# Theme & dark mode

The app follows the device's system Light/Dark setting. `app.json` sets
`userInterfaceStyle: "automatic"`, `ThemeProvider` reads `useColorScheme()`, and
screens consume the active palette through `useTheme()` / `makeStyles()`.

| Piece | File |
|---|---|
| Light + dark palettes | `palettes.ts` |
| Provider reading the OS scheme | `ThemeProvider.tsx` (mounted in `src/app/_layout.tsx`) |
| `useTheme()` hook | `ThemeProvider.tsx` |
| `makeStyles()` | `makeStyles.ts` |

## Designing for dark — not just inverting

A straight palette inversion reads as amateurish, because the things carrying
visual hierarchy in light mode stop working. Three rules this system encodes:

**1. Elevation cannot be a shadow.** Light mode separates a card from the page
with a black drop shadow. On `#0E1117` a black shadow is invisible, so cards
collapse into the background and the whole UI flattens. Dark mode therefore
carries elevation as *surface lightness* (`surface` → `card` → `elevated`, even
~10% luminance steps) plus a hairline border. Use `elevation(level)`, never a
hand-written `shadowColor`:

```tsx
const useStyles = makeStyles((c, e) => ({
  card: { ...e(2), backgroundColor: c.card, borderRadius: radii.lg },
}));
```

Levels: 0 flat · 1 resting card · 2 raised / segmented · 3 sheet / menu · 4 FAB.

`elevation()` returns **shadow properties only**. It deliberately does not set
`backgroundColor` or `borderColor` — call sites spread it last (`{ ...s, ...e(4) }`),
so doing that silently overrode deliberate colour choices. It once turned the
onboarding hero's white CTA into a grey blob and its white photo ring grey.
Depth in dark comes from the palette's surface steps (which components apply
themselves) plus much stronger shadows.

## React Navigation paints the canvas — theme it too

Migrating screens to `makeStyles` is NOT sufficient on its own. React
Navigation renders the screen background itself, and its default theme is
WHITE. Any screen that does not explicitly paint its own background therefore
rendered white in dark mode however well its own styles were themed — which is
why, for a while, only the login screen looked correct (it happens to set
`backgroundColor: c.surface` on its container).

`navigationTheme.ts` adapts our palette to React Navigation's `Theme`, and
`NavigationChrome` in `src/app/_layout.tsx` feeds it in. That covers all six
navigators at once. Individual layouts additionally set
`contentStyle: { backgroundColor: colors.background }` so the canvas is explicit
rather than inherited.

**If you add a new navigator, give it a themed `contentStyle`.**

## Fixed-dark surfaces

Not every screen should follow the scheme. `(onboarding)/welcome.tsx` is a
full-bleed photo under a navy scrim with white type — a *media* surface, not an
app surface. Its chrome is pinned to literals (`SCRIM_NAVY`, `ON_MEDIA`,
`ON_MEDIA_INK`) and renders identically in both schemes. Theming it to
`c.surface` / `c.primary` is what made dark mode look broken there.

Rule of thumb: **if the element sits on photography or video, it is on-media and
should be fixed light-on-dark. If it sits on the app background, theme it.**

**2. Tints must be rebuilt, not reused.** `rgba(8,58,133,0.08)` is designed
against white; over a dark ground it vanishes. Use `c.tint` / `c.tintAccent`,
which are lighter and more opaque in dark.

**3. Gradients need different stops per scheme.** Use `gradients.brand` /
`gradients.wash` from `useTheme()`. The old inline array
`[colors.primary, '#0a4da3', colors.accent]` hardcoded a light-mode navy
mid-stop, so with a brightened dark `primary` the ramp ran light → *dark* →
pink: non-monotonic and muddy.

## Writing themed UI

```tsx
import { makeStyles, useTheme, spacing } from '@/theme';

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderColor: c.border, padding: spacing.md },
  title: { color: c.text },
}));

export function Card() {
  const styles = useStyles();           // hook — must be inside the component
  const { colors, isDark } = useTheme(); // for one-off colours
  return <View style={styles.card}><ActivityIndicator color={colors.primary} /></View>;
}
```

Only colours are scheme-dependent. `spacing`, `radii`, `fontSize`, `fontWeight`
and `fonts` are constants — keep importing them from `@/theme` directly.

## Rules

1. **Never import `colors` from `@/theme` in new code.** That export is the
   STATIC light palette, kept only so nothing broke during migration. It cannot
   follow the scheme. Use `makeStyles` (stylesheets) or `useTheme` (values).
2. **Never call `StyleSheet.create` at module scope with a colour.** It is
   evaluated once at import, so the colour is frozen for the life of the JS
   context and will not react to the phone switching schemes. This is the single
   mistake that silently reintroduces the original bug.
3. **Both palettes must have identical keys.** `darkPalette` is typed as
   `Palette` (derived from `lightPalette`), so a missing key fails typecheck.
4. **Call `useStyles()` inside the component**, not at module scope — it is a hook.
5. **Never hardcode a hex** where a token exists (see the root `CLAUDE.md`).

## Deliberately NOT theme-aware

Some surfaces are fixed by design and must stay that way:

- `PhoneInput`'s `DARK` palette — selected by the `dark` prop for stream
  overlays and dark sheets. Independent of the system scheme. Its `LIGHT`
  counterpart *is* theme-aware (`makeLight(colors)`).
- The gifting overlays (`GiftTray`, `GiftOverlay`) sit on a fixed dark glass
  over video. They now read the palette, but only use `accent` /
  `textOnPrimary` (identical in both schemes) and `primary`.
- Blue-header detail screens keep `StatusBar style="light"` in both schemes —
  the header is brand blue regardless.

## Status bars

- `src/app/_layout.tsx` → `<ThemedStatusBar />` (`isDark ? 'light' : 'dark'`).
  Split into its own component because `RootLayout` renders the provider and
  therefore cannot consume the context itself.
- `src/app/(app)/_layout.tsx` → `inTabs ? (isDark ? 'light' : 'dark') : 'light'`.
  Tab screens follow the scheme; blue-header detail screens stay light-on-blue.

## Contrast

Both palettes were checked against WCAG AA (4.5:1 body text, 3:1 large/UI) with
a script over 14 foreground/background pairs. Two pairs sit at AA-large and are
button fills, not body text: `accent on background` (light, 3.72 — pre-existing)
and `primary on background` (dark, 3.26).

## Verifying

- **iOS Simulator** — Features ▸ Toggle Appearance (⇧⌘A)
- **Android emulator** — Settings ▸ Display ▸ Dark theme
- **Physical device** — flip the system setting with the app foregrounded. The
  provider re-renders live, so the UI changes without a restart.
- **Web** — `yarn web`, then toggle the OS/browser `prefers-color-scheme`.
