/**
 * Galleries / Albums.
 * - Client list:        GET  /customer/albums         (rich client album API)
 * - Photographer list:  GET  /photographer/albums
 * - Album detail:       GET  /customer/albums/{id}    (images + lock/payment)
 * - Unlock paid album:  POST /customer/albums/{id}/unlock
 * Image URLs come back absolute from the backend.
 */
import { api, requireOk } from '@/api/client';
import { env } from '@/config/env';
import type { PickedImage } from '@/services/imagePicker';
import type { ApiError, ApiEnvelope, ID } from '@/types';
import { appendFile } from '@/utils/upload';

export function normalizeImageUrl(url?: string | null): string | undefined {
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

  return `${backendRoot}/${trimmed}`;
}

export type GalleryItem = {
  id: ID;
  name: string;
  coverPhoto?: string;
  photoCount?: number;
  locked?: boolean;
  /**
   * True when this album is a content-library album (carries a
   * `contentApprovalStatus`). The Albums tab hides these — they live in
   * the Content tab instead.
   */
  isContent?: boolean;
  /** Album kind label when the backend provides it (Event / Personal / Content). */
  kind?: string;
  /** Event day (yyyy-MM-dd) and delivery day, only when the API sent them. */
  date?: string;
  receivedDate?: string;
  /** Who shot it, on the lists that name them (the client's). */
  photographer?: string;
  eventLocation?: string;
};

export type AlbumImage = { id: ID; url?: string; fullUrl?: string; caption?: string };

export type AlbumDetail = GalleryItem & {
  images: AlbumImage[];
  amountDue?: number;
  currency?: string;
  /** Event this album belongs to — names the archive handoff to mint. */
  eventId?: string;
  currencyId?: string;
  /**
   * Configured price to restore this album, set only while it's locked.
   * Distinct from `amountDue`, which is the event's booking balance — showing
   * that as the restore price was quoting people their whole photography fee.
   */
  archiveFee?: number;
  archiveCurrency?: string;
  photographer?: string;
  photographerAvatar?: string;
  /** Content-album review state (only set for content albums). */
  approvalStatus?: ContentApprovalStatus;
  /** Reviewer's note when the content album was rejected / needs changes. */
  approvalComment?: string;
  categoryLabel?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

function mapGallery(r: Raw): GalleryItem {
  const isContent = !!str(r.contentApprovalStatus);
  const rawCover =
    str(r.thumbnail) ??
    str(r.thumbnailUrl) ??
    str(r.coverPhoto) ??
    str(r.coverImage) ??
    str(r.fileUrl) ??
    str(r.url);
  return {
    id: String(r.id ?? ''),
    name: str(r.title) ?? str(r.name) ?? 'Album',
    coverPhoto: normalizeImageUrl(rawCover),
    photoCount: num(r.photoCount) ?? num(r.photosCount),
    locked: r.isLocked === true || r.locked === true,
    isContent,
    kind: isContent ? 'Content' : str(r.albumType) ?? str(r.kind),
    date: str(r.date) ?? str(r.eventDate),
    receivedDate: str(r.receivedDate) ?? str(r.createdAt),
    photographer: str(r.photographer) ?? str(r.photographerName),
    eventLocation: str(r.eventLocation),
  };
}

/**
 * Normal (event / personal) albums only — the Albums tab. Filters out
 * content-library albums, which live in the Content tab. Web parity:
 * salo-run's Albums view excludes content albums from the main list.
 */
export async function listAlbums(role?: string | boolean): Promise<GalleryItem[]> {
  const all = await listGalleries(role);
  return all.filter((a) => !a.isContent);
}

export async function listGalleries(role?: string | boolean): Promise<GalleryItem[]> {
  const isPhotographer = role === true || role === 'Photographer';
  const isCoordinator = role === 'Coordinator';
  const path = isPhotographer
    ? '/photographer/albums'
    : isCoordinator
    ? '/coordinator/galleries'
    : '/customer/albums';
  // A refused read is HTTP 200 with action 0; read as an empty list it said there were no albums.
  const res = requireOk(await api.get<ApiEnvelope<Raw[]>>(path));
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapGallery).filter((g) => g.id);
}

