/**
 * Connekyt design tokens — mirrors the web brand (landing page + dashboard).
 * Brand blue #083A85, accent pink #F20C8F, blue→pink gradients.
 */

export const colors = {
  // Brand
  primary: '#083A85',
  primaryDark: '#062d6b',
  accent: '#F20C8F',
  accentLight: '#ff4fae',

  // Surfaces (light)
  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceMuted: '#E9EAEE',

  // Text
  text: '#0F1217',
  textSoft: '#3A3D44',
  textMuted: '#6A6D76',
  textOnPrimary: '#FFFFFF',

  // Lines
  border: '#D4D6DC',
  borderSoft: '#E6E7EC',

  // Status
  success: '#065F46',
  successBg: '#ECFDF5',
  warning: '#92400E',
  warningBg: '#FFFBEB',
  error: '#991B1B',
  errorBg: '#FEF2F2',
  info: '#1E40AF',
  infoBg: '#EFF6FF',
} as const;

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
  '3xl': 48,
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
  '3xl': 34,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const theme = { colors, gradients, spacing, radii, fontSize, fontWeight };
export type Theme = typeof theme;
