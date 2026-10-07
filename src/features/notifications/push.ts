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
 * Requests permission and registers this device's Expo push token with the
 * backend. Safe to call more than once (no-ops after the first success) and
 * on any platform (returns null where push isn't available, e.g. simulators
 * or web).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (registered) return null;
    if (Platform.OS === 'web') return null;
    // Expo push tokens only work on real hardware, not simulators.
    if (!Device.isDevice) return null;

    // Android needs a channel with MAX importance for lock-screen wake and heads-up banner.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Amoria Connect Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#083A85',
        sound: 'connekyt_chime.wav',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('booking_updates', {
        name: 'Booking Updates',
        description: 'Accepted, declined and paid bookings, deposits and payment reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#083A85',
        sound: 'connekyt_chime.wav',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('urgent_booking_alerts', {
        name: 'Urgent Booking & Opportunity Alerts',
        description: 'Rings for new booking requests and event opportunities',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: '#F20C8F',
        sound: 'connekyt_ringtone.wav',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }

    // Interactive notification category for lock-screen 1-tap actioning
    try {
      await Notifications.setNotificationCategoryAsync('OPPORTUNITY_ALERT', [
        {
          identifier: 'ACTION_APPROVE',
          buttonTitle: "I'm Available",
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'ACTION_DECLINE',
          buttonTitle: 'Decline',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    } catch {
      // Non-fatal if categories unsupported in current environment
    }

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted || req.status === 'granted';
    }
    if (!granted) return null;

    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token) return null;

    // Latch only AFTER the backend has accepted it. Setting it first meant a
    // single network failure permanently convinced this install that it was
    // registered, and it never tried again.
    await registerPushToken(
      token,
      Platform.OS,
      Platform.OS === 'android' ? NOTIFICATION_CHANNELS.join(',') : undefined,
    );
    registered = true;
    return token;
  } catch {
    // Permission denied / no network / not configured — non-fatal.
    return null;
  }
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
