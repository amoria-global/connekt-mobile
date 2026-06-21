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
  const res = await api.get<ApiEnvelope<Raw[]>>('/streams');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapStream).filter((s) => s.id);
}

export async function getStream(id: string): Promise<StreamDetail> {
  const res = await api.get<ApiEnvelope<Raw>>(`/streams/${encodeURIComponent(id)}`);
  const d = (res?.data ?? {}) as Raw;
  return {
    ...mapStream(d),
    playbackUrl: str(d.playbackUrl) ?? str(d.hls) ?? str(d.rtmpUrl),
    eventId: str(d.eventId) ?? str(d.event && (d.event as Raw).id) ?? String(d.id ?? id),
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
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/register`,
    payload,
    { skipAuth: true },
  );
  const d = (res?.data ?? {}) as Raw;
  return {
    viewerId: String(d.viewerId ?? d.id ?? ''),
    needsPayment: d.needsPayment === true || d.requiresPayment === true,
    amount: num(d.amount) ?? num(d.streamFee),
    currencyCode: str(d.currencyAbbreviation) ?? str(d.currencyCode),
    hlsManifestUrl: str(d.hlsManifestUrl),
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
