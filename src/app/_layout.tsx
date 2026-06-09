import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/store/auth';
import { useOnboarding } from '@/store/onboarding';
import { colors } from '@/theme';

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

  useEffect(() => {
    bootstrap();
    loadOnboarding();
  }, [bootstrap, loadOnboarding]);

  useProtectedRoute();

  return (
    <SafeAreaProvider>
      {status === 'idle' || status === 'loading' ? (
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