// --- Content albums (photographer stock library) -------------------------

export type ContentApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type ContentAlbumItem = GalleryItem & {
  approvalStatus?: ContentApprovalStatus;
  categoryLabel?: string;
  approvalComment?: string;
};

/**
 * Content/library albums the photographer has authored. Web parity
 * (salo-run ContentAlbumsTab): there's no dedicated content GET endpoint
 * yet, so we reuse `/photographer/albums` and keep only rows that carry a
 * `contentApprovalStatus` — that flag is what marks an album as a
 * content-library album rather than a client event album.
 */
export async function listContentAlbums(): Promise<ContentAlbumItem[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/photographer/albums');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data
    .map((r) => ({
      ...mapGallery(r),
      approvalStatus: str(r.contentApprovalStatus) as ContentApprovalStatus | undefined,
      categoryLabel: str(r.contentCategoryLabel) ?? str(r.contentCategory),
      approvalComment: str(r.contentApprovalComment),
    }))
    .filter((a) => a.id && a.approvalStatus);
}

export async function getAlbum(id: string, role?: string | boolean): Promise<AlbumDetail> {
  const isPhotographer = role === true || role === 'Photographer';
  const isCoordinator = role === 'Coordinator';
  const path = isPhotographer
    ? `/photographer/albums/${encodeURIComponent(id)}`
    : isCoordinator
    ? `/coordinator/galleries/${encodeURIComponent(id)}`
    : `/customer/albums/${encodeURIComponent(id)}`;
  const res = await api.get<ApiEnvelope<Raw>>(path);
  const d = (res?.data ?? {}) as Raw;
  const rawImages = Array.isArray(d.images) ? (d.images as Raw[]) : [];
  const payment = (d.payment ?? {}) as Raw;
  return {
    ...mapGallery(d),
    photographer: str(d.photographer) ?? str(d.photographerName),
    photographerAvatar: normalizeImageUrl(str(d.photographerAvatar) ?? str(d.avatar)),
    amountDue: num(payment.amountDue) ?? num(d.amountDue),
    currency: str(payment.currency) ?? str(d.currency),
    eventId: str(d.eventId) ?? str(payment.eventId),
    currencyId: str(payment.currencyId) ?? str(d.currencyId),
    archiveFee: num(d.archiveFee),
    archiveCurrency: str(d.archiveCurrency),
    approvalStatus: str(d.contentApprovalStatus) as ContentApprovalStatus | undefined,
    approvalComment: str(d.contentApprovalComment),
    categoryLabel: str(d.contentCategoryLabel) ?? str(d.contentCategory) ?? str(d.category),
    images: rawImages
      .map((i) => {
        const rawThumb = str(i.thumbnailUrl) ?? str(i.thumbnail) ?? str(i.previewUrl);
        const rawOriginal = str(i.fileUrl) ?? str(i.url) ?? str(i.filePath) ?? str(i.path);
        const bestUrl = rawThumb || rawOriginal;
        return {
          id: String(i.id ?? ''),
          url: normalizeImageUrl(bestUrl) ?? '',
          fullUrl: normalizeImageUrl(rawOriginal || bestUrl) ?? '',
          caption: str(i.caption),
        };
      })
      .filter((i) => i.id && i.url),
  };
}

export async function unlockAlbum(id: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(`/customer/albums/${encodeURIComponent(id)}/unlock`);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not unlock this album.' } satisfies ApiError;
  }
}

// --- Photographer album management ---------------------------------------

export type AlbumCategory = { value: string; label: string };

/** Content-album categories (enum name + display label). */
export async function listAlbumCategories(): Promise<AlbumCategory[]> {
  const res = await api.get<ApiEnvelope<Raw>>('/photographer/albums/content/categories');
  const cats = (res?.data as Raw)?.categories;
  if (!Array.isArray(cats)) return [];
  return cats
    .map((c) => {
      if (typeof c === 'string') return { value: c, label: c };
      const r = c as Raw;
      const value = str(r.name) ?? str(r.value) ?? str(r.id);
      return value ? { value, label: str(r.label) ?? str(r.name) ?? value } : null;
    })
    .filter((c): c is AlbumCategory => !!c);
}

