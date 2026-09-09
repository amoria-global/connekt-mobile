import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/theme';

/** Guest-accessible screens (no login required). */
export default function PublicLayout() {
  const { colors } = useTheme();
  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.textOnPrimary,
          headerStyle: { backgroundColor: colors.primary },
          headerTitleStyle: { color: colors.textOnPrimary, fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="explore-events" options={{ title: 'Explore events' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="events/join" options={{ title: 'Join event' }} />
        <Stack.Screen name="events/pay" options={{ title: 'Payment' }} />
        <Stack.Screen name="events/live-stream" options={{ title: 'Live stream' }} />
        <Stack.Screen name="donate" options={{ title: 'Donate' }} />
        <Stack.Screen name="find-photos" options={{ title: 'Find My Photos' }} />
        <Stack.Screen name="browse-photos" options={{ title: 'Browse Photos' }} />
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
      <StatusBar style="light" />
    </>
  );
}
