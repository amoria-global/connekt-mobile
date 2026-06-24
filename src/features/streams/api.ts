/**
 * Live streams (/api/remote/streams). Viewers browse, join, and tip.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Stream = {
  id: ID;
  title: string;
  photographerName?: string;
  thumbnail?: string;
  isLive: boolean;
  viewerCount?: number;
};

export type StreamDetail = Stream & {
  playbackUrl?: string;
  eventId?: string;
};

export type StreamChat = { id: string; sender?: string; message: string; createdAt?: string };

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}
function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 'LIVE' || v === 'live';
}

function mapStream(r: Raw): Stream {
  const photographer = (r.photographer ?? {}) as Raw;
  const photographerName =
    [str(photographer.firstName), str(photographer.lastName)].filter(Boolean).join(' ') ||
    str(photographer.name);
  return {
    id: String(r.id ?? r.streamId ?? ''),
    title: str(r.title) ?? 'Live stream',
    photographerName,
    thumbnail: str(r.thumbnail) ?? str(r.coverImage),
    isLive: bool(r.isLive) || bool(r.status) || !!r.startedAt && !r.endedAt,
    viewerCount: num(r.viewerCount),
  };
}

export async function listStreams(): Promise<Stream[]> {
  // Backend route is /api/remote/customer/streams (ClientStreamController);
  // /api/remote/streams returns 404 ("No static resource"). The old
  // /streams path was never wired and silently broke the Live Streams
  // tab + every in-app stream/[id] open.
  const res = await api.get<ApiEnvelope<unknown>>('/customer/streams');
  const raw = res?.data;
  const data: Raw[] = Array.isArray(raw)
    ? (raw as Raw[])
    : Array.isArray((raw as any)?.content)
      ? ((raw as any).content as Raw[])
      : [];
  return data.map(mapStream).filter((s) => s.id);
}

/**
 * Backend has no `GET /streams/{id}` — there's only the list endpoint
 * and the event-by-id endpoint, and the event itself carries the
 * stream fields (hlsManifestUrl, whepUrl, peakViewers, etc.). So we
 * resolve the "stream detail" view by fetching the event with the
 * same id and mapping the relevant fields across.
 */
export async function getStream(id: string): Promise<StreamDetail> {
  const res = await api.get<ApiEnvelope<Raw>>(`/customer/events/${encodeURIComponent(id)}`);
  const d = (res?.data ?? {}) as Raw;
  // The event response has photographer{} nested; the mapStream helper
  // already handles that shape, so feed it the event raw.
  return {
    ...mapStream(d),
    playbackUrl:
      str(d.hlsManifestUrl) ??
      str(d.playbackUrl) ??
      str(d.whepUrl) ??
      str(d.hls) ??
      str(d.rtmpUrl),
    eventId: String(d.id ?? id),
    title: str(d.title) ?? 'Live stream',
    isLive: str(d.eventStatus)?.toUpperCase() === 'ONGOING' && str(d.streamStatus) !== 'ended',
    thumbnail: str(d.eventPhoto) ?? str(d.thumbnail) ?? str(d.coverImage),
  };
}

function pageContent(data: unknown): Raw[] {
  if (Array.isArray(data)) return data as Raw[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Raw[]) : [];
}

/** Live chat messages for a stream (web parity: GET /customer/events/{eventId}/chats). */
export async function listStreamChats(eventId: string): Promise<StreamChat[]> {
  const res = await api.get<ApiEnvelope<unknown>>(
    `/customer/events/${encodeURIComponent(eventId)}/chats?page=0&size=200`,
  );
  return pageContent(res?.data)
    .map((m) => {
      const sender =
        str(m.senderName) ??
        str(m.userName) ??
        ([str(m.firstName), str(m.lastName)].filter(Boolean).join(' ') || str(m.name));
      return {
        id: String(m.id ?? ''),
        sender: sender || undefined,
        message: str(m.message) ?? str(m.content) ?? str(m.text) ?? '',
        createdAt: str(m.createdAt) ?? str(m.timestamp),
      };
    })
    .filter((c) => c.id && c.message);
}

export async function joinStream(id: string): Promise<string | undefined> {
  const res = await api.post<ApiEnvelope<Raw>>(`/customer/streams/${encodeURIComponent(id)}/join`);
  const d = (res?.data ?? {}) as Raw;
  return str(d.playbackUrl) ?? str(d.hls);
}

