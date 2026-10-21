/**
 * Live streams (/api/remote/streams). Viewers browse, join, and tip.
 */
import { api, requireOk } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';
import { isApiError } from '@/store/auth';
import { appendFile } from '@/utils/upload';
import { normalizeImageUrl } from '@/features/gallery/api';

/** Where a stream is in its life. `ended` covers replays, which is most of a client's list. */
export type StreamPhase = 'live' | 'upcoming' | 'ended';

export type Stream = {
  /** The EVENT id. The viewer, `getStream` and `joinStream` all take an event id; the list rows carry the stream
   *  record's own id as `id` and the event's as `eventId`, and routing on the former opened "not found". */
  id: ID;
  /** The stream record id, kept for deletes. */
  streamId?: string;
  title: string;
  /** The event's own title, kept apart from the stream title because the web searches both. */
  eventTitle?: string;
  photographerName?: string;
  thumbnail?: string;
  isLive: boolean;
  phase: StreamPhase;
  /** Peak viewers when the feed has it, else total distinct viewers. Absent when the feed says nothing. */
  viewerCount?: number;
  messageCount?: number;
  /** Event or stream date as the feed gave it (YYYY-MM-DD), and its time (HH:mm). */
  date?: string;
  time?: string;
  duration?: string;
  eventType?: string;
  photographerImage?: string;
  description?: string;
  /** Video messages in the history. The client feed hardcodes 0, so 0 here means "ask the chats", see streamsModel. */
  videoCount?: number;
};

export type StreamDetail = Stream & {
  playbackUrl?: string;
  /** WebRTC (WHEP) URL, the same feed path the web uses. Absent when the backend withholds it (unpaid). */
  whepUrl?: string;
  eventId?: string;
};

export type StreamChat = {
  id: string;
  sender?: string;
  message: string;
  createdAt?: string;
  /** Backend row type (TEXT | GIFT | …) — GIFT rows carry `giftMeta`. */
  chatType?: string;
  /** JSON string with gift details when chatType === 'GIFT'. Parse defensively. */
  giftMeta?: string;
};

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
/**
 * `giftMeta` is documented as a JSON STRING on GIFT chat rows — but if a
 * backend path ever inlines the object instead, re-stringify it so callers
 * keep a single parse path (see parseGiftMeta in features/streams/gifting).
 */
function giftMetaStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  if (v && typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Both list feeds (`/coordinator/streams`, `/customer/streams`) name things differently from the stream detail:
 * `id` is the stream record, `eventId` the event, the title is `streamTitle` or `eventTitle`, the photographer is a
 * string, and the audience is `peakViewers` or `totalViewers`. Reading `title`, `photographer{}` and `viewerCount`
 * (as this used to) gave every card the title "Live stream" and no photographer or audience.
 */
export function streamPhase(r: Raw): StreamPhase {
  const status = (str(r.streamStatus) ?? str(r.status) ?? '').toLowerCase();
  if (status === 'ended' || !!r.endedAt || !!str(r.replayUrl)) return 'ended';
  if (['live', 'connected', 'streaming'].includes(status) || bool(r.isLive) || (!!r.startedAt && !r.endedAt)) return 'live';
  // The customer feed is completed streams only: a row with a duration or a past stream date has already aired.
  const duration = str(r.duration);
  if (duration && duration !== '0:00:00') return 'ended';
  return status === 'paused' ? 'live' : 'upcoming';
}

/**
 * Image urls in the stream feeds, read the way the web dashboard reads them (streams.tsx normalizeImg):
 * a bare file name is a profile photo, and the client feed builds an event cover under /uploads/event/media/ while
 * the file is saved under /uploads/event/photos/ (ClientStreamService vs FilePath.EVENT_PHOTOS), so the rewrite is
 * what makes the cover load. Verified against production: photos/<file> answers 200, media/<file> answers 404.
 */
export function streamImageUrl(url?: string): string | undefined {
  if (!url || url === 'null' || url.endsWith('/null')) return undefined;
  let u = url;
  if (!u.includes('/') && !u.startsWith('http')) u = `/uploads/profile/photos/${u}`;
  u = u.replace('/uploads/event/media/', '/uploads/event/photos/');
  return normalizeImageUrl(u);
}

export function mapStream(r: Raw): Stream {
  const photographer = (r.photographer ?? {}) as Raw;
  const photographerName =
    str(r.photographerName) ??
    ([str(photographer.firstName), str(photographer.lastName)].filter(Boolean).join(' ') ||
    str(photographer.name));
  const phase = streamPhase(r);
  const viewers = num(r.peakViewers) ?? num(r.totalViewers) ?? num(r.viewerCount);
  return {
    id: String(r.eventId ?? r.id ?? r.streamId ?? ''),
    streamId: str(r.id) ?? str(r.streamId),
    title: str(r.streamTitle) ?? str(r.eventTitle) ?? str(r.title) ?? 'Live stream',
    eventTitle: str(r.eventTitle),
    photographerName: photographerName?.trim() || undefined,
    thumbnail: streamImageUrl(str(r.coverImage) ?? str(r.eventPhoto) ?? str(r.thumbnail) ?? str(r.photographerImage)),
    photographerImage: streamImageUrl(str(r.photographerImage) ?? str(photographer.profilePicture)),
    description: str(r.description),
    videoCount: num(r.totalVideoMessages),
    isLive: phase === 'live',
    phase,
    viewerCount: viewers,
    messageCount: num(r.totalMessages),
    date: (str(r.streamDate) ?? str(r.eventDate))?.slice(0, 10),
    time: (str(r.streamTime) ?? str(r.eventTime))?.slice(0, 5),
    duration: str(r.duration) && str(r.duration) !== '0:00:00' ? str(r.duration) : undefined,
    eventType: str(r.eventType),
  };
}

export async function listStreams(asCoordinator = false): Promise<Stream[]> {
  // A refused read (HTTP 200, action 0) is an error, not an empty list. A failed coordinator read used to fall
  // back to the customer feed, which put a different account's history under a coordinator's name.
  const base = asCoordinator ? '/coordinator/streams' : '/customer/streams';
  const res = requireOk(await api.get<ApiEnvelope<unknown>>(base));
  const raw = res?.data;
  const data: Raw[] = Array.isArray(raw)
    ? (raw as Raw[])
    : Array.isArray((raw as { content?: unknown } | undefined)?.content)
      ? ((raw as { content: Raw[] }).content)
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
export async function getStream(id: string, asCoordinator = false): Promise<StreamDetail> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  // A refused read is an error; it used to leave an empty event that rendered as a stream with no title or feed.
  const res = requireOk(await api.get<ApiEnvelope<Raw>>(`${base}/${encodeURIComponent(id)}`));
  const d = (res?.data ?? {}) as Raw;
  // playbackUrl is HLS only; we derive it from whepUrl when the
  // backend's hlsManifestUrl is null (the same fallback as the public
  // access-status path — Cloudflare's manifest URL shares the customer
  // hash + live input id with WHEP, only path differs).
  const derivedHls = ((u?: string) =>
    u && u.includes('/webRTC/play') ? u.replace('/webRTC/play', '/manifest/video.m3u8') : undefined)(
    str(d.whepUrl),
  );
  return {
    ...mapStream(d),
    playbackUrl:
      str(d.hlsManifestUrl) ?? str(d.playbackUrl) ?? str(d.hls) ?? derivedHls,
    whepUrl: str(d.whepUrl),
    eventId: String(d.id ?? id),
    title: str(d.title) ?? 'Live stream',
    isLive: str(d.eventStatus)?.toUpperCase() === 'ONGOING' && str(d.streamStatus) !== 'ended',
    phase:
      str(d.eventStatus)?.toUpperCase() === 'ONGOING' && str(d.streamStatus) !== 'ended'
        ? 'live'
        : str(d.streamStatus) === 'ended' || ['COMPLETED', 'DONE'].includes((str(d.eventStatus) ?? '').toUpperCase())
          ? 'ended'
          : 'upcoming',
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
        str(m.viewerUsername) ??
        ([str(m.firstName), str(m.lastName)].filter(Boolean).join(' ') || str(m.name));
      return {
        id: String(m.id ?? ''),
        sender: sender || undefined,
        message: str(m.message) ?? str(m.content) ?? str(m.text) ?? '',
        createdAt: str(m.createdAt) ?? str(m.timestamp),
        chatType: str(m.chatType) ?? str(m.type),
        giftMeta: giftMetaStr(m.giftMeta),
      };
    })
    // GIFT rows must reach callers even if the human text is missing —
    // the styled gift line can be rebuilt from giftMeta alone.
    .filter((c) => c.id && (c.message || ((c.chatType || '').toUpperCase() === 'GIFT' && c.giftMeta)));
}

/**
 * Returns a playable HLS manifest URL for the given event/stream. We
 * fetch the event itself because there's no dedicated /streams/{id}/
 * join endpoint on the backend — the event already carries
 * `hlsManifestUrl` (Cloudflare HLS) once the photographer has called
 * /stream/start.
 *
 * Falls back to a Cloudflare-shape URL built from the liveInputId
 * when the column is still null (the backend's getHlsManifestUrl
 * helper does the same).
 */
