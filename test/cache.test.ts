import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheDir, mergeGitlabCache, readGitlabCache, readPushedWeek, writeGitlabCache } from '../src/collect/cache.ts';

test('merge overwrites the fetched range, zeroes absent days, prunes days >400 days old', () => {
  const cache = { fetchedAt: null, days: { '2025-01-05': 3, '2026-11-01': 9, '2026-11-02': 4 } };
  const out = mergeGitlabCache(cache, new Map([['2026-11-02', 1]]), '2026-11-01', '2026-11-21', '2026-11-21T04:00:00Z');
  assert.deepEqual(out.days, { '2026-11-02': 1 });
  assert.equal(out.fetchedAt, '2026-11-21T04:00:00Z');
});

test('merge keeps days outside the fetched range', () => {
  const cache = { fetchedAt: null, days: { '2026-10-01': 7 } };
  const out = mergeGitlabCache(cache, new Map([['2026-11-05', 2]]), '2026-11-01', '2026-11-21', '2026-11-21T04:00:00Z');
  assert.deepEqual(out.days, { '2026-10-01': 7, '2026-11-05': 2 });
});

test('read/write round-trips; a missing file reads as an empty cache', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'weave-')), 'nested');
  assert.deepEqual(await readGitlabCache(dir), { fetchedAt: null, days: {} });
  const cache = { fetchedAt: '2026-11-21T04:00:00Z', days: { '2026-11-02': 1 } };
  await writeGitlabCache(dir, cache);
  assert.deepEqual(await readGitlabCache(dir), cache);
  assert.equal((await stat(dir)).mode & 0o777, 0o700);
});

test('readPushedWeek returns null when absent and the trimmed week when present', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'weave-'));
  assert.equal(await readPushedWeek(dir), null);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(dir, 'pushed-week'), '2026-W47\n');
  assert.equal(await readPushedWeek(dir), '2026-W47');
});

test('cacheDir honours WEAVE_CACHE_DIR, then XDG_CACHE_HOME, then HOME', () => {
  assert.equal(cacheDir({ WEAVE_CACHE_DIR: '/x' }), '/x');
  assert.equal(cacheDir({ XDG_CACHE_HOME: '/c', HOME: '/h' }), '/c/karsanda-weave');
  assert.equal(cacheDir({ HOME: '/h' }), '/h/.cache/karsanda-weave');
});
