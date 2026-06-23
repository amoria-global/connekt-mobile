import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PragatiNarrow_400Regular,
  PragatiNarrow_700Bold,
} from '@expo-google-fonts/pragati-narrow';
import { useAuth } from '@/store/auth';
import { useOnboarding } from '@/store/onboarding';
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
type ForwardRefRenderable = {
  render: (props: { style?: unknown }, ref: unknown) => unknown;
};

let fontDefaultsApplied = false;

function applyDefaultFont() {
  if (fontDefaultsApplied) return;
  fontDefaultsApplied = true;

  const injectFamily = (component: unknown) => {
    const c = component as Partial<ForwardRefRenderable>;
    const original = c.render;
    if (typeof original !== 'function') return;
    (c as ForwardRefRenderable).render = function patchedRender(props, ref) {
      const next = {
        ...props,
        style: [{ fontFamily: 'PragatiNarrow_400Regular' }, props?.style],
      };
      return original.call(this, next, ref);
    };
  };

  injectFamily(Text);
  injectFamily(TextInput);
}

/**
 * Redirects between the (onboarding), (auth) and (app) groups based on auth
 * status and whether first-launch onboarding has been completed.
 */
function useProtectedRoute() {
  const status = useAuth((s) => s.status);
  const seen = useOnboarding((s) => s.seen);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;
    // Wait for the onboarding flag before routing an unauthenticated user.
    if (status === 'unauthenticated' && seen === null) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === '(onboarding)';
    // Guest-browsable screens (explore events / find photos) need no login.
    const inPublic = group === '(public)';

    if (status === 'authenticated') {
      if (inAuthGroup || inOnboarding) router.replace('/');
      return;
    }

    // Unauthenticated: show onboarding first, then auth — but allow (public).
    if (!seen) {
      if (!inOnboarding && !inPublic) router.replace('/splash');
    } else if (!inAuthGroup && !inPublic) {
      router.replace('/login');
    }
  }, [status, seen, segments, router]);
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

  useProtectedRoute();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {status === 'idle' || status === 'loading' || !fontsLoaded ? (
          <View style={styles.splash}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(app)" />
          </Stack>
        )}
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = {
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
} as const;
