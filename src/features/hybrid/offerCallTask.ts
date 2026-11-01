/**
 * Background offer notification task cleanup and payload helper.
 *
 * The backend (`ExpoPushService`) delivers all incoming offer and booking pushes
 * with top-level `title`, `body`, `sound: "connekyt_ringtone.wav"`, `priority: "high"`,
 * and `channelId: "urgent_alerts_v3"`, which `expo-notifications`'s native
 * `ExpoHandlingDelegate` presents directly in the OS Device Notifications tray.
 *
 * We unregister any legacy `OFFER_INCOMING_CALL` headless TaskManager task so
 * `FirebaseMessagingDelegate` never spins up a competing `RNHeadlessAppLoader`
 * instance (which calls `invalidateAppRecord` after 2000ms and disrupts the
 * active ReactHost).
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';

export const OFFER_CALL_TASK = 'OFFER_INCOMING_CALL';

function tryParseJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Unwraps the push payload from all shapes `expo-notifications` passes:
 *   - `task.data.data` (`RemoteMessageSerializer.toBundle(RemoteMessage)` on Android,
 *     with `dataString`, `body`, `title`, `message`, etc.)
 *   - `task.data.notification` (`{ title, body }`)
 *   - `task.data.dataString` or flat `task.data`
 */
export function payloadOf(task: unknown): Record<string, unknown> | null {
  const outer = (task as { data?: Record<string, unknown> } | undefined)?.data;
  if (!outer || typeof outer !== 'object') return null;

  const innerData =
    outer.data && typeof outer.data === 'object'
      ? (outer.data as Record<string, unknown>)
      : null;
  const innerNotif =
    outer.notification && typeof outer.notification === 'object'
      ? (outer.notification as Record<string, unknown>)
      : null;

  const parsedFromInner =
    tryParseJson(innerData?.dataString) ??
    tryParseJson(innerData?.body) ??
    tryParseJson(outer.dataString) ??
    tryParseJson(outer.body);

  const merged: Record<string, unknown> = {
    ...(innerData ?? outer),
    ...(parsedFromInner ?? {}),
  };

  if (!merged.title) {
    merged.title = innerData?.title ?? innerNotif?.title ?? outer.title;
  }
  if (!merged.body || typeof merged.body !== 'string' || merged.body.trim().startsWith('{')) {
    merged.body =
      (parsedFromInner?.body as string | undefined) ??
      (innerData?.message as string | undefined) ??
      (innerNotif?.body as string | undefined) ??
      (typeof outer.message === 'string' ? outer.message : undefined);
  }

  return merged;
}

function hasNativeTaskManager(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    return requireOptionalNativeModule('ExpoTaskManager') != null;
  } catch {
    return false;
  }
}

if (hasNativeTaskManager()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');

    TaskManager.defineTask(OFFER_CALL_TASK, async () => {
      // No-op: native ExpoHandlingDelegate presents the notification directly.
    });

    if (typeof Notifications.unregisterTaskAsync === 'function') {
      Notifications.unregisterTaskAsync(OFFER_CALL_TASK).catch(() => {});
    }
  } catch {
    // Safe fallback if TaskManager is unavailable in the current binary.
  }
}