export async function joinStream(id: string): Promise<string | undefined> {
  const res = await api.get<ApiEnvelope<Raw>>(`/customer/events/${encodeURIComponent(id)}`);
  const d = (res?.data ?? {}) as Raw;
  // HLS ONLY. expo-video has no WebRTC codec — feeding it a whepUrl
  // sends the player to Cloudflare's /webRTC/play endpoint, which
  // 404s on inactive streams and returns SDP (not video) when active.
  // Either way, the result is a black box with no video.
  return str(d.hlsManifestUrl) ?? str(d.playbackUrl);
}

export type TipStreamPayload = {
  amount: number;
  currency?: string;
  provider?: string;
  phone?: string;
};

export async function tipStream(
  id: string,
  payload: number | TipStreamPayload,
): Promise<void> {
  const body = typeof payload === 'number' ? { amount: payload } : payload;
  await api.post(`/streams/${encodeURIComponent(id)}/tip`, body);
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
    // HLS only. Backend's ACCESS_GRANTED now returns hlsManifestUrl
    // alongside whepUrl (see backend fix); expo-video has no WebRTC
    // codec, so we deliberately drop whepUrl from the recovery path.
    hlsManifestUrl: str(d.hlsManifestUrl) ?? str((top as any).hlsManifestUrl),
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

/**
 * Backend signature: GET /public/anonymous-viewer/{id}/access-status
 *   ?fingerprint=…&viewerId=…
 * Old mobile code POSTed a JSON body — backend rejected with
 * 405 "Method 'POST' is not supported", which was the red banner
 * users saw on the public live-stream screen when arriving with a
 * stored viewerId. Response carries `hasAccess` (not `active`) and
 * `whepUrl` (WebRTC). HLS manifest is only available after the
 * register flow — fall back to whepUrl as the playback URL.
 */
export async function checkAnonymousAccessStatus(
  eventId: string,
  viewerId: string,
  fingerprint: string,
): Promise<{ active: boolean; hlsManifestUrl?: string; reason?: string }> {
  const qs = new URLSearchParams({ viewerId, fingerprint });
  const res = await api.get<ApiEnvelope<Raw> & Raw>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/access-status?${qs.toString()}`,
    { skipAuth: true },
  );
  const top = (res ?? {}) as Raw;
  return {
    active: top.hasAccess === true,
    /*
     * Backend builds hlsManifestUrl from liveInputId via
     * cloudflareStreamService.getHlsManifestUrl() but that call
     * silently swallows errors and returns null on failure. When that
     * happens we derive HLS from whepUrl, which shares the same
     * Cloudflare customer hash + live input id — only the path differs:
     *   WHEP:  /webRTC/play
     *   HLS:   /manifest/video.m3u8
     * Mobile expo-video can ONLY play HLS, so this is the fallback
     * that lets a paid viewer actually see video instead of an
     * empty placeholder.
     */
    hlsManifestUrl: str(top.hlsManifestUrl) ?? deriveHlsFromWhep(str(top.whepUrl)),
    reason: str(top.reason),
  };
}

/**
 * Concurrency Heartbeat: Posts every 20-30s while player is active.
 * Heartbeat timeout is 60s server-side; missing heartbeats releases session.
 */
export async function sendAnonymousHeartbeat(
  eventId: string,
  viewerId: string,
  deviceFingerprint: string,
): Promise<{ ok: boolean; status?: string }> {
  try {
    const res = await api.post<ApiEnvelope<Raw> & Raw>(
      `/public/anonymous-viewer/${encodeURIComponent(eventId)}/heartbeat`,
      { viewerId, deviceFingerprint },
      { skipAuth: true },
    );
    const top = (res ?? {}) as Raw;
    return { ok: top.action === 1 || top.status === 'SUCCESS', status: str(top.status) };
  } catch (err) {
    return { ok: false, status: isApiError(err) ? err.message : undefined };
  }
}

/**
 * Clean Exit Hook: Deactivates session immediately when user leaves player
 * or backgrounds the app, allowing another device to claim access.
 */
export async function deactivateAnonymousSession(
  eventId: string,
  deviceFingerprint: string,
): Promise<void> {
  try {
    await api.post<ApiEnvelope<unknown>>(
      `/public/anonymous-viewer/${encodeURIComponent(eventId)}/deactivate`,
      { deviceFingerprint },
      { skipAuth: true },
    );
  } catch {
    /* Best-effort on unmount/background */
  }
}

export type InitiateAnonymousPaymentPayload = {
  viewerId: string;
  phone: string;
  paymentMethod: 'MOBILE_MONEY' | 'CARD';
  telecomProvider?: 'MTN' | 'AIRTEL';
  redirectUrl?: string;
  donationAmount?: number;
  viewerCount?: number;
  currencyId?: string;
};

export type InitiateAnonymousPaymentResult = {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  refid?: string;
  tid?: string;
  paymentUrl?: string;
  message?: string;
};

/**
 * Initiates Mobile Money or Card payment for an anonymous viewer.
 * Mobile Money triggers a USSD prompt on the user's phone.
 */
export async function initiateAnonymousPayment(
  eventId: string,
  payload: InitiateAnonymousPaymentPayload,
): Promise<InitiateAnonymousPaymentResult> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/initiate-payment`,
    payload,
    { skipAuth: true },
  );
  const top = (res ?? {}) as Raw;
  const d = (top.data ?? top) as Raw;
  return {
    status: (str(top.status) ?? str(d.status) ?? 'PENDING') as InitiateAnonymousPaymentResult['status'],
    refid: str(top.refid) ?? str(d.refid),
    tid: str(top.tid) ?? str(d.tid),
    paymentUrl: str(top.paymentUrl) ?? str(d.paymentUrl) ?? str(d.redirectUrl),
    message: str(top.message) ?? str(d.message),
  };
}

