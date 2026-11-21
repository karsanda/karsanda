import type { DayCounts, Level } from '../types.ts';

/** GitHub-style intensity: quartiles of the non-zero days; zero days stay level 0. */
export function toLevels(counts: DayCounts): Map<string, Level> {
  const nonZero = [...counts.values()].filter((n) => n > 0).sort((a, b) => a - b);
  const at = (p: number) => nonZero[Math.floor(p * (nonZero.length - 1))];
  const [t1, t2, t3] = [at(0.25), at(0.5), at(0.75)];

  const levels = new Map<string, Level>();
  for (const [day, n] of counts) {
    levels.set(day, n <= 0 ? 0 : n <= t1 ? 1 : n <= t2 ? 2 : n <= t3 ? 3 : 4);
  }
  return levels;
}
