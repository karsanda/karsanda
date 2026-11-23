import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, isoWeek, jakartaClock, jakartaDay, windowStart } from '../src/dates.ts';

test('jakartaDay shifts UTC to UTC+7', () => {
  assert.equal(jakartaDay('2026-11-20T16:59:59Z'), '2026-11-20');
  assert.equal(jakartaDay('2026-11-20T17:00:00Z'), '2026-11-21');
});

test('jakartaClock gives Jakarta weekday and hour', () => {
  assert.deepEqual(jakartaClock('2026-11-27T10:00:00Z'), { day: '2026-11-27', weekday: 5, hour: 17 });
});

test('isoWeek matches date +%G-W%V, including 53-week years', () => {
  assert.equal(isoWeek('2026-11-21'), '2026-W47');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  assert.equal(isoWeek('2026-01-01'), '2026-W01');
});

test('windowStart is the Sunday 52 weeks before this week', () => {
  assert.equal(windowStart('2026-11-21'), '2025-11-16'); // Saturday: still the week of Sun 2026-11-15
  assert.equal(windowStart('2026-11-22'), '2025-11-23'); // Sunday starts a new week
  assert.equal(daysBetween(windowStart('2026-11-21'), '2026-11-21').length, 371); // Sun 2025-11-16 … Sat 2026-11-21
});

test('addDays crosses month and year', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});
