/**
 * Fixed dark "viewing environment" tokens for the live viewer.
 *
 * The viewer is intentionally always dark (video-first), so these are constants
 * rather than theme-aware values, which also lets styles live in plain
 * `StyleSheet.create` with zero per-render cost.
 */
export const V = {
  bg: '#0B0D12',
  surface: '#12151C',
  surfaceRaised: '#1B1F29',
  chip: 'rgba(0,0,0,0.55)',
  chipStrong: 'rgba(0,0,0,0.72)',
  border: 'rgba(255,255,255,0.10)',
  text: '#F2F4F8',
  textSoft: '#C3C9D4',
  textMuted: '#9099AA',
  live: '#E5233D',
  accent: '#F20C8F',
  primary: '#3D6FD6',
  warning: '#F5B13D',
  hit: 44,
} as const;

export const VIDEO_ASPECT = 16 / 9;
/** Width at/above which the tablet/desktop side-by-side layout is used. */
export const WIDE_BREAKPOINT = 720;
export const CHAT_SIDE_WIDTH = 360;
