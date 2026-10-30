/**
 * Wakes the app for a new offer, even when it is closed, and shows the incoming-call alert.
 *
 * The server sends offers to Android builds that report the call capability as a high-priority data push (no
 * title or body, so Android shows nothing by itself). expo-notifications hands that push to this task; the task
 * posts the full-screen call notification through the native module. Imported first in index.js, because the
 * task must be defined when the JavaScript bundle loads in the background.
 */
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { isIncomingCallAvailable, showIncomingCall } from './incomingCall';

export const OFFER_CALL_TASK = 'OFFER_INCOMING_CALL';

/** Channel used when the native call alert cannot be shown (created by the app at start-up). */
const FALLBACK_CHANNEL = 'urgent_alerts_v2';

/** The push's own data, whether it arrives as a ready object or as the JSON string FCM carries. */
function payloadOf(task: unknown): Record<string, unknown> | null {
  const data = (task as { data?: Record<string, unknown> } | undefined)?.data;
  if (!data || typeof data !== 'object') return null;
  const asString = data.dataString;
  if (typeof asString === 'string') {
    try {
      return JSON.parse(asString) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return data;
}

if (Platform.OS === 'android') {
  TaskManager.defineTask(OFFER_CALL_TASK, async (task) => {
    const payload = payloadOf(task);
    if (!payload || payload.kind !== 'INCOMING_OFFER') return;
    // With the app open its own ringing screen takes over; a second alert on top would double the sound.
    if (AppState.currentState === 'active') return;

    const id = String(payload.candidateId ?? payload.referenceId ?? 'offer');
    const title = String(payload.title ?? 'New event offer');
    const body = String(payload.body ?? 'A client posted an event for you. Open Connekyt to answer.');
    if (showIncomingCall(id, title, body)) return;

    // The call alert could not be posted: fall back to a loud ordinary notification, so the offer is never lost.
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: payload,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          channelId: FALLBACK_CHANNEL,
        },
      });
    } catch {
      // Nothing more to try from a background task.
    }
  });

  if (isIncomingCallAvailable()) {
    Notifications.registerTaskAsync(OFFER_CALL_TASK).catch(() => {
      // Registration is retried on the next launch.
    });
  }
}