export type AnonymousPaymentStatusResult = {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  hlsManifestUrl?: string;
  whepUrl?: string;
  message?: string;
};

/**
 * Polls transaction status after initiating payment.
 */
export async function checkAnonymousPaymentStatus(
  eventId: string,
  refid: string,
  viewerId: string,
): Promise<AnonymousPaymentStatusResult> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/payment-status`,
    { refid, viewerId },
    { skipAuth: true },
  );
  const top = (res ?? {}) as Raw;
  const d = (top.data ?? top) as Raw;
  return {
    status: (str(top.status) ?? str(d.status) ?? 'PENDING') as AnonymousPaymentStatusResult['status'],
    hlsManifestUrl: str(d.hlsManifestUrl) ?? str(top.hlsManifestUrl),
    whepUrl: str(d.whepUrl) ?? str(top.whepUrl),
    message: str(top.message) ?? str(d.message),
  };
}

/**
 * Instant reconcile on demand when user taps "Already paid? Verify access".
 */
export async function reconcileAnonymousByFingerprint(
  eventId: string,
  fingerprint: string,
): Promise<{ status: string; viewerId?: string; hlsManifestUrl?: string }> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/reconcile-by-fingerprint`,
    { fingerprint },
    { skipAuth: true },
  );
  const top = (res ?? {}) as Raw;
  const d = (top.data ?? top) as Raw;
  return {
    status: str(top.status) ?? str(d.status) ?? 'REQUIRES_PAYMENT',
    viewerId: str(top.viewerId) ?? str(d.viewerId),
    hlsManifestUrl: str(top.hlsManifestUrl) ?? str(d.hlsManifestUrl),
  };
}

/**
 * Cloudflare Stream WHEP → HLS URL conversion. Only swaps the path;
 * the customer hash + live input id stay identical. Returns undefined
 * if the input doesn't look like a WHEP URL.
 */
function deriveHlsFromWhep(whepUrl?: string): string | undefined {
  if (!whepUrl) return undefined;
  if (whepUrl.includes('/webRTC/play')) {
    return whepUrl.replace('/webRTC/play', '/manifest/video.m3u8');
  }
  return undefined;
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
  /** Customer id for authenticated senders (null for anonymous viewers). */
  senderId?: string;
  avatar?: string;
  message: string;
  type?: string; // TEXT | REACTION | WISH | VIDEO | GIFT
  /** Raw backend chatType passthrough (same value that feeds `type`). */
  chatType?: string;
  /**
   * GIFT rows only: JSON string
   * {"code","name","emoji","amountUsd","bigAnimation","senderName","declarationId","message"?}.
   * Parse defensively — see parseGiftMeta in features/streams/gifting.
   */
  giftMeta?: string;
  videoUrl?: string;
  /** Backend pre-formatted "h:mm a" clock string. */
  time?: string;
  timestamp?: string;
};

export type PublicStreamChatPage = {
  messages: PublicStreamChat[];
  reactions: PublicStreamChat[];
};

