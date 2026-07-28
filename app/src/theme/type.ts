import type { TextStyle } from 'react-native';

/**
 * Type helpers for the three design-system faces.
 *
 * Archivo 700–800 UPPERCASE headings, Barlow for body/UI copy, IBM Plex Mono
 * for every label, tag and timestamp. CSS tracking is expressed in `em`;
 * React Native's `letterSpacing` is in px, so `ls` converts.
 */

export const FONTS = {
  archivo: {
    600: 'Archivo_600SemiBold',
    700: 'Archivo_700Bold',
    800: 'Archivo_800ExtraBold',
  },
  barlow: {
    400: 'Barlow_400Regular',
    600: 'Barlow_600SemiBold',
    700: 'Barlow_700Bold',
  },
  mono: {
    400: 'IBMPlexMono_400Regular',
    600: 'IBMPlexMono_600SemiBold',
  },
} as const;

/** CSS `letter-spacing: <em>em` at a given font size, in px. */
export const ls = (size: number, em: number): number => size * em;

/** Tracking constants from the design system. */
export const TRACK = {
  /** eyebrows */
  label: 0.14,
  /** badges, nav */
  tag: 0.09,
  /** mono body, timestamps */
  mono: 0.02,
  heading: -0.01,
  display: -0.02,
} as const;

type Opts = {
  /** letter-spacing in em */
  track?: number;
  /** line-height as a multiplier of the font size */
  lh?: number;
  color?: string;
  weight?: 600 | 700 | 800;
  /** headings are uppercase; duration figures like "2h 18m" are not */
  caps?: boolean;
};

/** The signature uppercase wide-tracked mono label. */
export function mono(size: number, o: Opts = {}): TextStyle {
  const { track = TRACK.tag, lh = 1, color, weight = 600 } = o;
  return {
    fontFamily: weight === 600 ? FONTS.mono[600] : FONTS.mono[400],
    fontSize: size,
    lineHeight: size * lh,
    letterSpacing: ls(size, track),
    textTransform: 'uppercase',
    ...(color ? { color } : null),
  };
}

/** Archivo — headings and metrics. Uppercase unless it is a duration. */
export function archivo(size: number, o: Opts = {}): TextStyle {
  const { track = 0, lh = 1, color, weight = 800, caps = true } = o;
  return {
    fontFamily: FONTS.archivo[weight],
    fontSize: size,
    lineHeight: size * lh,
    letterSpacing: ls(size, track),
    ...(caps ? { textTransform: 'uppercase' as const } : null),
    ...(color ? { color } : null),
  };
}

/** Barlow — the only lowercase face. Body and UI copy. */
export function barlow(size: number, o: Opts = {}): TextStyle {
  const { track = 0, lh = 1.3, color, weight } = o;
  return {
    fontFamily: weight === 700 ? FONTS.barlow[700] : weight === 600 ? FONTS.barlow[600] : FONTS.barlow[400],
    fontSize: size,
    lineHeight: size * lh,
    ...(track ? { letterSpacing: ls(size, track) } : null),
    ...(color ? { color } : null),
  };
}

/**
 * Metrics use Archivo with tabular figures so columns align.
 * (`.db-figures` in the design system.)
 */
export const FIGURES: TextStyle = { fontVariant: ['tabular-nums'] };
