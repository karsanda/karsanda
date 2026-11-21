import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('privacy-check flags a forbidden string in a committed or untracked file', () => {
  const root = mkdtempSync(join(tmpdir(), 'weave-privacy-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'local'));
  copyFileSync('scripts/privacy-check.sh', join(root, 'scripts/privacy-check.sh'));
  writeFileSync(join(root, '.gitignore'), 'local/\n');
  writeFileSync(join(root, 'local/forbidden.txt'), '# comment\nsecret-host.example\n');
  writeFileSync(join(root, 'README.md'), 'hello\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  const check = () => spawnSync('bash', ['scripts/privacy-check.sh'], { cwd: root });

  assert.equal(check().status, 0);
  writeFileSync(join(root, 'notes.md'), 'see https://SECRET-HOST.example/x\n');
  const r = check();
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}`, /notes\.md/);
});

test('committed files contain no forbidden strings', { skip: !existsSync('local/forbidden.txt') }, () => {
  const r = spawnSync('bash', ['scripts/privacy-check.sh']);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
});

function repoWithCheck() {
  const root = mkdtempSync(join(tmpdir(), 'weave-privacy-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'local'));
  copyFileSync('scripts/privacy-check.sh', join(root, 'scripts/privacy-check.sh'));
  writeFileSync(join(root, '.gitignore'), 'local/\n');
  writeFileSync(join(root, 'local/forbidden.txt'), 'secret-host.example\n');
  const git = (...a: string[]) => execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', ...a], { cwd: root });
  git('init', '-q');
  return { root, git, check: (...args: string[]) => spawnSync('bash', ['scripts/privacy-check.sh', ...args], { cwd: root }) };
}

test('--history finds a forbidden string that only survives in an old commit', () => {
  const { root, git, check } = repoWithCheck();
  writeFileSync(join(root, 'old.md'), 'internal: secret-host.example\n');
  git('add', '-A'); git('commit', '-q', '-m', 'oops');
  rmSync(join(root, 'old.md'));
  git('add', '-A'); git('commit', '-q', '-m', 'clean up');
  assert.equal(check().status, 0, 'the tip is clean');
  const r = check('--history');
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}`, /history/);
});

test('--history also checks author emails and commit messages', () => {
  const { root, check } = repoWithCheck();
  writeFileSync(join(root, 'a.md'), 'fine\n');
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=me@secret-host.example', 'add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=me@secret-host.example', 'commit', '-q', '-m', 'hello'], { cwd: root });
  assert.equal(check('--history').status, 1);
});

test('scans another directory with this repo\'s forbidden list', () => {
  const { check } = repoWithCheck();
  const other = mkdtempSync(join(tmpdir(), 'weave-other-'));
  execFileSync('git', ['init', '-q'], { cwd: other });
  writeFileSync(join(other, 'woven.svg'), '<svg>secret-host.example</svg>\n');
  assert.equal(check(other).status, 1);
});
