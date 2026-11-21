import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, isStale } from '../src/schedule.ts';

// Jakarta = UTC+7. 2026-11-23 is a Monday (ISO week 2026-W48).
test('skip when already pushed this week', () =>
  assert.equal(decide({ now: '2026-11-23T03:00:00Z', pushedWeek: '2026-W48', gitlabFetchedAt: null }), 'skip'));

test('publish when GitLab was fetched this week', () =>
  assert.equal(decide({ now: '2026-11-24T03:00:00Z', pushedWeek: '2026-W47', gitlabFetchedAt: '2026-11-23T02:00:00Z' }), 'publish'));

test('wait on Thursday without fresh GitLab', () =>
  assert.equal(decide({ now: '2026-11-26T03:00:00Z', pushedWeek: '2026-W47', gitlabFetchedAt: '2026-11-16T02:00:00Z' }), 'wait'));

test('Friday 17:00 WIB fallback publishes; 16:59 waits', () => {
  assert.equal(decide({ now: '2026-11-27T10:00:00Z', pushedWeek: null, gitlabFetchedAt: null }), 'publish');
  assert.equal(decide({ now: '2026-11-27T09:59:00Z', pushedWeek: null, gitlabFetchedAt: null }), 'wait');
});

test('weekend catch-up publishes', () =>
  assert.equal(decide({ now: '2026-11-28T03:00:00Z', pushedWeek: '2026-W47', gitlabFetchedAt: null }), 'publish'));

test('a GitLab fetch late Sunday UTC counts for the Jakarta Monday week', () =>
  // 2026-11-22T18:00Z is Monday 01:00 WIB → week 48
  assert.equal(decide({ now: '2026-11-23T03:00:00Z', pushedWeek: '2026-W47', gitlabFetchedAt: '2026-11-22T18:00:00Z' }), 'publish'));

test('stale after 14 days or never fetched', () => {
  assert.equal(isStale(null, '2026-11-21T00:00:00Z'), true);
  assert.equal(isStale('2026-11-06T00:00:00Z', '2026-11-21T00:00:00Z'), true);
  assert.equal(isStale('2026-11-08T00:00:00Z', '2026-11-21T00:00:00Z'), false);
});
