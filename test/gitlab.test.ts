import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsToDays, fetchGitlabDays } from '../src/collect/gitlab.ts';

const BASE = 'https://gl.test/api/v4';

/** Fake fetch serving pages keyed by the `page` query param. */
function pages(byPage: Record<string, { body: unknown; next?: string | null }>, seen: Request[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push(req);
    const page = new URL(req.url).searchParams.get('page') ?? '1';
    const entry = byPage[page];
    const headers = new Headers({ 'content-type': 'application/json' });
    if (entry.next !== undefined && entry.next !== null) headers.set('x-next-page', entry.next);
    return new Response(JSON.stringify(entry.body), { status: 200, headers });
  }) as typeof fetch;
}

const status = (code: number): typeof fetch => (async () => new Response('nope', { status: code })) as typeof fetch;
const throws = (err: Error): typeof fetch => (async () => { throw err; }) as typeof fetch;

test('eventsToDays buckets by Jakarta day', () => {
  const d = eventsToDays([
    { created_at: '2026-11-20T16:30:00Z' },
    { created_at: '2026-11-20T17:30:00Z' },
    { created_at: '2026-11-21T01:00:00Z' },
  ]);
  assert.deepEqual([...d], [['2026-11-20', 1], ['2026-11-21', 2]]);
});

test('follows x-next-page until the header is missing', async () => {
  const seen: Request[] = [];
  const fetchFn = pages({
    '1': { body: [{ created_at: '2026-11-01T03:00:00Z' }], next: '2' },
    '2': { body: [{ created_at: '2026-11-02T03:00:00Z' }], next: '3' },
    '3': { body: [{ created_at: '2026-11-02T04:00:00Z' }] },
  }, seen);
  const r = await fetchGitlabDays({ baseUrl: BASE, token: 't', after: '2025-11-16', fetchFn });
  assert.equal(seen.length, 3);
  assert.ok(r.ok);
  assert.deepEqual([...r.days], [['2026-11-01', 1], ['2026-11-02', 2]]);
});

test('stops when x-next-page is an empty string', async () => {
  const seen: Request[] = [];
  const fetchFn = pages({
    '1': { body: [{ created_at: '2026-11-01T03:00:00Z' }], next: '2' },
    '2': { body: [{ created_at: '2026-11-02T03:00:00Z' }], next: '' },
  }, seen);
  const r = await fetchGitlabDays({ baseUrl: BASE, token: 't', after: '2025-11-16', fetchFn });
  assert.equal(seen.length, 2);
  assert.ok(r.ok);
});

test('requests own events after the given day, 100 per page, oldest first', async () => {
  const seen: Request[] = [];
  await fetchGitlabDays({ baseUrl: BASE, token: 't', after: '2025-11-16', fetchFn: pages({ '1': { body: [] } }, seen) });
  const url = new URL(seen[0].url);
  assert.equal(url.origin + url.pathname, `${BASE}/events`);
  assert.equal(url.searchParams.get('after'), '2025-11-16');
  assert.equal(url.searchParams.get('per_page'), '100');
  assert.equal(url.searchParams.get('sort'), 'asc');
  assert.equal(url.searchParams.get('page'), '1');
});

test('401 → unauthorized, 403 → unreachable, thrown TypeError → unreachable', async () => {
  const run = (fetchFn: typeof fetch) => fetchGitlabDays({ baseUrl: BASE, token: 't', after: '2025-11-16', fetchFn });
  const r401 = await run(status(401));
  const r403 = await run(status(403));
  const rNet = await run(throws(new TypeError('fetch failed')));
  assert.equal(!r401.ok && r401.reason, 'unauthorized');
  assert.equal(!r403.ok && r403.reason, 'unreachable');
  assert.equal(!rNet.ok && rNet.reason, 'unreachable');
});

test('no error detail or message contains the token', async () => {
  const token = 'fake-token-SECRET-123';
  const failures = [
    status(401),
    status(403),
    status(502),
    throws(new TypeError(`fetch failed for ${token}`)),
    throws(new DOMException('The operation timed out.', 'TimeoutError')),
  ];
  for (const fetchFn of failures) {
    const r = await fetchGitlabDays({ baseUrl: BASE, token, after: '2025-11-16', fetchFn });
    assert.equal(r.ok, false);
    assert.ok(!JSON.stringify(r).includes(token), JSON.stringify(r));
  }
});

test('sends the token only as the PRIVATE-TOKEN header, never in the URL', async () => {
  const seen: Request[] = [];
  const token = 'fake-token-SECRET-123';
  await fetchGitlabDays({ baseUrl: BASE, token, after: '2025-11-16', fetchFn: pages({ '1': { body: [] } }, seen) });
  assert.equal(seen[0].headers.get('PRIVATE-TOKEN'), token);
  assert.ok(!seen[0].url.includes(token));
});

test('never follows a redirect, so the token cannot leak to another server', async () => {
  const { createServer } = await import('node:http');
  const received: (string | undefined)[] = [];
  const thief = createServer((req, res) => { received.push(req.headers['private-token'] as string | undefined); res.end('[]'); });
  await new Promise<void>((r) => thief.listen(0, '127.0.0.1', r));
  const thiefPort = (thief.address() as { port: number }).port;
  const gitlab = createServer((_req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${thiefPort}/steal` }); res.end(); });
  await new Promise<void>((r) => gitlab.listen(0, '127.0.0.1', r));
  const gitlabPort = (gitlab.address() as { port: number }).port;
  try {
    const r = await fetchGitlabDays({ baseUrl: `http://127.0.0.1:${gitlabPort}/api/v4`, token: 'fake-token-SECRET-123', after: '2025-11-16' });
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, 'unreachable');
    assert.deepEqual(received, []);
  } finally {
    thief.close();
    gitlab.close();
  }
});
