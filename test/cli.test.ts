import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TUESDAY = '2026-11-24T03:00:00Z'; // Tue 10:00 WIB, ISO week 2026-W48

const CALENDAR = JSON.stringify({ data: { viewer: { contributionsCollection: { contributionCalendar: {
  weeks: [{ contributionDays: [{ date: '2026-11-20', contributionCount: 3 }] }],
} } } } });

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'weave-cli-'));
  const fixture = join(root, 'calendar.json');
  await writeFile(fixture, CALENDAR);
  const notifyLog = join(root, 'notify.log');
  const notify = join(root, 'notify.sh');
  await writeFile(notify, `#!/bin/sh\necho "$@" >> ${notifyLog}\n`);
  await chmod(notify, 0o755);
  const env = {
    PATH: process.env.PATH,
    HOME: root,
    WEAVE_CACHE_DIR: join(root, 'cache'),
    WEAVE_OUT_DIR: join(root, 'out'),
    WEAVE_GH_FIXTURE: fixture,
    WEAVE_NOW: TUESDAY,
    WEAVE_NOTIFY_CMD: notify,
  };
  return { root, env, notifyLog };
}

function run(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile('node', ['src/cli.ts', ...args], { env }, (err, stdout, stderr) =>
      resolve({ code: err ? Number((err as { code?: number }).code ?? 1) : 0, out: stdout + stderr }));
  });
}

const svgs = async (dir: string) => (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.svg'));

test('manual without token exits 2 with the hint', async () => {
  const { env } = await setup();
  const r = await run([], env);
  assert.equal(r.code, 2);
  assert.match(r.out, /Set GITLAB_TOKEN and GITLAB_API_URL first/);
});

test('--skip-gitlab renders the woven year in both themes into WEAVE_OUT_DIR', async () => {
  const { env } = await setup();
  const r = await run(['--skip-gitlab'], env);
  assert.equal(r.code, 0, r.out);
  const files = await svgs(env.WEAVE_OUT_DIR);
  assert.deepEqual(files.sort(), ['woven-dark.svg', 'woven-light.svg']);
});

test('--scheduled with pushed-week = this week exits 11 and renders nothing', async () => {
  const { env } = await setup();
  const { mkdir } = await import('node:fs/promises');
  await mkdir(env.WEAVE_CACHE_DIR, { recursive: true });
  await writeFile(join(env.WEAVE_CACHE_DIR, 'pushed-week'), '2026-W48\n');
  const r = await run(['--scheduled'], env);
  assert.equal(r.code, 11);
  assert.equal((await svgs(env.WEAVE_OUT_DIR)).length, 0);
});

test('--scheduled with an unreadable gh fixture exits 1 and logs "GitHub failed"', async () => {
  const { env, root } = await setup();
  const r = await run(['--scheduled'], { ...env, WEAVE_GH_FIXTURE: join(root, 'missing.json') });
  assert.equal(r.code, 1);
  assert.match(r.out, /GitHub failed/);
  assert.equal((await svgs(env.WEAVE_OUT_DIR)).length, 0);
});

test('--scheduled midweek without GitLab renders, alerts stale, exits 10', async () => {
  const { env, notifyLog } = await setup();
  const r = await run(['--scheduled'], env);
  assert.equal(r.code, 10, r.out);
  assert.match(r.out, /GitLab skipped: no-token/);
  assert.equal((await svgs(env.WEAVE_OUT_DIR)).length, 2);
  assert.match(await readFile(notifyLog, 'utf8'), /Songket profile/);
});
