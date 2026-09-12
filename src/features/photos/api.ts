/**
 * Find My Photos — facial-recognition photo search + album access.
 * Mirrors the web: face-search, invite-code album lookup, free album flow,
 * paid album purchase, and photo download.
 */
import { api } from '@/api/client';
import { env } from '@/config/env';
import type { ApiEnvelope, ApiError, ID } from '@/types';
import type { PickedImage } from '@/services/imagePicker';
import { storage } from '@/services/storage';
import { appendFile } from '@/utils/upload';

// ─── Shared helpers ────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

// ─── Face search ───────────────────────────────────────────────────────────

export type FoundPhoto = {
  id: ID;
  thumbnailUrl?: string;
  url?: string;
  isPurchased: boolean;
  albumId?: string;
  /** 'paid' | 'free' — free albums route through the OTP/email flow. */
  albumType?: string;
  eventId?: string;
  eventTitle?: string;
  photographerName?: string;
  price?: number;
  currency?: string;
  currencyId?: string;
  currencyAbbreviation?: string;
  createdAt?: string;
};

function mapFoundPhoto(r: Raw): FoundPhoto {
  return {
    id: String(r.id ?? ''),
    thumbnailUrl: str(r.thumbnailUrl) ?? str(r.url),
    url: str(r.url),
    isPurchased: r.isPurchased === true,
    albumId: str(r.albumId) ?? str((r.album as Raw)?.id),
    albumType: str(r.albumType),
    eventId: str(r.eventId),
    eventTitle: str(r.eventTitle),
    photographerName: str(r.photographerName),
    price: num(r.price) ?? num(r.pricePerImage),
    currency: str(r.currency) ?? str(r.currencyCode) ?? str(r.currencyAbbreviation),
    currencyId: str(r.currencyId),
    currencyAbbreviation: str(r.currencyAbbreviation) ?? str(r.currency) ?? str(r.currencyCode),
    createdAt: str(r.createdAt),
  };
}

export async function faceSearch(
  selfie: PickedImage,
  code?: string,
  // Web parity: re-running a search after a purchase passes the buyer
  // context so already-bought photos come back flagged isPurchased.
  purchase?: { buyerId?: string | null; refid?: string | null },
): Promise<FoundPhoto[]> {
  const form = new FormData();
  // Cross-platform: on web this must be a real Blob, not the RN
  // { uri, name, type } object (which serialises to "[object Object]" and
  // makes the backend report "Required part 'selfie' is missing").
  await appendFile(form, 'selfie', selfie);
  if (code && code.trim()) form.append('code', code.trim());

  const qs = new URLSearchParams();
  if (purchase?.buyerId) qs.set('buyerId', purchase.buyerId);
  if (purchase?.refid) qs.set('refid', purchase.refid);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const res = await api.post<ApiEnvelope<Raw[]>>(`/public/face-search${suffix}`, form);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapFoundPhoto).filter((p) => p.id);
}

// ─── Viewer ID + preview URL watermarking ──────────────────────────────────

