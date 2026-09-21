import { Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme';

/** Guest-accessible screens (no login required). */
export default function PublicLayout() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const fallback = status === 'authenticated' ? '/(tabs)' : '/login';

  const renderBackToLogin = (tintColor?: string) => (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))}
      hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingRight: 8 }}
      accessibilityRole="button"
      accessibilityLabel={status === 'authenticated' ? 'Back' : 'Back to sign in'}
    >
      <Ionicons name="chevron-back" size={22} color={tintColor || colors.primary} />
      <Text style={{ color: tintColor || colors.primary, fontSize: 14, fontWeight: '700', marginLeft: -2 }}>
        {status === 'authenticated' ? 'Back' : 'Sign in'}
      </Text>
    </Pressable>
  );

  const renderBackOnly = (tintColor?: string) => (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))}
      hitSlop={12}
      style={({ pressed }) => [{
        padding: 6,
        marginLeft: -2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      }]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={24} color={tintColor || colors.primary} />
    </Pressable>
  );

  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.elevated },
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerLeft: () => renderBackOnly(),
        }}
      >
        <Stack.Screen
          name="explore-events"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="event/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="events/join" options={{ title: 'Join event' }} />
        <Stack.Screen name="events/pay" options={{ title: 'Payment' }} />
        <Stack.Screen
          name="events/live-stream"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="donate"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="find-photos"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="browse-photos"
          options={{
            title: 'Browse Photos',
            headerLeft: () => renderBackToLogin(),
          }}
        />
        <Stack.Screen name="gallery" options={{ title: 'Gallery' }} />
        <Stack.Screen name="help-center/index" options={{ title: 'Help Center' }} />
        <Stack.Screen name="help-center/booking" options={{ title: 'Booking Help' }} />
        <Stack.Screen name="help-center/my-account" options={{ title: 'My Account Help' }} />
        <Stack.Screen name="help-center/payment-methods" options={{ title: 'Payment Methods' }} />
        <Stack.Screen name="help-center/payment" options={{ title: 'Payment Help' }} />
        <Stack.Screen name="help-center/security" options={{ title: 'Security Help' }} />
        <Stack.Screen name="help-center/technical-support" options={{ title: 'Technical Support' }} />
        <Stack.Screen name="contact_us" options={{ title: 'Contact us' }} />
        <Stack.Screen name="feedback" options={{ title: 'Send feedback' }} />
        <Stack.Screen name="privacy-policy" options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="terms-of-service" options={{ title: 'Terms & Conditions' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
        <Stack.Screen name="trust-safety" options={{ title: 'Trust & Safety' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