// Backend StreamChatMessageDTO exposes `viewerUsername` + `viewerAvatar`
// (NOT viewerName/senderName) and a pre-formatted `time`. The earlier
// mapper read fields that never exist, so sender names + avatars never
// rendered. Read the real DTO fields first, keep the old keys as fallback.
function mapPublicChat(m: Raw): PublicStreamChat {
  const sender =
    str(m.viewerUsername) ??
    str(m.viewerName) ??
    str(m.senderName) ??
    str(m.userName) ??
    ([str(m.firstName), str(m.lastName)].filter(Boolean).join(' ') || str(m.name));
  return {
    id: String(m.id ?? ''),
    viewerName: sender,
    senderName: sender,
    senderId: str(m.senderId),
    avatar: str(m.viewerAvatar) ?? str(m.avatar),
    message: str(m.message) ?? str(m.content) ?? str(m.text) ?? '',
    type: str(m.chatType) ?? str(m.type),
    chatType: str(m.chatType) ?? str(m.type),
    giftMeta: giftMetaStr(m.giftMeta),
    videoUrl: str(m.videoUrl) ?? str(m.fileUrl),
    time: str(m.time),
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
    // Defense in depth: the backend already splits reactions out and
    // strips WISH rows, but filter by type here too so a REACTION/WISH
    // can never render as a text bubble in the chat list. GIFT rows DO
    // belong in the list (styled gift lines + overlay animations) and
    // must survive even if the human text is empty — the line can be
    // rebuilt from giftMeta alone.
    messages: messages
      .map(mapPublicChat)
      .filter((m) => {
        const t = (m.type || '').toUpperCase();
        if (!m.id || t === 'REACTION' || t === 'WISH') return false;
        if (t === 'GIFT') return !!(m.message || m.giftMeta);
        return !!(m.message || m.videoUrl);
      }),
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
 * Emoji reactions endpoint: POST /api/remote/public/events/{eventId}/reactions
 * Open to everyone (no payment or viewerId required). Rate limit: 60/min.
 */
export async function sendPublicStreamReaction(
  eventId: string,
  payload: { emoji: string; deviceFingerprint: string; viewerId?: string; name?: string },
): Promise<void> {
  const body: Record<string, unknown> = {
    emoji: payload.emoji,
    deviceFingerprint: payload.deviceFingerprint,
  };
  if (payload.name) body.name = payload.name;
  if (payload.viewerId) body.viewerId = payload.viewerId;

  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/public/events/${encodeURIComponent(eventId)}/reactions`,
    body,
    { skipAuth: true },
  );
  const top = (res ?? {}) as Raw;
  if (top.action !== 1 && top.status !== 'SUCCESS' && !top.ok) {
    // Non-fatal fallback - best effort
  }
}

// ────── Public video message (1-min video wish in live chat) ─────────────
//
// Web parity: knockout's "Send 1-min video message" button posts a
// recorded clip to POST /public/events/{id}/chats/video (multipart).
// Backend (PublicRemoteController.sendPublicVideoChat) requires the same
// paid-viewer identity as text chat: viewerId + deviceFingerprint, plus
// the video file and an optional caption. The saved row comes back as a
// VIDEO-typed chat with a `videoUrl`, which every viewer's poll renders
// as an inline player.

export async function sendPublicVideoChat(
  eventId: string,
  payload: {
    viewerId: string;
    deviceFingerprint: string;
    video: { uri: string; name?: string; mimeType?: string };
    content?: string;
  },
): Promise<PublicStreamChat | null> {
  const form = new FormData();
  // Cross-platform file part (real Blob on web, RN object on native).
  await appendFile(form, 'video', {
    uri: payload.video.uri,
    name: payload.video.name ?? `wish-${Date.now()}.mp4`,
    type: payload.video.mimeType ?? 'video/mp4',
  });
  form.append('viewerId', payload.viewerId);
  form.append('deviceFingerprint', payload.deviceFingerprint);
  if (payload.content?.trim()) form.append('content', payload.content.trim());

  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/chats/video`,
    form,
    { skipAuth: true },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send video message.' };
  }
  return res?.data ? mapPublicChat(res.data) : null;
}

// ────── Gift catalog (TikTok-style live gifting) ─────────────────────────
//
// GET /public/gift-catalog (no auth) → envelope
//   { action:1, data:{ baseCurrency:'USD',
//       gifts:[{code,name,emoji,amountUsd,tier,bigAnimation,sortOrder}],
//       exchangeRates:{ ABBR:{symbol,rateToUsd} } } }
// Every gift carries an exact USD amount; the tray shows prices as "$X"
// and the server derives the charged amount from `code` at initiation.

export type GiftCatalogItem = {
  code: string;
  name: string;
  emoji: string;
  amountUsd: number;
  tier: 'POPULAR' | 'PREMIUM';
  /** Big gifts trigger the full-stage takeover animation. */
  bigAnimation: boolean;
  sortOrder: number;
};

export type GiftExchangeRate = { symbol?: string; rateToUsd?: number };

export type GiftCatalog = {
  baseCurrency: string;
  gifts: GiftCatalogItem[];
  exchangeRates: Record<string, GiftExchangeRate>;
};

export async function getGiftCatalog(): Promise<GiftCatalog> {
  const res = await api.get<ApiEnvelope<Raw>>('/public/gift-catalog', { skipAuth: true });
  const d = (res?.data ?? {}) as Raw;
  const rawGifts: Raw[] = Array.isArray(d.gifts) ? (d.gifts as Raw[]) : [];
  const gifts = rawGifts
    .map((g): GiftCatalogItem => ({
      code: str(g.code) ?? '',
      name: str(g.name) ?? str(g.code) ?? 'Gift',
      emoji: str(g.emoji) ?? '🎁',
      amountUsd: num(g.amountUsd) ?? 0,
      tier: str(g.tier)?.toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'POPULAR',
      bigAnimation: g.bigAnimation === true,
      sortOrder: num(g.sortOrder) ?? 0,
    }))
    .filter((g) => g.code && g.amountUsd > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const ratesRaw = (d.exchangeRates ?? {}) as Raw;
  const exchangeRates: Record<string, GiftExchangeRate> = {};
  for (const [abbr, v] of Object.entries(ratesRaw)) {
    const r = (v ?? {}) as Raw;
    exchangeRates[abbr] = { symbol: str(r.symbol), rateToUsd: num(r.rateToUsd) };
  }

  return { baseCurrency: str(d.baseCurrency) ?? 'USD', gifts, exchangeRates };
}

// ────── Public gift / sponsor flow ───────────────────────────────────────
//
// Web parity: AnonymousViewerController.@PostMapping("/{id}/gift") —
// the same endpoint the web uses for anonymous viewers. Triggers
// XentriPay (MoMo or Card) and returns a paymentUrl. Backend body:
//   { viewerId, deviceFingerprint, amount, currencyId, paymentMethod,
//     phone?, telecomProvider?, donationAmount?, redirectUrl?, message?,
//     giftCode? }
//
// `giftCode` (optional) names a catalog gift — when present the SERVER
// derives the exact amount from the catalog and the client `amount` is
// ignored, so a tampered client can't underpay for a Lion. Mobile does
// NOT collect payment in-app though: the live screens hand off to the
// web page (liveGiftUrl in features/payments/webCheckout), so this
// function currently has no callers — it's kept in web-contract parity.

export type GiftInitiation = {
  refid?: string;
  paymentUrl?: string;
  message?: string;
};

export async function initiatePublicGift(
  eventId: string,
  payload: {
    viewerId: string;
    deviceFingerprint: string;
    amount: number;
    currencyId: string;
    paymentMethod: 'MOMO' | 'CARD';
    phone?: string;
    /** Operator id from the payment options (MTN, AIRTEL, MPESA, ...). */
    telecomProvider?: string;
    redirectUrl?: string;
    giftMessage?: string;
    /** Catalog gift code — server derives the exact amount; `amount` is ignored when present. */
    giftCode?: string;
  },
): Promise<GiftInitiation> {
  const body: Record<string, unknown> = {
    viewerId: payload.viewerId,
    deviceFingerprint: payload.deviceFingerprint,
    amount: payload.amount,
    currencyId: payload.currencyId,
    paymentMethod: payload.paymentMethod,
  };
  if (payload.giftCode) body.giftCode = payload.giftCode;
  if (payload.paymentMethod === 'MOMO') {
    body.phone = payload.phone ?? '';
    body.telecomProvider = payload.telecomProvider ?? '';
  }
  if (payload.paymentMethod === 'CARD' && payload.redirectUrl) {
    body.redirectUrl = payload.redirectUrl;
  }
  if (payload.giftMessage?.trim()) body.message = payload.giftMessage.trim();

  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/gift`,
    body,
    { skipAuth: true },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not start the gift payment.' };
  }
  const d = (res?.data ?? {}) as Raw;
  return {
    refid: str(d.refid) ?? str(d.refId) ?? str(d.referenceId),
    paymentUrl: str(d.paymentUrl) ?? str(d.checkoutUrl),
    message: str(res?.message),
  };
}

/**
 * Gift from a signed-in account: POST /payments/xentripay/initiate-gift.
 * Catalog gifts are priced by `giftCode` on the server (USD); no amount is sent.
 * Same contract the web live page uses for authenticated viewers.
 */
export async function initiateAuthenticatedGift(payload: {
  eventId: string;
  giftCode: string;
  currencyId: string;
  paymentMethod: 'MOBILE_MONEY' | 'CARD';
  phone?: string;
  /** Operator id from the payment options (MTN, AIRTEL, MPESA, ...). */
  telecomProvider?: string;
}): Promise<GiftInitiation> {
  const body: Record<string, unknown> = {
    eventId: payload.eventId,
    giftCode: payload.giftCode,
    currencyId: payload.currencyId,
    paymentMethod: payload.paymentMethod,
  };
  if (payload.paymentMethod === 'MOBILE_MONEY') {
    body.phone = payload.phone ?? '';
    body.telecomProvider = payload.telecomProvider ?? '';
  }
  const res = await api.post<ApiEnvelope<Raw>>('/payments/xentripay/initiate-gift', body);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not start the gift payment.' };
  }
  const d = (res?.data ?? {}) as Raw;
  return {
    refid: str(d.refid) ?? str(d.refId) ?? str(d.referenceId),
    paymentUrl: str(d.paymentUrl) ?? str(d.checkoutUrl),
    message: str(res?.message),
  };
}

// ────── Device-switch confirmation (single-device enforcement) ──────────
//
// The DEVICE_MISMATCH reason from access-status means the paid viewer
// is currently watching from another device. Forced switching isn't
// supported - the backend rejects switch-device unconditionally now,
// regardless of whether the old device is still active (a purchase is
// locked to whichever device is actively watching, no on-demand override).
// The only legitimate way to take over is retryAnonymousDeviceAccess
// below, which succeeds ONLY once the old device has gone quiet for 60s+.

/** @deprecated Backend now rejects this unconditionally - see
 *  retryAnonymousDeviceAccess for the supported "take over once idle" path.
 *  Kept only so any remaining caller gets a clear message instead of a
 *  broken request shape. */
export async function switchAnonymousDevice(
  eventId: string,
  viewerId: string,
  fingerprint: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/switch-device`,
    { viewerId, newDeviceFingerprint: fingerprint },
    { skipAuth: true },
  );
  return { ok: res?.action === 1, message: str(res?.message) };
}

/**
 * Attempts to take over this viewer's session for the current device -
 * succeeds only if the previously-bound device has missed heartbeats for
 * 60s+ (gone idle/closed the app); hard-rejects with a clear message if the
 * other device is still actively watching. This is the real "retry" action
 * for a DEVICE_MISMATCH conflict now that forced switching is gone.
 */
export async function retryAnonymousDeviceAccess(
  eventId: string,
  viewerId: string,
  deviceFingerprint: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/device-check`,
    { viewerId, deviceFingerprint },
    { skipAuth: true },
  );
  return { ok: res?.action === 1, message: str(res?.message) };
}

// ────── Group-code access (web parity: join-package.tsx group flow) ─────────

export type GroupAccessResult = {
  shareCode: string;
  expiresAt?: string;
  viewerCount: number;
  remainingInvites: number;
};

/**
 * Generate a shareable group invite code after a successful group payment.
 * Web: POST /api/remote/public/streams/{eventId}/group-access
 */
export async function generateGroupAccess(
  eventId: string,
  data: { paymentRefId: string; viewerCount: number; purchaserEmail: string },
): Promise<GroupAccessResult> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/streams/${encodeURIComponent(eventId)}/group-access`,
    data,
    { skipAuth: true },
  );
  const d = (res?.data ?? res) as Raw;
  return {
    shareCode: str(d.shareCode) ?? str(d.code) ?? '',
    expiresAt: str(d.expiresAt) ?? str(d.expiry),
    viewerCount: num(d.viewerCount) ?? num(d.people) ?? 0,
    remainingInvites: num(d.remainingInvites) ?? 0,
  };
}

