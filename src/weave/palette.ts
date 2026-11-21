import type { Theme } from '../types.ts';

export interface Palette {
  /** quiet days: GitHub's own neutral grey */
  base: string;
  /** float colours for intensity levels 1..4 */
  ramp: [string, string, string, string];
  edge: string;
  edgeDim: string;
  caption: string;
  /** blur radius of the glow on the busiest days */
  glow: number;
}

/** "Dua benang": red weave, gold for the busiest days, on GitHub's own page background. */
export const PALETTE: Record<Theme, Palette> = {
  dark: {
    base: '#21262d',
    ramp: ['#6b2333', '#b8364c', '#e88a3c', '#f5c451'],
    edge: '#e88a3c',
    edgeDim: '#6b2333',
    caption: '#9198a1',
    glow: 2.4,
  },
  light: {
    base: '#eff2f5',
    ramp: ['#f6c6cf', '#e0607a', '#e07b22', '#c98a00'],
    edge: '#e07b22',
    edgeDim: '#f6c6cf',
    caption: '#59636e',
    glow: 1.2,
  },
};
