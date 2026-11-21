import { jakartaDay } from '../dates.ts';
import type { DayCounts, GitlabResult } from '../types.ts';

const MAX_PAGES = 1000;

export function eventsToDays(events: { created_at: string }[]): DayCounts {
  const days: DayCounts = new Map();
  for (const e of events) {
    const day = jakartaDay(e.created_at);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  return days;
}

/**
 * Counts the token owner's own GitLab events per Jakarta day.
 * Read-only GETs; the token travels only in the PRIVATE-TOKEN header and never
 * appears in a returned detail (details carry status codes / error names only).
 */
export async function fetchGitlabDays(opts: {
  baseUrl: string;
  token: string;
  after: string;
  fetchFn?: typeof fetch;
}): Promise<GitlabResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const events: { created_at: string }[] = [];
  let page = '1';

  for (let n = 0; page && n < MAX_PAGES; n++) {
    const url = new URL(`${opts.baseUrl.replace(/\/+$/, '')}/events`);
    url.searchParams.set('after', opts.after);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('sort', 'asc');
    url.searchParams.set('page', page);

    let res: Response;
    try {
      res = await fetchFn(url, {
        headers: { 'PRIVATE-TOKEN': opts.token },
        // fetch strips only Authorization on cross-origin redirects, not custom headers:
        // never follow one, or the token could reach an SSO proxy or another host.
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      return { ok: false, reason: 'unreachable', detail: err instanceof Error ? err.name : 'Error' };
    }
    if (res.status === 401) return { ok: false, reason: 'unauthorized', detail: 'HTTP 401' };
    if (!res.ok) return { ok: false, reason: 'unreachable', detail: `HTTP ${res.status}` };

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, reason: 'unreachable', detail: 'invalid JSON' };
    }
    if (!Array.isArray(body)) return { ok: false, reason: 'unreachable', detail: 'unexpected response' };
    events.push(...(body as { created_at: string }[]));

    const next = res.headers.get('x-next-page') ?? '';
    page = next !== page ? next : '';
  }
  return { ok: true, days: eventsToDays(events) };
}
