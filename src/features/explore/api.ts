/**
 * Explore: photos and short video clips. Public reads (feed, facets, item, unlock) go to /api/public, saves and
 * purchases to /api/remote. Everything returned for browsing is a watermarked preview; the originals and full clips
 * only come through the signed links of an unlocked purchase.
 */
import { api } from '@/api/client';
import { env } from '@/config/env';
import type { ApiEnvelope } from '@/types';

export type MediaType = 'PHOTO' | 'VIDEO';

export type ExploreItem = {
  id: string;
  albumId: string;
  mediaType: MediaType;
  title: string;
  categoryLabel: string | null;
  creatorName: string;
  creatorLogo: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  /** Public 15 second watermarked preview of a clip (HLS). Never the full clip. */
  previewVideoUrl: string | null;
  durationSeconds: number | null;
  aspectRatio: number;
  priceAmount: number | null;
  priceCurrency: string;
  tags: string[];
};

export type Facets = {
  categories: { name: string; label: string; count: number }[];
  tags: string[];
  clips: number;
  total: number;
};

export type FeedQuery = {
  q?: string;
  category?: string;
  type?: '' | MediaType;
  sort?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
  currency?: string;
  tag?: string;
  cursor?: string | null;
  size?: number;
};

export type UnlockedItem = {
  id: string;
  mediaType: MediaType;
  title: string;
  thumbnailUrl: string | null;
  /** The original photo, for its owner. */
  viewUrl: string | null;
  /** The full clip, as a signed download. */
  downloadUrl: string | null;
};
export type Unlocked = { refid: string; items: UnlockedItem[]; zipUrl: string };

type Raw = Record<string, any>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const publicBase = () => env.apiBaseUrl.replace(/\/api\/remote$/, '');

export function mapItem(r: Raw): ExploreItem {
  const w = Number(r.width) || 0;
  const h = Number(r.height) || 0;
  const ratio = Number(r.aspectRatio) || (w && h ? w / h : 4 / 3);
  return {
    id: String(r.id),
    albumId: String(r.albumId ?? ''),
    mediaType: r.mediaType === 'VIDEO' ? 'VIDEO' : 'PHOTO',
    title: String(r.title ?? ''),
    categoryLabel: str(r.categoryLabel),
    creatorName: String(r.creator?.name ?? ''),
    creatorLogo: str(r.creator?.logo),
    thumbnailUrl: str(r.thumbnailUrl),
    previewUrl: str(r.previewUrl),
    previewVideoUrl: str(r.previewVideoUrl),
    durationSeconds: typeof r.durationSeconds === 'number' ? r.durationSeconds : null,
    // Keep a sane range so one very tall or wide picture cannot break the columns.
    aspectRatio: Math.min(2.2, Math.max(0.5, ratio)),
    priceAmount: typeof r.price?.amount === 'number' ? r.price.amount : null,
    priceCurrency: String(r.price?.currency ?? 'USD'),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  };
}

export async function fetchFeed(q: FeedQuery): Promise<{ items: ExploreItem[]; nextCursor: string | null }> {
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  if (q.category) p.set('category', q.category);
  if (q.type) p.set('type', q.type);
  if (q.tag) p.set('tag', q.tag);
  p.set('sort', q.sort ?? 'newest');
  p.set('currency', q.currency ?? 'USD');
  p.set('size', String(q.size ?? 24));
  if (q.cursor) p.set('cursor', q.cursor);
  const res = await api.get<ApiEnvelope<{ items: Raw[]; nextCursor: string | null }>>(`${publicBase()}/api/public/explore/feed?${p}`);
  return { items: (res?.data?.items ?? []).map(mapItem), nextCursor: res?.data?.nextCursor ?? null };
}

export async function fetchFacets(currency = 'USD'): Promise<Facets> {
  const res = await api.get<ApiEnvelope<Raw>>(`${publicBase()}/api/public/explore/facets?currency=${currency}`);
  const d = res?.data ?? {};
  return {
    categories: (d.categories ?? []).map((c: Raw) => ({ name: String(c.name), label: String(c.label), count: Number(c.count) })),
    tags: (d.tags ?? []).map((t: Raw) => String(t.name)),
    clips: Number(d.clips ?? 0),
    total: Number(d.total ?? 0),
  };
}

export async function fetchItem(id: string, currency = 'USD'): Promise<ExploreItem | null> {
  try {
    const res = await api.get<ApiEnvelope<Raw>>(`${publicBase()}/api/public/explore/items/${id}?currency=${currency}`);
    return res?.data ? mapItem(res.data) : null;
  } catch {
    return null;
  }
}

export async function unlockByCode(code: string): Promise<Unlocked> {
  const res = await api.post<ApiEnvelope<Raw>>(`${publicBase()}/api/public/content/unlock`, { code });
  const d = res?.data ?? {};
  return {
    refid: String(d.refid ?? ''),
    zipUrl: String(d.zipUrl ?? ''),
    items: (d.items ?? []).map((i: Raw) => ({
      id: String(i.id),
      mediaType: i.mediaType === 'VIDEO' ? 'VIDEO' : 'PHOTO',
      title: String(i.title ?? ''),
      thumbnailUrl: str(i.thumbnailUrl),
      viewUrl: str(i.viewUrl),
      downloadUrl: str(i.downloadUrl),
    })),
  };
}

export async function recoverByEmail(email: string): Promise<void> {
  await api.post(`${publicBase()}/api/public/content/recover`, { email });
}

// ── signed-in saves ─────────────────────────────────────────────────────

export async function fetchSavedIds(): Promise<string[]> {
  const res = await api.get<ApiEnvelope<{ ids: string[] }>>('/explore/saves');
  return (res?.data?.ids ?? []).map(String);
}
export async function fetchSavedItems(currency = 'USD'): Promise<ExploreItem[]> {
  const res = await api.get<ApiEnvelope<{ items: Raw[] }>>(`/explore/saves?currency=${currency}`);
  return (res?.data?.items ?? []).map(mapItem);
}
export const putSave = (id: string) => api.put(`/explore/saves/${id}`);
export const deleteSave = (id: string) => api.delete(`/explore/saves/${id}`);

export type PurchaseRow = { refid: string; paidAt: string | null; title: string; unlockCode: string | null };
export async function fetchPurchases(): Promise<PurchaseRow[]> {
  const res = await api.get<ApiEnvelope<{ purchases: Raw[] }>>('/explore/purchases');
  return (res?.data?.purchases ?? []).map((p: Raw) => ({
    refid: String(p.refid), paidAt: str(p.paidAt), title: String(p.title ?? ''), unlockCode: str(p.unlockCode),
  }));
}

// ── cart (web builds only: the caller checks digitalPurchasesEnabled) ───────

export type QuoteGroup = { albumId: string; photoIds: string[]; amount: number; currencyId: string };
export type Quote = { total: number; currency: string; groups: QuoteGroup[]; unavailable: string[] };
export async function fetchQuote(items: string[], currency: string): Promise<Quote> {
  const res = await api.post<ApiEnvelope<Raw>>(`${publicBase()}/api/public/explore/cart/quote`, { items, currency });
  const d = res?.data ?? {};
  return {
    total: Number(d.total ?? 0), currency: String(d.currency ?? currency),
    groups: (d.groups ?? []).map((g: Raw) => ({ albumId: String(g.albumId), photoIds: (g.photoIds ?? []).map(String), amount: Number(g.amount), currencyId: String(g.currencyId) })),
    unavailable: (d.unavailable ?? []).map(String),
  };
}