export async function getViewerId(buyerId?: string | null): Promise<string> {
  if (buyerId) return `B${buyerId.slice(0, 8)}`;
  try {
    let id = await storage.get('photoViewerId');
    if (!id) {
      id = 'V' + Math.random().toString(36).slice(2, 10).toUpperCase();
      await storage.set('photoViewerId', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function stampPreviewUrl(
  url: string | undefined,
  viewerId: string,
  purchase?: { buyerId?: string | null; refid?: string | null }
): string | undefined {
  if (!url) return url;
  if (!url.includes('/api/photos/') || !url.includes('/preview')) return url;
  const sep = url.includes('?') ? '&' : '?';
  let out = `${url}${sep}v=${viewerId}`;
  if (purchase?.buyerId) out += `&buyerId=${purchase.buyerId}`;
  if (purchase?.refid) out += `&refid=${purchase.refid}`;
  return out;
}

// ─── Invite-code album lookup ───────────────────────────────────────────────

export type AlbumPhotoItem = {
  id: string;
  url: string;
  thumbnailUrl?: string;
  price?: number;
  albumId?: string;
  albumType?: string;
  currencyAbbreviation?: string;
  currencyId?: string;
  isPurchased?: boolean;
  alt?: string;
};

export type AlbumData = {
  albumId: string;
  eventId?: string;
  title?: string;
  photographerName?: string;
  albumType?: string;
  pricing?: {
    pricePerImage?: number;
    currencyId?: string;
    currencyAbbreviation?: string;
  };
  photos: AlbumPhotoItem[];
};

export async function getAlbumByCode(code: string): Promise<AlbumData> {
  const res = await api.get<ApiEnvelope<Raw>>(`/public/albums?code=${encodeURIComponent(code)}`);
  // A wrong or expired code answers HTTP 200 with action:0. Falling through
  // to the parser turned that into an album with zero photos, so the screen
  // showed an empty gallery instead of "that code isn't right".
  if (res?.action !== 1) {
    throw {
      status: 404,
      message: res?.message || 'That code did not match an album. Check it and try again.',
    } satisfies ApiError;
  }
  // Backend wraps in { action:1, data: {...} }; api client puts that into res.data
  const d = (res?.data ?? res ?? {}) as Raw;
  const pricing = (d.pricing as Raw) || {};
  const perPhoto = num(pricing.pricePerImage) ?? num(d.pricePerPhoto);
  const curId = str(pricing.currencyId) ?? str(d.currencyId);
  const curAbbr = str(pricing.currencyAbbreviation) ?? str(d.currencyAbbreviation);
  const albumId = str(d.albumId) ?? str(d.id) ?? '';
  const albumType = str(d.albumType);
  const rawPhotos = Array.isArray(d.photos) ? (d.photos as Raw[]) : [];
  return {
    albumId,
    eventId: str(d.eventId),
    title: str(d.title) ?? str(d.eventTitle),
    photographerName: str(d.photographerName),
    albumType,
    pricing: { pricePerImage: perPhoto, currencyId: curId, currencyAbbreviation: curAbbr },
    photos: rawPhotos.map((p) => ({
      id: String(p.id ?? ''),
      url: str(p.url) ?? str(p.thumbnailUrl) ?? '',
      thumbnailUrl: str(p.thumbnailUrl) ?? str(p.url),
      price: num(p.price) ?? perPhoto,
      albumId,
      albumType,
      currencyId: curId,
      currencyAbbreviation: curAbbr,
    })).filter((p) => p.id),
  };
}

// ─── Free album flow ────────────────────────────────────────────────────────

export type FreeAlbumPhoto = {
  id: string;
  url: string;
  thumbnailUrl: string;
  caption?: string;
};

export type FreeAlbumData = {
  albumId: string;
  title: string;
  photographerName?: string;
  expiresAt?: string;
  photos: FreeAlbumPhoto[];
  maxFreeDownloads?: number | null;
  pricePerExtraImage?: number | null;
  currencyId?: string;
  currencyAbbreviation?: string;
  alreadyAcquiredPhotoIds?: string[];
};

function parseFreeAlbumData(raw: Raw): FreeAlbumData {
  // Handle double-wrap { action, data: { ...actual fields } }
  const d: Raw = (raw?.data && typeof raw.data === 'object') ? (raw.data as Raw) : raw;
  const photos = Array.isArray(d.photos) ? (d.photos as Raw[]) : [];
  const maxRaw = d.maxFreeDownloads ?? d.max_free_downloads ?? null;
  const priceRaw = d.pricePerExtraImage ?? d.price_per_extra_image ?? null;
  const acquired = Array.isArray(d.alreadyAcquiredPhotoIds)
    ? (d.alreadyAcquiredPhotoIds as string[])
    : Array.isArray(d.acquiredPhotoIds)
      ? (d.acquiredPhotoIds as string[])
      : [];
  return {
    albumId: str(d.albumId) ?? str(d.id) ?? '',
    title: str(d.title) ?? str(d.eventTitle) ?? '',
    photographerName: str(d.photographerName),
    expiresAt: str(d.expiresAt),
    maxFreeDownloads: maxRaw !== null ? Number(maxRaw) : null,
    pricePerExtraImage: priceRaw !== null ? Number(priceRaw) : null,
    currencyId: str(d.currencyId),
    currencyAbbreviation: str(d.currencyAbbreviation) ?? str(d.currencySymbol),
    alreadyAcquiredPhotoIds: acquired,
    photos: photos.map((p) => ({
      id: String(p.id ?? ''),
      url: str(p.url) ?? '',
      thumbnailUrl: str(p.thumbnailUrl) ?? str(p.url) ?? '',
      caption: str(p.caption),
    })).filter((p) => p.id),
  };
}

/** Request OTP for a free album. Throws on failure. */
export async function requestFreeAlbumAccess(accessCode: string, email: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>('/public/albums/free/request-access', {
    accessCode: accessCode.trim(),
    email: email.trim().toLowerCase(),
  });
  // action !== 1 means error from backend
  if ((res as unknown as Raw)?.action === 0) {
    const msg = str((res as unknown as Raw)?.message);
    throw new Error(msg || 'Failed to send access code.');
  }
}

/** Verify OTP and return the free album with photos. Throws on failure. */
export async function verifyFreeAlbumAccess(
  accessCode: string,
  email: string,
  otp: string
): Promise<FreeAlbumData> {
  const res = await api.post<ApiEnvelope<Raw>>('/public/albums/free/verify-access', {
    accessCode: accessCode.trim(),
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  });
  const envelope = (res ?? {}) as Raw;
  if (envelope.action === 0) {
    const msg = str(envelope.message);
    throw new Error(msg || 'Invalid verification code.');
  }
  const inner = (envelope.data ?? envelope) as Raw;
  const albumData = parseFreeAlbumData(inner);
  // If photos came back in verify, we're done
  if (albumData.photos.length > 0) return albumData;
  // Otherwise fetch photos separately
  if (albumData.albumId) {
    const full = await getFreeAlbum(albumData.albumId);
    return { ...albumData, ...full };
  }
  return albumData;
}

/** Fetch free album photos after OTP verification. */
export async function getFreeAlbum(albumId: string): Promise<FreeAlbumData> {
  const res = await api.get<ApiEnvelope<Raw>>(`/public/albums/free/${encodeURIComponent(albumId)}`);
  const envelope = (res ?? {}) as Raw;
  const inner = (envelope.data ?? envelope) as Raw;
  return parseFreeAlbumData(inner);
}

/** Persist which photos the viewer downloaded (for OWNED tracking). */
export async function logFreeAlbumDownload(albumId: string, photoIds: string[]): Promise<void> {
  try {
    await api.post(`/public/albums/free/${encodeURIComponent(albumId)}/log-download`, { photoIds });
  } catch { /* best-effort */ }
}

// ─── Paid album purchase ────────────────────────────────────────────────────

export type IdentifyBuyerResult = {
  buyerId: string;
  purchasedPhotoIds: string[];
};

export async function identifyAlbumBuyer(
  albumId: string,
  data: { name: string; email: string; phone: string }
): Promise<IdentifyBuyerResult> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/albums/${encodeURIComponent(albumId)}/identify-buyer`,
    { ...data, deviceFingerprint: '' },
  );
  const d = (res?.data ?? {}) as Raw;
  return {
    buyerId: str(d.buyerId) ?? '',
    purchasedPhotoIds: Array.isArray(d.purchasedPhotoIds) ? (d.purchasedPhotoIds as string[]) : [],
  };
}

// ─── ⚠ UNUSED payment surface — read docs/PAYMENTS.md before wiring any of
//     this up ────────────────────────────────────────────────────────────────
//
// Everything from here to the unlock helpers below (initiateAlbumPurchase,
// initiateMultiAlbumPurchase, recordAlbumPurchase, getPublicPaymentStatus) is
// defined but NEVER CALLED. The app does not take payments natively: photo
// checkout opens connekyt.com in the in-app browser via
// `webCheckout.browsePhotosUrl` / `albumPurchaseUrl`, and the web client owns
// initiation, polling, settlement and delivery.
//
// Wiring these up means re-implementing a payment flow that took seven
// production defects to get right on web — including one where anonymous
// buyers were told a successful payment had failed and offered a retry that
// charges them again. If you genuinely need a native flow, read
// docs/PAYMENTS.md first, keep every status read on the PUBLIC endpoints these
// use, and give every failure path a terminal state.
//
// Note also that the in-app browser is a separate storage jar: anything the
// web checkout writes to localStorage (buyerId, cart, unlock code) is NOT
// visible to this app and disappears when the sheet closes. Delivery
// therefore relies on the emailed unlock code, not on app-side state.

export type AlbumPurchaseResult = {
  refid: string;
  paymentUrl?: string;
};

export async function initiateAlbumPurchase(data: {
  albumId: string;
  photoIds: string[];
  buyerId: string;
  amount: number;
  currencyId: string;
}): Promise<AlbumPurchaseResult> {
  const res = await api.post<ApiEnvelope<Raw>>(
    '/public/payments/xentripay/initiate-album-purchase',
    data,
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  const refid = str(d.refid) ?? str(d.reference) ?? str(d.transactionId) ?? str(d.refId) ?? '';
  const paymentUrl = str(d.paymentUrl) ?? str(d.redirectUrl) ?? str(d.url) ?? str(d.checkoutUrl);
  return { refid, paymentUrl };
}

/** One slice of a cross-album purchase: a face-scan can match photos across
 * multiple photographers' albums — each slice becomes its own AlbumPurchase
 * row server-side so revenue routes to the right photographer. */
export type MultiAlbumPurchaseItem = {
  albumId: string;
  photoIds: string[];
  amount: number;
  currencyId: string;
};

export async function initiateMultiAlbumPurchase(data: {
  items: MultiAlbumPurchaseItem[];
  buyerId?: string;
  viewerEmail?: string;
  // Web parity: the same endpoint accepts a payment method so the buyer
  // can pick mobile money (phone + operator) OR card. Card returns a
  // paymentUrl to open; mobile money returns just a refid to poll. When
  // omitted the backend falls back to its card/hosted-page default.
  paymentMethod?: 'MOBILE_MONEY' | 'CARD';
  phone?: string;
  telecomProvider?: string; // 'MTN' | 'AIRTEL' | 'MPESA' | …
  /** ISO-2 country — drives backend gateway routing (PawaPay vs XentriPay). */
  country?: string;
  /** Where the gateway sends the buyer back after a card payment. */
  redirectUrl?: string;
}): Promise<AlbumPurchaseResult> {
  const body: Record<string, unknown> = { items: data.items };
  if (data.buyerId) body.buyerId = data.buyerId;
  if (data.viewerEmail) body.viewerEmail = data.viewerEmail;
  if (data.paymentMethod) body.paymentMethod = data.paymentMethod;
  if (data.phone) body.phone = data.phone;
  if (data.telecomProvider) body.telecomProvider = data.telecomProvider;
  if (data.country) body.country = data.country;
  if (data.redirectUrl) body.redirectUrl = data.redirectUrl;

  const res = await api.post<ApiEnvelope<Raw>>(
    '/public/payments/xentripay/initiate-multi-album-purchase',
    body,
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  const refid = str(d.refid) ?? str(d.reference) ?? str(d.transactionId) ?? str(d.refId) ?? '';
  const paymentUrl = str(d.paymentUrl) ?? str(d.redirectUrl) ?? str(d.url) ?? str(d.checkoutUrl);
  return { refid, paymentUrl };
}

export type RecordPurchaseResult = {
  unlockCode?: string;
  status?: string;
};

export async function recordAlbumPurchase(
  refid: string,
  buyerId?: string
): Promise<RecordPurchaseResult> {
  const res = await api.post<ApiEnvelope<Raw>>(
    '/public/payments/record-album-purchase',
    buyerId ? { refid, buyerId } : { refid },
  );
  const d = (res?.data ?? {}) as Raw;
  return { unlockCode: str(d.unlockCode), status: str(d.status) };
}

export type PublicPaymentStatus = 'success' | 'pending' | 'failed';

export async function getPublicPaymentStatus(refid: string): Promise<PublicPaymentStatus> {
  const res = await api.get<ApiEnvelope<Raw> & Raw>(
    `/public/payments/xentripay/status/${encodeURIComponent(refid)}`,
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  const raw = (str(d.status) ?? str(d.paymentStatus) ?? '').toUpperCase();
  if (/SUCCESS|COMPLETED|PAID|APPROVED/.test(raw)) return 'success';
  if (/FAIL|CANCEL|DECLIN|ERROR/.test(raw)) return 'failed';
  return 'pending';
}

/** Build the URL for downloading a purchased photo (auth via query params). */
export function getPhotoDownloadUrl(
  albumId: string,
  photoId: string,
  token: { refid?: string; buyerId?: string }
): string {
  const base = env.apiBaseUrl.replace(/\/$/, '');
  const qs = new URLSearchParams();
  if (token.refid) qs.set('refid', token.refid);
  if (token.buyerId) qs.set('buyerId', token.buyerId);
  const q = qs.toString();
  return `${base}/public/albums/${albumId}/photo/${photoId}/download${q ? `?${q}` : ''}`;
}

// ─── Unlock already-purchased photos ───────────────────────────────────────

export type UnlockResult = {
  buyerId?: string;
  purchasedPhotoIds?: string[];
  refid?: string;
};

export async function unlockAlbumPhotos(albumId: string, identifier: string): Promise<UnlockResult> {
  const isEmail = identifier.includes('@');
  // Web parity: POST /public/albums/{albumId}/unlock-photos with the album
  // id in the PATH (not the body). The old /public/unlock-photos path 404s
  // — that route doesn't exist on the backend, so "unlock by email / code"
  // silently failed.
  const body = isEmail ? { email: identifier } : { unlockCode: identifier };
  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/albums/${encodeURIComponent(albumId)}/unlock-photos`,
    body,
  );
  // A wrong code or an unknown email answers HTTP 200 with action:0. Reading
  // straight through returned an empty unlock, so the sheet closed as though
  // it had worked and the buyer saw nothing change and no error.
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'That code or email did not match this album.',
    } satisfies ApiError;
  }
  const d = (res?.data ?? {}) as Raw;
  return {
    buyerId: str(d.buyerId),
    purchasedPhotoIds: Array.isArray(d.purchasedPhotoIds) ? (d.purchasedPhotoIds as string[]) : [],
    refid: str(d.refid),
  };
}

