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
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken } from './api';

// Show incoming pushes as a banner + sound even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let registered = false;

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

    // Android needs a channel for notifications to reach the tray.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Event updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#083A85',
      });
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

    registered = true;
    await registerPushToken(token, Platform.OS);
    return token;
  } catch {
    // Permission denied / no network / not configured — non-fatal.
    return null;
  }
}

/**
 * Fires `onOpen` with the notification's `data` payload when the user taps a
 * push (from the tray). Returns an unsubscribe function.
 */
export function addNotificationResponseListener(
  onOpen: (data: Record<string, unknown>) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    onOpen(data);
  });
  return () => sub.remove();
}
