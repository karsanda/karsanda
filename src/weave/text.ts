import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';

/**
 * Text drawn as outline paths. README images render as plain <img>, which can't
 * load web fonts, so glyphs are baked into the SVG instead of using <text>.
 */
export type FontName = 'mono';

const FILES: Record<FontName, string> = {
  mono: '../../fonts/IBMPlexMono-Medium.ttf',
};

const loaded = new Map<FontName, opentype.Font>();

function font(name: FontName): opentype.Font {
  let f = loaded.get(name);
  if (!f) {
    const bytes = readFileSync(new URL(FILES[name], import.meta.url));
    f = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    loaded.set(name, f);
  }
  return f;
}

export function textWidth(text: string, name: FontName, size: number): number {
  return font(name).getAdvanceWidth(text, size);
}

export function textPath(
  text: string,
  opts: { font: FontName; size: number; x: number; y: number; anchor?: 'start' | 'middle' | 'end'; fill: string },
): string {
  const width = textWidth(text, opts.font, opts.size);
  const shift = opts.anchor === 'middle' ? width / 2 : opts.anchor === 'end' ? width : 0;
  const d = font(opts.font).getPath(text, opts.x - shift, opts.y, opts.size).toPathData(1);
  return `<path d="${d}" fill="${opts.fill}"/>`;
}