export type CreateAlbumInput = {
  title: string;
  description?: string;
  category: string; // enum name
  pricePerImage: number;
  currencyId: string;
  cover?: PickedImage | null;
  images: PickedImage[];
};

/** Creates a paid content album (web parity: POST /photographer/albums/content). */
export async function createContentAlbum(input: CreateAlbumInput): Promise<void> {
  const form = new FormData();
  form.append('title', input.title.trim());
  if (input.description) form.append('description', input.description);
  form.append('category', input.category);
  form.append('pricePerImage', String(input.pricePerImage));
  form.append('currencyId', input.currencyId);
  // Cross-platform file parts (real Blob on web, RN object on native).
  if (input.cover) await appendFile(form, 'coverImage', input.cover);
  for (const img of input.images) await appendFile(form, 'images', img);

  const res = await api.post<ApiEnvelope<Raw>>('/photographer/albums/content', form);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not create the album.' } satisfies ApiError;
  }
}

// ────── Normal album creation (Event / Personal PAID / Personal FREE) ────
//
// Web parity (salo-run photographer create-album modal):
//   Event album    → POST /photographer/albums          (+ eventId)
//   Personal PAID  → POST /photographer/albums/paid      (pricePerImage, currencyId)
//   Personal FREE  → POST /photographer/albums/free       (recipientEmail, …)
//                    then POST /photographer/albums/{id}/send-free
// In every case photos are uploaded afterwards via addAlbumImages().

export type AlbumCreateResult = { id: string; accessCode?: string; inviteCode?: string };

async function postAlbum(path: string, fields: Record<string, string | undefined>): Promise<AlbumCreateResult> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && v !== '') form.append(k, v);
  }
  const res = await api.post<ApiEnvelope<Raw>>(path, form);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not create the album.' } satisfies ApiError;
  }
  const d = (res?.data ?? {}) as Raw;
  const id = str(d.id) ?? str(d.albumId) ?? '';
  if (!id) throw { status: 400, message: 'Album created but no id was returned.' } satisfies ApiError;
  return { id, accessCode: str(d.accessCode), inviteCode: str(d.inviteCode) };
}

export async function createEventAlbum(input: {
  eventId: string;
  title: string;
  description?: string;
  category?: string;
  images?: PickedImage[];
}): Promise<AlbumCreateResult> {
  const res = await postAlbum('/photographer/albums', {
    title: input.title.trim(),
    description: input.description,
    category: input.category,
    eventId: input.eventId,
  });
  if (input.images && input.images.length > 0) {
    await addAlbumImages(res.id, input.images);
  }
  return res;
}

export async function createPaidAlbum(input: {
  title: string;
  description?: string;
  category?: string;
  location?: string;
  date?: string;
  pricePerImage: string;
  currencyId: string;
  images?: PickedImage[];
}): Promise<AlbumCreateResult> {
  const res = await postAlbum('/photographer/albums/paid', {
    title: input.title.trim(),
    description: input.description,
    category: input.category,
    location: input.location,
    date: input.date,
    pricePerImage: input.pricePerImage,
    currencyId: input.currencyId,
  });
  if (input.images && input.images.length > 0) {
    await addAlbumImages(res.id, input.images);
  }
  return res;
}

