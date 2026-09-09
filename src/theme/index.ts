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

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
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
 * Pragati Narrow family names, as loaded by `useFonts` in the root layout
 * (@expo-google-fonts/pragati-narrow). Use these for `fontFamily` so the
 * mobile app matches the web brand type (knockout globals.css uses
 * 'Pragati Narrow' for the whole UI). Only 400 + 700 are bundled, so pair
 * `fonts.bold` with headings/labels and `fonts.regular` with body copy.
 */
export const fonts = {
  regular: 'PragatiNarrow_400Regular',
  bold: 'PragatiNarrow_700Bold',
} as const;

export const theme = { colors, gradients, spacing, radii, fontSize, fontWeight, fonts };
export type Theme = typeof theme;

// --- Dark mode ---------------------------------------------------------
// Re-exported here so screens have one import site: `from '@/theme'`.
export { lightPalette, darkPalette, palettes, gradientsFor } from './palettes';
export type { Palette, ColorSchemeName, Gradients } from './palettes';
export { makeElevation } from './elevation';
export type { ElevationLevel, ElevationFn } from './elevation';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ThemePreference } from './ThemeProvider';
export { makeStyles } from './makeStyles';
export { navigationThemeFor } from './navigationTheme';
