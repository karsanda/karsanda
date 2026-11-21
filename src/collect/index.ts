import type { DayCounts } from '../types.ts';

export function sumDays(...sources: DayCounts[]): DayCounts {
  const total: DayCounts = new Map();
  for (const source of sources) {
    for (const [day, n] of source) total.set(day, (total.get(day) ?? 0) + n);
  }
  return total;
}
