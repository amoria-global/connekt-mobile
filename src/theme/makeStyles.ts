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

      const created = StyleSheet.create(factory(colors, elevation)) as T;
      cache.set(scheme, created);
      return created;
    }, [scheme, colors, elevation]);
  };
}
