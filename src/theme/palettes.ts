/**
 * Light and dark colour palettes.
 *
 * Both palettes MUST expose exactly the same keys — `darkPalette` is typed as
 * `Palette` so TypeScript fails the build if one drifts from the other.
 *
 * DESIGNING FOR DARK IS NOT INVERTING LIGHT
 * -----------------------------------------
 * A straight inversion reads as amateurish, because the things that carry
 * hierarchy in light mode stop working:
 *
 *  1. ELEVATION. Light mode separates cards from the page with a black drop
 *     shadow. On a near-black ground a black shadow is invisible, so every
 *     card flattens into the background. Dark mode must express elevation as
 *     *surface lightness* instead — hence `surface` < `card` < `elevated`,
 *     each a deliberate step apart, plus a hairline `border` to catch the eye.
 *  2. TINTS. A brand wash like `rgba(8,58,133,0.08)` is designed against
 *     white. Over `#0E1117` it disappears completely. Dark needs a *lighter,
 *     more opaque* tint to read at all — see `tint` / `tintAccent`.
 *  3. SATURATION. Fully saturated brand colour on a dark ground glares and
 *     bleeds. Surfaces get a slight blue cast (not neutral grey) so they sit
 *     with the brand, and pure #FFF text is softened to avoid halation.
 *
 * Brand hues stay recognisable across schemes, but `primary` is deliberately
 * BRIGHTER in dark: #083A85 is a fill colour chosen to carry white text on
 * white backgrounds, and at that darkness it vanishes against #0E1117.
 */

export const lightPalette = {
  // Brand
  primary: '#083A85',
  primaryDark: '#062d6b',
  accent: '#F20C8F',
  accentLight: '#ff4fae',
  /** Text-link blue: `primary` is a fill colour, and in dark it is only 3.4:1 as small text on a card. */
  link: '#083A85',

  // Surfaces — ascending "elevation": page < panel < card < raised
  background: '#F4F6FB',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  surfaceMuted: '#E9EAEE',
  /** Raised above `card` (sheets, menus, FABs). */
  elevated: '#FFFFFF',

  // Text
  text: '#0F1217',
  textSoft: '#3A3D44',
  textMuted: '#6A6D76',
  textOnPrimary: '#FFFFFF',

  // Lines
  border: '#D4D6DC',
  borderSoft: '#E6E7EC',

  /** Brand-tinted wash for highlight panels. */
  tint: 'rgba(8,58,133,0.07)',
  tintAccent: 'rgba(242,12,143,0.07)',
  /** Overlay behind modals / over media. */
  scrim: 'rgba(0,0,0,0.45)',
  /** Drop-shadow colour (paired with `elevation()` in ./elevation). */
  shadow: '#0F1217',

  // Status
  success: '#065F46',
  successBg: '#ECFDF5',
  warning: '#92400E',
  warningBg: '#FFFBEB',
  error: '#991B1B',
  errorBg: '#FEF2F2',
  info: '#1E40AF',
  infoBg: '#EFF6FF',

  /** Stronger tinted grounds and rules for status chips and banners (the wallet's pending and suspended chips). */
  warningSoft: '#FEF3C7',
  warningLine: '#FDE68A',
  errorSoft: '#FEE2E2',
  errorLine: '#FECACA',
} as const;

/** The shape every palette must satisfy. */
export type Palette = { [K in keyof typeof lightPalette]: string };

export const darkPalette: Palette = {
  // Brand — brightened so it still reads as a fill against dark surfaces.
  primary: '#3D6FD6',
  primaryDark: '#2A54A8',
  accent: '#F20C8F',
  accentLight: '#ff4fae',
  link: '#7FA6F5',

  // Surfaces — four deliberate steps. These carry elevation on their own,
  // because shadows do not register on a dark ground. Sampled from the Photographer prototype, whose screens sit on
  // a deep blue-teal (about #071321 to #0B1828) with cards a step lighter (about #0F2231 to #132434). The native
  // splash in app.json stays #0E1117 (changing it is a native change); AppPreloader keeps that hex as the splash
  // continuation, so the app fades from the splash colour into this ground.
  background: '#0A1524',
  surface: '#0F1D2F',
  card: '#13243A',
  surfaceMuted: '#1A2E47',
  elevated: '#1B3049',

  // Text: softened whites; pure #FFF on near-black causes halation. Slightly cool so it sits on the navy.
  text: '#EDF2F8',
  textSoft: '#C4D0E0',
  textMuted: '#8FA4BF',
  textOnPrimary: '#FFFFFF',

  // Lines: a blue hairline, visible enough to define a card edge, quiet enough not to grid up.
  border: '#274463',
  borderSoft: '#1A304A',

  // Tints must be lighter AND more opaque than their light counterparts,
  // otherwise they vanish against the background.
  tint: 'rgba(61,111,214,0.16)',
  tintAccent: 'rgba(242,12,143,0.15)',
  scrim: 'rgba(0,0,0,0.65)',
  shadow: '#000000',

  // Status — light foreground on a deep, desaturated tinted ground.
  success: '#4ADE80',
  successBg: '#0E2F22',
  warning: '#FBBF24',
  warningBg: '#33260A',
  error: '#F87171',
  errorBg: '#341A1D',
  info: '#8FB4FF',
  infoBg: '#14335E',

  warningSoft: '#3D2C0A',
  warningLine: '#5A4210',
  errorSoft: '#40191D',
  errorLine: '#6B2A31',
};

export type ColorSchemeName = 'light' | 'dark';

export const palettes: Record<ColorSchemeName, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

/**
 * Brand gradients, per scheme.
 *
 * The light ramp is the original brand blue→pink. The dark ramp is NOT the
 * same colours: the old array `[primary, '#0a4da3', accent]` hardcoded a
 * light-mode navy mid-stop, so under a brightened dark `primary` the ramp ran
 * light → DARK → pink. Non-monotonic, and it looked muddy. The dark ramp below
 * ascends in luminance and pulls the pink back slightly so it does not glare.
 */
export const gradientsFor = (scheme: ColorSchemeName) =>
  scheme === 'dark'
    ? {
        brand: ['#14346F', '#2B5AB8', '#D01B84'] as const,
        accent: ['#C40A75', '#F20C8F'] as const,
        /** Faint brand wash for hero panels. */
        wash: ['rgba(61,111,214,0.20)', 'rgba(242,12,143,0.14)'] as const,
        /** Hero action fills (client Book photographer, Pay now). White text reads on every stop (>= 4.5:1). */
        heroBlue: ['#173A8F', '#2A5FCC'] as const,
        /** The one secondary hero per screen (Publish offer). */
        heroViolet: ['#4C1D95', '#9226B8'] as const,
      }
    : {
        brand: ['#083A85', '#0a4da3', '#F20C8F'] as const,
        accent: ['#F20C8F', '#ff4fae'] as const,
        wash: ['rgba(8,58,133,0.08)', 'rgba(242,12,143,0.08)'] as const,
        heroBlue: ['#083A85', '#1B55B8'] as const,
        heroViolet: ['#5B21B6', '#A21CAF'] as const,
      };

export type Gradients = ReturnType<typeof gradientsFor>;
