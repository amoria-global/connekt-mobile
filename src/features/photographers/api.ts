/**
 * Photographer discovery (/api/remote/customer/photographers).
 * Mapped defensively; text search is applied client-side over the result set.
 */
import { api, requireOk } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Photographer = {
  id: ID;
  name: string;
  avatar?: string;
  coverImage?: string;
  images?: string[];
  rating?: number;
  reviewCount?: number;
  completedJobs?: number;
  location?: string;
  category?: string;
  specialties?: string[];
  startingPrice?: number;
  /** Currency of the package the starting price comes from, when the API states it. */
  startingPriceCurrency?: string;
  currentStatus?: string;
  isVerified?: boolean;
};

export type PhotographerPackage = {
  id: ID;
  name: string;
  price?: number;
  currency?: string;
};

export type PhotographerDetail = Photographer & {
  bio?: string;
  packages: PhotographerPackage[];
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function mapPhotographer(r: Raw): Photographer {
  const fullName = [str(r.firstName), str(r.lastName)].filter(Boolean).join(' ');
  const specialties = Array.isArray(r.specialties) ? r.specialties : [];
  const firstSpecialty = specialties[0] as any;
  const category = str(firstSpecialty?.name) ?? str(r.customerType);

  const packages = Array.isArray(r.packages) ? r.packages : [];
  const prices = packages.map(p => num(p.price)).filter((p): p is number => p !== undefined);
  const startingPrice = prices.length > 0 ? Math.min(...prices) : undefined;
  // The currency belongs to the package the starting price comes from, never to a different, dearer one.
  const cheapest = startingPrice === undefined ? undefined : packages.find((p) => num(p.price) === startingPrice);
  const startingPriceCurrency = cheapest ? (str(cheapest.currency) ?? str(cheapest.currencyCode) ?? str(cheapest.currencyAbbreviation)) : undefined;

  const projects = Array.isArray(r.projects) ? r.projects : [];
  const projectImages = projects
    .map((p: any) =>
      typeof p === 'string'
        ? p
        : str(p?.projectImage) ??
          str(p?.imageUrl) ??
          str(p?.images?.[0]) ??
          str(p?.url) ??
          str(p?.image),
    )
    .filter(Boolean) as string[];

  const portfolio = Array.isArray(r.portfolio)
    ? (r.portfolio.map((p: any) => (typeof p === 'string' ? p : str(p?.url) ?? str(p?.imageUrl))).filter(Boolean) as string[])
    : [];

  const coverImage = str(r.coverPicture) ?? str(r.coverImage);
  const avatar = str(r.profilePicture) ?? str(r.avatar);

  // Match web parity (knockout photographers.tsx:1675):
  // Cover photo first, then portfolio project images, then profile picture.
  const rawImages = [
    coverImage,
    ...projectImages,
    ...portfolio,
    avatar,
  ].filter(
    (u): u is string => typeof u === 'string' && !!u && !u.includes('/null') && u.trim().length > 0,
  );
  const images = Array.from(new Set(rawImages));

  const specialtiesList = specialties
    .map((s: any) => (typeof s === 'string' ? s : str(s?.name)))
    .filter(Boolean) as string[];

  const completedJobs = num(r.completedEvents) ?? num(r.completedJobs) ?? 0;
  const isVerified = r.isVerified !== false;
  const currentStatus = str(r.currentStatus) ?? 'available';

  return {
    id: String(r.id ?? r.slug ?? r.photographerId ?? ''),
    name: str(r.name) ?? (fullName || 'Photographer'),
    avatar,
    coverImage,
    images: images.length > 0 ? images : (coverImage ? [coverImage] : []),
    rating: num(r.rating) ?? num(r.avgRating),
    reviewCount: num(r.reviewCount) ?? num(r.reviewsCount) ?? (Array.isArray(r.reviews) ? r.reviews.length : 0),
    completedJobs,
    location: str(r.location) ?? str(r.address) ?? str(r.city),
    category,
    specialties: specialtiesList,
    startingPrice,
    startingPriceCurrency,
    currentStatus,
    isVerified,
  };
}

function mapPackage(r: Raw): PhotographerPackage {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? str(r.packageName) ?? 'Package',
    price: num(r.price),
    currency: str(r.currency) ?? str(r.currencyCode) ?? str(r.currencyAbbreviation),
  };
}

/** The photographer specialties the platform defines (`GET /public/specialties`), as plain names. */
export async function listSpecialties(): Promise<string[]> {
  const res = requireOk(await api.get<ApiEnvelope<unknown>>('/public/specialties', { skipAuth: true }));
  const data = (res as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data) {
    const name = typeof row === 'string' ? row : typeof (row as { name?: unknown })?.name === 'string' ? (row as { name: string }).name : '';
    const clean = name.trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      out.push(clean);
    }
  }
  return out;
}

export async function listPhotographers(): Promise<Photographer[]> {
  // Walk every page — fetching only the first 50 hid the rest of the
  // directory (the screen paginates over whatever this returns).
  const size = 100;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    // A refused page answers HTTP 200 with action:0; read as an empty page it said "no photographers".
    const res = requireOk(
      await api.get<ApiEnvelope<any>>(`/public/photographers/list?page=${page}&size=${size}`),
    );
    const rows = Array.isArray(res?.data?.content)
      ? res.data.content
      : Array.isArray(res?.data)
        ? res.data
        : [];
    all.push(...rows);
    const totalPages = res?.data?.totalPages;
    if (typeof totalPages === 'number') {
      if (page + 1 >= totalPages) break;
    } else if (rows.length < size) {
      break;
    }
  }
  return all.map(mapPhotographer).filter((p: Photographer) => p.id);
}