export type GroupRedeemResult = {
  ok: boolean;
  hlsManifestUrl?: string;
  viewerId?: string;
  message?: string;
};

/**
 * Redeem a group invite code on behalf of a new viewer.
 * Web: POST /api/remote/public/streams/{eventId}/redeem-group-code
 */
export async function redeemGroupCode(
  eventId: string,
  data: { inviteCode: string; viewerUsername: string },
): Promise<GroupRedeemResult> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/streams/${encodeURIComponent(eventId)}/redeem-group-code`,
    data,
    { skipAuth: true },
  );
  const d = (res?.data ?? res) as Raw;
  return {
    ok: res?.action === 1 || d?.success === true,
    hlsManifestUrl: str(d.hlsManifestUrl),
    viewerId: str(d.viewerId),
    message: str(res?.message) ?? str(d.message),
  };
}

// ────── Event wishes (web parity: view-event.client.tsx wishes section) ──────

/**
 * Send a pre-event text wish to the organizer.
 * Web: POST /api/remote/public/events/{id}/wishes
 */
export async function sendEventWish(
  eventId: string,
  data: { name: string; email: string; message: string },
): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/wishes`,
    data,
    { skipAuth: true },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send wish.' };
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

// --- Stream history: chats, video messages, delete (web dashboard parity) -----------------------------------------
// The web Streams page (app/pages/client/streams.tsx) is the reference: per stream it reads the chat history from the
// role's own endpoint, splits it into text and video messages, enriches the card from the public event, and lets the
// owner delete the record.

