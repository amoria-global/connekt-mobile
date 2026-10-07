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
import { Alert, AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useRole } from '@/features/auth/role';
import { acceptEventBooking, declineEventBooking, listPhotographerEvents } from '@/features/events/api';
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
  const busy = useRef(false);

  /** Show `focusId` if it's still waiting, else the newest waiting request. */
  const check = useCallback(
    async (focusId?: string) => {
      if (!isPhotographer || busy.current) return;
      try {
        const events = await listPhotographerEvents();
        if (focusId) dismissed.current.delete(focusId);
        const waiting = pendingRequests(events, todayStr(), dismissed.current);
        const next = (focusId && waiting.find((e) => e.id === focusId)) || waiting[0] || null;
        setActive((prev) => (prev && next && prev.id === next.id ? prev : next));
        // Tapped a request that's already been answered: open its page instead.
        if (focusId && !waiting.some((e) => e.id === focusId)) {
          router.push(`/event/${focusId}` as never);
        }
      } catch {
        // Offline: try again on the next poll
      }
    },
    [isPhotographer, router],
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
      Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener(() => void check());
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
          await acceptEventBooking(ev.id);
          done(ev, 'Booking accepted', 'The client has been notified and asked to pay the deposit.');
        } finally {
          busy.current = false;
        }
        void check(); // another request may be waiting
      }}
      onDecline={async (ev, reason) => {
        busy.current = true;
        try {
          await declineEventBooking(ev.id, reason);
          done(ev, 'Booking declined', 'The client has been told you are not available.');
        } finally {
          busy.current = false;
        }
        void check(); // another request may be waiting
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