export async function getPhotographer(id: string): Promise<PhotographerDetail> {
  const [res, packagesRes] = await Promise.all([
    api.get<ApiEnvelope<Raw>>(`/public/photographers/${encodeURIComponent(id)}`),
    api.get<ApiEnvelope<Raw[]>>(`/public/photographers/${encodeURIComponent(id)}/packages`).catch(() => ({ data: [] }))
  ]);

  const d = (res?.data ?? {}) as Raw;
  const base = mapPhotographer(d);
  const rawPackages = Array.isArray(packagesRes?.data) ? packagesRes.data : [];

  return {
    ...base,
    bio: str(d.bio) ?? str(d.about),
    packages: rawPackages.map(mapPackage).filter((p) => p.id),
  };
}

// ────── Bookmark (favorite) ──────────────────────────────────────────────
//
// Web parity: BookmarkedPhotographerController. The list endpoint returns
// the customer's bookmarked photographers; bookmark / unbookmark toggle
// the relationship.

export type BookmarkedRef = { id: string; bookmarkedAt?: string };

export async function listBookmarkedPhotographers(): Promise<BookmarkedRef[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/customer/photographers/bookmarks');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data
    .map((r) => ({
      id: String((r as any).photographerId ?? (r as any).id ?? ''),
      bookmarkedAt: str((r as any).bookmarkedAt) ?? str((r as any).createdAt),
    }))
    .filter((r) => r.id);
}

export async function bookmarkPhotographer(photographerId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/customer/photographers/bookmark/${encodeURIComponent(photographerId)}`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not bookmark photographer.' };
  }
}

export async function unbookmarkPhotographer(photographerId: string): Promise<void> {
  // The web removes via DELETE on /bookmark/{id}; the mobile API client
  // uses DELETE method too.
  const res = await api.delete<ApiEnvelope<Raw>>(
    `/customer/photographers/bookmark/${encodeURIComponent(photographerId)}`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not remove bookmark.' };
  }
}

/**
 * Report a photographer. Backend accepts `{ reason, description }`;
 * "reason" is a short pick from a fixed list, "description" is free text.
 */
export async function reportPhotographer(
  photographerId: string,
  reason: string,
  description?: string,
): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/customer/photographers/${encodeURIComponent(photographerId)}/report`,
    { reason, description: description?.trim() || '' },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not submit report.' };
  }
}

// ────── Rebook (customer side) ──────────────────────────────────────────
//
// Web parity: CustomerRebookController.@PostMapping("/rebook"). The
// caller must have previously worked with this photographer (the
// backend enforces it), so the UI surfaces Rebook only on the
// photographer detail when the relationship exists.

export type RebookInput = {
  photographerId: string;
  packageId: string;
  title: string;
  description?: string;
  eventDate: string;     // YYYY-MM-DD
  startTime: string;     // HH:mm:ss
  endTime: string;       // HH:mm:ss
  location: string;
  eventOrganizer?: string;
  eventType?: string;
  notes?: string;
};

export async function rebookPhotographer(
  input: RebookInput,
  asCoordinator = false,
): Promise<void> {
  const base = asCoordinator ? '/coordinator/rebook' : '/customer/rebook';
  const res = await api.post<ApiEnvelope<Raw>>(base, {
    photographerId: input.photographerId,
    packageId: input.packageId,
    title: input.title.trim(),
    description: input.description ?? '',
    eventDate: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    eventOrganizer: input.eventOrganizer ?? 'Organizer',
    eventType: input.eventType ?? 'Event',
    notes: input.notes ?? '',
  });
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not rebook photographer.' };
  }
}

// ────── Coordinator: invite a photographer by email ─────────────────────
//
// Web parity: CoordinatorController.invitePhotographer →
// POST /coordinator/photographers/invite?email=...&message=...&eventId=...
// The backend persists the invite and triggers a Brevo email.

export async function inviteCoordinatorPhotographer(
  email: string,
  message?: string,
  eventId?: string,
): Promise<void> {
  const qs = new URLSearchParams({ email: email.trim() });
  if (message?.trim()) qs.set('message', message.trim());
  if (eventId) qs.set('eventId', eventId);
  const res = await api.post<ApiEnvelope<Raw>>(
    `/coordinator/photographers/invite?${qs.toString()}`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send invite.' };
  }
}

// ────── Booked dates (for availability calendar) ─────────────────────────

export type BookedDate = {
  date: string; // "YYYY-MM-DD"
  isFullDay?: boolean;
  reason?: string;
  bookingId?: string;
  eventDate?: string;
  startTime?: { hour: number; minute: number } | null;
  endTime?: { hour: number; minute: number } | null;
  /** Partly booked days only (isFullDay false): bookings so far and the daily cap. */
  bookedCount?: number;
  capacity?: number;
};

/**
 * Red (full) days for this photographer, and with `includePartial` also days
 * that have bookings but can take more (`isFullDay: false`). A backend that
 * doesn't know the parameter just returns the full days.
 */
export async function getBookedDates(
  photographerId: string,
  from: string,
  to: string,
  opts: { includePartial?: boolean } = {},
): Promise<BookedDate[]> {
  try {
    const res = await api.get<ApiEnvelope<any>>(
      `/public/photographers/${encodeURIComponent(photographerId)}/booked-dates?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${opts.includePartial ? '&includePartial=true' : ''}`,
    );
    const data = res?.data;
    if (Array.isArray(data)) return data as BookedDate[];
    if (data && Array.isArray((data as any).data)) return (data as any).data as BookedDate[];
    return [];
  } catch {
    return [];
  }
}

