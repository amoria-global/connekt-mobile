/**
 * Chat (web parity: ChatController.java at /api/remote/chat).
 *
 * The conversations endpoint returns a list of conversations with a
 * `participants` array; the OTHER participant's id is the recipient
 * id used to load history (/chat/messages/{recipientId}) and send
 * new messages (multipart POST to /chat/send with senderId,
 * recipientId, content).
 *
 * The mobile API used to call `/chat/conversations/{id}/messages` and
 * `POST /chat/messages` — neither exists on the backend, which is why
 * opening any conversation showed an empty thread and Send did nothing.
 */
import { api } from '@/api/client';
import { env } from '@/config/env';
import { storage, StorageKeys } from '@/services/storage';
import type { ApiEnvelope, ID } from '@/types';

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

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

/**
 * Pick the other participant. The conversations DTO sends back BOTH
 * participants (self + partner). Mobile loads the signed-in user's id
 * from the persisted session to filter out the self side.
 */
function pickPartner(participants: Raw[], selfId?: string): Raw | undefined {
  if (!participants.length) return undefined;
  if (!selfId) return participants[0];
  return participants.find((p) => String(p.id ?? '') !== selfId) ?? participants[0];
}

function mapConversation(r: Raw, selfId?: string): Conversation {
  const participants = Array.isArray(r.participants) ? (r.participants as Raw[]) : [];
  const partner = pickPartner(participants, selfId) ?? {};
  const partnerId = String(partner.id ?? '');

  const last = (r.lastMessage ?? {}) as Raw;
  const lastMessage = str(last.content) ?? str(r.lastMessageText) ?? str(last.text) ?? str(last.body);

  return {
    id: partnerId || String(r.id ?? ''),
    conversationId: str(r.id),
    partnerId,
    name: str(partner.name) ?? str(r.title) ?? str(r.name) ?? 'Conversation',
    lastMessage,
    unreadCount: num(r.unreadCount),
    avatar: str(partner.image) ?? str(partner.profilePicture) ?? str(r.avatar),
    timestamp: str(last.createdAt) ?? str(r.updatedAt) ?? str(last.timestamp) ?? str(r.lastMessageAt),
    isOnline: partner.isOnline === true,
  };
}

async function getSelfId(): Promise<string | undefined> {
  try {
    const raw = await storage.get(StorageKeys.session);
    if (!raw) return undefined;
    const session = JSON.parse(raw) as { user?: { customerId?: string } };
    return session.user?.customerId;
  } catch {
    return undefined;
  }
}

export async function listConversations(): Promise<Conversation[]> {
  const [selfId, res] = await Promise.all([
    getSelfId(),
    api.get<ApiEnvelope<Raw[]>>('/chat/conversations'),
  ]);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map((r) => mapConversation(r, selfId)).filter((c) => c.partnerId);
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
  return {
    id: String(r.id ?? r.messageId ?? ''),
    text: str(r.content) ?? str(r.text) ?? str(r.body) ?? '',
    senderId,
    isMine: !!selfId && !!senderId && senderId === selfId,
    isRead: r.isRead === true,
    timestamp: str(r.createdAt) ?? str(r.timestamp) ?? str(r.sentAt),
  };
}

/**
 * Loads chat history with a partner. The route parameter is the OTHER
 * person's customerId — the conversation id is NOT what the backend
 * expects here, despite the previous mobile call shape.
 */
export async function listMessages(partnerId: string): Promise<Message[]> {
  const [selfId, res] = await Promise.all([
    getSelfId(),
    api.get<ApiEnvelope<Raw[]>>(`/chat/messages/${encodeURIComponent(partnerId)}`),
  ]);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map((r) => mapMessage(r, selfId)).filter((m) => m.id);
}

/**
 * Send a chat message (web parity: POST /chat/send, multipart with
 * senderId, recipientId, content). The previous JSON POST to
 * /chat/messages 404'd, which is why Send did nothing.
 */
export async function sendMessage(partnerId: string, text: string): Promise<void> {
  const senderId = await getSelfId();
  if (!senderId) throw { status: 401, message: 'Not signed in' };
  const form = new FormData();
  form.append('senderId', senderId);
  form.append('recipientId', partnerId);
  form.append('content', text);
  await api.post('/chat/send', form);
}

/** Mark all messages from a partner as read. */
export async function markConversationRead(partnerId: string): Promise<void> {
  await api.patch(`/chat/messages/${encodeURIComponent(partnerId)}/read`);
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

// Expose env so other callers (websocket subscription) can reuse the base URL.
export { env };
