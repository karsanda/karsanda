import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid } from '../src/weave/grid.ts';
import { toLevels } from '../src/weave/levels.ts';

test('grid is 53×7, starts on windowStart, nulls future days', () => {
  const g = buildGrid('2026-11-21'); // a Saturday
  assert.equal(g.length, 53);
  assert.ok(g.every((c) => c.length === 7));
  assert.equal(g[0][0], '2025-11-17');
  assert.equal(g[52][5], '2026-11-21');
  assert.equal(g[52][6], null);
});

test('levels by quartiles of non-zero days, in input order', () => {
  const counts = new Map([1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => [`2026-01-0${i + 1}`, n]));
  assert.deepEqual([...toLevels(counts).values()], [1, 1, 2, 2, 3, 3, 4, 4]);
});

test('empty or all-zero input → no levels above 0, no throw', () => {
  assert.equal(toLevels(new Map()).size, 0);
  assert.deepEqual([...toLevels(new Map([['2026-01-01', 0]])).values()], [0]);
});
