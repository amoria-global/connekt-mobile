import { approveOpportunity, rejectOpportunity } from '@/features/hybrid/api';
import {
    addNotificationResponseListener,
    registerForPushNotifications,
} from '@/features/notifications/push';
import { notificationTarget } from '@/features/notifications/routing';
import { GlobalOpportunityCallNotifier, showIncomingOpportunity } from '@/features/hybrid/GlobalOpportunityCallNotifier';
import { InAppNotificationWatcher } from '@/features/notifications/InAppNotificationWatcher';
import { BookingRequestCallNotifier } from '@/features/bookings/BookingRequestCallNotifier';
import { showIncomingRequest } from '@/features/bookings/incomingRequests';
import { useRole } from '@/features/auth/role';
import { isBlockedInSharedWorkspace } from '@/features/workspace/model';
import { WorkspaceChip } from '@/features/workspace/WorkspaceChip';
import { selectIsShared, useWorkspace } from '@/store/workspace';
import { useLanguage } from '@/store/language';
import { setAudioModeAsync } from '@/utils/safeAudio';
import { DialogHost } from '@/components/ui/dialog';
import { SheetCloseButton } from '@/components/ui/SheetCloseButton';
import { fonts, useTheme } from '@/theme';
import { HeaderHelpButton } from '@/components/help/HeaderHelpButton';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

export default function AppLayout() {
  const { isDark, colors: c } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { isPhotographer } = useRole();
  const pathname = usePathname();
  // Which workspace the photographer is working in. Everything below is keyed by it, so a switch remounts the whole
  // signed-in app and nothing from one workspace can show up in the other.
  const hydrated = useWorkspace((s) => s.hydrated);
  const activeId = useWorkspace((s) => s.activeId);
  const isShared = useWorkspace(selectIsShared);
  const hydrate = useWorkspace((s) => s.hydrate);
  const refreshWorkspaces = useWorkspace((s) => s.refresh);

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    if (hydrated && isPhotographer) void refreshWorkspaces();
  }, [hydrated, isPhotographer, refreshWorkspaces]);
  // Money, account and notification screens are not part of a shared workspace: a deep link or a stale route goes home.
  useEffect(() => {
    if (isShared && isBlockedInSharedWorkspace(pathname)) router.replace('/');
  }, [isShared, pathname, router]);

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

      // Tapping Accept, Decline, or an Opportunity notification opens the photographer's incoming Offer Details page with the 3 response options
      const isOpportunityPush =
        actionIdentifier === 'ACTION_APPROVE' ||
        actionIdentifier === 'ACTION_DECLINE' ||
        data.type === 'OPPORTUNITY' ||
        data.type === 'HYBRID_OPPORTUNITY' ||
        (typeof data.link === 'string' && data.link.includes('/opportunities'));

      if (isOpportunityPush && candidateId) {
        router.push(`/bookings?tab=opportunities&candidate=${encodeURIComponent(candidateId)}` as never);
        showIncomingOpportunity(candidateId, 'details');
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

  const sheetHeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {isShared ? <WorkspaceChip /> : null}
      <SheetCloseButton />
    </View>
  );

  // Until the stored selection is read, paint nothing: the wrong workspace must never flash.
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  return (
    <View style={{ flex: 1 }} key={activeId ?? 'own'}>
      <Stack
        screenOptions={{
          // Only while a shared workspace is open. The chip renders nothing otherwise, but on iOS 26 an empty header
          // item is still drawn as a blank glass circle, so no item is registered at all.
          // Help sits in every header (Midnight Glass: nothing floats over a button), beside the workspace chip
          // while a shared workspace is open. Screens with their own headerRight (sheets with a close) keep theirs.
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isShared ? <WorkspaceChip /> : null}
              <HeaderHelpButton />
            </View>
          ),
          // The header is the page itself, so a pushed screen reads as one piece of Midnight Glass.
          headerTintColor: c.link,
          headerStyle: { backgroundColor: c.background },
          headerTitleStyle: { color: c.text, fontFamily: fonts.display },
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
            // The form is long and its first screen is the cover photo and title, so it opens at full height rather
            // than at a partial detent the user has to drag up.
            sheetAllowedDetents: [1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerRight: sheetHeaderRight,
          }}
        />
        <Stack.Screen name="host/index" options={{ title: 'My hosted events' }} />
        <Stack.Screen name="host/new" options={{ title: 'Host an event' }} />
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
            sheetAllowedDetents: [1],
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
