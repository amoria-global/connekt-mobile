/**
 * Background notification task for incoming offers on Android.
 *
 * If a data-only offer push arrives while the app is backgrounded or terminated, this task schedules
 * a high-priority visible notification on `urgent_alerts_v2` with the `OPPORTUNITY_ALERT` category
 * (Accept / Reject action buttons) and custom ringtone, without auto-launching the app.
 * When the user taps the notification or an action button, Expo Router navigates directly to the offer.
 */
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { isIncomingCallAvailable } from './incomingCall';

export const OFFER_CALL_TASK = 'OFFER_INCOMING_CALL';

/** High-importance channel for incoming offers (created by the app at start-up). */
const OFFER_CHANNEL = 'urgent_alerts_v2';

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
  TaskManager.defineTask(OFFER_CALL_TASK, async (task: unknown) => {
    const payload = payloadOf(task);
    if (!payload || payload.kind !== 'INCOMING_OFFER') return;
    // With the app open in the foreground, its own in-app offer sheet and foreground handler take over.
    if (AppState.currentState === 'active') return;

    const id = String(payload.candidateId ?? payload.referenceId ?? '');
    const title = String(payload.title ?? 'New event offer');
    const body = String(payload.body ?? 'A client posted an event for you. Tap to review and respond.');

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...payload,
            type: payload.type ?? 'OPPORTUNITY',
            candidateId: id || undefined,
            referenceId: id || undefined,
            link: payload.link ?? (id ? `/opportunities/${id}` : '/opportunities'),
          },
          categoryIdentifier: 'OPPORTUNITY_ALERT',
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
  });

  if (isIncomingCallAvailable()) {
    Notifications.registerTaskAsync(OFFER_CALL_TASK).catch(() => {
      // Registration is retried on the next launch.
    });
  }
}
