/**
 * Calendar helpers. All days are 'YYYY-MM-DD' strings in Asia/Jakarta time,
 * which is a fixed UTC+7 with no DST, so plain UTC arithmetic plus an offset
 * keeps results independent of the machine's timezone.
 */

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
function weekdayOf(day: string): number {
  return parseDay(day).getUTCDay() || 7;
}

export function jakartaDay(iso: string): string {
  return toDay(new Date(Date.parse(iso) + JAKARTA_OFFSET_MS));
}

export function jakartaClock(iso: string): { day: string; weekday: number; hour: number } {
  const shifted = new Date(Date.parse(iso) + JAKARTA_OFFSET_MS);
  const day = toDay(shifted);
  return { day, weekday: weekdayOf(day), hour: shifted.getUTCHours() };
}

export function addDays(day: string, n: number): string {
  return toDay(new Date(parseDay(day).getTime() + n * DAY_MS));
}

/** ISO-8601 week, formatted like `date +%G-W%V`. */
export function isoWeek(day: string): string {
  // The Thursday of a week decides which year the week belongs to.
  const thursday = addDays(day, 4 - weekdayOf(day));
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor((parseDay(thursday).getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Sunday of `today`'s Sunday-to-Saturday week, minus 52 weeks: the first day of the 53-week window. */
export function windowStart(today: string): string {
  return addDays(today, -(weekdayOf(today) % 7) - 52 * 7);
}

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
