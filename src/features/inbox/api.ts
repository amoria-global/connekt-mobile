/**
 * Chat conversations (/api/remote/chat/conversations).
 * Mapped defensively because participant/message field names vary.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Conversation = {
  id: ID;
  name: string;
  lastMessage?: string;
  unreadCount: number;
  avatar?: string;
  timestamp?: string;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

function mapConversation(r: Raw): Conversation {
  const other = (r.otherParticipant ?? r.participant ?? r.user ?? {}) as Raw;
  const participantName =
    [str(other.firstName), str(other.lastName)].filter(Boolean).join(' ') || str(other.name);
  const name = str(r.title) ?? str(r.name) ?? participantName ?? 'Conversation';

  const last = (r.lastMessage ?? {}) as Raw;
  const lastMessage = str(r.lastMessageText) ?? str(last.text) ?? str(last.body);

  return {
    id: String(r.conversationId ?? r.id ?? ''),
    name,
    lastMessage,
    unreadCount: num(r.unreadCount),
    avatar: str(other.profilePicture) ?? str(r.avatar),
    timestamp: str(r.updatedAt) ?? str(last.timestamp) ?? str(r.lastMessageAt),
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/chat/conversations');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapConversation).filter((c) => c.id);
}

export type Message = {
  id: ID;
  text: string;
  senderId?: string;
  timestamp?: string;
};

function mapMessage(r: Raw): Message {
  const sender = r.sender;
  const senderId =
    str(r.senderId) ??
    (typeof sender === 'string' ? sender : str((sender as Raw)?.id)) ??
    str(r.customerId);
  return {
    id: String(r.id ?? r.messageId ?? ''),
    text: str(r.text) ?? str(r.body) ?? '',
    senderId,
    timestamp: str(r.timestamp) ?? str(r.createdAt) ?? str(r.sentAt),
  };
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapMessage).filter((m) => m.id);
}

export async function sendMessage(conversationId: string, text: string): Promise<void> {
  await api.post('/chat/messages', { conversationId, text });
}
