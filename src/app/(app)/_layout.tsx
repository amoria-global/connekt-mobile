import { useEffect } from 'react';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { PersistentBottomBar } from '@/components/PersistentBottomBar';
import {
  addNotificationResponseListener,
  registerForPushNotifications,
} from '@/features/notifications/push';
import { notificationTarget } from '@/features/notifications/routing';
import { colors, useTheme } from '@/theme';

export default function AppLayout() {
  const { isDark, colors: c } = useTheme();
  const segments = useSegments() as string[];
  const router = useRouter();
  // Tab screens are light → dark status icons; blue-header detail screens → light.
  const inTabs = segments.includes('(tabs)');

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
          // Branded blue headers, matching the top/bottom chrome.
          // Branded blue headers. Uses the ACTIVE palette, not the static
          // light one: dark mode brightens `primary`, which keeps the header
          // distinct from the near-black canvas instead of merging into it.
          headerTintColor: c.textOnPrimary, // white chevron / back
          headerStyle: { backgroundColor: c.primary },
          headerTitleStyle: { color: c.textOnPrimary, fontWeight: '700' },
          contentStyle: { backgroundColor: c.background },
          headerBackButtonDisplayMode: 'minimal', // chevron only, no "‹ Home" text
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="event/new"
          options={{
            title: 'New event',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="event/geo-pricing" options={{ title: 'Geo pricing' }} />
        <Stack.Screen name="photographers" options={{ title: 'Photographers' }} />
        <Stack.Screen name="photographer/[id]" options={{ title: 'Photographer' }} />
        <Stack.Screen name="conversation/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="packages" options={{ title: 'My Packages' }} />
        <Stack.Screen name="package/new" options={{ title: 'New package', presentation: 'modal' }} />
        <Stack.Screen name="streams" options={{ title: 'Live Streams' }} />
        <Stack.Screen name="stream/[id]" options={{ title: 'Stream' }} />
        <Stack.Screen name="stream/control/[id]" options={{ title: 'Go Live' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="find-my-photos" options={{ title: 'Find My Photos' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="preferences" options={{ title: 'Notifications' }} />
        <Stack.Screen
          name="album/new"
          options={{
            title: 'New album',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="album/[id]" options={{ title: 'Album' }} />
        <Stack.Screen name="gallery" options={{ title: 'Gallery' }} />
        <Stack.Screen name="bookings" options={{ title: 'Bookings' }} />
        <Stack.Screen name="content-albums" options={{ title: 'Content Albums' }} />
        <Stack.Screen
          name="content-album/new"
          options={{
            title: 'New content album',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.8, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="photobooks" options={{ title: 'Photobooks' }} />
        <Stack.Screen name="photobook/[id]" options={{ title: 'Photobook' }} />
        <Stack.Screen name="photobook/new" options={{ title: 'New photobook', presentation: 'modal' }} />
        <Stack.Screen name="wallet/movements" options={{ title: 'Wallet movements' }} />
        <Stack.Screen name="withdraw" options={{ title: 'Withdraw' }} />
        <Stack.Screen name="transactions" options={{ title: 'Transactions' }} />
        <Stack.Screen name="payroll" options={{ title: 'Payroll report' }} />
        <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
        <Stack.Screen name="payments" options={{ title: 'Payments' }} />
        <Stack.Screen name="payment/[id]" options={{ title: 'Payment' }} />
        <Stack.Screen name="donations" options={{ title: 'Donate' }} />
        <Stack.Screen name="clients" options={{ title: 'Clients' }} />
        <Stack.Screen name="client/[id]" options={{ title: 'Client' }} />
        <Stack.Screen name="two-factor" options={{ title: 'Two-factor' }} />
        <Stack.Screen name="tv-devices" options={{ title: 'Manage TVs' }} />
        <Stack.Screen name="connect-to-tv" options={{ title: 'Connect to TV', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="pay-on-tv" options={{ title: 'Pay on TV', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="kyc" options={{ title: 'Verification' }} />
        <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
        <Stack.Screen name="blocked-accounts" options={{ title: 'Blocked accounts' }} />
        <Stack.Screen name="team/index" options={{ title: 'Team' }} />
        <Stack.Screen name="team/invite" options={{ title: 'Invite member', presentation: 'modal' }} />
        <Stack.Screen name="team/roles" options={{ title: 'Roles & permissions' }} />
        <Stack.Screen name="team/role/[id]" options={{ title: 'Role' }} />
        <Stack.Screen name="team/member/[id]" options={{ title: 'Member' }} />
      </Stack>
      {/*
       * Persistent bottom bar across every (app) route. The bar lives
       * *below* the Stack so it overlays each screen content. Detail
       * screens already pad their ScrollView contentContainerStyle with
       * paddingBottom 100+, so the bar doesn't cover anything important.
       */}
      <PersistentBottomBar />
      <StatusBar style={inTabs ? (isDark ? 'light' : 'dark') : 'light'} />
    </View>
  );
}
