import { viewerTokens } from '@/theme';

/**
 * Fixed dark "viewing environment" tokens for the live viewer, which is always dark (video first).
 * The values live in the theme (src/theme/media.ts).
 */
export const V = viewerTokens;

export const VIDEO_ASPECT = 16 / 9;
/** Width at/above which the tablet/desktop side-by-side layout is used. */
export const WIDE_BREAKPOINT = 720;
export const CHAT_SIDE_WIDTH = 360;
