import { useEffect, useState } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments, type Href } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PragatiNarrow_400Regular,
  PragatiNarrow_700Bold,
} from '@expo-google-fonts/pragati-narrow';
import { Asset } from 'expo-asset';
import { useAuth } from '@/store/auth';
import { useOnboarding } from '@/store/onboarding';
import { UpdateBanner } from '@/features/updates/UpdateBanner';
import { colors } from '@/theme';

/**
 * Default every `<Text>` and `<TextInput>` to Pragati Narrow so the
 * mobile app matches the web (knockout/app/globals.css line 43:
 * `font-family: 'Pragati Narrow', -apple-system, BlinkMacSystemFont,
 * 'Segoe UI', 'Roboto'…`).
 *
 * React 19 silently drops `defaultProps` on function/forwardRef
 * components, so the earlier `Text.defaultProps = …` approach was a
 * no-op. The reliable workaround is to wrap the underlying `render`
 * function on the forwardRef object — every `<Text>` call ultimately
 * routes through it, so injecting `{ fontFamily }` into the style
 * array there makes the family default global.
 *
 * Style arrays merge right-to-left, so any inline `fontFamily:
 * 'PragatiNarrow_700Bold'` (e.g. the FindMyPhotos hero) still wins.
 */
function applyDefaultFont() {
  // Web (react-native-web): inject a low-specificity CSS default so every
  // Text / input that doesn't set its own fontFamily inherits Pragati
  // Narrow. Components that DO set a family (e.g. PragatiNarrow_700Bold on
  // headings) keep it — this only fills in the default. Patching RN's
  // internal Text.render is avoided on purpose: it crashes under React 19
  // in release. Native screens use the theme's `fonts` tokens directly.
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  const id = 'app-default-font';
  if (document.getElementById(id)) return;

  // Why not a universal `* { font-family }` rule? react-native-web gives
  // every <Text> a base `font: 14px System` class (specificity 0,1,0) that
  // resolves to the system stack (-apple-system, "Segoe UI", Roboto, …) and
  // outranks a `*` selector — so unstyled text stayed on the system font.
  // Forcing it with `!important` instead would flatten our real bold and
  // break the icon fonts (Ionicons et al.).
  //
  // The clean fix: build ONE real "Pragati Narrow" family (400 + 700) from
  // the already-loaded font files, then REDEFINE the exact fallback family
  // names in RNW's system stack to point at it. Unstyled text resolves to
  // one of those names → renders Pragati, with fontWeight still selecting the
  // true bold face. Our explicit `PragatiNarrow_*` families and the icon
  // fonts are untouched (they're not in the hijack list), so bold and icons
  // keep working — no `!important`, no specificity fight.
  let regular: string | undefined;
  let bold: string | undefined;
  try {
    regular = Asset.fromModule(PragatiNarrow_400Regular).uri;
    bold = Asset.fromModule(PragatiNarrow_700Bold).uri;
  } catch {
    /* asset uris unavailable — skip; branded screens still render Pragati */
  }
  if (!regular || !bold) return;

  const face = (family: string) =>
    `@font-face{font-family:${family};font-style:normal;font-weight:400;src:url("${regular}") format("truetype");}` +
    `@font-face{font-family:${family};font-style:normal;font-weight:700;src:url("${bold}") format("truetype");}`;

  // The real family + the system-stack names browsers actually fall back to.
  const families = ["'Pragati Narrow'", "'Segoe UI'", 'Roboto', 'Helvetica', 'Arial', 'BlinkMacSystemFont'];
  const stack =
    "'Pragati Narrow', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const style = document.createElement('style');
  style.id = id;
  style.textContent =
    families.map(face).join('') +
    // Catch UA-styled elements (body, form controls) that don't use the RN stack.
    `html,body,input,textarea,button,select{font-family:${stack};}`;
  document.head.appendChild(style);
}

