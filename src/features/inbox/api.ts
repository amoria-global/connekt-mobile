/**
 * Chat (web parity: ChatController.java at /api/remote/chat).
 *
 * The conversations endpoint returns a list of conversations with a
 * `participants` array; the OTHER participant's id is the recipient
 * id used to load history (/chat/messages/{recipientId}) and send
 * new messages (multipart POST to /chat/send with recipientId, content, senderId).
 */
import { api } from '@/api/client';
import { env } from '@/config/env';
import { listPhotographers } from '@/features/photographers/api';
import { listClients } from '@/features/clients/api';
import { storage, StorageKeys } from '@/services/storage';
import { useAuth } from '@/store/auth';
import type { ApiEnvelope, ApiError, ID } from '@/types';

export type Conversation = {
  id: ID;
  /** Backend conversation id (UUID), useful for marking read. */
  conversationId?: ID;
  /** The OTHER participant's customer id — used as the recipientId. */
  partnerId: ID;
  name: string;
  lastMessage?: string;
  unreadCount: number;
  avatar?: string;
  timestamp?: string;
  isOnline?: boolean;
};

export type ChatContact = {
  id: string;
  name: string;
  avatar?: string;
  category?: string;
  isBooked?: boolean;
  isVerified?: boolean;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function num(v: unknown): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

/** Normalize avatar and attachment image URLs (web parity). */
export function normalizeChatImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed.includes('/null')) return undefined;

  const backendRoot = env.apiBaseUrl.replace(/\/api\/remote\/?$/, '');

  if (/^https?:\/\//i.test(trimmed)) {
    const OLD_IP = 'http://197.243.24.101';
    if (trimmed.startsWith(OLD_IP)) {
      return trimmed.replace(OLD_IP, backendRoot);
    }
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `${backendRoot}${trimmed}`;
  }

  return `${backendRoot}/uploads/profile/photos/${trimmed}`;
}

/** Synchronous self ID check from in-memory Zustand auth store. */
export function getSelfIdSync(): string | undefined {
  const storeUser = useAuth.getState().user as any;
  if (storeUser?.customerId) return String(storeUser.customerId);
  if (storeUser?.id) return String(storeUser.id);
  const storeSession = useAuth.getState().session as any;
  if (storeSession?.user?.customerId) return String(storeSession.user.customerId);
  if (storeSession?.user?.id) return String(storeSession.user.id);
  if (storeSession?.customerId) return String(storeSession.customerId);
  return undefined;
}

/**
 * Returns the current authenticated user's ID. Checks Zustand store first,
 * then falls back to persisted session storage.
 */
export async function getSelfId(): Promise<string | undefined> {
  const syncId = getSelfIdSync();
  if (syncId) return syncId;
  try {
    const raw = await storage.get(StorageKeys.session);
    if (!raw) return undefined;
    const session = JSON.parse(raw) as any;
    return (
      session?.user?.customerId ??
      session?.user?.id ??
      session?.customerId ??
      session?.id ??
      undefined
    );
  } catch {
    return undefined;
  }
}

/**
 * Pick the other participant. In backend ChatService.java:
 * conv.setId(contact.getId());
 * conv.setParticipants(List.of(meParticipant, fromCustomer(contact)));
 *
 * The partner is the participant whose ID matches conv.id OR does NOT match selfId.
 */
function pickPartner(participants: Raw[], selfId?: string, convId?: string): Raw | undefined {
  if (!participants.length) return undefined;

  const cleanSelfId = selfId ? selfId.toLowerCase().trim() : undefined;
  const cleanConvId = convId ? convId.toLowerCase().trim() : undefined;

  // 1. Match by conversation ID (in backend ChatService, conv.id is contact.id)
  if (cleanConvId) {
    const matching = participants.find(
      (p) => String(p.id ?? '').toLowerCase().trim() === cleanConvId
    );
    if (matching) return matching;
  }

  // 2. If selfId is known, return the participant that is NOT self
  if (cleanSelfId) {
    const other = participants.find(
      (p) => String(p.id ?? '').toLowerCase().trim() !== cleanSelfId
    );
    if (other) return other;
  }

  // 3. Fallback: if there are 2 participants, index 1 is contact, index 0 is me
  if (participants.length > 1) {
    return participants[1];
  }

  return participants[0];
}