export type StreamMessage = {
  id: string;
  username: string;
  avatar?: string;
  message: string;
  /** Wall-clock label the backend formats ("3:42 PM"). */
  time?: string;
  chatType?: string;
};

export type StreamVideo = {
  id: string;
  username: string;
  avatar?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: string;
  time?: string;
};

export type StreamHistory = { messages: StreamMessage[]; videos: StreamVideo[] };

/**
 * The chat history of one stream. A coordinator reads `/coordinator/streams/{eventId}/chats`, a client
 * `/customer/events/{eventId}/chats` (the same split the web makes). The response is a raw page with no `action`, so
 * only a transport failure is an error; a page with no rows is a real empty history.
 */
export async function listStreamHistory(eventId: string, asCoordinator: boolean): Promise<StreamHistory> {
  const id = encodeURIComponent(eventId);
  const path = asCoordinator
    ? `/coordinator/streams/${id}/chats?page=0&size=500`
    : `/customer/events/${id}/chats?page=0&size=500`;
  const res = await api.get<ApiEnvelope<unknown> & { data?: unknown }>(path);
  const rows = pageContent((res as { data?: unknown })?.data);
  const messages: StreamMessage[] = [];
  const videos: StreamVideo[] = [];
  const seen = new Set<string>();
  for (const m of rows) {
    const rid = String(m.id ?? '');
    if (!rid || seen.has(rid)) continue;
    seen.add(rid);
    const username = str(m.viewerUsername) ?? '';
    const avatar = streamImageUrl(str(m.viewerAvatar));
    const videoUrl = streamImageUrl(str(m.videoUrl));
    if (str(m.videoUrl)) {
      videos.push({
        id: rid,
        username,
        avatar,
        videoUrl: videoUrl ?? '',
        thumbnailUrl: streamImageUrl(str(m.thumbnailUrl)),
        duration: str(m.duration) ?? '0:00',
        time: str(m.time),
      });
    } else {
      messages.push({ id: rid, username, avatar, message: str(m.message) ?? '', time: str(m.time), chatType: str(m.chatType) });
    }
  }
  return { messages, videos };
}

