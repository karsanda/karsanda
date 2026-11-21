import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isoWeek, jakartaDay } from '../src/dates.ts';

const ME = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];

function setup({ withRemote = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'weave-publish-'));
  const work = join(root, 'work');
  const remote = join(root, 'remote.git');
  const env0 = { ...process.env, HOME: root, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: work, env: env0 }).toString().trim();
  const remoteGit = (...args: string[]) => execFileSync('git', ['--git-dir', remote, ...args], { env: env0 }).toString().trim();

  mkdirSync(join(work, 'scripts'), { recursive: true });
  mkdirSync(join(work, 'assets'));
  copyFileSync('scripts/publish.sh', join(work, 'scripts/publish.sh'));
  copyFileSync('scripts/privacy-check.sh', join(work, 'scripts/privacy-check.sh'));
  writeFileSync(join(work, 'assets/x.svg'), 'v0\n');
  writeFileSync(join(work, 'README.md'), 'published readme\n');
  writeFileSync(join(work, '.gitignore'), 'local/\n');
  git('init', '-q', '-b', 'main');
  git(...ME, 'add', '.');
  git(...ME, 'commit', '-q', '-m', 'init');
  if (withRemote) {
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
    git('remote', 'add', 'origin', remote);
    git('push', '-q', 'origin', 'main');
  }

  // Stand-in for `node src/cli.ts --scheduled`: optionally renders into WEAVE_OUT_DIR, then exits with STUB_CODE.
  const stub = join(root, 'stub.sh');
  writeFileSync(stub, [
    '#!/usr/bin/env bash',
    'mkdir -p "$WEAVE_OUT_DIR"',
    '[ "${STUB_CHANGE:-0}" = 1 ] && echo "${STUB_CONTENT:-$(date +%s%N)}" > "$WEAVE_OUT_DIR/x.svg"',
    '[ -n "${STUB_NEEDS_TOKEN:-}" ] && { [ -n "${GITLAB_TOKEN:-}" ] || exit 10; }',
    'exit "${STUB_CODE:-0}"',
  ].join('\n'));
  chmodSync(stub, 0o755);

  const cache = join(root, 'cache');
  const env = { PATH: process.env.PATH!, HOME: root, GIT_CONFIG_NOSYSTEM: '1', WEAVE_CLI: stub, WEAVE_CACHE_DIR: cache };
  const run = (extra: Record<string, string> = {}) => {
    const r = spawnSync('bash', ['scripts/publish.sh'], { cwd: work, env: { ...env, ...extra } });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const stamp = () => (existsSync(join(cache, 'pushed-week')) ? readFileSync(join(cache, 'pushed-week'), 'utf8').trim() : null);
  const remoteCount = () => (withRemote ? remoteGit('rev-list', '--count', 'main') : '0');
  return { root, work, git, remoteGit, run, stamp, remoteCount };
}

const thisWeek = () => isoWeek(jakartaDay(new Date().toISOString()));

test('exit 0 + change → one assets-only commit by songket-weaver on origin/main, stamp written', () => {
  const { git, remoteGit, run, stamp } = setup();
  const before = git('rev-parse', 'HEAD');
  const r = run({ STUB_CHANGE: '1' });
  assert.equal(r.code, 0, r.out);
  assert.equal(remoteGit('log', '-1', '--format=%an <%ae>|%cn <%ce>|%B', 'main'),
    `songket-weaver <songket-weaver@karsanda.invalid>|songket-weaver <songket-weaver@karsanda.invalid>|weave: ${thisWeek()}`);
  assert.equal(remoteGit('show', '--name-only', '--format=', 'main'), 'assets/x.svg');
  assert.equal(git('rev-parse', 'HEAD'), before, 'your own checkout is untouched');
  assert.equal(stamp(), thisWeek());
});

test('exit 0 + no change → nothing pushed, stamp written', () => {
  const { run, stamp, remoteCount } = setup();
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.equal(remoteCount(), '1');
  assert.equal(stamp(), thisWeek());
});

for (const [code, message] of [['10', 'waiting for GitLab data'], ['11', 'already pushed this week']]) {
  test(`exit ${code} → exit 0, "${message}", nothing pushed, no stamp`, () => {
    const { run, stamp, remoteCount } = setup();
    const r = run({ STUB_CODE: code, STUB_CHANGE: '1' });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, new RegExp(message));
    assert.equal(remoteCount(), '1');
    assert.equal(stamp(), null);
  });
}

