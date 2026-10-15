import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  listStreamChats,
  sendInAppStreamChat,
  sendPublicStreamChat,
  sendPublicStreamReaction,
  type StreamChat,
} from '@/features/streams/api';
import { parseGiftMeta, type GiftEvent } from '@/features/streams/gifting/GiftOverlay';
import { useRole } from '@/features/auth/role';
import { useAuth, isApiError } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import type { ChatConnection } from '../types';
import { isGiftChat } from '../utils';

/** Bounded render window, never keep/render more than this many messages. */
export const CHAT_WINDOW = 100;
const POLL_MS = 4000;
const FAILURES_BEFORE_UNAVAILABLE = 3;

/**
 * Chat + reactions over the EXISTING endpoints (same 4s poll, same send paths,
 * same payloads). Adds connection-health tracking and a bounded window only.
 */
export function useStreamChat(eventId: string | undefined) {
  const user = useAuth((s) => s.user);
  const { isCoordinator } = useRole();
  const [chats, setChats] = useState<StreamChat[]>([]);
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);
  const [giftCount, setGiftCount] = useState(0);
  const [connection, setConnection] = useState<ChatConnection>('connecting');
  const [sending, setSending] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    let first = true;
    let failures = 0;
    const seenGifts = new Set<string>();

    const load = async () => {
      try {
        const msgs = await listStreamChats(eventId);
        if (!active) return;
        failures = 0;
        setConnection('connected');
        setChats(msgs.length > CHAT_WINDOW ? msgs.slice(-CHAT_WINDOW) : msgs);

        for (const m of msgs) {
          if (!isGiftChat(m) || seenGifts.has(m.id)) continue;
          seenGifts.add(m.id);
          if (first) continue;
          const meta = parseGiftMeta(m.giftMeta);
          if (!meta) continue;
          const ev: GiftEvent = { ...meta, id: m.id, senderName: meta.senderName ?? m.sender ?? 'Viewer' };
          setGiftEvents((prev) => [...prev.slice(-49), ev]);
          setGiftCount((n) => n + 1);
        }
        first = false;
      } catch {
        if (!active) return;
        failures += 1;
        setConnection(failures >= FAILURES_BEFORE_UNAVAILABLE ? 'unavailable' : 'reconnecting');
      }
    };

    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [eventId, pollNonce]);

  const retryConnection = useCallback(() => {
    setConnection('connecting');
    setPollNonce((n) => n + 1);
  }, []);

  /** Resolves true when the message was accepted by the backend. */
  const sendMessage = useCallback(
    async (rawMsg: string, replyTo?: string): Promise<boolean> => {
      const trimmed = rawMsg.trim();
      if (!trimmed || !eventId) return false;
      const msg = replyTo && !trimmed.startsWith(`@${replyTo}`) ? `@${replyTo} ${trimmed}` : trimmed;

      setSending(true);
      try {
        const senderName = user
          ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'You'
          : 'You';
        if (isCoordinator) {
          await sendInAppStreamChat(eventId, msg);
        } else {
          const fp = await getDeviceId().catch(() => 'device-client');
          const viewerId = user?.customerId ? String(user.customerId) : 'viewer';
          await sendPublicStreamChat(eventId, { viewerId, deviceFingerprint: fp, message: msg });
        }
        setChats((prev) =>
          [
            ...prev,
            {
              id: `local-${Date.now()}`,
              sender: senderName || 'You',
              message: msg,
              createdAt: new Date().toISOString(),
            },
          ].slice(-CHAT_WINDOW),
        );
        return true;
      } catch (e) {
        Alert.alert('Could not send', isApiError(e) ? e.message : 'Please try again.');
        return false;
      } finally {
        setSending(false);
      }
    },
    [eventId, user, isCoordinator],
  );

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!eventId) return;
      try {
        const fp = await getDeviceId().catch(() => 'device-client');
        const senderName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Viewer';
        const viewerId = user?.customerId ? String(user.customerId) : undefined;
        await sendPublicStreamReaction(eventId, {
          emoji,
          deviceFingerprint: fp,
          viewerId,
          name: senderName || 'Viewer',
        });
      } catch {
        /* local burst already animated */
      }
    },
    [eventId, user],
  );

  const giftChats = useMemo(() => chats.filter(isGiftChat), [chats]);

  return {
    chats,
    giftChats,
    giftEvents,
    giftCount,
    connection,
    sending,
    sendMessage,
    sendReaction,
    retryConnection,
  };
}
