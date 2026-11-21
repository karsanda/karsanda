/**
 * npm run preview → local/preview.html: the README as GitHub would show it, in
 * dark and light themes plus a phone-width column. Dev tool only (output is gitignored).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Theme } from './types.ts';

const GITHUB = {
  dark: { bg: '#0d1117', fg: '#e6edf3', muted: '#9198a1', rule: '#3d444d' },
  light: { bg: '#ffffff', fg: '#1f2328', muted: '#59636e', rule: '#d1d9e0' },
} as const;

/** Just enough Markdown for this README: headings, lists, images, links, bold, italic, code; HTML passes through. */
function inline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="height:20px">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#4493f8;text-decoration:none">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(127,127,127,.2);padding:1px 4px;border-radius:4px">$1</code>');
}

function toHtml(md: string, theme: Theme): string {
  const html = md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<source [^>]*>\s*/g, '')
    .replace(/<img src="assets\/([^"]+)-light\.svg"/g, `<img src="../assets/$1-${theme}.svg"`)
    .split('\n')
    .map((line) => {
      const heading = line.match(/^(#{1,3}) (.*)$/);
      if (heading) {
        const level = heading[1].length;
        const rule = level < 3 ? `;border-bottom:1px solid ${GITHUB[theme].rule};padding-bottom:.3em` : '';
        return `<h${level} style="margin:24px 0 16px${rule}">${inline(heading[2])}</h${level}>`;
      }
      if (line.startsWith('- ')) return `<li>${inline(line.slice(2))}</li>`;
      if (line.trim() === '' || line.trimStart().startsWith('<')) return line;
      return `<p>${inline(line)}</p>`;
    })
    .join('\n');
  return html
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (items) => `<ul>${items}</ul>`)
    .replace(/<\/p>\n<p>(<img alt)/g, ' $1');
}

function panel(theme: Theme, width: number, label: string, body: string): string {
  const c = GITHUB[theme];
  return `<section style="width:${width}px;background:${c.bg};color:${c.fg};padding:16px 16px 32px;border:1px solid ${c.rule};border-radius:6px">
<div style="font:12px ui-monospace,monospace;color:${c.muted};margin-bottom:12px">${label}</div>${body}</section>`;
}

const readme = await readFile('README.md', 'utf8');
const page = `<!doctype html><meta charset="utf-8"><title>Profile preview</title>
<style>
  body { margin: 0; padding: 24px; background: #6e7781; font: 16px/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  main { display: flex; gap: 24px; align-items: flex-start; }
  h3 { font-size: 1.25em; margin: 24px 0 16px; }
  img { max-width: 100%; vertical-align: middle; }
  p, ul { margin: 0 0 16px; }
  sub { opacity: .8; }
  a img { border: 0; }
</style>
<main>
${panel('dark', 860, 'GitHub dark · 860 px', toHtml(readme, 'dark'))}
${panel('light', 860, 'GitHub light · 860 px', toHtml(readme, 'light'))}
${panel('dark', 390, 'phone · 390 px', toHtml(readme, 'dark'))}
</main>
<p style="color:#fff">The gold shimmer animates in the live page; with reduced motion turned on it stays still.</p>`;

await mkdir('local', { recursive: true });
await writeFile('local/preview.html', page);
console.log('wrote local/preview.html');
