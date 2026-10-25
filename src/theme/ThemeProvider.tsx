/**
 * Theme provider — the single place the OS colour scheme enters the app.
 *
 * Before this existed, `src/theme/index.ts` exported one hardcoded light
 * palette and nothing in `src/` referenced `useColorScheme` or `Appearance`,
 * so the app could not follow the phone no matter what `app.json` said.
 * (`app.json` already sets `userInterfaceStyle: "automatic"`, so the OS was
 * reporting the scheme correctly — the app simply never read it.)
 *
 * Midnight Glass is the default, so with nothing saved the app is dark whatever the
 * phone says. The Profile header's appearance button saves 'light' or 'dark' on this
 * device through `setPreference`. A `preference` prop overrides both, for tests.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { storage, StorageKeys } from '@/services/storage';
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
  /** The saved choice ('dark' unless the person picked otherwise). */
  preference: ThemePreference;
  /** Saves a new choice on this device and applies it at once. */
  setPreference: (next: ThemePreference) => void;
};

const DEFAULT_PREFERENCE: ThemePreference = 'dark';
const isPreference = (v: unknown): v is ThemePreference => v === 'light' || v === 'dark' || v === 'system';

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
  preference: 'light',
  setPreference: () => {},
});

export function ThemeProvider({
  children,
  preference: forced,
}: {
  children: ReactNode;
  preference?: ThemePreference;
}) {
  // Returns 'light' | 'dark' | 'unspecified' (React Native 0.86). Anything
  // that is not an explicit 'dark' is treated as light.
  const systemScheme = useColorScheme();
  const [saved, setSaved] = useState<ThemePreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    if (forced) return;
    storage
      .get(StorageKeys.themePreference)
      .then((v) => isPreference(v) && setSaved(v))
      .catch(() => {});
  }, [forced]);

  const setPreference = useCallback((next: ThemePreference) => {
    setSaved(next);
    storage.set(StorageKeys.themePreference, next).catch(() => {});
  }, []);

  const preference = forced ?? saved;

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: ColorSchemeName =
      preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
    const colors = palettes[scheme];

    return {
      scheme,
      isDark: scheme === 'dark',
      colors,
      gradients: gradientsFor(scheme),
      elevation: makeElevation(scheme, colors),
      preference,
      setPreference,
    };
  }, [preference, systemScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Active theme. Re-renders the calling component when the phone's scheme
 * changes, which is what makes dark mode live rather than launch-only.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
