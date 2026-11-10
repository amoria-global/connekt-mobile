/**
 * Shows the full-screen incoming booking request (BookingRequestCallModal)
 * for a direct booking still waiting on the photographer. Mounted in the
 * signed-in layout so it can appear over any screen.
 *
 * It looks when the app opens or comes back to the foreground, every 15 s
 * while open, as soon as a push lands, and when the notification (or its
 * "View & respond" button) is tapped. "Decide later" hides a request for the
 * rest of the session; it stays on the Events tab with Accept / Decline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useRole } from '@/features/auth/role';
import { acceptEventBooking, declineEventBooking, listPhotographerEvents } from '@/features/events/api';
import { acceptBooking, listBookings, rejectBooking } from '@/features/bookings/api';
import { canDrawOverOtherApps, showIncomingCall } from '@/features/hybrid/incomingCall';
import { RINGING_CHANNEL } from '@/features/notifications/push';
import type { EventItem } from '@/features/events/types';
import { BookingRequestCallModal } from './BookingRequestCallModal';
import { onShowIncomingRequest, pendingRequests } from './incomingRequests';

const POLL_MS = 15_000;

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function BookingRequestCallNotifier() {
  const { isPhotographer } = useRole();
  const router = useRouter();
  const [active, setActive] = useState<EventItem | null>(null);
  const dismissed = useRef<Set<string>>(new Set());
  const notifiedTrayIds = useRef<Set<string>>(new Set());
  const busy = useRef(false);

  const ensureBookingTrayNotification = useCallback(async (ev: EventItem) => {
    if (Platform.OS === 'web') return;
    const id = ev.id || ev.bookingId;
    if (!id || notifiedTrayIds.current.has(id)) return;
    notifiedTrayIds.current.add(id);

    const client = ev.clientName || 'A client';
    const title = `New Booking Request: ${ev.title || 'Event'}`;
    const body = `${client} requested to book you${ev.eventDate ? ` on ${ev.eventDate}` : ''}. Tap to respond.`;

    showIncomingCall(id, title, body);

    if (Platform.OS === 'android' && AppState.currentState !== 'active' && canDrawOverOtherApps() === true) {
      Linking.openURL(`connekt://bookings/${encodeURIComponent(id)}`).catch(() => {});
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'connekyt_ringtone.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'BOOKING_REQUEST',
          data: {
            type: 'BOOKING',
            kind: 'BOOKING_REQUEST',
            referenceId: id,
            eventId: ev.id,
            bookingId: ev.bookingId,
            link: `/events/${ev.id}`,
          },
        },
        trigger:
          Platform.OS === 'android'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 1,
                channelId: RINGING_CHANNEL,
              }
            : null,
      });
    } catch {
      // Non-fatal if local notification scheduling is unavailable
    }
  }, []);

  /** Show `focusId` if it's still waiting, else the newest waiting request. */
  const check = useCallback(
    async (focusId?: string) => {
      if (!isPhotographer || busy.current) return;
      try {
        const [eventsRes, bookingsRes] = await Promise.allSettled([
          listPhotographerEvents(),
          listBookings(),
        ]);
        const events: EventItem[] =
          eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value)
            ? [...eventsRes.value]
            : [];
        const bookings =
          bookingsRes.status === 'fulfilled' && Array.isArray(bookingsRes.value)
            ? bookingsRes.value
            : [];

        // Synthesize any pending booking into an EventItem if not already in events
        for (const b of bookings) {
          if ((b.status ?? '').toUpperCase() === 'PENDING') {
            const matchIndex = events.findIndex(
              (e) => e.id === b.eventId || (b.eventId && e.id === b.eventId) || e.id === b.id,
            );
            if (matchIndex === -1) {
              events.push({
                id: b.eventId || b.id,
                bookingId: b.id,
                title: b.eventTitle || 'Booking request',
                clientName: b.clientName,
                clientId: b.clientId,
                bookingStatus: 'PENDING',
                eventDate: b.eventDate,
                price: b.proposedPrice,
                currency: b.currency,
                createdAt: b.createdAt,
              });
            } else {
              events[matchIndex].bookingId = b.id;
              if (!events[matchIndex].bookingStatus) {
                events[matchIndex].bookingStatus = 'PENDING';
              }
            }
          }
        }

        if (focusId) dismissed.current.delete(focusId);
        const waiting = pendingRequests(events, todayStr(), dismissed.current);
        const next =
          (focusId && waiting.find((e) => e.id === focusId || e.bookingId === focusId)) ||
          waiting[0] ||
          null;
        if (next) {
          void ensureBookingTrayNotification(next);
        }
        setActive((prev) => (prev && next && prev.id === next.id ? prev : next));
        // Tapped a request that's already been answered: open its page instead.
        if (focusId && !waiting.some((e) => e.id === focusId || e.bookingId === focusId)) {
          router.push(`/event/${focusId}` as never);
        }
      } catch {
        // Offline: try again on the next poll
      }
    },
    [isPhotographer, router, ensureBookingTrayNotification],
  );

  useEffect(() => {
    if (!isPhotographer) return;
    void check();
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => void check(), POLL_MS);
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void check();
        if (!timer) timer = setInterval(() => void check(), POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    const received =
      Platform.OS === 'web'
        ? null
        : Notifications.addNotificationReceivedListener(() => void check());
    const offTap = onShowIncomingRequest((eventId) => void check(eventId));
    return () => {
      if (timer) clearInterval(timer);
      appState.remove();
      received?.remove();
      offTap();
    };
  }, [isPhotographer, check]);

  if (!isPhotographer || !active) return null;

  const done = (ev: EventItem, title: string, message: string) => {
    dismissed.current.add(ev.id);
    if (ev.bookingId) dismissed.current.add(ev.bookingId);
    setActive(null);
    Alert.alert(title, message, [
      { text: 'Open booking', onPress: () => router.push(`/event/${ev.id}` as never) },
      { text: 'OK' },
    ]);
  };

  return (
    <BookingRequestCallModal
      // A new request mounts a fresh screen, so no state carries over.
      key={active.id}
      event={active}
      onAccept={async (ev) => {
        busy.current = true;
        try {
          try {
            await acceptEventBooking(ev.id);
          } catch {
            const bId = ev.bookingId || ev.id;
            await acceptBooking(bId);
          }
          done(ev, 'Booking accepted', 'The client has been notified and asked to pay the deposit.');
        } finally {
          busy.current = false;
        }
        void check(); // another request may be waiting
      }}
      onDecline={async (ev, reason) => {
        busy.current = true;
        try {
          try {
            await declineEventBooking(ev.id, reason);
          } catch {
            const bId = ev.bookingId || ev.id;
            await rejectBooking(bId, reason);
          }
          done(ev, 'Booking declined', 'The client has been told you are not available.');
        } finally {
          busy.current = false;
        }
        void check(); // another request may be waiting
      }}
      onViewDetails={(ev) => {
        dismissed.current.add(ev.id);
        if (ev.bookingId) dismissed.current.add(ev.bookingId);
        setActive(null);
        router.push(`/event/${ev.id}` as never);
      }}
      onLater={(ev) => {
        dismissed.current.add(ev.id);
        if (ev.bookingId) dismissed.current.add(ev.bookingId);
        setActive(null);
      }}
    />
  );
}
