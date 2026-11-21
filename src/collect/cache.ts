import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { addDays, daysBetween } from '../dates.ts';
import type { DayCounts, GitlabCache } from '../types.ts';

const CACHE_FILE = 'gitlab-days.json';
const PUSHED_WEEK_FILE = 'pushed-week';
const KEEP_DAYS = 400;

export function cacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.WEAVE_CACHE_DIR) return env.WEAVE_CACHE_DIR;
  const base = env.XDG_CACHE_HOME || join(env.HOME ?? homedir(), '.cache');
  return join(base, 'karsanda-weave');
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function readGitlabCache(dir: string): Promise<GitlabCache> {
  const raw = await readOptional(join(dir, CACHE_FILE));
  if (raw === null) return { fetchedAt: null, days: {} };
  const parsed = JSON.parse(raw) as GitlabCache;
  return { fetchedAt: parsed.fetchedAt ?? null, days: parsed.days ?? {} };
}

/** Fresh counts are authoritative for every day in [from, to]; other days are kept until they age out. */
export function mergeGitlabCache(
  cache: GitlabCache,
  fresh: DayCounts,
  from: string,
  to: string,
  fetchedAt: string,
): GitlabCache {
  const oldest = addDays(to, -KEEP_DAYS);
  const merged: Record<string, number> = {};
  for (const [day, n] of Object.entries(cache.days)) {
    if (day < oldest || (day >= from && day <= to)) continue;
    merged[day] = n;
  }
  for (const day of daysBetween(from, to)) {
    const n = fresh.get(day) ?? 0;
    if (n > 0) merged[day] = n;
  }
  const days = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { fetchedAt, days };
}

export async function writeGitlabCache(dir: string, cache: GitlabCache): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const target = join(dir, CACHE_FILE);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(cache, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, target);
}

export async function readPushedWeek(dir: string): Promise<string | null> {
  const raw = await readOptional(join(dir, PUSHED_WEEK_FILE));
  return raw === null ? null : raw.trim() || null;
}
