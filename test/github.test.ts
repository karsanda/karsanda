import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchGithubDays, parseGithubCalendar } from '../src/collect/github.ts';
import { sumDays } from '../src/collect/index.ts';

function calendar(days: [string, number][]): string {
  return JSON.stringify({
    data: { viewer: { contributionsCollection: { contributionCalendar: {
      weeks: [{ contributionDays: days.map(([date, contributionCount]) => ({ date, contributionCount })) }],
    } } } },
  });
}
const EMPTY_CALENDAR = calendar([]);

test('parses the calendar and drops zero days', () => {
  const d = parseGithubCalendar(calendar([['2026-11-01', 2], ['2026-11-02', 0], ['2026-11-03', 5]]));
  assert.deepEqual([...d], [['2026-11-01', 2], ['2026-11-03', 5]]);
});

test('splits a 371-day window into two calls of ≤365 days', async () => {
  const calls: string[][] = [];
  await fetchGithubDays('2025-11-17', '2026-11-22', async (a) => { calls.push(a); return EMPTY_CALENDAR; });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('from=2025-11-17T00:00:00+07:00'));
  assert.ok(calls[0].includes('to=2026-11-16T23:59:59+07:00'));
  assert.ok(calls[1].includes('from=2026-11-17T00:00:00+07:00'));
  assert.ok(calls[1].includes('to=2026-11-22T23:59:59+07:00'));
  assert.deepEqual(calls[0].slice(0, 2), ['api', 'graphql']);
});

test('days outside a chunk are ignored, so a padded calendar never double-counts', async () => {
  // GitHub pads calendars to whole weeks; the same day may come back in both chunks.
  const padded = calendar([['2026-11-16', 3], ['2026-11-17', 4]]);
  const d = await fetchGithubDays('2025-11-17', '2026-11-22', async () => padded);
  assert.deepEqual([...d].sort(), [['2026-11-16', 3], ['2026-11-17', 4]]);
});

test('a failing gh call rejects (no silent empty year)', async () => {
  await assert.rejects(fetchGithubDays('2026-01-01', '2026-01-31', async () => { throw new Error('gh: not logged in'); }));
});

test('sumDays adds per day across sources', () => {
  const s = sumDays(new Map([['a', 1], ['b', 2]]), new Map([['b', 3]]));
  assert.deepEqual([...s].sort(), [['a', 1], ['b', 5]]);
});
