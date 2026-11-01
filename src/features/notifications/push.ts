/**
 * Push notifications (system tray) via expo-notifications and Firebase Cloud Messaging (Android) / APNs (iOS).
 *
 * Flow:
 *   1. registerForPushNotifications() — request permission, ensure Android
 *      channels and categories, fetch the push token (Expo push token or
 *      direct Firebase FCM token), and hand it to the backend (registerPushToken).
 *   2. The backend stores the token and fires pushes via Expo Push Service and
 *      Firebase Cloud Messaging HTTP v1 — those land in the OS notification
 *      tray and wake the lock screen automatically.
 *   3. addNotificationResponseListener() and consumeInitialNotificationResponse()
 *      route a tapped notification (from foreground, background, lock screen,
 *      or terminated state) directly into the relevant offer or destination.
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken, unregisterPushToken } from './api';
import { isIncomingCallAvailable } from '@/features/hybrid/incomingCall';
import { showSystemBannerInForeground } from './inAppAlerts';
// The notification LED is the brand colour, whatever the app's scheme.
import { lightPalette } from '@/theme';

// Always present system banner, sound, and MAX priority so Android never calls
// builder.setSilent(true) or downgrades priority to PRIORITY_DEFAULT (even when
// MainActivity is resumed over the lock screen via android:showWhenLocked="true").
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = showSystemBannerInForeground(
      notification.request.content.data as Record<string, unknown> | undefined,
    );
    return {
      shouldShowBanner: show,
      shouldShowList: true,
      shouldPlaySound: show,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

let registered = false;
let currentPushToken: string | null = null;
const handledResponseKeys = new Set<string>();

/**
 * Android channels this app creates, reported to the backend with the push
 * token. Android drops a push addressed to a channel the device doesn't have,
 * so the backend only targets a channel listed here and falls back to
 * "default" otherwise.
 */
export const NOTIFICATION_CHANNELS = [
  'default',
  'booking_updates',
  'urgent_booking_alerts',
  'urgent_alerts_v2',
  'urgent_alerts_v3',
] as const;

/** Sent to the server with the token on Android builds with the native IncomingCall module. */
export const INCOMING_CALL_CAPABILITY = 'incoming_call_v1';

export function reportedChannels(): string {
  const list: string[] = [...NOTIFICATION_CHANNELS];
  if (isIncomingCallAvailable()) list.push(INCOMING_CALL_CAPABILITY);
  return list.join(',');
}

export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

/**
 * Forget that this device registered, so the next signed-in user registers
 * their own token.
 */
export function resetPushRegistration(): void {
  registered = false;
  currentPushToken = null;
}

/**
 * Invalidates this device's push token on the backend and resets local
 * registration state. Call before clearing the auth token on logout.
 */
export async function unregisterFromPushNotifications(): Promise<void> {
  const tokenToRemove = currentPushToken;
  registered = false;
  currentPushToken = null;
  if (!tokenToRemove || Platform.OS === 'web') return;
  try {
    await unregisterPushToken(tokenToRemove);
  } catch {
    // Non-fatal on logout if offline
  }
}

/**
 * Ensures Android channels are created with MAX importance, vibration, sound,
 * and PUBLIC lockscreen visibility so alerts wake the screen.
 */
