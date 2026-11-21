export type Theme = 'dark' | 'light';

/** 'YYYY-MM-DD' (Asia/Jakarta) → contribution count */
export type DayCounts = Map<string, number>;

export type Level = 0 | 1 | 2 | 3 | 4;

export interface GitlabCache {
  fetchedAt: string | null;
  days: Record<string, number>;
}

export type GitlabResult =
  | { ok: true; days: DayCounts }
  | { ok: false; reason: 'no-token' | 'no-url' | 'unauthorized' | 'unreachable'; detail: string };