/**
 * Delete a stream record: `DELETE /{role}/streams/{id}` with the record id first and, when that fails, the event id,
 * exactly the web's order (the backend accepts either). Unlike the web, a failure is reported: the client endpoint only
 * lets the creator delete, and a viewer who paid for the stream must be told, not shown a card that stays.
 */
export async function deleteStreamRecord(
  stream: { id: string; streamId?: string },
  asCoordinator: boolean,
): Promise<void> {
  const base = asCoordinator ? '/coordinator/streams' : '/customer/streams';
  const first = stream.streamId ?? stream.id;
  try {
    requireOk(await api.delete<ApiEnvelope<unknown>>(`${base}/${encodeURIComponent(first)}`));
  } catch (e) {
    if (first === stream.id) throw e;
    requireOk(await api.delete<ApiEnvelope<unknown>>(`${base}/${encodeURIComponent(stream.id)}`));
  }
}

/**
 * What the public event adds to a card: its cover, the photographer and the description. Read from the raw payload the
 * way the web does (evt.eventPhoto, evt.photographerName or evt.photographer{}, evt.photographerImage).
 */
export async function loadStreamEventExtras(eventId: string): Promise<Partial<Stream>> {
  const res = await api.get<ApiEnvelope<Raw>>(`/public/events/${encodeURIComponent(eventId)}`, { skipAuth: true });
  const e = (res?.data ?? {}) as Raw;
  const ph = (e.photographer ?? {}) as Raw;
  return {
    thumbnail: streamImageUrl(str(e.eventPhoto) ?? str(e.coverImage)),
    photographerImage: streamImageUrl(str(e.photographerImage) ?? str(ph.profilePicture)),
    description: str(e.description),
    photographerName:
      str(e.photographerName) ?? ([str(ph.firstName), str(ph.lastName)].filter(Boolean).join(' ') || undefined),
  };
}

/**
 * Tells the backend a video message was opened, the call the web makes (streams.tsx markVideoAsViewed):
 * `PATCH /{role}/streams/{streamId}/videos/{videoId}/viewed`, fire and forget. Today the backend cannot honour it for
 * these ids (it looks the video up as an EventMedia and compares the stream id to an event id, and the coordinator
 * route does not exist), so a failure is ignored, exactly as on the web. The screen keeps its own viewed state.
 */
export async function markVideoViewed(streamId: string, videoId: string, asCoordinator: boolean): Promise<void> {
  const role = asCoordinator ? 'coordinator' : 'customer';
  try {
    await api.patch(`/${role}/streams/${encodeURIComponent(streamId)}/videos/${encodeURIComponent(videoId)}/viewed`);
  } catch {
    /* the web ignores this too */
  }
}
