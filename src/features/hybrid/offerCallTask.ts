/**
 * Wakes the display and posts a ringing device notification on Android when a new
 * offer or booking request push arrives in the background or when the phone is locked.
 *
 * Imported first in `index.js` so the task is defined when the JavaScript bundle
 * loads in headless background mode.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { isIncomingCallAvailable, showIncomingCall } from './incomingCall';

export const OFFER_CALL_TASK = 'OFFER_INCOMING_CALL';

/** High-importance channel for incoming offers (created by the app at start-up). */
const OFFER_CHANNEL = 'urgent_alerts_v3';

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
 * Unwraps the push payload from all shapes `expo-notifications` passes to TaskManager:
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

if (Platform.OS === 'android') {
  TaskManager.defineTask(OFFER_CALL_TASK, async (task: unknown) => {
    const payload = payloadOf(task);
    if (!payload) return;

    const kind = String(payload.kind ?? '').toUpperCase();
    const type = String(payload.type ?? '').toUpperCase();
    const isOffer =
      kind === 'INCOMING_OFFER' ||
      kind === 'BOOKING_REQUEST' ||
      type === 'OPPORTUNITY' ||
      type === 'HYBRID_OPPORTUNITY';
    if (!isOffer) return;

    const id = String(payload.candidateId ?? payload.referenceId ?? payload.eventId ?? 'offer');
    const title = String(payload.title ?? 'New event offer');
    const body = String(
      payload.body ?? 'A client posted an event for you. Tap to review and respond.',
    );

    // Trigger native IncomingCall module to wake up the locked display and post the ringing device notification.
    const wokeScreen = showIncomingCall(id, title, body);

    if (!wokeScreen) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: {
              ...payload,
              type: payload.type ?? 'OPPORTUNITY',
              candidateId: id !== 'offer' ? id : undefined,
              referenceId: id !== 'offer' ? id : undefined,
              link: payload.link ?? (id !== 'offer' ? `/opportunities/${id}` : '/opportunities'),
            },
            categoryIdentifier: kind === 'BOOKING_REQUEST' ? 'BOOKING_REQUEST' : 'OPPORTUNITY_ALERT',
            sound: 'connekyt_ringtone.wav',
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            channelId: OFFER_CHANNEL,
          },
        });
      } catch {
        // Nothing more to try from a background task.
      }
    }
  });

  if (isIncomingCallAvailable()) {
    Notifications.registerTaskAsync(OFFER_CALL_TASK).catch(() => {
      // Registration is retried on the next launch.
    });
  }
}