async function safeSetChannel(
  channelId: string,
  config: Notifications.NotificationChannelInput,
): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(channelId, config);
  } catch {
    try {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: config.name,
        description: config.description,
        importance: config.importance,
        vibrationPattern: config.vibrationPattern,
        enableVibrate: config.enableVibrate,
        showBadge: config.showBadge,
        lockscreenVisibility: config.lockscreenVisibility,
        bypassDnd: config.bypassDnd,
        sound: 'default',
      });
    } catch {
      // Non-fatal in Expo Go
    }
  }
}

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const ringAudioAttributes = {
    usage: (Notifications.AndroidAudioUsage?.NOTIFICATION_RINGTONE ?? 6) as Notifications.AndroidAudioUsage,
    contentType: (Notifications.AndroidAudioContentType?.SONIFICATION ?? 4) as Notifications.AndroidAudioContentType,
  };
  const chimeAudioAttributes = {
    usage: (Notifications.AndroidAudioUsage?.NOTIFICATION ?? 5) as Notifications.AndroidAudioUsage,
    contentType: (Notifications.AndroidAudioContentType?.SONIFICATION ?? 4) as Notifications.AndroidAudioContentType,
  };
  await safeSetChannel('urgent_alerts_v3', {
    name: 'Offer & Booking Rings',
    description: 'Rings in device notifications for new booking requests and event offers',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: lightPalette.accent,
    sound: 'connekyt_ringtone.wav',
    audioAttributes: ringAudioAttributes,
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
  void chimeAudioAttributes;
  await safeSetChannel('default', {
    name: 'Amoria Connect Notifications',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: lightPalette.primary,
    sound: 'connekyt_chime.wav',
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await safeSetChannel('booking_updates', {
    name: 'Booking Updates',
    description: 'Accepted, declined and paid bookings, deposits and payment reminders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: lightPalette.primary,
    sound: 'connekyt_chime.wav',
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Android freezes a channel's sound and importance once it exists, and phones that created urgent_booking_alerts
  // earlier keep whatever it was then (often silent when locked). A fresh id gets the ringtone settings.
  await safeSetChannel('urgent_alerts_v2', {
    name: 'Offer & Booking Rings',
    description: 'Rings for new booking requests and event offers, even when the phone is locked',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: lightPalette.accent,
    sound: 'connekyt_ringtone.wav',
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  await safeSetChannel('urgent_booking_alerts', {
    name: 'Urgent Booking & Opportunity Alerts',
    description: 'Rings for new booking requests and event opportunities',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: lightPalette.accent,
    sound: 'connekyt_ringtone.wav',
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
}

/**
 * Registers interactive notification categories for lock-screen and banner actions.
 */
export async function ensureNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('OPPORTUNITY_ALERT', [
      {
        identifier: 'ACTION_APPROVE',
        buttonTitle: 'Accept',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'ACTION_DECLINE',
        buttonTitle: 'Reject',
        options: {
          opensAppToForeground: true,
          isDestructive: true,
        },
      },
    ]);
    await Notifications.setNotificationCategoryAsync('BOOKING_REQUEST', [
      {
        identifier: 'VIEW_REQUEST',
        buttonTitle: 'View & respond',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch {
    // Non-fatal if categories unsupported in current environment
  }
}

function resolveProjectId(): string {
  return (
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    'd81fbfa6-f576-4450-97c6-c443332179be'
  );
}

async function fetchExpoToken(): Promise<string | undefined> {
  const projectId = resolveProjectId();
  try {
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (res?.data) return res.data;
  } catch {
    try {
      const fallbackRes = await Notifications.getExpoPushTokenAsync();
      if (fallbackRes?.data) return fallbackRes.data;
    } catch (innerErr) {
      console.warn('[push] getExpoPushTokenAsync fallback failed:', innerErr);
    }
  }
  // Fallback to native Firebase FCM device token on Android so direct Firebase HTTP v1 pushes work
  if (Platform.OS === 'android' && typeof Notifications.getDevicePushTokenAsync === 'function') {
    try {
      const deviceRes = await Notifications.getDevicePushTokenAsync();
      if (deviceRes?.data && typeof deviceRes.data === 'string') {
        return deviceRes.data;
      }
    } catch (deviceErr) {
      console.warn('[push] getDevicePushTokenAsync fallback failed:', deviceErr);
    }
  }
  return undefined;
}

/**
 * Requests permission and registers this device's push token with the
 * backend. Safe to call more than once (no-ops after the first success) and
 * on any platform.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (registered && currentPushToken) return currentPushToken;
    if (Platform.OS === 'web') return null;

    // Ensure channels and interactive action categories
    await ensureAndroidChannels();
    await ensureNotificationCategories();

    // Request OS notification permissions (Alert, Badge, Sound, Lock screen)
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      granted = req.granted || req.status === 'granted';
    }

    if (!granted) {
      console.warn('[push] Notification permissions not granted by user.');
      return null;
    }

    // Check device hardware for remote push token acquisition
    if (!Device.isDevice) {
      console.log(
        '[push] Running on simulator/emulator — remote push tokens require physical hardware. Channels & local notifications are enabled.',
      );
      return null;
    }

    const token = await fetchExpoToken();
    if (!token) {
      console.warn('[push] Could not obtain push token.');
      return null;
    }

    console.log('[push] Push token obtained:', token);

    await registerPushToken(
      token,
      Platform.OS,
      Platform.OS === 'android' ? reportedChannels() : undefined,
    );
    registered = true;
    currentPushToken = token;
    console.log('[push] Successfully registered push token with backend.');
    return token;
  } catch (err) {
    console.warn('[push] Failed to register for push notifications:', err);
    return null;
  }
}

/**
 * Listens for device push token rotations while signed in and updates the
 * backend with a fresh push token.
 */
export function startPushTokenRefreshListener(): () => void {
  if (Platform.OS === 'web' || typeof Notifications.addPushTokenListener !== 'function') {
    return () => {};
  }
  const sub = Notifications.addPushTokenListener(async () => {
    try {
      const nextToken = await fetchExpoToken();
      if (!nextToken || nextToken === currentPushToken) return;
      await registerPushToken(
        nextToken,
        Platform.OS,
        Platform.OS === 'android' ? reportedChannels() : undefined,
      );
      registered = true;
      currentPushToken = nextToken;
    } catch (err) {
      console.warn('[push] Failed to refresh push token with backend:', err);
    }
  });
  return () => sub.remove();
}

/**
 * Schedules a local test notification to trigger in `delaySeconds` seconds.
 */
export async function scheduleTestLockScreenNotification(delaySeconds = 5): Promise<string> {
  await ensureAndroidChannels();
  await ensureNotificationCategories();
  const channelId = Platform.OS === 'android' ? 'urgent_alerts_v2' : undefined;
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Connekyt Notification 🔔',
      body: 'Lock-screen notifications are working! Tap to open Connekyt.',
      sound: 'connekyt_ringtone.wav',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: 'TEST', timestamp: Date.now() },
      categoryIdentifier: 'BOOKING_REQUEST',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      channelId,
    },
  });
}

/**
 * Schedules a simulated incoming booking request alert to trigger in `delaySeconds` seconds.
 */
export async function scheduleTestBookingAlert(delaySeconds = 5): Promise<string> {
  await ensureAndroidChannels();
  await ensureNotificationCategories();
  const channelId = Platform.OS === 'android' ? 'urgent_alerts_v2' : undefined;
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New Booking Request 🔔',
      body: 'Sarah Jenkins requested a 4-hour Wedding photography package. Tap to respond.',
      sound: 'connekyt_ringtone.wav',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        type: 'BOOKING',
        kind: 'BOOKING_REQUEST',
        referenceId: 'test-booking',
        eventId: 'test-event',
        timestamp: Date.now(),
      },
      categoryIdentifier: 'BOOKING_REQUEST',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      channelId,
    },
  });
}

export type NotificationDiagnostic = {
  permissionGranted: boolean;
  permissionStatus: string;
  isDevice: boolean;
  pushToken: string | null;
  registeredWithBackend: boolean;
  channelsSummary?: string;
  iosDetails?: {
    allowsAlert?: boolean | null;
    allowsBadge?: boolean | null;
    allowsSound?: boolean | null;
    allowsLockScreen?: boolean | null;
  };
};

/**
 * Inspects system notification permissions, physical device status, push token,
 * backend registration, and Android/iOS lock-screen readiness.
 */
export async function checkNotificationDiagnostics(): Promise<NotificationDiagnostic> {
  const settings = await Notifications.getPermissionsAsync();
  const permissionGranted = settings.granted || settings.status === 'granted';

  let pushToken: string | null = currentPushToken;
  let isRegistered = registered;

  if (permissionGranted && Device.isDevice) {
    try {
      const token = await fetchExpoToken();
      pushToken = token ?? null;
      if (!isRegistered && pushToken) {
        await registerPushToken(
          pushToken,
          Platform.OS,
          Platform.OS === 'android' ? reportedChannels() : undefined,
        );
        registered = true;
        currentPushToken = pushToken;
        isRegistered = true;
      }
    } catch (e) {
      console.warn('[diagnostics] Push token check error:', e);
    }
  }

  let channelsSummary = '';
  if (Platform.OS === 'android') {
    try {
      await ensureAndroidChannels();
      const channels = await Notifications.getNotificationChannelsAsync();
      const urgent = channels.find((c) => c.id === 'urgent_alerts_v2');
      const updates = channels.find((c) => c.id === 'booking_updates');
      channelsSummary = `Android Channels:\n• Urgent Alert: ${urgent ? `Active (Importance ${urgent.importance})` : 'Missing'}\n• Booking Updates: ${updates ? `Active (Importance ${updates.importance})` : 'Missing'}`;
    } catch {
      channelsSummary = 'Android Channels: Could not inspect';
    }
  }

  return {
    permissionGranted,
    permissionStatus: settings.status,
    isDevice: Device.isDevice,
    pushToken,
    registeredWithBackend: isRegistered,
    channelsSummary: Platform.OS === 'android' ? channelsSummary : undefined,
    iosDetails:
      Platform.OS === 'ios'
        ? {
            allowsAlert: settings.ios?.allowsAlert,
            allowsBadge: settings.ios?.allowsBadge,
            allowsSound: settings.ios?.allowsSound,
            allowsLockScreen: settings.ios?.allowsDisplayOnLockScreen,
          }
        : undefined,
  };
}

/** The channel that rings for booking requests and opportunities. */
export const RINGING_CHANNEL = 'urgent_alerts_v3';

/**
 * Whether ringing alerts break through Do Not Disturb.
 */
export async function ringingBypassesDnd(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const channel = await Notifications.getNotificationChannelAsync(RINGING_CHANNEL);
    return channel ? !!channel.bypassDnd : null;
  } catch {
    return null;
  }
}

/**
 * Opens the system settings page for the ringing channel.
 */
export async function openRingingChannelSettings(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package ?? 'com.amoria.connekyt.app';
  try {
    await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: pkg },
      { key: 'android.provider.extra.CHANNEL_ID', value: RINGING_CHANNEL },
    ]);
  } catch {
    await Linking.openSettings();
  }
}