// ─── Browse photos (stock library) ─────────────────────────────────────────

export interface BrowseRow {
  imageId: string;
  galleryId: string;
  title: string;
  category: string | null;
  categoryLabel: string | null;
  fileUrl: string;
  /**
   * Grid-sized variant from the thumbnail pipeline. Use this, not fileUrl.
   *
   * fileUrl is the ORIGINAL, and PaidMediaAccessGuard on the backend returns
   * 403 for originals in galleries that sell per photo, which is every gallery
   * this endpoint lists. Rendering fileUrl gives an empty tile. Thumbnails are
   * the intended public preview and are never gated.
   */
  thumbnailUrl?: string;
  photographerId: string | null;
  photographerName: string;
  photographerLogo: string | null;
  listingPrice: number;
  listingCurrency: string | null;
  buyerPrice: number;
  buyerCurrency: string;
}

export async function fetchBrowsePhotos(page: number, size: number = 50): Promise<BrowseRow[]> {
  // Browse is served from /api/public (not /api/remote) — pass a full URL so the client skips the base prefix
  const base = env.apiBaseUrl.replace(/\/api\/remote$/, '');
  const res = await api.get<ApiEnvelope<{ items: Raw[]; total: number }>>(`${base}/api/public/content/browse?page=${page}&size=${size}`);
  const items = res?.data?.items || [];
  return items.map((r: any) => ({
    imageId: String(r.imageId ?? r.id),
    galleryId: String(r.galleryId ?? ''),
    title: String(r.title ?? ''),
    category: str(r.category) ?? null,
    categoryLabel: str(r.categoryLabel) ?? null,
    fileUrl: String(r.fileUrl ?? r.url ?? ''),
    thumbnailUrl: str(r.thumbnailUrl) ?? undefined,
    photographerId: str(r.photographerId) ?? null,
    photographerName: String(r.photographerName ?? 'Unknown'),
    photographerLogo: str(r.photographerLogo) ?? null,
    listingPrice: Number(r.listingPrice || 0),
    listingCurrency: str(r.listingCurrency) ?? null,
    buyerPrice: Number(r.buyerPrice || 0),
    buyerCurrency: String(r.buyerCurrency ?? 'USD'),
  }));
}