function mapConversation(r: Raw, selfId?: string): Conversation {
  const convIdStr = str(r.id);
  const participants = Array.isArray(r.participants) ? (r.participants as Raw[]) : [];
  const partner = pickPartner(participants, selfId, convIdStr) ?? {};

  // Partner ID is the contact participant ID, or r.partnerId, or convId
  const partnerId =
    str(partner.id) ??
    str(r.partnerId) ??
    convIdStr ??
    '';

  const last = (r.lastMessage ?? {}) as Raw;
  const lastMessage =
    str(last.content) ??
    str(r.lastMessageContent) ??
    str(r.lastMessageText) ??
    str(last.text) ??
    str(last.body) ??
    str(r.lastMessage);

  const rawImage =
    str(partner.image) ??
    str(partner.profilePicture) ??
    str(r.partnerImage) ??
    str(r.image) ??
    str(r.avatar);

  const avatar = normalizeChatImageUrl(rawImage);

  const rawName =
    str(partner.name) ??
    str(r.partnerName) ??
    str(r.name) ??
    str(r.title) ??
    'Creator';

  const timestamp =
    str(last.createdAt) ??
    str(r.lastMessageAt) ??
    str(r.updatedAt) ??
    str(last.timestamp) ??
    str(r.createdAt);

  return {
    id: partnerId,
    conversationId: convIdStr,
    partnerId,
    name: rawName,
    lastMessage,
    unreadCount: num(r.unreadCount),
    avatar,
    timestamp,
    isOnline: partner.isOnline === true || r.isOnline === true,
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const [selfId, res] = await Promise.all([
    getSelfId(),
    api.get<ApiEnvelope<Raw[]> | Raw[]>('/chat/conversations'),
  ]);

  const rawList: Raw[] = Array.isArray(res)
    ? res
    : Array.isArray((res as any)?.data)
      ? (res as any).data
      : [];

  const cleanSelf = selfId ? selfId.toLowerCase().trim() : undefined;
  return rawList
    .map((r) => mapConversation(r, selfId))
    .filter(
      (c) =>
        !!c.id &&
        !!c.partnerId &&
        (!cleanSelf || c.partnerId.toLowerCase().trim() !== cleanSelf)
    );
}

export type Message = {
  id: ID;
  text: string;
  senderId?: string;
  /** True when the signed-in user wrote it — drives left/right bubble. */
  isMine?: boolean;
  isRead?: boolean;
  timestamp?: string;
};

function mapMessage(r: Raw, selfId?: string): Message {
  const senderId = str(r.senderId);
  const cleanSelfId = selfId ? selfId.toLowerCase().trim() : undefined;
  const cleanSenderId = senderId ? senderId.toLowerCase().trim() : undefined;
  const isMine = !!cleanSelfId && !!cleanSenderId && cleanSenderId === cleanSelfId;

  return {
    id: String(r.id ?? r.messageId ?? ''),
    text: str(r.content) ?? str(r.text) ?? str(r.body) ?? '',
    senderId,
    isMine,
    isRead: r.isRead === true,
    timestamp: str(r.createdAt) ?? str(r.timestamp) ?? str(r.sentAt),
  };
}

/**
 * Loads chat history with a partner. The route parameter is the OTHER
 * person's customerId.
 */
export async function listMessages(partnerId: string): Promise<Message[]> {
  const [selfId, res] = await Promise.all([
    getSelfId(),
    api.get<ApiEnvelope<Raw[]> | Raw[]>(`/chat/messages/${encodeURIComponent(partnerId)}`),
  ]);

  const rawList: Raw[] = Array.isArray(res)
    ? res
    : Array.isArray((res as any)?.data)
      ? (res as any).data
      : [];

  return rawList.map((r) => mapMessage(r, selfId)).filter((m) => !!m.id);
}

/**
 * Send a chat message (web parity: POST /chat/send, multipart with
 * recipientId, content, senderId).
 */
export async function sendMessage(partnerId: string, text: string): Promise<Raw | null> {
  const senderId = (await getSelfId()) || getSelfIdSync();
  const form = new FormData();
  if (senderId) {
    form.append('senderId', senderId);
  }
  form.append('recipientId', partnerId);
  form.append('content', text);

  const res = await api.post<{ action?: number; message?: string; data?: Raw }>('/chat/send', form);

  if (res && typeof res.action === 'number' && res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Message not sent. Please try again.',
    } satisfies ApiError;
  }
  return res?.data ?? null;
}

/** Mark all messages from a partner as read. */
export async function markConversationRead(partnerId: string): Promise<void> {
  try {
    await api.patch(`/chat/messages/${encodeURIComponent(partnerId)}/read`);
  } catch {
    // Non-critical background sync
  }
}