export async function createFreeAlbum(input: {
  title: string;
  description?: string;
  category?: string;
  location?: string;
  date?: string;
  recipientEmail: string;
  maxFreeDownloads?: string;
  pricePerExtraImage?: string;
  currencyId?: string;
  images?: PickedImage[];
}): Promise<AlbumCreateResult> {
  const fields: Record<string, string | undefined> = {
    title: input.title.trim(),
    description: input.description,
    category: input.category,
    location: input.location,
    date: input.date,
    recipientEmail: input.recipientEmail.trim(),
    maxFreeDownloads: input.maxFreeDownloads,
  };
  // Currency only matters when there's actually a per-extra price to charge.
  if (input.pricePerExtraImage) {
    fields.pricePerExtraImage = input.pricePerExtraImage;
    fields.currencyId = input.currencyId;
  }
  const res = await postAlbum('/photographer/albums/free', fields);
  // Email the invite + access code to the recipient (best-effort).
  try {
    await api.post(`/photographer/albums/${encodeURIComponent(res.id)}/send-free`, {});
  } catch {
    /* the album still exists; the photographer can resend from detail */
  }
  if (input.images && input.images.length > 0) {
    await addAlbumImages(res.id, input.images);
  }
  return res;
}

/** Adds more photos to an existing album. */
export async function addAlbumImages(albumId: string, images: PickedImage[]): Promise<void> {
  for (const img of images) {
    const form = new FormData();
    await appendFile(form, 'file', img);
    const res = await api.post<ApiEnvelope<Raw>>(
      `/photographer/albums/${encodeURIComponent(albumId)}/images`,
      form,
    );
    // Per-photo refusals (below the delivery minimum, unsupported file, album
    // full) come back as HTTP 200 with action:0. Ignoring them meant an album
    // was created, reported as a success, and contained nothing.
    if (res?.action !== 1) {
      throw {
        status: 400,
        message: res?.message || 'One of the photos could not be uploaded.',
      } satisfies ApiError;
    }
  }
}

/** Deletes an album the photographer owns. */
export async function deleteAlbum(id: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<Raw>>(`/photographer/albums/${encodeURIComponent(id)}`);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not delete the album.' } satisfies ApiError;
  }
}

// ────── Album lifecycle (Send / Publish / Submit) ───────────────────────
//
// Mirrors PhotographerAlbumController:
//   POST /photographer/albums/{id}/send            → email link to client
//   POST /photographer/albums/{id}/publish         → publish to Face-AI search
//   POST /photographer/albums/content/{id}/submit  → content album review

export async function sendAlbumToClient(albumId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/photographer/albums/${encodeURIComponent(albumId)}/send`,
    {},
  );
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not send the album to the client.',
    } satisfies ApiError;
  }
}

export async function publishAlbumToFaceSearch(albumId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/photographer/albums/${encodeURIComponent(albumId)}/publish`,
    {},
  );
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not publish the album.',
    } satisfies ApiError;
  }
}

export async function submitContentAlbum(albumId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/photographer/albums/content/${encodeURIComponent(albumId)}/submit`,
    {},
  );
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not submit the album for review.',
    } satisfies ApiError;
  }
}

// ────── Face-scan / AWS Rekognition index ───────────────────────────────
//
// When a photographer uploads photos to an album, the backend kicks off
// AWS Rekognition to index faces in each image. The resulting "face
// collection" is what powers the public face-search endpoint that
// clients use to find their own photos. This helper surfaces the
// indexing status so a photographer can verify their album is
// face-searchable.

export type AlbumFaceStatus = {
  albumId: string;
  eventId?: string;
  isPublished?: boolean;
  galleryImageCount: number;
  eventMediaCount?: number;
  /** Face collection metadata from Rekognition (faceCount, status). */
  collection?: {
    faceCount?: number;
    status?: string;
    error?: string;
    message?: string;
  };
  message?: string;
};

export async function getAlbumFaceStatus(albumId: string): Promise<AlbumFaceStatus> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/photographer/albums/${encodeURIComponent(albumId)}/face-status`,
  );
  const d = (res?.data ?? {}) as Raw;
  const col = (d.collection ?? {}) as Raw;
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);
  return {
    albumId,
    eventId: str(d.eventId),
    isPublished: d.isPublished === true,
    galleryImageCount: num(d.galleryImageCount) ?? 0,
    eventMediaCount: num(d.eventMediaCount),
    collection: col
      ? {
          faceCount: num(col.faceCount) ?? num(col.totalFaces),
          status: str(col.status),
          error: str(col.error),
          message: str(col.message),
        }
      : undefined,
    message: str(res?.message),
  };
}