export async function tipStream(id: string, amount: number): Promise<void> {
  await api.post(`/streams/${encodeURIComponent(id)}/tip`, { amount });
}

// ────── Public stream access (guest / anonymous viewer flow) ──────────────
//
// Mirrors the web's `validateStreamToken` / `requestStreamAccess` /
// anonymous-viewer endpoints so the mobile guest flow can validate an invite
// token and join a free or pre-paid live stream the same way.

export type ValidatedStreamToken = {
  valid: boolean;
  eventId?: string;
  eventTitle?: string;
  hasLiveStream: boolean;
  hlsManifestUrl?: string;
  streamFee?: number;
  currencyCode?: string;
  currencySymbol?: string;
  requiresPayment: boolean;
};

export async function validateStreamToken(
  eventId: string,
  inviteToken: string,
): Promise<ValidatedStreamToken> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/public/events/${encodeURIComponent(eventId)}/stream/validate-token`,
    { inviteToken },
    { skipAuth: true },
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  return {
    valid: d.valid === true,
    eventId: str(d.eventId) ?? eventId,
    eventTitle: str(d.eventTitle),
    hasLiveStream: d.hasLiveStream === true,
    hlsManifestUrl: str(d.hlsManifestUrl) ?? undefined,
    streamFee: num(d.streamFee),
    currencyCode: str(d.currencyAbbreviation),
    currencySymbol: str(d.currencySymbol),
    requiresPayment: d.requiresPayment === true,
  };
}

export type StreamAccess = { whepUrl?: string; hlsManifestUrl?: string; eventTitle?: string };

export async function requestStreamAccess(
  eventId: string,
  inviteToken: string,
  viewerUsername: string,
): Promise<StreamAccess> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/stream/access`,
    { inviteToken, viewerUsername },
    { skipAuth: true },
  );
  const d = (res?.data ?? {}) as Raw;
  return {
    whepUrl: str(d.whepUrl),
    hlsManifestUrl: str(d.hlsManifestUrl),
    eventTitle: str(d.eventTitle),
  };
}

/** Public viewer count for the event detail screen (no auth). */
export async function getPublicViewerCount(eventId: string): Promise<number> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/viewers`,
    { skipAuth: true },
  );
  const d = (res?.data ?? {}) as Raw;
  return num(d.viewerCount) ?? 0;
}

// ────── Anonymous viewer (paid live stream, no account) ──────────────────

export type AnonymousViewerRegistration = {
  viewerId: string;
  needsPayment: boolean;
  amount?: number;
  currencyCode?: string;
  hlsManifestUrl?: string;
};

export async function registerAnonymousViewer(
  eventId: string,
  payload: { name: string; email: string; phone?: string; deviceId: string },
): Promise<AnonymousViewerRegistration> {
  // Backend DTO (AnonymousViewerRequest) requires the field as
  // `deviceFingerprint`, not `deviceId`. Phone is @NotBlank too —
  // pass a safe empty string when missing so the form still
  // validates (the lookup-by-email path doesn't actually use phone).
  const body = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone ?? '',
    deviceFingerprint: payload.deviceId,
  };
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/register`,
    body,
    { skipAuth: true },
  );
  // Register returns the fields at the TOP level (not under data):
  //   { action, status, viewerId, whepUrl?, name? }
  const top = (res ?? {}) as Raw;
  const d = (top.data ?? top) as Raw;
  const status = str((top as any).status) ?? str(d.status);
  return {
    viewerId: String((top as any).viewerId ?? d.viewerId ?? d.id ?? ''),
    needsPayment: status === 'REQUIRES_PAYMENT' || d.needsPayment === true || d.requiresPayment === true,
    amount: num(d.amount) ?? num(d.streamFee),
    currencyCode: str(d.currencyAbbreviation) ?? str(d.currencyCode),
    // ACCESS_GRANTED returns whepUrl (WebRTC); free streams may carry
    // hlsManifestUrl. Either resolves the "Already paid? Recover by
    // email" flow.
    hlsManifestUrl: str(d.hlsManifestUrl) ?? str((top as any).whepUrl) ?? str(d.whepUrl),
  };
}

