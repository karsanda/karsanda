const SVG_NS = 'http://www.w3.org/2000/svg';

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Round to one decimal: keeps files small and output deterministic. */
export function r(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * A self-contained SVG document. Width/height equal the viewBox, so an <img> gets
 * an intrinsic aspect ratio, and the README scales it with width="100%".
 */
export function svgDoc(opts: {
  width: number;
  height: number;
  title: string;
  style?: string;
  defs?: string;
  body: string;
}): string {
  const { width, height } = opts;
  return [
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`,
    `<title>${esc(opts.title)}</title>`,
    opts.style ? `<style>${opts.style}</style>` : '',
    opts.defs ? `<defs>${opts.defs}</defs>` : '',
    opts.body,
    '</svg>',
  ].join('');
}
