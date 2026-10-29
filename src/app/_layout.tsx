import { useEffect, useState } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments, type Href } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

if (
  Platform.OS === 'web' &&
  TextInput.State &&
  typeof TextInput.State.currentlyFocusedInput !== 'function'
) {
  TextInput.State.currentlyFocusedInput = () =>
    typeof TextInput.State.currentlyFocusedField === 'function'
      ? (TextInput.State.currentlyFocusedField() as any)
      : null;
}
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PragatiNarrow_400Regular, PragatiNarrow_700Bold } from '@expo-google-fonts/pragati-narrow';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useAuth } from '@/store/auth';
import { takePendingScanEvent } from '@/features/events/scanIntent';
import { resolveDeferredLink, takePendingDestination } from '@/features/links/deferredLink';
import { isPhotographerType } from '@/features/auth/role';
import { takePendingInviteHref } from '@/features/workspace/pendingInvite';
import { useCurrency } from '@/store/currency';
import { useOnboarding } from '@/store/onboarding';
import { UpdatePromptModal } from '@/features/updates';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import { useTheme, ThemeProvider, navigationThemeFor } from '@/theme';
import { AppPreloader } from '@/components/ui/AppPreloader';
import { GlobalHelpButton } from '@/components/help/GlobalHelpButton';

// Keep native splash screen visible while fonts and auth bootstrap resolve
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

/**
 * Default every `<Text>` and `<TextInput>` to Inter, the Midnight Glass body
 * face (design/brief.png). Headings set Space Grotesk through `fonts`.
 *
 * React 19 silently drops `defaultProps` on function/forwardRef
 * components, so the earlier `Text.defaultProps = …` approach was a
 * no-op. The reliable workaround is to wrap the underlying `render`
 * function on the forwardRef object — every `<Text>` call ultimately
 * routes through it, so injecting `{ fontFamily }` into the style
 * array there makes the family default global.
 *
 * Style arrays merge right-to-left, so any inline `fontFamily:
 * fonts.bold` still wins.
 */
