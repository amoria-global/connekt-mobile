/**
 * Photographer discovery (/api/remote/customer/photographers).
 * Mapped defensively; text search is applied client-side over the result set.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Photographer = {
  id: ID;
  name: string;
  avatar?: string;
  rating?: number;
  reviewCount?: number;
  location?: string;
  category?: string;
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
  return {
    id: String(r.id ?? r.slug ?? r.photographerId ?? ''),
    name: str(r.name) ?? (fullName || 'Photographer'),
    avatar: str(r.profilePicture) ?? str(r.avatar),
    rating: num(r.rating) ?? num(r.avgRating),
    reviewCount: num(r.reviewCount) ?? num(r.reviewsCount),
    location: str(r.location) ?? str(r.city),
    category: str(r.category),
  };
}

function mapPackage(r: Raw): PhotographerPackage {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? 'Package',
    price: num(r.price),
    currency: str(r.currency) ?? str(r.currencyCode),
  };
}

export async function listPhotographers(): Promise<Photographer[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/customer/photographers');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapPhotographer).filter((p) => p.id);
}

export async function getPhotographer(id: string): Promise<PhotographerDetail> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/customer/photographers/${encodeURIComponent(id)}`,
  );
  const d = (res?.data ?? {}) as Raw;
  const base = mapPhotographer(d);
  const rawPackages = Array.isArray(d.packages) ? (d.packages as Raw[]) : [];
  return {
    ...base,
    bio: str(d.bio),
    packages: rawPackages.map(mapPackage).filter((p) => p.id),
  };
}
