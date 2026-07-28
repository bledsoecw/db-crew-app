/**
 * Deitemeyer Brothers design-system tokens, ported from
 * `_ds/.../tokens/*.css` in the Claude Design handoff bundle.
 *
 * Only the tokens this app actually uses are listed. Values are copied
 * verbatim from the CSS — do not "improve" them here; change the design
 * system first.
 */

export const navy = {
  950: '#070e1c', // hero gradient floor / data band
  900: '#0d1a33',
  800: '#142a52', // side nav
  700: '#1a4789', // DB mark blue — buttons, links, headers
  600: '#21569f',
  500: '#2b6ac0',
  400: '#5289d2',
  300: '#7ba4dd',
  200: '#b9cdf0', // on-navy secondary text
  100: '#e6eef9',
  50: '#f2f6fc',
} as const;

export const green = {
  900: '#0f3d18',
  800: '#175a24',
  700: '#1e7a2f', // green text on light surfaces
  600: '#29a03d',
  500: '#3cc84a', // logo green
  400: '#56dd62', // accent on navy
  300: '#7ef08a', // positive figure on near-black
  200: '#b9f2bf',
  100: '#e4f9e7', // total-row tint
} as const;

export const ink = {
  950: '#080c12',
  900: '#0e1113', // near-black text & data bands
  800: '#1a1e21',
  700: '#2b3033',
  600: '#474d51',
  500: '#6b6f72',
} as const;

export const slate = {
  300: '#b6c0cd',
  200: '#d8dfe8', // app hairline
  100: '#e9edf3', // app sunken
  50: '#f4f6f9', // app page background
} as const;

export const white = '#ffffff';

export const status = {
  live: green[500],
  warning: '#b5892a',
  warningInk: '#12100a', // legible ink on the warning amber
  danger: '#c0392b',
} as const;

/** Corner radius — subtle, mostly square. */
export const radius = {
  xs: 2,
  sm: 3,
  md: 5,
  lg: 8,
  pill: 999,
} as const;

/** Border widths. */
export const border = {
  thin: 1,
  med: 2,
  thick: 3,
} as const;

/** Motion — 120–320ms, nothing bounces. */
export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
