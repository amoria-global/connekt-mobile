/**
 * Wakes the display and rings like a call on Android when a new offer or booking request arrives while the app
 * is minimized, locked or closed.
 *
 * The server sends offers to Android builds that report the incoming-call capability as a high-priority data push.
 * expo-notifications hands that push to this task, which posts the full-screen call notification through the
 * native IncomingCall module. Imported first in `index.js` so the task is defined when the bundle loads headless.
 *
 * Guarded so builds without the native TaskManager or call module (2.2.2, 2.3.0, iOS) never throw at startup.
 * The phone's push-token listener is NOT involved here: the loop that caused timeouts lived in push.ts.
 */
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { isIncomingCallAvailable, showIncomingCall } from './incomingCall';

export const OFFER_CALL_TASK = 'OFFER_INCOMING_CALL';

/** Loud channel used when the call screen cannot be shown (created by the app at start-up). */
const FALLBACK_CHANNEL = 'urgent_alerts_v3';

function tryParseJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The push's own data, whatever shape expo-notifications hands the task. */
export function payloadOf(task: unknown): Record<string, unknown> | null {
  const outer = (task as { data?: Record<string, unknown> } | undefined)?.data;
  if (!outer || typeof outer !== 'object') return null;

  const innerData =
    outer.data && typeof outer.data === 'object' ? (outer.data as Record<string, unknown>) : null;
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

      // With the app open the normal notification handler presents it; a second alert would double the sound.
      if (AppState.currentState === 'active') return;

      const id = String(payload.candidateId ?? payload.referenceId ?? payload.eventId ?? 'offer');
      const title = String(payload.title ?? 'New event offer');
      const body = String(payload.body ?? 'A client posted an event for you. Tap to review and respond.');

      if (showIncomingCall(id, title, body)) return;

      // The call screen could not be posted: fall back to a loud ordinary notification so the offer is never lost.
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'connekyt_ringtone.wav',
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: kind === 'BOOKING_REQUEST' ? 'BOOKING_REQUEST' : 'OPPORTUNITY_ALERT',
            data: {
              ...payload,
              type: payload.type ?? 'OPPORTUNITY',
              candidateId: id !== 'offer' ? id : undefined,
              referenceId: id !== 'offer' ? id : undefined,
              link: payload.link ?? (id !== 'offer' ? `/opportunities/${id}` : '/opportunities'),
            },
          },
          trigger: { channelId: FALLBACK_CHANNEL },
        });
      } catch {
        // Nothing more to try from a background task.
      }
    });

    if (isIncomingCallAvailable() && typeof Notifications.registerTaskAsync === 'function') {
      Notifications.registerTaskAsync(OFFER_CALL_TASK).catch(() => {
        // Registration is retried on the next launch.
      });
    }
  } catch {
    // Safe fallback if TaskManager is unavailable in the current binary.
  }
}
