/**
 * Theme provider — the single place the OS colour scheme enters the app.
 *
 * Before this existed, `src/theme/index.ts` exported one hardcoded light
 * palette and nothing in `src/` referenced `useColorScheme` or `Appearance`,
 * so the app could not follow the phone no matter what `app.json` said.
 * (`app.json` already sets `userInterfaceStyle: "automatic"`, so the OS was
 * reporting the scheme correctly — the app simply never read it.)
 *
 * `preference` allows a future in-app Light/Dark/System setting: pass
 * 'system' (default) to follow the phone, or force a scheme. Persisting that
 * choice is deliberately NOT handled here — wire it to the settings store
 * when the setting ships.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { makeElevation, type ElevationFn } from './elevation';
import {
  gradientsFor,
  palettes,
  type ColorSchemeName,
  type Gradients,
  type Palette,
} from './palettes';

export type ThemePreference = ColorSchemeName | 'system';

type ThemeContextValue = {
  /** The scheme actually in effect after applying `preference`. */
  scheme: ColorSchemeName;
  /** Convenience flag — `scheme === 'dark'`. */
  isDark: boolean;
  /** The palette for the active scheme. */
  colors: Palette;
  /** Brand gradients for the active scheme (light and dark use DIFFERENT stops). */
  gradients: Gradients;
  /**
   * Scheme-correct elevation. In light mode a cast shadow; in dark a lifted
   * surface + hairline, because a black shadow does not register on a dark
   * ground. See ./elevation.ts.
   */
  elevation: ElevationFn;
};

/**
 * Default matches the pre-existing behaviour (light), so a component rendered
 * outside the provider degrades to exactly what it did before rather than
 * crashing or flashing dark.
 */
const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'light',
  isDark: false,
  colors: palettes.light,
  gradients: gradientsFor('light'),
  elevation: makeElevation('light', palettes.light),
});

export function ThemeProvider({
  children,
  preference = 'system',
}: {
  children: ReactNode;
  preference?: ThemePreference;
}) {
  // Returns 'light' | 'dark' | null. null happens on some Android versions and
  // in tests — treat it as light, matching the historical default.
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: ColorSchemeName =
      preference === 'system' ? (systemScheme ?? 'light') : preference;
    const colors = palettes[scheme];

    return {
      scheme,
      isDark: scheme === 'dark',
      colors,
      gradients: gradientsFor(scheme),
      elevation: makeElevation(scheme, colors),
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Active theme. Re-renders the calling component when the phone's scheme
 * changes, which is what makes dark mode live rather than launch-only.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
