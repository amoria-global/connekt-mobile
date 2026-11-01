/**
 * Notifications are delivered directly to the OS device notification tray and lock screen
 * via FCM / APNs push notifications (`push.ts`, `offerCallTask.ts`, `IncomingCallModule`).
 *
 * Opening the app UI must never trigger in-app notification popups, banners, or ringtones.
 */
export function InAppNotificationWatcher() {
  return null;
}
