/**
 * Push notifications (system tray) via expo-notifications.
 *
 * Flow:
 *   1. registerForPushNotifications() — request permission, ensure an
 *      Android channel, fetch the Expo push token, and hand it to the
 *      backend (registerPushToken). Call this once the user is signed in.
 *   2. The backend stores the token and fires an Expo push
 *      (https://exp.host/--/api/v2/push/send) when events change — those
 *      land in the OS notification tray automatically.
 *   3. addNotificationResponseListener() routes a tapped notification into
 *      the app (defaults to the Notifications screen).
 *
 * Foreground notifications are shown as a banner too (setNotificationHandler).
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken } from './api';
import { showSystemBannerInForeground } from './inAppAlerts';
// The notification LED is the brand colour, whatever the app's scheme.
import { lightPalette } from '@/theme';

// With the app open, booking and payment pushes are shown by
// InAppNotificationWatcher (its own banner and sound), so the phone's banner
// is skipped for those to avoid alerting twice. Everything else still shows
// as a banner with sound.
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
    };
  },
});

let registered = false;

/**
 * Android channels this app creates, reported to the backend with the push
 * token. Android drops a push addressed to a channel the device doesn't have,
 * so the backend only targets a channel listed here and falls back to
 * "default" otherwise.
 *
 * A channel's importance and sound can't be changed once created, and the
 * released app (2.2.0) created "default" at DEFAULT importance (no heads-up
 * banner, system sound). Booking changes therefore use a new channel,
 * booking_updates, instead of trying to upgrade "default".
 */
export const NOTIFICATION_CHANNELS = ['default', 'booking_updates', 'urgent_booking_alerts'] as const;

/**
 * Forget that this device registered, so the next signed-in user registers
 * their own token.
 *
 * Without this the latch survived a sign-out: the second account on a shared
 * phone registered nothing and received no notifications at all, while the
 * first account's pushes kept arriving on a device they had signed out of.
 * Call on logout and whenever a session expires.
 */
export function resetPushRegistration(): void {
  registered = false;
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
 * Registers interactive notification categories for lock-screen 1-tap actions.
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
        buttonTitle: 'Decline',
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

/**
 * Requests permission and registers this device's Expo push token with the
 * backend. Safe to call more than once (no-ops after the first success) and
 * on any platform (returns null where push isn't available, e.g. simulators
 * or web).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (registered) return null;
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
      console.log('[push] Running on simulator/emulator — remote push tokens require physical hardware. Channels & local notifications are enabled.');
      return null;
    }

    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
      'd81fbfa6-f576-4450-97c6-c443332179be';

    let token: string | undefined;
    try {
      const res = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      token = res.data;
    } catch {
      try {
        const fallbackRes = await Notifications.getExpoPushTokenAsync();
        token = fallbackRes.data;
      } catch (innerErr) {
        console.warn('[push] getExpoPushTokenAsync fallback failed:', innerErr);
      }
    }

    if (!token) {
      console.warn('[push] Could not obtain Expo push token.');
      return null;
    }

    console.log('[push] Push token obtained:', token);

    // Latch only AFTER the backend has accepted it. Setting it first meant a
    // single network failure permanently convinced this install that it was
    // registered, and it never tried again.
    await registerPushToken(
      token,
      Platform.OS,
      Platform.OS === 'android' ? NOTIFICATION_CHANNELS.join(',') : undefined,
    );
    registered = true;
    console.log('[push] Successfully registered push token with backend.');
    return token;
  } catch (err) {
    console.warn('[push] Failed to register for push notifications:', err);
    return null;
  }
}

/**
 * Schedules a local test notification to trigger in `delaySeconds` seconds.
 * Allows the user to tap "Test", immediately lock their phone, and verify
 * that the screen lights up with banner, sound, and vibration on the lock screen.
 */
export async function scheduleTestLockScreenNotification(delaySeconds = 5): Promise<string> {
  await ensureAndroidChannels();
  await ensureNotificationCategories();
  const channelId = Platform.OS === 'android' ? 'urgent_booking_alerts' : undefined;
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Connekyt Notification 🔔',
      body: 'Lock-screen notifications are working! Tap to open Connekyt.',
      sound: 'connekyt_ringtone.wav',
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
 * Fires with full booking metadata, custom ringtone, and lock-screen "View & respond" button.
 */
export async function scheduleTestBookingAlert(delaySeconds = 5): Promise<string> {
  await ensureAndroidChannels();
  await ensureNotificationCategories();
  const channelId = Platform.OS === 'android' ? 'urgent_booking_alerts' : undefined;
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New Booking Request 🔔',
      body: 'Sarah Jenkins requested a 4-hour Wedding photography package. Tap to respond.',
      sound: 'connekyt_ringtone.wav',
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
 * Inspects system notification permissions, physical device status, Expo push token,
 * backend registration, and Android/iOS lock-screen readiness.
 */
export async function checkNotificationDiagnostics(): Promise<NotificationDiagnostic> {
  const settings = await Notifications.getPermissionsAsync();
  const permissionGranted = settings.granted || settings.status === 'granted';

  let pushToken: string | null = null;
  let isRegistered = registered;

  if (permissionGranted && Device.isDevice) {
    try {
      const projectId =
        (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
        (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
        'd81fbfa6-f576-4450-97c6-c443332179be';
      const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      pushToken = res.data;
      if (!isRegistered && pushToken) {
        await registerPushToken(
          pushToken,
          Platform.OS,
          Platform.OS === 'android' ? NOTIFICATION_CHANNELS.join(',') : undefined,
        );
        registered = true;
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
      const urgent = channels.find((c) => c.id === 'urgent_booking_alerts');
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
export const RINGING_CHANNEL = 'urgent_booking_alerts';

/**
 * Whether ringing alerts break through Do Not Disturb. Android only lets the
 * user grant this, per channel ("Override Do Not Disturb"); the channel's
 * bypassDnd reflects their choice. null when it can't be read (not Android,
 * or the channel isn't created yet).
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
 * Opens the system settings page for the ringing channel, where the user can
 * turn on "Override Do Not Disturb". Falls back to the app's settings page.
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

/**
 * Fires `onOpen` with the notification's `data` payload and optional action
 * identifier when the user interacts with a push (from tray or lock screen).
 * Returns an unsubscribe function.
 */
export function addNotificationResponseListener(
  onOpen: (data: Record<string, unknown>, actionIdentifier?: string) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    onOpen(data, response.actionIdentifier);
  });
  return () => sub.remove();
}