test('a CLI error propagates its exit code', () => {
  const { run, stamp } = setup();
  assert.equal(run({ STUB_CODE: '1' }).code, 1);
  assert.equal(stamp(), null);
});

test('no origin remote → exit 0, "no remote", no stamp', () => {
  const { run, stamp } = setup({ withRemote: false });
  const r = run({ STUB_CHANGE: '1' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /no remote/);
  assert.equal(stamp(), null);
});

test('a staged draft in your checkout is never published', () => {
  const { work, git, remoteGit, run } = setup();
  writeFileSync(join(work, 'README.md'), 'DRAFT, not for publishing\n');
  git('add', 'README.md');
  const r = run({ STUB_CHANGE: '1' });
  assert.equal(r.code, 0, r.out);
  assert.equal(remoteGit('show', 'main:README.md'), 'published readme');
});

test('unstaged edits in your checkout do not break the run', () => {
  const { work, run, remoteCount } = setup();
  writeFileSync(join(work, 'README.md'), 'work in progress\n');
  const r = run({ STUB_CHANGE: '1' });
  assert.equal(r.code, 0, r.out);
  assert.equal(remoteCount(), '2');
});

test('an unpushed local commit is never pushed', () => {
  const { work, git, remoteGit, run } = setup();
  writeFileSync(join(work, 'notes.md'), 'local only\n');
  git(...ME, 'add', 'notes.md');
  git(...ME, 'commit', '-q', '-m', 'local only');
  const r = run({ STUB_CHANGE: '1' });
  assert.equal(r.code, 0, r.out);
  assert.ok(!remoteGit('ls-tree', '--name-only', 'main').split('\n').includes('notes.md'));
});

test('a forbidden string in the rendered assets blocks the push', () => {
  const { work, run, stamp, remoteCount } = setup();
  mkdirSync(join(work, 'local'));
  writeFileSync(join(work, 'local/forbidden.txt'), 'secret-host.example\n');
  const r = run({ STUB_CHANGE: '1', STUB_CONTENT: '<svg>secret-host.example</svg>' });
  assert.equal(r.code, 1, r.out);
  assert.equal(remoteCount(), '1');
  assert.equal(stamp(), null);
});

test('the scratch worktree is cleaned up afterwards', () => {
  const { git, run } = setup();
  run({ STUB_CHANGE: '1' });
  assert.equal(git('worktree', 'list').split('\n').length, 1);
});

test('hook is sourced when GITLAB_TOKEN is empty, with pipefail off', () => {
  const { root, run, stamp } = setup();
  const hook = join(root, 'hook.sh');
  const opts = join(root, 'hook-opts');
  writeFileSync(hook, `set -o | grep -E '^(pipefail|errexit|nounset)' > ${opts}\nGITLAB_TOKEN=from-hook\n`);
  const r = run({ WEAVE_CREDENTIAL_HOOK: hook, STUB_NEEDS_TOKEN: '1' });
  assert.equal(r.code, 0, r.out);
  assert.equal(stamp(), thisWeek());
  assert.ok(!r.out.includes('from-hook'));
  assert.deepEqual(readFileSync(opts, 'utf8').trim().split('\n').map((l) => l.split(/\s+/)[1]), ['off', 'off', 'off']);
});

test('hook is not sourced when GITLAB_TOKEN is already set', () => {
  const { root, run } = setup();
  const marker = join(root, 'sourced');
  const hook = join(root, 'hook.sh');
  writeFileSync(hook, `touch ${marker}\n`);
  run({ WEAVE_CREDENTIAL_HOOK: hook, GITLAB_TOKEN: 'preset' });
  assert.equal(existsSync(marker), false);
});

test('git never sees the token', () => {
  const { work, root, run } = setup();
  const seen = join(root, 'seen-by-git');
  const hook = join(work, '.git/hooks/pre-commit');
  writeFileSync(hook, `#!/usr/bin/env bash\necho "\${GITLAB_TOKEN:-none}" > ${seen}\n`);
  chmodSync(hook, 0o755);
  const r = run({ STUB_CHANGE: '1', GITLAB_TOKEN: 'fake-token-SECRET-123' });
  assert.equal(r.code, 0, r.out);
  assert.equal(readFileSync(seen, 'utf8').trim(), 'none');
});
