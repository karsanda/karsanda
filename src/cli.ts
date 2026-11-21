/**
 * npm run weave                     render with fresh GitLab data (needs GITLAB_TOKEN + GITLAB_API_URL)
 * npm run weave -- --skip-gitlab    render from the cached GitLab counts
 * node src/cli.ts --scheduled       timer mode: exit 0 = publish, 10 = wait, 11 = already pushed, 1 = error
 *
 * This program never mints credentials: it only uses a GITLAB_TOKEN already in its environment.
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { cacheDir, mergeGitlabCache, readGitlabCache, readPushedWeek, writeGitlabCache } from './collect/cache.ts';
import { fetchGithubDays } from './collect/github.ts';
import { fetchGitlabDays } from './collect/gitlab.ts';
import { sumDays } from './collect/index.ts';
import { EGG_MESSAGE } from './content.ts';
import { addDays, jakartaDay, windowStart } from './dates.ts';
import { renderAll } from './render.ts';
import { decide, isStale } from './schedule.ts';
import type { GitlabResult } from './types.ts';

const EXIT = { publish: 0, error: 1, usage: 2, wait: 10, skip: 11 } as const;

const DEFAULT_TOKEN_HINT = 'Set GITLAB_TOKEN and GITLAB_API_URL first (or pass --skip-gitlab).';
const DEFAULT_STALE_HINT = 'GitLab data is over 14 days old: refresh your GitLab token and run npm run weave.';

async function gitlab(env: NodeJS.ProcessEnv, after: string): Promise<GitlabResult> {
  if (!env.GITLAB_TOKEN) return { ok: false, reason: 'no-token', detail: 'GITLAB_TOKEN is not set' };
  if (!env.GITLAB_API_URL) return { ok: false, reason: 'no-url', detail: 'GITLAB_API_URL is not set' };
  return fetchGitlabDays({ baseUrl: env.GITLAB_API_URL, token: env.GITLAB_TOKEN, after });
}

async function notify(env: NodeJS.ProcessEnv): Promise<void> {
  const message = env.WEAVE_STALE_HINT || DEFAULT_STALE_HINT;
  await promisify(execFile)(env.WEAVE_NOTIFY_CMD || 'notify-send', ['Songket profile', message]).catch(() => {});
  console.log(`stale: ${message}`);
}

export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const mode = argv.includes('--scheduled') ? 'scheduled' : argv.includes('--skip-gitlab') ? 'skip-gitlab' : 'manual';
  const now = env.WEAVE_NOW ?? new Date().toISOString();
  const today = jakartaDay(now);
  const from = windowStart(today);
  const dir = cacheDir(env);
  const pushedWeek = await readPushedWeek(dir);

  if (mode === 'scheduled' && decide({ now, pushedWeek, gitlabFetchedAt: null }) === 'skip') {
    console.log('already pushed this week');
    return EXIT.skip;
  }

  let cache = await readGitlabCache(dir);
  if (mode !== 'skip-gitlab') {
    const result = await gitlab(env, addDays(from, -1));
    if (result.ok) {
      cache = mergeGitlabCache(cache, result.days, from, today, now);
      await writeGitlabCache(dir, cache);
      console.log(`GitLab: ${result.days.size} active days`);
    } else if (mode === 'manual') {
      if (result.reason === 'no-token' || result.reason === 'no-url') {
        console.error(env.WEAVE_TOKEN_HINT || DEFAULT_TOKEN_HINT);
        return EXIT.usage;
      }
      console.error(`GitLab failed: ${result.reason} (${result.detail})`);
      return EXIT.error;
    } else {
      console.log(`GitLab skipped: ${result.reason} (${result.detail})`);
    }
  }

  let github;
  try {
    const fixture = env.WEAVE_GH_FIXTURE;
    github = await fetchGithubDays(from, today, fixture ? () => readFile(fixture, 'utf8') : undefined);
  } catch (err) {
    console.error(`GitHub failed: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    return EXIT.error;
  }

  const counts = sumDays(github, new Map(Object.entries(cache.days)));
  const written = await renderAll({ today, counts, message: EGG_MESSAGE, outDir: env.WEAVE_OUT_DIR || 'assets' });
  console.log(`rendered ${written.length} assets (${counts.size} active days)`);

  if (mode !== 'scheduled') return EXIT.publish;
  if (isStale(cache.fetchedAt, now)) await notify(env);
  const decision = decide({ now, pushedWeek, gitlabFetchedAt: cache.fetchedAt });
  console.log(`decision: ${decision}`);
  return decision === 'publish' ? EXIT.publish : EXIT.wait;
}

process.exitCode = await main(process.argv.slice(2), process.env);
