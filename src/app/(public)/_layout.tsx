import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';

/** Guest-accessible screens (no login required). */
export default function PublicLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.textOnPrimary,
          headerStyle: { backgroundColor: colors.primary },
          headerTitleStyle: { color: colors.textOnPrimary, fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="explore-events" options={{ title: 'Explore events' }} />
        <Stack.Screen name="find-photos" options={{ title: 'Find My Photos' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
