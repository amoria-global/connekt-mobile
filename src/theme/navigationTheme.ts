/**
 * Adapter: our palette -> React Navigation's `Theme`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Migrating every screen to `makeStyles` was not enough. React Navigation
 * paints the screen canvas itself, and its DEFAULT theme has a WHITE
 * background. Any screen that does not explicitly paint its own background
 * therefore rendered white in dark mode, no matter how well its own styles
 * were themed. Only screens that happened to set `backgroundColor` on their
 * root container (login, for one) looked correct — which is exactly the
 * "only the login page follows the theme" symptom.
 *
 * Feeding this theme to `ThemeProvider` from `expo-router/react-navigation` fixes
 * every navigator at once — all six `_layout.tsx` files — because expo-router
 * is built on React Navigation. It covers the screen canvas, the default
 * header, and the hairline borders between navigation chrome and content.
 *
 * Per-navigator `screenOptions` still win where a screen wants branded chrome
 * (e.g. the blue detail headers in `(app)/_layout.tsx`).
 */
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation';

import type { ColorSchemeName, Palette } from './palettes';

export function navigationThemeFor(scheme: ColorSchemeName, c: Palette): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      /** Tint for back chevrons, active tab icons, and other interactive chrome. */
      primary: c.primary,
      /** The screen canvas — the fix for white-in-dark-mode screens. */
      background: c.background,
      /** Header and tab-bar surface. */
      card: c.surface,
      text: c.text,
      border: c.border,
      /** Badge / notification dot. */
      notification: c.accent,
    },
  };
}
