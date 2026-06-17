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
  coverImage?: string;
  rating?: number;
  reviewCount?: number;
  location?: string;
  category?: string;
  startingPrice?: number;
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

  return {
    id: String(r.id ?? r.slug ?? r.photographerId ?? ''),
    name: str(r.name) ?? (fullName || 'Photographer'),
    avatar: str(r.profilePicture) ?? str(r.avatar),
    coverImage: str(r.coverPicture) ?? str(r.coverImage),
    rating: num(r.rating) ?? num(r.avgRating),
    reviewCount: num(r.reviewCount) ?? num(r.reviewsCount) ?? (Array.isArray(r.reviews) ? r.reviews.length : 0),
    location: str(r.location) ?? str(r.address) ?? str(r.city),
    category,
    startingPrice,
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

export async function listPhotographers(): Promise<Photographer[]> {
  const res = await api.get<ApiEnvelope<any>>('/public/photographers/list?size=50');
  const data = Array.isArray(res?.data?.content) ? res.data.content : (Array.isArray(res?.data) ? res.data : []);
  return data.map(mapPhotographer).filter((p: Photographer) => p.id);
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
