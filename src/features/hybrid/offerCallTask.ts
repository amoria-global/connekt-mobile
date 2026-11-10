/**
 * Wakes the display and rings like a call on Android when a new offer or booking request arrives while the app
 * is minimized, locked or closed.
 *
 * The server sends offers to Android builds that report the incoming-call capability as a high-priority data push.
 * expo-notifications hands that push to this task, which posts the full-screen call notification through the
 * native IncomingCall module, plays the looping ringtone and vibrates even while backgrounded or locked, and
 * launches the app UI over the lock screen / other apps (`Linking.openURL`) so the call screen opens immediately
 * without requiring the app to be open or focused.
 *
 * Guarded so builds without the native TaskManager or call module (2.2.2, 2.3.0, iOS) never throw at startup.
 */
import { AppState, Linking, Platform, Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer, setAudioModeAsync } from '@/utils/safeAudio';
import { canDrawOverOtherApps, isIncomingCallAvailable, showIncomingCall } from './incomingCall';

export const OFFER_CALL_TASK = 'OFFER_INCOMING_CALL';

/** Loud channel used when the call screen cannot be shown (created by the app at start-up). */
const FALLBACK_CHANNEL = 'urgent_alerts_v3';

const RINGTONE = require('../../../assets/sounds/connekyt_ringtone.wav');
const HEADLESS_RING_MS = 47_000;

function ringInBackground(): void {
  if (Platform.OS === 'web') return;
  try {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
    const player = createAudioPlayer(RINGTONE);
    player.loop = true;
    player.play();
    Vibration.vibrate([0, 600, 350, 600, 350, 600], true);
    setTimeout(() => {
      try {
        player.pause();
        player.remove();
      } catch {
        // Best effort.
      }
      Vibration.cancel();
    }, HEADLESS_RING_MS);
  } catch {
    try {
      Vibration.vibrate([0, 600, 350, 600, 350, 600]);
    } catch {
      // Best effort.
    }
  }
}

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

      // 1. Wake the display and post the insistent ringing notification via native IncomingCallModule.
      const showedNativeCall = showIncomingCall(id, title, body);

      // 2. Start audio ringtone + vibration in background/headless JS so it rings even if the OS notification
      // channel is muted or throttled while the app is not focused.
      ringInBackground();

      // 3. If "Display over other apps" (SYSTEM_ALERT_WINDOW) is granted, launch the app to the foreground
      // immediately so the full-screen calling UI overrides the current screen / lock screen like WhatsApp.
      if (canDrawOverOtherApps() === true) {
        const deepLink =
          kind === 'BOOKING_REQUEST'
            ? `connekt://bookings/${encodeURIComponent(id)}`
            : id !== 'offer'
              ? `connekt://offers/${encodeURIComponent(id)}?ring=1`
              : 'connekt://bookings?tab=opportunities';
        Linking.openURL(deepLink).catch(() => {
          // If the OS blocks background activity launch, the insistent notification + ringtone still run.
        });
      }

      if (showedNativeCall) {
        // The push already put an ordinary notification in the tray (native, no app code needed); the call
        // notification replaces it so the offer is not duplicated.
        try {
          for (const n of await Notifications.getPresentedNotificationsAsync()) {
            const d = (n.request.content.data ?? {}) as Record<string, unknown>;
            if (d.candidateId === id || d.referenceId === id) {
              await Notifications.dismissNotificationAsync(n.request.identifier);
            }
          }
        } catch {
          // Best effort.
        }
      }

      // 4. Also post the interactive notification on urgent_alerts_v3 with Accept / Reject action buttons
      // so the user can see and answer directly on the lock screen even if they haven't unlocked yet.
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

    if (isIncomingCallAvailable() && typeof Notifications.registerTaskAsync === 'function') {
      Notifications.registerTaskAsync(OFFER_CALL_TASK).catch(() => {
        // Registration is retried on the next launch.
      });
    }
  } catch {
    // Safe fallback if TaskManager is unavailable in the current binary.
  }
}
