/**
 * Live streams (/api/remote/streams). Viewers browse, join, and tip.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';
import { appendFile } from '@/utils/upload';

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
    telecomProvider?: 'MTN' | 'AIRTEL';
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
    body.telecomProvider = payload.telecomProvider ?? 'MTN';
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
