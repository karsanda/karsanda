import { isoWeek, jakartaClock, jakartaDay } from './dates.ts';

const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const FRIDAY = 5;
const FALLBACK_HOUR = 17;

/**
 * At most one push per ISO week (Jakarta time): publish as soon as this week's
 * GitLab data is in; otherwise fall back on Friday 17:00 WIB (or the weekend,
 * when a missed Friday run is caught up). A machine that has never fetched
 * GitLab never falls back: its banner would drop a year of GitLab activity.
 */
export function decide(opts: { now: string; pushedWeek: string | null; gitlabFetchedAt: string | null }): 'skip' | 'publish' | 'wait' {
  const clock = jakartaClock(opts.now);
  const week = isoWeek(clock.day);
  if (opts.pushedWeek === week) return 'skip';
  if (!opts.gitlabFetchedAt) return 'wait';
  if (isoWeek(jakartaDay(opts.gitlabFetchedAt)) === week) return 'publish';
  if (clock.weekday > FRIDAY || (clock.weekday === FRIDAY && clock.hour >= FALLBACK_HOUR)) return 'publish';
  return 'wait';
}

export function isStale(fetchedAt: string | null, now: string): boolean {
  return fetchedAt === null || Date.parse(now) - Date.parse(fetchedAt) > STALE_MS;
}
