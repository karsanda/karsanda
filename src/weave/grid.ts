import { addDays, windowStart } from '../dates.ts';

export const WEEKS = 53;

/** 53 columns (weeks) × 7 rows (Sun..Sat, weekend on both edges) ending with today's week; days after today are null. */
export function buildGrid(today: string): (string | null)[][] {
  const start = windowStart(today);
  const columns: (string | null)[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const column: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      column.push(day <= today ? day : null);
    }
    columns.push(column);
  }
  return columns;
}