function applyDefaultFont() {
  // Web (react-native-web): inject a low-specificity CSS default so every
  // Text / input that doesn't set its own fontFamily inherits Inter.
  // Components that DO set a family (e.g. SpaceGrotesk_700Bold on
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
  // The clean fix: build ONE real "Inter" family (400..800) from
  // the already-loaded font files, then REDEFINE the exact fallback family
  // names in RNW's system stack to point at it. Unstyled text resolves to
  // one of those names → renders Inter, with fontWeight still selecting the
  // true bold face. Our explicit `fonts.*` families and the icon
  // fonts are untouched (they're not in the hijack list), so bold and icons
  // keep working — no `!important`, no specificity fight.
  let regular: string | undefined;
  let medium: string | undefined;
  let semibold: string | undefined;
  let displayMedium: string | undefined;
  let displayBold: string | undefined;
  try {
    // Dynamically require expo-asset only on web where @font-face CSS injection is needed.
    // Prevents native iOS/Android from evaluating requireNativeModule('ExpoAsset') on startup.
    const resolveUri = (mod: unknown): string | undefined => {
      if (typeof mod === 'string') return mod;
      const { Asset } = require('expo-asset') as typeof import('expo-asset');
      return Asset.fromModule(mod as number).uri;
    };
    regular = resolveUri(Inter_400Regular);
    medium = resolveUri(Inter_500Medium) ?? regular;
    semibold = resolveUri(Inter_600SemiBold) ?? regular;
    displayMedium = resolveUri(SpaceGrotesk_600SemiBold) ?? semibold;
    displayBold = resolveUri(SpaceGrotesk_700Bold) ?? semibold;
  } catch {
    /* asset uris unavailable — skip; screens that set `fonts.*` still render Inter */
  }
  if (!regular || !semibold) return;

  const face = (family: string) =>
    `@font-face{font-family:${family};font-style:normal;font-weight:400;src:url("${regular}") format("truetype");}` +
    `@font-face{font-family:${family};font-style:normal;font-weight:500;src:url("${medium}") format("truetype");}` +
    `@font-face{font-family:${family};font-style:normal;font-weight:600;src:url("${semibold}") format("truetype");}` +
    `@font-face{font-family:${family};font-style:normal;font-weight:700;src:url("${semibold}") format("truetype");}` +
    `@font-face{font-family:${family};font-style:normal;font-weight:800;src:url("${displayBold ?? semibold}") format("truetype");}`;

  const namedFaces = [
    `@font-face{font-family:"Inter_400Regular";font-style:normal;font-weight:100 900;src:url("${regular}") format("truetype");}`,
    `@font-face{font-family:"Inter_500Medium";font-style:normal;font-weight:100 900;src:url("${medium}") format("truetype");}`,
    `@font-face{font-family:"Inter_600SemiBold";font-style:normal;font-weight:100 900;src:url("${semibold}") format("truetype");}`,
    displayMedium
      ? `@font-face{font-family:"SpaceGrotesk_600SemiBold";font-style:normal;font-weight:100 900;src:url("${displayMedium}") format("truetype");}`
      : '',
    displayBold
      ? `@font-face{font-family:"SpaceGrotesk_700Bold";font-style:normal;font-weight:100 900;src:url("${displayBold}") format("truetype");}`
      : '',
  ].join('');

  // The real family + the system-stack names browsers actually fall back to.
  const families = [
    "'Inter'",
    "'Segoe UI'",
    'Roboto',
    'Helvetica',
    'Arial',
    'BlinkMacSystemFont',
    '-apple-system',
    'system-ui',
  ];
  const stack =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const style = document.createElement('style');
  style.id = id;
  style.textContent =
    namedFaces +
    families.map(face).join('') +
    // Catch UA-styled elements (body, form controls) that don't use the RN stack.
    `html,body,input,textarea,button,select{font-family:${stack};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}`;
  document.head.appendChild(style);
}

