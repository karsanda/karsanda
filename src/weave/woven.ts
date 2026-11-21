import type { DayCounts, Theme } from '../types.ts';
import { borderBits } from './egg.ts';
import { buildGrid } from './grid.ts';
import { toLevels } from './levels.ts';
import { PALETTE, type Palette } from './palette.ts';
import { r, svgDoc } from './svg.ts';
import { textPath } from './text.ts';

const W = 1200;
const PITCH = 21.5;
const FIELD_X = (W - 53 * PITCH) / 2;
const FIELD_Y = 36;
const FIELD_W = 53 * PITCH;
const FIELD_BOTTOM = FIELD_Y + 7 * PITCH;
const MONTHS_Y = FIELD_BOTTOM + 20;
const FOOT_Y = FIELD_BOTTOM + 30;
const H = FIELD_BOTTOM + 78;

// Pucuk rebung edges: tessellating triangles 16 wide, stepped every 8 px.
const REBUNG_COUNT = 150;
const REBUNG_STEP = 8;

/** Diamond half-size per level: quiet days are small grey dots, busy days large bright floats. */
const SIZES = [2.6, 5, 6.5, 8, 9.5];
const GLOWING = new Set([3, 4]);
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function defs(p: Palette): string {
  const diamond = (s: number) => `M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z`;
  return [
    `<filter id="glow" x="-100%" y="-100%" width="300%" height="300%">`,
    `<feGaussianBlur stdDeviation="${p.glow}" result="blur"/>`,
    `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`,
    `</filter>`,
    ...SIZES.map((s, level) => {
      const fill = level ? p.ramp[level - 1] : p.base;
      const glow = GLOWING.has(level) ? ' filter="url(#glow)"' : '';
      return `<path id="f${level}" d="${diamond(s)}" fill="${fill}"${glow}/>`;
    }),
    `<path id="up" d="M0 12L8 0L16 12Z" fill="${p.edge}"/>`,
    `<path id="down" d="M0 0H16L8 12Z" fill="${p.edgeDim}"/>`,
    `<linearGradient id="beam" x1="0" x2="1" y1="0" y2="0">`,
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>`,
    `<stop offset="0.85" stop-color="#ffffff" stop-opacity="0.25"/>`,
    `<stop offset="0.97" stop-color="#ffffff" stop-opacity="0.8"/>`,
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>`,
    `</linearGradient>`,
  ].join('');
}

const STYLE = [
  '.scan { animation: scan 6s linear infinite; }',
  `@keyframes scan { from { transform: translateX(-160px); } to { transform: translateX(${W}px); } }`,
  '@media (prefers-reduced-motion: reduce) { .scan { animation: none; opacity: 0; } }',
].join(' ');

function rebungRow(id: string, y: number, bits: (0 | 1)[]): string {
  const uses = bits.map((bit, i) => `<use href="#${bit ? 'up' : 'down'}" x="${i * REBUNG_STEP - 4}" y="${y}"/>`);
  return `<g id="${id}">${uses.join('')}</g>`;
}

/** Corner brackets around the field, like a heads-up display. */
function hud(p: Palette): string {
  const [x0, y0, x1, y1, len] = [r(FIELD_X - 6), FIELD_Y - 6, r(FIELD_X + FIELD_W + 6), r(FIELD_BOTTOM + 6), 14];
  const stroke = `fill="none" stroke="${p.edge}" stroke-width="1.5"`;
  return `<g id="hud">${[
    `M${x0} ${y0 + len}V${y0}H${x0 + len}`,
    `M${r(x1 - len)} ${y0}H${x1}V${y0 + len}`,
    `M${x0} ${r(y1 - len)}V${y1}H${x0 + len}`,
    `M${r(x1 - len)} ${y1}H${x1}V${r(y1 - len)}`,
  ].map((d) => `<path d="${d}" ${stroke}/>`).join('')}</g>`;
}

/** One label under the first column of every month that starts inside the window. */
function months(grid: (string | null)[][], p: Palette): string {
  const labels: string[] = [];
  grid.forEach((column, w) => {
    const first = column.find((day) => day?.endsWith('-01'));
    if (!first) return;
    const name = MONTH_NAMES[Number(first.slice(5, 7)) - 1];
    labels.push(textPath(name, { font: 'mono', size: 11, x: r(FIELD_X + w * PITCH + 2), y: r(MONTHS_Y), fill: p.caption }));
  });
  return `<g id="months">${labels.join('')}</g>`;
}

/** "My year, woven": the last 53 weeks of GitHub + GitLab activity as songket floats. */
export function renderWoven(opts: { today: string; counts: DayCounts; theme: Theme; message: string }): string {
  const p = PALETTE[opts.theme];
  const grid = buildGrid(opts.today);

  const inWindow: DayCounts = new Map();
  for (const day of grid.flat()) {
    const n = day ? opts.counts.get(day) : undefined;
    if (day && n) inWindow.set(day, n);
  }
  const levels = toLevels(inWindow);
  const total = [...inWindow.values()].reduce((a, b) => a + b, 0);
  const summary = `${inWindow.size} active days · ${total.toLocaleString('en-US')} contributions · GitHub + GitLab`;

  const floats: string[] = [];
  grid.forEach((column, w) =>
    column.forEach((day, d) => {
      if (!day) return;
      const x = r(FIELD_X + w * PITCH + PITCH / 2);
      const y = r(FIELD_Y + d * PITCH + PITCH / 2);
      floats.push(`<use href="#f${levels.get(day) ?? 0}" x="${x}" y="${y}"/>`);
    }),
  );

  const footBits = borderBits('', REBUNG_COUNT).map((b) => (b ? 0 : 1) as 0 | 1);
  const body = [
    rebungRow('rebung', 8, borderBits(opts.message, REBUNG_COUNT)),
    hud(p),
    `<g id="field">${floats.join('')}</g>`,
    months(grid, p),
    rebungRow('rebung-foot', r(FOOT_Y), footBits),
    textPath(`// ${summary}`, { font: 'mono', size: 14, x: r(FIELD_X), y: r(H - 8), fill: p.caption }),
    `<mask id="thread" mask-type="alpha"><use href="#field"/></mask>`,
    `<g mask="url(#thread)"><rect class="scan" x="0" y="0" width="160" height="${r(H)}" fill="url(#beam)"/></g>`,
  ].join('');

  return svgDoc({ width: W, height: r(H), title: `My year, woven: ${summary}`, style: STYLE, defs: defs(p), body });
}