/**
 * Redirects between the (onboarding), (auth) and (app) groups based on auth
 * status and whether first-launch onboarding has been completed.
 *
 * Returns whether routing has SETTLED — i.e. the current group is already the
 * one this user belongs in, so nothing is about to be redirected away.
 *
 * Why that matters: `/` resolves to `(app)/(tabs)/index`, the dashboard. The
 * redirect below can only run once the navigator is mounted (it waits on
 * `useRootNavigationState().key`), so on a cold start the dashboard renders —
 * and fires its data hooks — for a frame before onboarding/login replaces it.
 * The caller keeps the splash over the navigator until this flips true, which
 * removes that flash. It also covers sign-out, where the same race would
 * briefly re-expose the dashboard on the way to /login.
 */
function useProtectedRoute() {
  const status = useAuth((s) => s.status);
  const seen = useOnboarding((s) => s.seen);
  const termsAccepted = useOnboarding((s) => s.termsAccepted);
  const segments = useSegments();
  const router = useRouter();
  // undefined until the root <Stack> is actually mounted. The layout renders a
  // plain splash <View> (no navigator) while auth/fonts load, so without this
  // guard a redirect that fires the moment auth status resolves — but before
  // fonts finish, common on web — throws "Attempted to navigate before mounting
  // the Root Layout component."
  const navigationState = useRootNavigationState();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (status === 'idle' || status === 'loading') return;
    // Wait for the onboarding flag before routing an unauthenticated user.
    if (status === 'unauthenticated' && seen === null) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === '(onboarding)';
    // Guest-browsable screens (explore events / find photos) need no login.
    const inPublic = group === '(public)';
    const onTerms = (segments as string[]).includes('terms');

    /** Send the user elsewhere and keep the splash up until they land. */
    const go = (href: Href) => {
      setSettled(false);
      router.replace(href);
    };

    // First install: force the Terms & Conditions screen before anything
    // else (persisted, so it only happens once). Wait until storage has
    // been read (termsAccepted !== null).
    if (termsAccepted === false) {
      if (!onTerms) go('/terms' as Href);
      else setSettled(true);
      return;
    }
    if (termsAccepted === null) return;

    if (status === 'authenticated') {
      if (inAuthGroup || inOnboarding) go('/' as Href);
      else setSettled(true);
      return;
    }

    // Unauthenticated: show onboarding first, then auth — but allow (public).
    if (!seen) {
      if (!inOnboarding && !inPublic) go('/splash' as Href);
      else setSettled(true);
    } else if (!inAuthGroup && !inPublic) {
      go('/login' as Href);
    } else {
      setSettled(true);
    }
  }, [navigationState?.key, status, seen, termsAccepted, segments, router]);

  return settled;
}

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const loadOnboarding = useOnboarding((s) => s.load);
  const [fontsLoaded] = useFonts({
    PragatiNarrow_400Regular,
    PragatiNarrow_700Bold,
  });

  useEffect(() => {
    bootstrap();
    loadOnboarding();
  }, [bootstrap, loadOnboarding]);

  // Apply the global Pragati Narrow default ONCE the Google Font has
  // loaded — applying earlier would print the family name as text since
  // the font file isn't registered yet on Android.
  useEffect(() => {
    if (!fontsLoaded) return;
    applyDefaultFont();
  }, [fontsLoaded]);

  const routeSettled = useProtectedRoute();
  const booting = status === 'idle' || status === 'loading' || !fontsLoaded;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {booting ? (
          <View style={styles.splash}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          // The navigator has to be mounted for the route guard to redirect at
          // all, so it can't be withheld — instead the splash stays layered on
          // top until the guard confirms we're on the right screen. Without
          // this the dashboard (which owns `/`) flashes on every cold start.
          <View style={styles.flex}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(public)" />
              <Stack.Screen name="(app)" />
            </Stack>
            {routeSettled ? null : (
              <View style={[styles.splash, StyleSheet.absoluteFillObject]}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          </View>
        )}
        {/* OTA update prompt — appears once a downloaded update is ready. */}
        <UpdateBanner />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = {
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
} as const;
