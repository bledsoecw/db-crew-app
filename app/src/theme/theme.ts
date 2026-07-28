import { createContext, useContext } from 'react';

import { green, ink, navy, slate, status, white } from './tokens';

/**
 * Two surface schemes, ported 1:1 from the prototype's `--c-*` custom
 * properties.
 *
 * `sun` is the DEFAULT, not the exception: near-black ground with white type
 * is the highest-contrast, lowest-glare combination on a phone in direct
 * sunlight, and it is already the design system's `--surface-band` language.
 * `day` is the indoor/overcast scheme.
 */
export type Scheme = {
  /** screen ground */
  bg: string;
  /** raised card */
  surf: string;
  /** sunken control inside a card */
  surf2: string;
  /** hairline */
  line: string;
  /** stronger outline, used on outline buttons */
  line2: string;
  /** primary text */
  fg: string;
  /** secondary text */
  mut: string;
  /** the mono label device */
  lab: string;
  /** accent legible on this ground */
  acc: string;
  /** near-black data band */
  band: string;
  bandline: string;
  /** low-contrast chip fill */
  chip: string;
  /** navy chrome fill (buttons that are not go/stop) */
  nav: string;
  /** tab bar ground */
  tabbg: string;
  /** the CLOCK OUT button — inverse of the ground, so it reads as "stop" */
  stop: string;
  stopfg: string;
  /** total-row tint */
  total: string;
  /** 3px left bar on notes */
  navline: string;
  /** sun-mode toggle glyph */
  sunico: string;
};

export const SUN: Scheme = {
  bg: ink[900],
  surf: '#181c20',
  surf2: '#22272b',
  line: 'rgba(255,255,255,.16)',
  line2: 'rgba(255,255,255,.34)',
  fg: white,
  mut: 'rgba(255,255,255,.76)',
  lab: navy[200],
  acc: green[300],
  band: navy[950],
  bandline: 'rgba(255,255,255,.14)',
  chip: 'rgba(255,255,255,.09)',
  nav: navy[700],
  tabbg: navy[950],
  stop: white,
  stopfg: ink[900],
  total: 'rgba(60,200,74,.14)',
  navline: green[500],
  sunico: '#ffd84d',
};

export const DAY: Scheme = {
  bg: slate[50],
  surf: white,
  surf2: slate[100],
  line: slate[200],
  line2: slate[300],
  fg: ink[900],
  mut: ink[700],
  lab: ink[600],
  acc: green[700],
  band: navy[900],
  bandline: 'rgba(255,255,255,.14)',
  chip: slate[100],
  nav: navy[700],
  tabbg: navy[800],
  stop: ink[900],
  stopfg: white,
  total: green[100],
  navline: green[700],
  sunico: ink[500],
};

/**
 * Colors that do NOT flip with the scheme.
 *
 * Green means go, white means stop. Green is never decoration here — it is
 * the clock-in action, the live dot and the AFTER tag. Amber is the only
 * warning voice. These read the same in both schemes on purpose: a crew
 * member should never have to re-learn the colors when the light changes.
 */
export const FIXED = {
  go: green[500],
  goInk: ink[900],
  live: green[500],
  liveText: green[300],
  warn: status.warning,
  warnInk: status.warningInk,
  rec: status.danger,
  /** camera chrome is always dark — the viewfinder is the ground */
  camBg: '#080a0c',
  camPreview: '#101418',
  camTile: '#1b2024',
  onBandMut: 'rgba(255,255,255,.55)',
  onBandLab: navy[300],
} as const;

export type Theme = {
  sun: boolean;
  c: Scheme;
  /** Minimum height of a primary control, in px. Gloved-thumb budget. */
  tap: number;
};

export const ThemeContext = createContext<Theme>({ sun: true, c: SUN, tap: 76 });

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
