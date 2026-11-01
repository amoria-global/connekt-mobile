/**
 * Shows the incoming direct booking request modal (BookingRequestCallModal)
 * ONLY when the photographer explicitly taps a booking request device notification
 * (or its "View & respond" action button).
 *
 * Opening the app UI never auto-shows popups or rings.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/dialog';
import { useRouter } from 'expo-router';
import { useRole } from '@/features/auth/role';
import { acceptEventBooking, declineEventBooking, listPhotographerEvents } from '@/features/events/api';
import { acceptBooking, listBookings, rejectBooking } from '@/features/bookings/api';
import type { EventItem } from '@/features/events/types';
import { BookingRequestCallModal } from './BookingRequestCallModal';
import { onShowIncomingRequest, pendingRequests } from './incomingRequests';

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
  const busy = useRef(false);

  /** Show `focusId` when tapped from a device notification. */
  const check = useCallback(
    async (focusId?: string) => {
      if (!isPhotographer || busy.current || !focusId) return;
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

        dismissed.current.delete(focusId);
        const waiting = pendingRequests(events, todayStr(), dismissed.current);
        const next =
          waiting.find((e) => e.id === focusId || e.bookingId === focusId) ||
          waiting[0] ||
          null;
        setActive((prev) => (prev && next && prev.id === next.id ? prev : next));
        if (!waiting.some((e) => e.id === focusId || e.bookingId === focusId)) {
          router.push(`/event/${focusId}` as never);
        }
      } catch {
        // Ignore network errors
      }
    },
    [isPhotographer, router],
  );

  useEffect(() => {
    if (!isPhotographer) return;
    const offTap = onShowIncomingRequest((eventId) => void check(eventId));
    return () => {
      offTap();
    };
  }, [isPhotographer, check]);

  if (!isPhotographer || !active) return null;

  const done = (ev: EventItem, title: string, message: string) => {
    dismissed.current.add(ev.id);
    setActive(null);
    Alert.alert(title, message, [
      { text: 'Open booking', onPress: () => router.push(`/event/${ev.id}` as never) },
      { text: 'OK' },
    ]);
  };

  return (
    <BookingRequestCallModal
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
      }}
      onViewDetails={(ev) => {
        dismissed.current.add(ev.id);
        setActive(null);
        router.push(`/event/${ev.id}` as never);
      }}
      onLater={(ev) => {
        dismissed.current.add(ev.id);
        setActive(null);
      }}
    />
  );
}
