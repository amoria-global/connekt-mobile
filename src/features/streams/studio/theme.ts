/**
 * Visual tokens for the Creator Live Studio.
 *
 * The studio sits on top of a live camera feed, so it is always dark /
 * translucent regardless of the app colour scheme. Brand hues (blue #083A85,
 * pink #F20C8F) are kept for primary actions.
 */
export const S = {
  scrim: 'rgba(0,0,0,0.45)',
  scrimStrong: 'rgba(0,0,0,0.66)',
  glass: 'rgba(16,18,24,0.58)',
  glassActive: 'rgba(255,255,255,0.92)',
  line: 'rgba(255,255,255,0.16)',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.74)',
  textFaint: 'rgba(255,255,255,0.5)',
  live: '#EF4444',
  go: '#F20C8F',
  brand: '#083A85',
  warn: '#F59E0B',
  ok: '#22C55E',
  sheetBg: '#14161B',
  sheetRow: '#1E2128',
  sheetLine: 'rgba(255,255,255,0.08)',
} as const;

/** Minimum touch target (dp) for primary studio controls. */
export const TOUCH = 48;
