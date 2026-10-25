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
  /** A tactile object (the paper calendar tile) resting on glass. */
  object: '0 10px 24px rgba(0,0,0,0.45), inset 0 -2px 0 rgba(0,0,0,0.08)',
  insetLight: 'inset 0 2px 5px rgba(8,24,56,0.10)',
  /** The active tab pill and glowing icon tiles. */
  glow: (rgb: string, alpha = 0.45) => `0 0 18px rgba(${rgb},${alpha})`,
} as const;
