import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { PersistentBottomBar } from '@/components/PersistentBottomBar';
import { colors } from '@/theme';

export default function AppLayout() {
  const segments = useSegments() as string[];
  // Tab screens are light → dark status icons; blue-header detail screens → light.
  const inTabs = segments.includes('(tabs)');

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          // Branded blue headers, matching the top/bottom chrome.
          headerTintColor: colors.textOnPrimary, // white chevron / back
          headerStyle: { backgroundColor: colors.primary },
          headerTitleStyle: { color: colors.textOnPrimary, fontWeight: '700' },
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
        <Stack.Screen name="photographers" options={{ title: 'Photographers' }} />
        <Stack.Screen name="photographer/[id]" options={{ title: 'Photographer' }} />
        <Stack.Screen name="conversation/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="packages" options={{ title: 'My Packages' }} />
        <Stack.Screen name="package/new" options={{ title: 'New package', presentation: 'modal' }} />
        <Stack.Screen name="streams" options={{ title: 'Live Streams' }} />
        <Stack.Screen name="stream/[id]" options={{ title: 'Stream' }} />
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
        <Stack.Screen name="kyc" options={{ title: 'Verification' }} />
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
      <StatusBar style={inTabs ? 'dark' : 'light'} />
    </View>
  );
}