function responseDedupKey(response: Notifications.NotificationResponse): string {
  const id = response?.notification?.request?.identifier ?? '';
  const action = response?.actionIdentifier ?? Notifications.DEFAULT_ACTION_IDENTIFIER;
  const data = (response?.notification?.request?.content?.data ?? {}) as Record<string, unknown>;
  const ref = String(data.candidateId ?? data.referenceId ?? data.eventId ?? data.link ?? '');
  return `${id}:${action}:${ref}`;
}

export function resetHandledNotificationResponses(): void {
  handledResponseKeys.clear();
}

/**
 * Processes a cold-start / terminated notification response exactly once.
 */
export async function consumeInitialNotificationResponse(
  onOpen: (data: Record<string, unknown>, actionIdentifier?: string) => void | Promise<void>,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (typeof Notifications.getLastNotificationResponseAsync !== 'function') return false;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return false;
    const key = responseDedupKey(response);
    if (handledResponseKeys.has(key)) return false;
    handledResponseKeys.add(key);
    const data = (response.notification?.request?.content?.data ?? {}) as Record<string, unknown>;
    if (typeof Notifications.clearLastNotificationResponseAsync === 'function') {
      await Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    await onOpen(data, response.actionIdentifier);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fires `onOpen` with the notification's `data` payload and optional action
 * identifier when the user interacts with a push (from tray or lock screen).
 */
export function addNotificationResponseListener(
  onOpen: (data: Record<string, unknown>, actionIdentifier?: string) => void | Promise<void>,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const key = responseDedupKey(response);
    if (handledResponseKeys.has(key)) return;
    handledResponseKeys.add(key);
    if (typeof Notifications.clearLastNotificationResponseAsync === 'function') {
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    const data = (response.notification?.request?.content?.data ?? {}) as Record<string, unknown>;
    void onOpen(data, response.actionIdentifier);
  });
  return () => sub.remove();
}
