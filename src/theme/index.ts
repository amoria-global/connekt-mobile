/**
 * Connekyt design tokens — mirrors the web brand (landing page + dashboard).
 * Brand blue #083A85, accent pink #F20C8F, blue→pink gradients.
 */

import { lightPalette } from './palettes';

/**
 * STATIC light palette. Unchanged in value from before dark mode existed, so
 * every existing `import { colors } from '@/theme'` keeps behaving exactly as
 * it did — including inside module-level `StyleSheet.create`.
 *
 * This export CANNOT follow the phone's colour scheme: it is a constant, and a
 * stylesheet built from it is frozen at module load. For theme-aware colours,
 * use `useTheme()` (values) or `makeStyles()` (stylesheets) instead. See
 * src/theme/README.md for the migration recipe.
 */
export const colors = lightPalette;

/** Blue→pink brand gradient stops (use with expo-linear-gradient when added). */
export const gradients = {
  brand: ['#083A85', '#F20C8F'] as const,
  accent: ['#F20C8F', '#ff4fae'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  xxl: 32,
  '3xl': 48,
  xxxl: 48,
} as const;

/**
 * Midnight Glass radii: 14 tile · 20 card · 24 panel · 28 hero · pill. `sm` stays 8 for the small
 * inner pieces (badges, checkboxes) the brief does not size.
 */
export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  '2xl': 28,
  full: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  xxl: 28,
  '3xl': 34,
  xxxl: 34,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Midnight Glass type, as loaded by `useFonts` in the root layout. Space Grotesk carries
 * headings, numbers and buttons; Inter carries body and UI copy. Custom fonts do not
 * synthesise weights on Android, so pick the family for the weight rather than setting
 * `fontWeight` alone.
 *
 * `bold` is Space Grotesk because nearly every existing `fonts.bold` is a heading, a number
 * or a button label; a bold UI label that should stay Inter uses `fonts.semibold`.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
} as const;

/** Display tracking from the brief (-0.02em to -0.035em), as points for a given size. */
export const tracking = (size: number, em = -0.025) => size * em;

/**
 * Shadows as RN `boxShadow` strings (New Architecture), so inset highlights work on both platforms.
 * `raised` takes the button's own colour for its glow.
 */
export const shadows = {
  glass: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 32px rgba(0,0,0,0.35)',
  glassLight: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(11,42,102,0.10)',
  raised: (rgb: string) => `inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 24px rgba(${rgb},0.45)`,
  /** The 1px top highlight on a flat fill, so it reads as the raised button's family. */
  highlight: 'inset 0 1px 0 rgba(255,255,255,0.22)',
  inset: 'inset 0 2px 6px rgba(0,0,0,0.5)',
  insetLight: 'inset 0 2px 5px rgba(8,24,56,0.10)',
  /** The active tab pill and glowing icon tiles. */
  glow: (rgb: string, alpha = 0.45) => `0 0 18px rgba(${rgb},${alpha})`,
} as const;

/** `#RRGGBB` at an opacity, for strokes and washes derived from a palette colour. */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** RGB triplets for the glows, matching the palette. */
export const glowRgb = { primary: '62,111,216', accent: '238,14,143', live: '34,199,217', pending: '245,180,0' } as const;

export { motion, useReducedMotion } from './motion';

export const theme = { colors, gradients, spacing, radii, fontSize, fontWeight, fonts };
export type Theme = typeof theme;

// --- Dark mode ---------------------------------------------------------
// Re-exported here so screens have one import site: `from '@/theme'`.
export { lightPalette, darkPalette, palettes, gradientsFor, raisedStops } from './palettes';
export type { Palette, ColorSchemeName, Gradients } from './palettes';
export { makeElevation } from './elevation';
export type { ElevationLevel, ElevationFn } from './elevation';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ThemePreference } from './ThemeProvider';
export { makeStyles } from './makeStyles';
export { navigationThemeFor } from './navigationTheme';