export async function confirmAnonymousPayment(
  eventId: string,
  payload: { viewerId: string; refid: string },
): Promise<{ hlsManifestUrl?: string }> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/confirm-payment`,
    payload,
    { skipAuth: true },
  );
  const d = (res?.data ?? {}) as Raw;
  return { hlsManifestUrl: str(d.hlsManifestUrl) };
}

export async function checkAnonymousAccessStatus(
  eventId: string,
  viewerId: string,
): Promise<{ active: boolean; hlsManifestUrl?: string }> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/access-status`,
    { viewerId },
    { skipAuth: true },
  );
  const d = (res?.data ?? {}) as Raw;
  return { active: d.active === true || d.status === 'ACTIVE', hlsManifestUrl: str(d.hlsManifestUrl) };
}

// ────── Public stream chat + reactions ───────────────────────────────────
//
// Mirrors the web view-event chat panel:
//   GET  /public/events/{id}/chats?page=0&size=50 → { data: messages[], reactions: [] }
//   POST /public/events/{id}/chats   body { viewerId, message, deviceFingerprint, messageType? }
// Reactions reuse the same POST endpoint with messageType=REACTION; the
// message field carries the emoji literal. Backend rate-limits chats
// (10/min) and reactions (30/min) per viewer.

export type PublicStreamChat = {
  id: string;
  viewerName?: string;
  senderName?: string;
  message: string;
  type?: string; // TEXT | REACTION | WISH | VIDEO
  videoUrl?: string;
  timestamp?: string;
};

export type PublicStreamChatPage = {
  messages: PublicStreamChat[];
  reactions: PublicStreamChat[];
};

function mapPublicChat(m: Raw): PublicStreamChat {
  const sender = str(m.viewerName) ?? str(m.senderName) ?? str(m.userName) ??
    ([str(m.firstName), str(m.lastName)].filter(Boolean).join(' ') || str(m.name));
  return {
    id: String(m.id ?? ''),
    viewerName: sender,
    senderName: sender,
    message: str(m.content) ?? str(m.message) ?? str(m.text) ?? '',
    type: str(m.chatType) ?? str(m.type),
    videoUrl: str(m.videoUrl) ?? str(m.fileUrl),
    timestamp: str(m.timestamp) ?? str(m.createdAt),
  };
}

export async function getPublicStreamChats(
  eventId: string,
  page = 0,
  size = 50,
): Promise<PublicStreamChatPage> {
  const res = await api.get<ApiEnvelope<unknown> & Raw>(
    `/public/events/${encodeURIComponent(eventId)}/chats?page=${page}&size=${size}`,
    { skipAuth: true },
  );
  // Endpoint shape: { data: [...messages], reactions: [...] }
  const data = (res as any)?.data;
  const messages: Raw[] = Array.isArray(data) ? data : (data?.content ?? []);
  const reactions: Raw[] = Array.isArray((res as any)?.reactions)
    ? (res as any).reactions
    : (Array.isArray(data?.reactions) ? data.reactions : []);
  return {
    messages: messages.map(mapPublicChat).filter((m) => m.id && (m.message || m.videoUrl)),
    reactions: reactions.map(mapPublicChat).filter((m) => m.id),
  };
}

export async function sendPublicStreamChat(
  eventId: string,
  payload: { viewerId: string; deviceFingerprint: string; message: string },
): Promise<PublicStreamChat | null> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/chats`,
    payload,
    { skipAuth: true },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send message.' };
  }
  return res?.data ? mapPublicChat(res.data) : null;
}

/**
 * Reactions are stored as REACTION-typed chat rows; the backend
 * fans them out via the same broadcaster so every viewer sees them
 * as floating emoji animations. message carries the emoji literal.
 */
export async function sendPublicStreamReaction(
  eventId: string,
  payload: { viewerId: string; deviceFingerprint: string; emoji: string },
): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/chats`,
    {
      viewerId: payload.viewerId,
      deviceFingerprint: payload.deviceFingerprint,
      message: payload.emoji,
      messageType: 'REACTION',
    },
    { skipAuth: true },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send reaction.' };
  }
}

/**
 * In-app (authenticated) chat send — Coordinator-side endpoint. Used by
 * the in-app stream/[id] viewer.
 */
export async function sendInAppStreamChat(
  eventId: string,
  message: string,
): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/coordinator/streams/${encodeURIComponent(eventId)}/chats`,
    { message },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send message.' };
  }
}
