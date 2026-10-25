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

  // Midnight Glass roles (design/brief.png). Light mode keeps the same roles on light tokens.
  /** Highlight blue: the top stop of a raised button, active icons, a selected day. */
  primaryLight: '#2F64C8',
  /** Glass panel fill, top and bottom stops of the vertical gradient. */
  glassTop: 'rgba(255,255,255,0.82)',
  glassBottom: 'rgba(255,255,255,0.66)',
  /** Solid fill for glass where blur is unavailable (Android without a blur target, low power). */
  glassSolid: '#FFFFFF',
  /** The glass edge. */
  stroke: 'rgba(8,58,133,0.12)',
  /** Inset well (fields, inner panels) sunk into glass. */
  well: 'rgba(8,24,56,0.05)',
  /** Live and collaboration: cyan. */
  live: '#0B7C8C',
  liveBg: 'rgba(11,124,140,0.10)',
  /** Pending and waiting: amber. */
  pending: '#8A5A00',
  pendingBg: 'rgba(245,180,0,0.16)',
} as const;

/** The shape every palette must satisfy. */
export type Palette = { [K in keyof typeof lightPalette]: string };

/**
 * Midnight Glass (design/brief.png): the default scheme. The values are the brief's tokens; the
 * solid surfaces are what the glass flattens to over `background`, so a screen not yet on glass
 * still sits in the same family.
 */
export const darkPalette: Palette = {
  // Brand: brightened so it still reads as a fill against dark surfaces.
  primary: '#3E6FD8',
  primaryDark: '#3360C4',
  accent: '#EE0E8F',
  accentLight: '#FF5DB8',
  link: '#7FA6F5',

  // Surfaces: four deliberate steps. `card` is the brief's blur fallback, #16243C. The native
  // splash in app.json stays #0E1117 (changing it is a native change); AppPreloader keeps that hex
  // as the splash continuation, so the app fades from the splash colour into this ground.
  background: '#0A1220',
  surface: '#101B2E',
  card: '#16243C',
  surfaceMuted: '#1B2B46',
  elevated: '#1D2F4D',

  // Text: softened whites; pure #FFF on near-black causes halation.
  text: '#EAF0FA',
  textSoft: '#C9D5EA',
  textMuted: '#93A3BE',
  textOnPrimary: '#FFFFFF',

  // Lines: the glass stroke flattened over a card, so solid hairlines and glass edges agree.
  border: '#2A3B58',
  borderSoft: '#1E2D47',

  // Tints must be lighter AND more opaque than their light counterparts,
  // otherwise they vanish against the background.
  tint: 'rgba(62,111,216,0.16)',
  tintAccent: 'rgba(238,14,143,0.15)',
  scrim: 'rgba(0,0,0,0.65)',
  shadow: '#000000',

  // Status: light foreground on a deep, desaturated tinted ground. Warning is the brief's amber.
  success: '#4ADE80',
  successBg: '#0E2F22',
  warning: '#F5B400',
  warningBg: '#33260A',
  error: '#F87171',
  errorBg: '#341A1D',
  info: '#8FB4FF',
  infoBg: '#14335E',

  warningSoft: '#3D2C0A',
  warningLine: '#5A4210',
  errorSoft: '#40191D',
  errorLine: '#6B2A31',

  primaryLight: '#5B8CFF',
  glassTop: 'rgba(32,50,82,0.62)',
  glassBottom: 'rgba(18,30,52,0.52)',
  glassSolid: '#16243C',
  stroke: 'rgba(170,195,240,0.14)',
  well: 'rgba(4,9,18,0.55)',
  live: '#22C7D9',
  liveBg: 'rgba(34,199,217,0.14)',
  pending: '#F5B400',
  pendingBg: 'rgba(245,180,0,0.14)',
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
        /**
         * Raised (skeuo) button fills, top to bottom, with `raisedStops`. The magenta middle is
         * darker than `accent` on purpose: white on #EE0E8F is 4.1:1, on #D80C82 it is 4.9:1.
         */
        raisedPrimary: ['#5B8CFF', '#3E6FD8', '#3360C4'] as const,
        raisedAccent: ['#F64BA8', '#D80C82', '#B0076F'] as const,
        /** Greeting name and avatar ring. */
        ring: ['#5B8CFF', '#EE0E8F'] as const,
      }
    : {
        brand: ['#083A85', '#0a4da3', '#F20C8F'] as const,
        accent: ['#F20C8F', '#ff4fae'] as const,
        wash: ['rgba(8,58,133,0.08)', 'rgba(242,12,143,0.08)'] as const,
        heroBlue: ['#083A85', '#1B55B8'] as const,
        heroViolet: ['#5B21B6', '#A21CAF'] as const,
        raisedPrimary: ['#2F64C8', '#083A85', '#062D6B'] as const,
        raisedAccent: ['#F64BA8', '#D80C82', '#B0076F'] as const,
        ring: ['#083A85', '#F20C8F'] as const,
      };

/** Stop positions for the three-stop raised fills (the brief's 55% middle). */
export const raisedStops = [0, 0.55, 1] as const;

export type Gradients = ReturnType<typeof gradientsFor>;
