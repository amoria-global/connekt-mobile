import { approveOpportunity, rejectOpportunity } from '@/features/hybrid/api';
import {
    addNotificationResponseListener,
    registerForPushNotifications,
} from '@/features/notifications/push';
import { notificationTarget } from '@/features/notifications/routing';
import { GlobalOpportunityCallNotifier } from '@/features/hybrid/GlobalOpportunityCallNotifier';
import { InAppNotificationWatcher } from '@/features/notifications/InAppNotificationWatcher';
import { BookingRequestCallNotifier } from '@/features/bookings/BookingRequestCallNotifier';
import { showIncomingRequest } from '@/features/bookings/incomingRequests';
import { useRole } from '@/features/auth/role';
import { useLanguage } from '@/store/language';
import { setAudioModeAsync } from '@/utils/safeAudio';
import { DialogHost } from '@/components/ui/dialog';
import { useTheme } from '@/theme';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

export default function AppLayout() {
  const { isDark, colors: c } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { isPhotographer } = useRole();

  // Signed-in: register for push notifications and route taps. The (app)
  // group only mounts once authenticated, so this runs at the right time.
  // Push is native-only — skip on web (expo-notifications has no web push
  // and only logs "not supported" warnings there).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Silent mode is strictly respected (no sound if mute switch on, vibration only).
    void setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    });
    registerForPushNotifications();
    const unsubscribe = addNotificationResponseListener(async (data, actionIdentifier) => {
      const candidateId =
        typeof data.candidateId === 'string'
          ? data.candidateId
          : typeof data.referenceId === 'string'
            ? data.referenceId
            : undefined;

      // Interactive lock-screen 1-tap actions
      if (actionIdentifier === 'ACTION_APPROVE' && candidateId) {
        try {
          await approveOpportunity(candidateId);
        } catch (e) {
          console.warn('[pushAction] Error approving opportunity from notification:', e);
        }
        router.push('/bookings?tab=opportunities');
        return;
      }

      if (actionIdentifier === 'ACTION_DECLINE' && candidateId) {
        try {
          await rejectOpportunity(candidateId);
        } catch (e) {
          console.warn('[pushAction] Error declining opportunity from notification:', e);
        }
        return;
      }

      // A direct booking request (its "View & respond" button, kind === 'BOOKING_REQUEST',
      // or a notification of type 'BOOKING' for a photographer)
      // opens the full-screen incoming request instead of the event page.
      const isBookingRequestPush =
        data.kind === 'BOOKING_REQUEST' ||
        actionIdentifier === 'VIEW_REQUEST' ||
        (isPhotographer &&
          (data.type === 'BOOKING' || data.type === 'EVENT') &&
          typeof data.referenceId === 'string');

      if (isBookingRequestPush) {
        const eventId =
          typeof data.eventId === 'string'
            ? data.eventId
            : typeof data.referenceId === 'string'
              ? data.referenceId
              : undefined;
        if (eventId) {
          showIncomingRequest(eventId);
          return;
        }
      }

      // Deep-link to the exact entity the notification is about.
      router.push(
        notificationTarget({
          type: typeof data.type === 'string' ? data.type : undefined,
          referenceId: typeof data.referenceId === 'string' ? data.referenceId : undefined,
          eventId: typeof data.eventId === 'string' ? data.eventId : undefined,
          link: typeof data.link === 'string' ? data.link : undefined,
          deepLink: typeof data.deepLink === 'string' ? data.deepLink : undefined,
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
          // Dark uses the card step and the link blue, exactly as TopBar does, so a pushed screen's header does not jump
          // a shade lighter than the tab screens. Light is unchanged.
          headerTintColor: c.link,
          headerStyle: { backgroundColor: isDark ? c.card : c.elevated },
          headerTitleStyle: { color: c.text, fontWeight: '700' },
          contentStyle: { backgroundColor: c.background },
          headerBackButtonDisplayMode: 'minimal', // chevron only, no "‹ Home" text
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="event/new"
          options={{
            title: t('navNewEvent'),
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="event/[id]" options={{ title: t('navEvent') }} />
        <Stack.Screen name="event/geo-pricing" options={{ title: t('navGeoPricing') }} />
        <Stack.Screen
          name="event/hybrid-wizard"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen name="photographers" options={{ title: t('navPhotographers') }} />
        <Stack.Screen name="photographer/[id]" options={{ title: t('navPhotographer') }} />
        <Stack.Screen name="conversation/[id]" options={{ title: t('navChat') }} />
        <Stack.Screen name="packages" options={{ title: t('navMyPackages') }} />
        <Stack.Screen name="package/new" options={{ title: t('navNewPackage'), presentation: 'modal' }} />
        <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Stack.Screen name="streams" options={{ title: t('navLiveStreams') }} />
        <Stack.Screen name="stream/[id]" options={{ title: t('navStream'), headerShown: false }} />
        <Stack.Screen name="stream/control/[id]" options={{ title: t('navGoLive'), headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: t('notificationsTitle'), headerShown: false }} />
        <Stack.Screen name="find-my-photos" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ title: t('navEditProfile') }} />
        <Stack.Screen name="preferences" options={{ title: t('navPreferences') }} />
        <Stack.Screen
          name="album/new"
          options={{
            title: t('navNewAlbum'),
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="album/[id]" options={{ title: t('navAlbum'), headerShown: false }} />
        <Stack.Screen name="gallery" options={{ title: t('navGallery') }} />
        <Stack.Screen name="bookings" options={{ title: t('navBookings') }} />
        <Stack.Screen name="content-albums" options={{ title: t('navContentAlbums') }} />
        <Stack.Screen
          name="content-album/new"
          options={{
            title: t('navNewContentAlbum'),
            headerShown: false,
          }}
        />
        <Stack.Screen name="photobooks" options={{ title: t('navPhotobooks') }} />
        <Stack.Screen name="photobook/[id]" options={{ title: t('navPhotobook'), headerShown: false }} />
        <Stack.Screen name="photobook/new" options={{ title: t('navNewPhotobook'), headerShown: false }} />
        <Stack.Screen name="wallet/movements" options={{ title: t('navWalletMovements') }} />
        <Stack.Screen name="withdraw" options={{ title: t('navWithdraw') }} />
        <Stack.Screen name="payment-accounts" options={{ title: t('navPaymentAccounts') }} />
        <Stack.Screen name="transactions" options={{ title: t('navTransactions') }} />
        <Stack.Screen name="payroll" options={{ title: t('navPayrollReport') }} />
        <Stack.Screen name="analytics" options={{ title: t('navAnalytics'), headerShown: false }} />
        <Stack.Screen name="payments" options={{ title: t('navPayments') }} />
        <Stack.Screen name="payment/[id]" options={{ title: t('navPayment') }} />
        <Stack.Screen name="donations" options={{ title: t('navDonate') }} />
        <Stack.Screen name="clients" options={{ title: t('navClients') }} />
        <Stack.Screen name="client/[id]" options={{ title: t('navClient') }} />
        <Stack.Screen name="two-factor" options={{ title: t('navTwoFactor') }} />
        <Stack.Screen name="tv-devices" options={{ title: t('navManageTvs') }} />
        <Stack.Screen
          name="connect-to-tv"
          options={{ title: t('navConnectToTv'), presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="pay-on-tv"
          options={{ title: t('navPayOnTv'), presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen name="kyc" options={{ headerShown: false }} />
        <Stack.Screen name="delete-account" options={{ title: t('navDeleteAccount') }} />
        <Stack.Screen name="blocked-accounts" options={{ title: t('navBlockedAccounts') }} />
        <Stack.Screen name="collaborate/index" options={{ title: t('navCollaborate') }} />
        <Stack.Screen name="collaborate/album/[id]" options={{ title: t('navAlbum') }} />
        <Stack.Screen name="collaborate/joined/[id]" options={{ title: t('navAlbum') }} />
        <Stack.Screen name="collaborate/join/[token]" options={{ title: t('navJoinAlbum') }} />
      </Stack>
      <GlobalOpportunityCallNotifier />
      <InAppNotificationWatcher />
      <BookingRequestCallNotifier />
      <DialogHost />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}
