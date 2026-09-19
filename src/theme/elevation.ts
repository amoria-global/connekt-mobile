/**
 * Elevation, expressed correctly for each scheme.
 *
 * THE PROBLEM
 * -----------
 * 22 files in this app raise surfaces with a black drop shadow:
 *
 *   shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2
 *
 * That is right for light mode and useless in dark mode — a black shadow on a
 * `#0E1117` ground produces no visible change, so every card, sheet and FAB
 * collapses into the background and the UI reads as one flat plane. This is the
 * single biggest reason a naively-inverted dark theme looks amateurish.
 *
 * THE FIX
 * -------
 * Dark mode expresses elevation the way the medium actually allows:
 *   - a LIGHTER surface (higher level = lighter), and
 *   - a hairline border to catch the edge,
 *   - with the shadow kept only as a soft ambient spread (much higher opacity,
 *     larger radius) so it still separates a floating element from content.
 *
 * Light mode keeps the familiar cast shadow and no border.
 *
 * USAGE
 *   const { elevation } = useTheme();
 *   <View style={[styles.card, elevation(2)]} />
 *
 * Levels: 0 flat · 1 resting card · 2 raised card / segmented · 3 sheet / menu
 * · 4 FAB / floating action.
 */
import { Platform, type ViewStyle } from 'react-native';

import type { ColorSchemeName, Palette } from './palettes';

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

const LIGHT_SHADOW: Record<ElevationLevel, { o: number; r: number; y: number; e: number }> = {
  0: { o: 0, r: 0, y: 0, e: 0 },
  1: { o: 0.06, r: 4, y: 1, e: 1 },
  2: { o: 0.09, r: 8, y: 2, e: 3 },
  3: { o: 0.14, r: 16, y: 6, e: 6 },
  4: { o: 0.20, r: 20, y: 8, e: 10 },
};

/**
 * Dark shadows are stronger and softer — a tight 8%-black shadow is invisible
 * here, but a wide 45% one still reads as depth without looking like a halo.
 */
const DARK_SHADOW: Record<ElevationLevel, { o: number; r: number; y: number; e: number }> = {
  0: { o: 0, r: 0, y: 0, e: 0 },
  1: { o: 0.30, r: 8, y: 2, e: 1 },
  2: { o: 0.38, r: 14, y: 4, e: 3 },
  3: { o: 0.48, r: 24, y: 8, e: 6 },
  4: { o: 0.55, r: 30, y: 10, e: 10 },
};

/**
 * Returns SHADOW PROPERTIES ONLY.
 *
 * It deliberately does NOT set `backgroundColor` or `borderColor`. An earlier
 * version did — lifting the surface and adding a hairline automatically — and
 * it silently destroyed deliberate design decisions, because call sites spread
 * it last:
 *
 *   cta: { backgroundColor: c.surface, ...e(4) }   // e() overwrote the surface
 *   ring: { borderWidth: 4, borderColor: '#FFF', ...e(4) }  // ring turned grey
 *
 * On the onboarding hero that turned a crisp white CTA into a grey blob in dark
 * mode. Elevation must never override colour the caller chose.
 *
 * Depth in dark mode therefore comes from two places that do NOT fight the
 * caller: the palette's own surface steps (`surface` < `card` < `elevated`,
 * which components already apply themselves) and the markedly stronger, softer
 * shadow values below. Where a card wants an explicit edge, it sets its own
 * `borderColor: c.border`.
 */
export function makeElevation(scheme: ColorSchemeName, c: Palette) {
  const isDark = scheme === 'dark';

  return function elevation(level: ElevationLevel = 1): ViewStyle {
    if (level === 0) return {};
    const s = (isDark ? DARK_SHADOW : LIGHT_SHADOW)[level];

    return {
      shadowColor: c.shadow,
      shadowOpacity: s.o,
      shadowRadius: s.r,
      shadowOffset: { width: 0, height: s.y },
      ...Platform.select({ android: { elevation: s.e }, default: {} }),
    };
  };
}

export type ElevationFn = ReturnType<typeof makeElevation>;
