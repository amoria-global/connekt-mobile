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

/** The verified avatar, kept identical to the web (`.ph-avatar-verif`): seal blue and the empty-avatar greys. */
export const verifiedAvatar = { seal: '#3B82F6', emptyBg: '#CBD5E1', emptyText: '#334155' } as const;

/**
 * Broadcast red (design/live.png), for events on air right now and nothing else. The recipes are
 * the reference's own: the LIVE badge runs #FF2448 to #E8002B (55%) to #C8001F; Watch Live runs
 * #FF2D55 to #FF0033 to #D4002A, its middle stop at 35% so the label sits on the deep end (white
 * 4.7:1; on pure #FF0033 it would be 3.96:1).
 */
export const liveFill = {
  top: '#FF2D55',
  mid: '#FF0033',
  deep: '#C8001F',
  glow: 'rgba(255,0,51,0.55)',
  badge: ['#FF2448', '#E8002B', '#C8001F'] as const,
  badgeStops: [0, 0.55, 1] as const,
  button: ['#FF2D55', '#FF0033', '#D4002A'] as const,
  buttonStops: [0, 0.35, 1] as const,
  /** The live card's edge and its two-layer glow. */
  cardBorder: 'rgba(255,45,85,0.75)',
  cardGlow: '0 0 30px rgba(255,0,51,0.45), 0 0 80px rgba(255,0,51,0.25)',
  badgeShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 18px rgba(255,0,51,0.55)',
  buttonShadow: '0 10px 26px rgba(255,0,51,0.55)',
  ringGlow: '0 0 18px rgba(255,0,51,0.6)',
  shine: 'rgba(255,255,255,0.28)',
} as const;

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

/**
 * Mid tones for module-level labels and icons that sit on both schemes (booking modes, match
 * tiers, contribution bars): each clears 3:1 on white and on the Midnight ground.
 */
export const midTones = { blue: '#3E6FD8', magenta: '#EE0E8F', green: '#1F9D57', orange: '#D9621A', slate: '#93A3BE' } as const;

/** The native splash colour (app.json); the preloader continues it, so it stays exact. */
export const nativeSplash = '#0E1117';

/** Instagram's story ring, drawn in its owner's colours. */
export const instagramRing = ['#F58529', '#DD2A7B', '#8134AF', '#F58529'] as const;
