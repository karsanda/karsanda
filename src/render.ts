import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DayCounts, Theme } from './types.ts';
import { renderWoven } from './weave/woven.ts';

const THEMES: Theme[] = ['dark', 'light'];

/** Writes the woven year in both themes; returns the written paths. */
export async function renderAll(opts: { today: string; counts: DayCounts; message: string; outDir: string }): Promise<string[]> {
  await mkdir(opts.outDir, { recursive: true });
  const paths: string[] = [];
  for (const theme of THEMES) {
    const path = join(opts.outDir, `woven-${theme}.svg`);
    await writeFile(path, `${renderWoven({ today: opts.today, counts: opts.counts, theme, message: opts.message })}\n`);
    paths.push(path);
  }
  return paths;
}
