/**
 * `makeStyles` — theme-aware replacement for a module-level `StyleSheet.create`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `const styles = StyleSheet.create({ card: { backgroundColor: colors.card } })`
 * at module scope is evaluated ONCE, when the module is first imported. The
 * colour is baked in for the lifetime of the JS context, so such a stylesheet
 * can never react to the phone switching to dark mode. Adding a palette and a
 * hook does not help on its own — the stylesheet is already frozen.
 *
 * There are 124 files in this app using module-level `StyleSheet.create`.
 * Each one migrates like this:
 *
 *   // before
 *   const styles = StyleSheet.create({
 *     card: { backgroundColor: colors.card, borderColor: colors.border },
 *   });
 *   // ...
 *   <View style={styles.card} />
 *
 *   // after
 *   const useStyles = makeStyles((c) => ({
 *     card: { backgroundColor: c.card, borderColor: c.border },
 *   }));
 *   // ...inside the component:
 *   const styles = useStyles();
 *   <View style={styles.card} />
 *
 * Styles are built once per scheme and cached, so switching light↔dark costs
 * one factory call per stylesheet, not one per render.
 */
import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import type { ColorSchemeName, Palette } from './palettes';
import type { ElevationFn } from './elevation';
import { useTheme } from './ThemeProvider';
import { shadows } from './shadows';

/**
 * Mirrors React Native's own `StyleSheet.NamedStyles`. Using the real style
 * types (rather than `object`) is what gives the factory's return value a
 * CONTEXTUAL type, so `alignItems: 'center'` narrows to `FlexAlignType`
 * instead of widening to `string`. With a looser constraint every migrated
 * stylesheet fails to typecheck against `StyleProp<ViewStyle>`.
 */
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * The factory receives the palette AND a scheme-correct `elevation` helper, so
 * a stylesheet can express depth without hardcoding a shadow that only works in
 * one scheme:
 *
 *   const useStyles = makeStyles((c, e) => ({
 *     card: { ...e(2), backgroundColor: c.card, borderRadius: radii.lg },
 *   }));
 */
const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'SpaceGrotesk_700Bold',
  '800': 'SpaceGrotesk_700Bold',
  '900': 'SpaceGrotesk_700Bold',
  bold: 'SpaceGrotesk_700Bold',
};

/** The retired brand face, mapped onto its Midnight Glass replacement. */
const RETIRED_FAMILY: Record<string, string> = {
  PragatiNarrow_400Regular: 'Inter_400Regular',
  PragatiNarrow_700Bold: 'SpaceGrotesk_700Bold',
};

const CARD_RADIUS = 12;

/**
 * The Midnight Glass pass every themed stylesheet goes through (see CLAUDE.md, Design System):
 *
 *  - Type. A text style that sets a size or weight but no family gets the family for its weight
 *    (Inter for body and UI, Space Grotesk at bold), and the weight is dropped: custom fonts carry
 *    their weight in the file, and Android falls back to the system face when both are set.
 *  - Glass. A rounded card painted with the palette's `card` or `surface` becomes glass: the glass
 *    fill, the stroke edge and the glass shadow, unless the style already sets its own edge colour or
 *    shadow. Squared bars, rows and anything with a deliberate colour are left alone.
 *
 * Exported for tests; screens never call it.
 */
export function midnightStyles(styles: Record<string, unknown>, c: Palette, isDark: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(styles)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      out[key] = raw;
      continue;
    }
    const st = { ...(raw as Record<string, unknown>) };
    const family = st.fontFamily as string | undefined;
    if (family && RETIRED_FAMILY[family]) {
      st.fontFamily = RETIRED_FAMILY[family];
    } else if (!family && (st.fontSize !== undefined || st.fontWeight !== undefined)) {
      st.fontFamily = FAMILY_BY_WEIGHT[String(st.fontWeight ?? '400')] ?? FAMILY_BY_WEIGHT['400'];
      delete st.fontWeight;
    }
    const radius = typeof st.borderRadius === 'number' ? st.borderRadius : 0;
    const paintsCard = st.backgroundColor === c.card || st.backgroundColor === c.surface;
    if (paintsCard && radius >= CARD_RADIUS && st.boxShadow === undefined && st.shadowColor === undefined) {
      st.backgroundColor = c.glassTop;
      if (st.borderColor === undefined || st.borderColor === c.border || st.borderColor === c.borderSoft) {
        st.borderColor = c.stroke;
        st.borderWidth = st.borderWidth ?? 1;
      }
      st.boxShadow = isDark ? shadows.glass : shadows.glassLight;
    }
    out[key] = st;
  }
  return out;
}

export function makeStyles<T extends NamedStyles<T> | NamedStyles<Record<string, unknown>>>(
  factory: (colors: Palette, elevation: ElevationFn) => T & NamedStyles<Record<string, unknown>>,
) {
  // One cache per makeStyles call site, keyed by scheme. Holds at most two
  // entries ('light' and 'dark'), so this is bounded, not a leak.
  const cache = new Map<ColorSchemeName, T>();

  return function useStyles(): T {
    const { scheme, colors, elevation } = useTheme();

    return useMemo(() => {
      const cached = cache.get(scheme);
      if (cached) return cached;

      const created = StyleSheet.create(midnightStyles(factory(colors, elevation), colors, scheme === 'dark') as T) as T;
      cache.set(scheme, created);
      return created;
    }, [scheme, colors, elevation]);
  };
}
