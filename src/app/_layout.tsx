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
 * 'Segoe UI', 'Roboto'…`). React Native has no CSS-style "body font",
 * so the canonical way is overriding `defaultProps.style` once at
 * boot. `weight: '700'` callers already in the codebase pick up
 * PragatiNarrow_700Bold automatically; everything else uses the
 * 400-weight regular.
 */
function applyDefaultFont() {
  const TextAny = Text as unknown as { defaultProps?: { style?: unknown } };
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  const existing = (TextAny.defaultProps.style ?? {}) as Record<string, unknown>;
  TextAny.defaultProps.style = [existing, { fontFamily: 'PragatiNarrow_400Regular' }];

  const InputAny = TextInput as unknown as { defaultProps?: { style?: unknown } };
  InputAny.defaultProps = InputAny.defaultProps ?? {};
  const inputExisting = (InputAny.defaultProps.style ?? {}) as Record<string, unknown>;
  InputAny.defaultProps.style = [inputExisting, { fontFamily: 'PragatiNarrow_400Regular' }];
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
