import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWoven } from '../src/weave/woven.ts';
import { decodeBorder } from '../src/weave/egg.ts';
import { daysBetween } from '../src/dates.ts';
import { assertHygienic } from './helpers/hygiene.ts';

const today = '2026-11-21';
const counts = new Map([['2026-11-20', 5], ['2026-11-21', 1], ['2025-11-17', 2]]);
const uses = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

test('one float per non-future day; active days use #f1–#f4', () => {
  const svg = renderWoven({ today, counts, theme: 'dark', message: 'hi' });
  assert.equal(uses(svg, /href="#f[0-4]"/g), 370); // 371 window days minus Sun 2026-11-22
  assert.equal(uses(svg, /href="#f[1-4]"/g), 3);
});

test('title carries the active days and contributions in the window', () => {
  const svg = renderWoven({ today, counts: new Map([...counts, ['2026-11-19', 6605]]), theme: 'dark', message: '' });
  assert.match(svg, /<title>My year, woven: 4 active days · 6,613 contributions · GitHub \+ GitLab<\/title>/);
});

test('days outside the window neither render nor skew the levels or totals', () => {
  const withOld = new Map([...counts, ['2024-01-01', 999]]);
  assert.equal(
    renderWoven({ today, counts: withOld, theme: 'dark', message: 'hi' }),
    renderWoven({ today, counts, theme: 'dark', message: 'hi' }),
  );
});

test('the rebung group decodes back to the message', () => {
  const svg = renderWoven({ today, counts, theme: 'light', message: 'halo, dunia!' });
  const group = svg.match(/<g id="rebung">([\s\S]*?)<\/g>/)![1];
  const bits = [...group.matchAll(/href="#(up|down)"/g)].map((m) => (m[1] === 'up' ? 1 : 0) as 0 | 1);
  assert.equal(decodeBorder(bits), 'halo, dunia!');
});

test('transparent background: no full-size backdrop rect', () => {
  const svg = renderWoven({ today, counts, theme: 'dark', message: '' });
  assert.ok(!/<rect[^>]*width="1200"/.test(svg));
});

test('a scan beam, masked to the field, stops under reduced motion', () => {
  const svg = renderWoven({ today, counts, theme: 'dark', message: '' });
  assert.match(svg, /<mask id="thread"[^>]*><use href="#field"\/><\/mask>/);
  assert.match(svg, /<g mask="url\(#thread\)"><rect class="scan"/); // mask on a static group, so it does not slide with the beam
  assert.match(svg, /animation:\s*scan 6s linear infinite/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.scan\s*\{\s*animation:\s*none;\s*opacity:\s*0/);
});

test('only the two busiest levels glow', () => {
  const svg = renderWoven({ today, counts, theme: 'dark', message: '' });
  assert.match(svg, /<filter id="glow"/);
  for (const level of [3, 4]) assert.match(svg, new RegExp(`<path id="f${level}"[^>]*filter="url\\(#glow\\)"`));
  for (const level of [0, 1, 2]) assert.doesNotMatch(svg, new RegExp(`<path id="f${level}"[^>]*filter=`));
});

test('HUD: four corner brackets and one tick per month start', () => {
  const svg = renderWoven({ today, counts, theme: 'dark', message: '' });
  const group = (id: string) => (svg.match(new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`)) ?? ['', ''])[1];
  assert.equal((group('hud').match(/<path /g) ?? []).length, 4);
  assert.equal((group('months').match(/<path /g) ?? []).length, 12); // Dec 2025 … Nov 2026
});

test('hygienic, deterministic, themes differ', () => {
  const dark = renderWoven({ today, counts, theme: 'dark', message: 'hi' });
  const light = renderWoven({ today, counts, theme: 'light', message: 'hi' });
  assertHygienic(dark);
  assertHygienic(light);
  assert.equal(dark, renderWoven({ today, counts, theme: 'dark', message: 'hi' }));
  assert.notEqual(dark, light);
});

test('an empty year still renders a full base weave', () => {
  const svg = renderWoven({ today, counts: new Map(), theme: 'dark', message: '' });
  assertHygienic(svg);
  assert.equal(uses(svg, /href="#f0"/g), 370);
  assert.match(svg, /0 active days · 0 contributions/);
});

test('a dense year stays under 200 KB', () => {
  const dense = new Map(daysBetween('2025-11-17', today).map((d, i) => [d, 1 + (i % 10)]));
  assertHygienic(renderWoven({ today, counts: dense, theme: 'light', message: 'halo, dunia!' }));
});
