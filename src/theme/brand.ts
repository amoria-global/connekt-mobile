/**
 * Colours the app does not choose: third-party marks drawn as their owners require, the live
 * fill, and the app's own illustrations and onboarding photo scrims. Kept here so no screen
 * carries a hex of its own (see CLAUDE.md, Design System).
 */

/** Marks drawn in their owners' colours. Never retint them. */
export const brandMarks = {
  google: { red: '#EA4335', blue: '#4285F4', yellow: '#FBBC05', green: '#34A853' },
  /** Sign in with Apple: black on light, white on dark, per Apple's guidelines. */
  appleBlack: '#000000',
  mtn: '#FFCB05',
  airtel: '#ED1C24',
} as const;

/**
 * Live is cyan in Midnight Glass. The fill runs light to deep, and the middle stop, where a
 * label sits, carries white text at 4.8:1.
 */
export const liveFill = { top: '#22C7D9', mid: '#0A7E90', deep: '#08697A', glow: '#5FE0EC' } as const;

/** The app's own illustrations (Help and Update glyphs). */
export const illustration = {
  help: { from: '#22C7D9', to: '#3E6FD8' },
  updateTray: ['#5B8CFF', '#3360C4'] as const,
  updateArrow: ['#A6F7D2', '#22C7D9'] as const,
  updateGlow: '#3E6FD8',
} as const;

/** Scrims over the onboarding photographs, top to bottom (fixed: they sit on photos). */
export const onboardingScrims = {
  blue: ['#1E63D0', '#062B63'] as const,
  navy: ['#1E3A8A', '#062B63'] as const,
  night: ['#000000', '#03122B'] as const,
} as const;
