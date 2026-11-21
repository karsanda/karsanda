import assert from 'node:assert/strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** GitHub serves README images through a proxy as plain <img>: keep every asset self-contained. */
export function assertHygienic(svg: string): void {
  assert.ok(svg.startsWith('<svg'), 'must start with <svg');
  for (const banned of ['<script', '<image', '<text', 'font-family', 'NaN', 'undefined', 'xlink:']) {
    assert.ok(!svg.includes(banned), `must not contain ${banned}`);
  }
  const urls = svg.match(/https?:\/\/[^"'\s)]+/g) ?? [];
  assert.deepEqual(urls.filter((u) => u !== SVG_NS), [], 'no URLs besides the SVG namespace');
  assert.ok(Buffer.byteLength(svg) < 200_000, `must be < 200 KB (is ${Buffer.byteLength(svg)} B)`);
}
