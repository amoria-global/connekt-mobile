/**
 * Fixed-dark tokens for the screens that sit on live video: the creator studio and the viewer.
 * They do not follow the scheme (video is the picture), so they are constants, built from the
 * Midnight Glass dark palette rather than their own hexes. Colour keeps its meaning here too:
 * cyan is live, magenta the call to go live, blue an action, amber a warning.
 */
import { darkPalette as d } from './palettes';

/** The creator studio, over the camera feed. */
export const studioTokens = {
  scrim: 'rgba(0,0,0,0.45)',
  scrimStrong: 'rgba(0,0,0,0.66)',
  glass: 'rgba(16,27,46,0.62)',
  glassActive: 'rgba(255,255,255,0.92)',
  line: d.stroke,
  text: d.textOnPrimary,
  textDim: 'rgba(255,255,255,0.74)',
  textFaint: 'rgba(255,255,255,0.5)',
  live: d.live,
  go: d.accent,
  brand: d.primary,
  warn: d.pending,
  ok: d.success,
  sheetBg: d.surface,
  sheetRow: d.card,
  sheetLine: d.stroke,
} as const;

/** The live viewer: always dark, video first. */
export const viewerTokens = {
  bg: d.background,
  surface: d.surface,
  surfaceRaised: d.card,
  chip: 'rgba(0,0,0,0.55)',
  chipStrong: 'rgba(0,0,0,0.72)',
  border: d.stroke,
  text: d.text,
  textSoft: d.textSoft,
  textMuted: d.textMuted,
  live: d.live,
  accent: d.accent,
  primary: d.primary,
  warning: d.pending,
  hit: 44,
} as const;
