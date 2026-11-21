import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textPath, textWidth } from '../src/weave/text.ts';
import { svgDoc } from '../src/weave/svg.ts';
import { assertHygienic } from './helpers/hygiene.ts';

const firstMoveX = (p: string) => Number(p.match(/d="M(-?[\d.]+)/)![1]);

test('textPath returns a single path and no <text>', () => {
  const p = textPath('249 active days', { font: 'mono', size: 15, x: 30, y: 236, fill: '#fff' });
  assert.match(p, /^<path d="M[^"]+" fill="#fff"\/>$/);
  assert.ok(!p.includes('NaN'));
});

test('anchor middle shifts the text left by half its width', () => {
  const w = textWidth('abc', 'mono', 20);
  assert.ok(w > 0);
  const start = textPath('abc', { font: 'mono', size: 20, x: 100, y: 50, fill: '#000' });
  const middle = textPath('abc', { font: 'mono', size: 20, x: 100, y: 50, anchor: 'middle', fill: '#000' });
  assert.ok(Math.abs(firstMoveX(start) - w / 2 - firstMoveX(middle)) <= 0.1);
});

test('svgDoc has viewBox, intrinsic size, title, and style only when given', () => {
  const doc = svgDoc({ width: 1200, height: 360, title: 'A & B', body: '<rect/>' });
  assert.match(doc, /viewBox="0 0 1200 360"/);
  assert.match(doc, /width="1200" height="360"/);
  assert.match(doc, /<title>A &amp; B<\/title>/);
  assert.ok(!doc.includes('<style'));
  assertHygienic(doc);
});

test('assertHygienic rejects script, text, external URLs, oversize', () => {
  const wrap = (s: string) => `<svg xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
  assert.throws(() => assertHygienic(wrap('<script>alert(1)</script>')));
  assert.throws(() => assertHygienic(wrap('<text>hi</text>')));
  assert.throws(() => assertHygienic(wrap('<use href="https://evil.test/x.svg#a"/>')));
  assert.throws(() => assertHygienic(wrap('x'.repeat(200_000))));
  assertHygienic(wrap('<rect/>'));
});
