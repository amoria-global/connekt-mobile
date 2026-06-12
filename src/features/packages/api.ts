/**
 * Photographer packages (/api/remote/photographer/packages).
 */
import { api } from '@/api/client';
import type { ApiError, ApiEnvelope, ID } from '@/types';

export type ServiceType = 'OUTDOOR' | 'STUDIO';

export type Package = {
  id: ID;
  name: string; // packageName / tier
  description?: string;
  price?: number;
  currency?: string; // code, for display
  currencyId?: string; // UUID, for edit
  priceUnit?: string;
  durationHours?: number;
  includedPhotos?: number;
  includedVideos?: number;
  hasLiveStream?: boolean;
  deliveryDays?: number;
  serviceType?: ServiceType;
};

export type CreatePackageInput = {
  packageName: string;
  price: number;
  currencyId: string;
  priceUnit?: string;
  durationHours?: number;
  description?: string;
  hasLiveStream?: boolean;
  includedPhotos?: number;
  includedVideos?: number;
  deliveryDays?: number;
  serviceType?: ServiceType;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function mapPackage(r: Raw): Package {
  const currency = (r.currency ?? {}) as Raw;
  return {
    id: String(r.id ?? ''),
    name: str(r.packageName) ?? str(r.name) ?? 'Package',
    description: str(r.description),
    price: num(r.price),
    currency: str(r.currencyAbbreviation) ?? str(r.currencyCode) ?? str(currency.abbreviation) ?? str(r.currency as string),
    currencyId: str(r.currencyId) ?? str(currency.id),
    priceUnit: str(r.priceUnit),
    durationHours: num(r.durationHours),
    includedPhotos: num(r.includedPhotos),
    includedVideos: num(r.includedVideos),
    hasLiveStream: r.hasLiveStream === true,
    deliveryDays: num(r.deliveryDays),
    serviceType: str(r.serviceType) === 'STUDIO' ? 'STUDIO' : 'OUTDOOR',
  };
}

/** Full web-parity payload for create + update. */
function buildPackagePayload(input: CreatePackageInput): Record<string, unknown> {
  return {
    packageName: input.packageName,
    price: input.price,
    currencyId: input.currencyId,
    priceUnit: input.priceUnit || 'per event',
    durationHours: input.durationHours ?? 0,
    description: input.description ?? '',
    isActive: true,
    hasLiveStream: input.hasLiveStream ?? false,
    includedPhotos: input.includedPhotos ?? 0,
    includedVideos: input.includedVideos ?? 0,
    extraPhotoPrice: 0,
    extraVideoPrice: 0,
    photobookPhotos: null,
    deliveryDays: input.deliveryDays ?? 0,
    serviceType: input.serviceType === 'STUDIO' ? 'STUDIO' : 'OUTDOOR',
    features: [],
  };
}

export async function listPackages(): Promise<Package[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/photographer/packages');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapPackage).filter((p) => p.id);
}

export async function createPackage(input: CreatePackageInput): Promise<Package> {
  const res = await api.post<ApiEnvelope<Raw>>('/photographer/packages', buildPackagePayload(input));
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not create the package.',
    } satisfies ApiError;
  }
  return mapPackage((res?.data ?? {}) as Raw);
}

export async function updatePackage(id: string, input: CreatePackageInput): Promise<Package> {
  const res = await api.put<ApiEnvelope<Raw>>(
    `/photographer/packages/${encodeURIComponent(id)}`,
    buildPackagePayload(input),
  );
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not save your changes.' } satisfies ApiError;
  }
  return mapPackage((res?.data ?? {}) as Raw);
}

export async function deletePackage(id: string): Promise<void> {
  await api.delete(`/photographer/packages/${encodeURIComponent(id)}`);
}