/**
 * Redirects between the (onboarding), (auth) and (app) groups based on auth
 * status and whether first-launch onboarding has been completed.
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

  // First launch after an install: ask for the page the visitor's shared link or QR was going to. It is kept on disk and
  // delivered by goOr below once they are signed in; if they already are (a reinstall), take it straight away.
  useEffect(() => {
    if (!navigationState?.key) return;
    let cancelled = false;
    resolveDeferredLink().then((href) => {
      if (cancelled || !href) return;
      const { status: now } = useAuth.getState();
      if (now === 'authenticated' && useOnboarding.getState().termsAccepted === true) {
        takePendingDestination().then((h) => { if (h) router.replace(h as Href); }).catch(() => undefined);
      }
    });
    return () => { cancelled = true; };
    // Once per launch: the check itself remembers whether this install already asked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationState?.key]);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (status === 'idle' || status === 'loading') return;
    // Wait for the onboarding flag before routing an unauthenticated user.
    if (status === 'unauthenticated' && seen === null) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === '(onboarding)';
    // Guest-browsable screens (explore events, find photos, donate, legal, help) need no login.
    const inPublic = group === '(public)';
    const onTerms = (segments as string[]).includes('terms');

    // First install: force the Terms & Conditions screen before anything
    // else (persisted, so it only happens once). Wait until storage has
    // been read (termsAccepted !== null).
    if (termsAccepted === false) {
      if (!onTerms) router.replace('/terms' as Href);
      return;
    }
    if (termsAccepted === null) return;

    // A scanned event QR outranks the default landing screen: once terms and
    // sign-in are out of the way, deliver the viewer to the event they scanned.
    const goOr = (fallback: string, signedIn = false) => {
      // A workspace invitation the person signed up or in for outranks everything else: it is why they are here. Only
      // taken once signed in, so it is not spent on the way to the sign-in screen.
      const invite = signedIn
        ? takePendingInviteHref(isPhotographerType(useAuth.getState().user?.customerType)).catch(() => null)
        : Promise.resolve<string | null>(null);
      invite.then((href) => {
        if (href) {
          router.replace(href as Href);
          return;
        }
        // The page a shared link or QR was going to before the app was installed (see features/links/deferredLink).
        takePendingDestination()
          .catch(() => null)
          .then((href) => {
            if (href) {
              router.replace(href as Href);
              return;
            }
            takePendingScanEvent()
              .catch(() => null)
              .then((eventId) => router.replace((eventId ? `/(public)/event/${eventId}?src=qr` : fallback) as Href));
          });
      });
    };

    if (status === 'authenticated') {
      if (inAuthGroup || inOnboarding) goOr('/', true);
      return;
    }

    // Unauthenticated: show onboarding intro slides, then auth — but allow (public).
    if (!seen) {
      if (!inOnboarding && !inPublic) goOr('/welcome');
    } else if (!inAuthGroup && !inPublic) {
      goOr('/login');
    }
  }, [navigationState?.key, status, seen, termsAccepted, segments, router]);
}

export default function RootLayout() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const loadOnboarding = useOnboarding((s) => s.load);
  const loadCurrency = useCurrency((s) => s.load);
  const syncCurrency = useCurrency((s) => s.syncWithAccount);
  const authStatus = useAuth((s) => s.status);
  // Pragati Narrow stays loaded until the last screen that names it is migrated.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    PragatiNarrow_400Regular,
    PragatiNarrow_700Bold,
  });

  const [preloaderDone, setPreloaderDone] = useState(false);

  useEffect(() => {
    bootstrap();
    loadOnboarding();
    loadCurrency();
  }, [bootstrap, loadOnboarding, loadCurrency]);

  // Signed in: adopt the currency saved on the account so web and mobile agree.
  useEffect(() => {
    if (authStatus === 'authenticated') syncCurrency();
  }, [authStatus, syncCurrency]);

  // Hide the native static splash screen immediately so the full-screen video
  // preloader is revealed and plays from the very first frame
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Apply the global Inter default on web mount and once the Google Font has
  // loaded — `applyDefaultFont` is a no-op on native.
  useEffect(() => {
    applyDefaultFont();
  }, [fontsLoaded]);

  useProtectedRoute();

  return (
    <ThemeProvider>
      <NavigationChrome>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(app)" />
          </Stack>
          {!preloaderDone ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <AppPreloader
                fontsLoaded={fontsLoaded}
                onFinish={() => setPreloaderDone(true)}
              />
            </View>
          ) : null}
          {/* Help: on every screen, bottom right. Waits for the intro video; steps aside where it would cover a control. */}
          <GlobalHelpButton ready={preloaderDone} />
          {/* Mandatory OTA update prompt (blocking, one action) */}
          <UpdatePromptModal />
          {/* Screens are theme-aware now, so the status bar follows suit:
              light icons on dark surfaces, dark icons on light ones. */}
          <ThemedStatusBar />
        </SafeAreaProvider>
      </GestureHandlerRootView>
      </NavigationChrome>
    </ThemeProvider>
  );
}

/**
 * Feeds our palette to React Navigation, whose own default theme paints a
 * WHITE screen canvas. Without this, every screen that does not explicitly set
 * its own background renders white in dark mode — which is the "only the
 * login page follows the theme" bug, since login happened to paint its own.
 *
 * Must sit INSIDE our ThemeProvider (it consumes the scheme) and OUTSIDE the
 * navigators, so all six `_layout.tsx` files inherit it.
 */
function NavigationChrome({ children }: { children: React.ReactNode }) {
  const { scheme, colors: c } = useTheme();
  return (
    <NavigationThemeProvider value={navigationThemeFor(scheme, c)}>
      {children}
    </NavigationThemeProvider>
  );
}

/**
 * Split out so it can call `useTheme()` — RootLayout renders the provider, so
 * it cannot consume the context itself.
 */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
