import {
    addNotificationResponseListener,
    registerForPushNotifications,
} from '@/features/notifications/push';
import { notificationTarget } from '@/features/notifications/routing';
import { GlobalOpportunityCallNotifier } from '@/features/hybrid/GlobalOpportunityCallNotifier';
import { CurrencyButton } from '@/components/topbar/CurrencyButton';
import { useTheme } from '@/theme';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

export default function AppLayout() {
  const { isDark, colors: c } = useTheme();
  const router = useRouter();

  // Signed-in: register for push notifications and route taps. The (app)
  // group only mounts once authenticated, so this runs at the right time.
  // Push is native-only — skip on web (expo-notifications has no web push
  // and only logs "not supported" warnings there).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    registerForPushNotifications();
    const unsubscribe = addNotificationResponseListener((data) => {
      // Deep-link to the exact entity the notification is about.
      router.push(
        notificationTarget({
          type: typeof data.type === 'string' ? data.type : undefined,
          referenceId: typeof data.referenceId === 'string' ? data.referenceId : undefined,
          eventId: typeof data.eventId === 'string' ? data.eventId : undefined,
        }),
      );
    });
    return unsubscribe;
  }, [router]);

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          // Elevated surface headers — same chrome combo as TopBar /
          // PersistentBottomBar so light and dark stay consistent.
          headerTintColor: c.primary,
          headerStyle: { backgroundColor: c.elevated },
          headerTitleStyle: { color: c.text, fontWeight: '700' },
          contentStyle: { backgroundColor: c.background },
          headerBackButtonDisplayMode: 'minimal', // chevron only, no "‹ Home" text
          headerShadowVisible: false,
          // Display-currency selector on every headed screen, like the web topbar.
          // Form screens below opt out.
          headerRight: () => <CurrencyButton compact />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="event/new"
          options={{
            title: 'New event',
            headerRight: () => null,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="event/geo-pricing" options={{ title: 'Geo pricing' }} />
        <Stack.Screen
          name="event/hybrid-wizard"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen name="photographers" options={{ title: 'Photographers' }} />
        <Stack.Screen name="photographer/[id]" options={{ title: 'Photographer' }} />
        <Stack.Screen name="conversation/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="packages" options={{ title: 'My Packages' }} />
        <Stack.Screen name="package/new" options={{ title: 'New package', presentation: 'modal', headerRight: () => null }} />
        <Stack.Screen name="streams" options={{ title: 'Live Streams' }} />
        <Stack.Screen name="stream/[id]" options={{ title: 'Stream', headerShown: false }} />
        <Stack.Screen name="stream/control/[id]" options={{ title: 'Go Live', headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications', headerShown: false }} />
        <Stack.Screen name="find-my-photos" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
        <Stack.Screen
          name="album/new"
          options={{
            title: 'New album',
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="album/[id]" options={{ title: 'Album', headerShown: false }} />
        <Stack.Screen name="gallery" options={{ title: 'Gallery' }} />
        <Stack.Screen name="bookings" options={{ title: 'Bookings' }} />
        <Stack.Screen name="content-albums" options={{ title: 'Content Albums' }} />
        <Stack.Screen
          name="content-album/new"
          options={{
            title: 'New content album',
            headerShown: false,
          }}
        />
        <Stack.Screen name="photobooks" options={{ title: 'Photobooks' }} />
        <Stack.Screen name="photobook/[id]" options={{ title: 'Photobook', headerShown: false }} />
        <Stack.Screen name="photobook/new" options={{ title: 'New photobook', headerShown: false }} />
        <Stack.Screen name="wallet/movements" options={{ title: 'Wallet movements' }} />
        <Stack.Screen name="withdraw" options={{ title: 'Withdraw' }} />
        <Stack.Screen name="payment-accounts" options={{ title: 'Payment accounts' }} />
        <Stack.Screen name="transactions" options={{ title: 'Transactions' }} />
        <Stack.Screen name="payroll" options={{ title: 'Payroll report' }} />
        <Stack.Screen name="analytics" options={{ title: 'Analytics', headerShown: false }} />
        <Stack.Screen name="payments" options={{ title: 'Payments' }} />
        <Stack.Screen name="payment/[id]" options={{ title: 'Payment' }} />
        <Stack.Screen name="donations" options={{ title: 'Donate' }} />
        <Stack.Screen name="clients" options={{ title: 'Clients' }} />
        <Stack.Screen name="client/[id]" options={{ title: 'Client' }} />
        <Stack.Screen name="two-factor" options={{ title: 'Two-factor' }} />
        <Stack.Screen name="tv-devices" options={{ title: 'Manage TVs' }} />
        <Stack.Screen
          name="connect-to-tv"
          options={{ title: 'Connect to TV', presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="pay-on-tv"
          options={{ title: 'Pay on TV', presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen name="kyc" options={{ headerShown: false }} />
        <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
        <Stack.Screen name="blocked-accounts" options={{ title: 'Blocked accounts' }} />
        <Stack.Screen name="collaborate/index" options={{ title: 'Collaborate' }} />
        <Stack.Screen name="collaborate/album/[id]" options={{ title: 'Album' }} />
        <Stack.Screen name="collaborate/joined/[id]" options={{ title: 'Album' }} />
        <Stack.Screen name="collaborate/join/[token]" options={{ title: 'Join album' }} />
      </Stack>
      <GlobalOpportunityCallNotifier />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}