/** Unread badge count for the bottom tab / topbar bell. */
export async function getUnreadCount(): Promise<number> {
  try {
    const res = await api.get<ApiEnvelope<Raw>>('/chat/unread-count');
    const d = (res?.data ?? {}) as Raw;
    return num(d.count) || num(d.unreadCount) || (typeof res?.data === 'number' ? (res.data as number) : 0);
  } catch {
    return 0;
  }
}

/**
 * Fetch contacts for New Message composer (web parity: /customer/photographers or
 * /coordinator/photographers + public photographers directory).
 * Returns real creators with valid backend UUIDs.
 */
export async function listChatContacts(userRole?: string): Promise<ChatContact[]> {
  const isPhotographer = userRole?.toLowerCase() === 'photographer';
  const isCoordinator = userRole?.toLowerCase().includes('coordinator');

  if (isPhotographer) {
    const [clientsRes, publicPros] = await Promise.allSettled([
      listClients(),
      listPhotographers(),
    ]);

    const contacts: ChatContact[] = [];
    const seenIds = new Set<string>();

    if (clientsRes.status === 'fulfilled' && Array.isArray(clientsRes.value)) {
      for (const c of clientsRes.value) {
        const id = String(c.id ?? '');
        if (id && !seenIds.has(id.toLowerCase())) {
          seenIds.add(id.toLowerCase());
          contacts.push({
            id,
            name: c.name || 'Client',
            avatar: normalizeChatImageUrl(c.avatar),
            category: c.bookings ? `${c.bookings} booking${c.bookings > 1 ? 's' : ''}` : 'Client',
            isBooked: true,
            isVerified: true,
          });
        }
      }
    }

    if (publicPros.status === 'fulfilled' && Array.isArray(publicPros.value)) {
      for (const p of publicPros.value) {
        const id = String(p.id ?? '');
        if (id && !seenIds.has(id.toLowerCase())) {
          seenIds.add(id.toLowerCase());
          contacts.push({
            id,
            name: p.name || 'Creator',
            avatar: normalizeChatImageUrl(p.avatar),
            category: p.category || (p.specialties && p.specialties[0]) || 'Photography',
            isBooked: false,
            isVerified: p.isVerified,
          });
        }
      }
    }

    return contacts;
  }

  const bookedEndpoint = isCoordinator
    ? '/coordinator/photographers'
    : '/customer/photographers';

  const [bookedRes, publicPros] = await Promise.allSettled([
    api.get<ApiEnvelope<Raw[]> | Raw[]>(bookedEndpoint),
    listPhotographers(),
  ]);

  const contacts: ChatContact[] = [];
  const seenIds = new Set<string>();

  // 1. Booked photographers (primary contacts with established relationships)
  if (bookedRes.status === 'fulfilled' && bookedRes.value) {
    const val = bookedRes.value;
    const list = Array.isArray(val)
      ? val
      : Array.isArray((val as any)?.data?.content)
        ? (val as any).data.content
        : Array.isArray((val as any)?.data)
          ? (val as any).data
          : [];

    for (const p of list) {
      const id = String(p.id ?? '');
      if (id && !seenIds.has(id.toLowerCase())) {
        seenIds.add(id.toLowerCase());
        const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
        contacts.push({
          id,
          name: fullName || str(p.name) || 'Booked Creator',
          avatar: normalizeChatImageUrl(str(p.profileImage) ?? str(p.profilePicture) ?? str(p.image)),
          category:
            str(p.speciality) ??
            str(p.category) ??
            (Array.isArray(p.specializations) ? p.specializations[0] : undefined) ??
            'Booked Photographer',
          isBooked: true,
          isVerified: p.isVerified === true,
        });
      }
    }
  }

  // 2. Public photographers directory (to message any creator on the platform)
  if (publicPros.status === 'fulfilled' && Array.isArray(publicPros.value)) {
    for (const p of publicPros.value) {
      const id = String(p.id ?? '');
      if (id && !seenIds.has(id.toLowerCase())) {
        seenIds.add(id.toLowerCase());
        contacts.push({
          id,
          name: p.name || 'Creator',
          avatar: normalizeChatImageUrl(p.avatar),
          category: p.category || (p.specialties && p.specialties[0]) || 'Photography',
          isBooked: false,
          isVerified: p.isVerified,
        });
      }
    }
  }

  return contacts;
}

// Expose env so other callers (websocket subscription) can reuse the base URL.
export { env };
