/**
 * Photographer packages (/api/remote/photographer/packages).
 */
import { api } from '@/api/client';
import type { ApiError, ApiEnvelope, ID } from '@/types';

export type Package = {
  id: ID;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  duration?: string;
};

export type CreatePackageInput = {
  name: string;
  description?: string;
  price: number;
  duration?: string;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function mapPackage(r: Raw): Package {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? 'Package',
    description: str(r.description),
    price: num(r.price),
    currency: str(r.currency) ?? str(r.currencyCode),
    duration: str(r.duration),
  };
}

export async function listPackages(): Promise<Package[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/photographer/packages');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapPackage).filter((p) => p.id);
}

export async function createPackage(input: CreatePackageInput): Promise<Package> {
  const res = await api.post<ApiEnvelope<Raw>>('/photographer/packages', input);
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not create the package.',
    } satisfies ApiError;
  }
  return mapPackage((res?.data ?? {}) as Raw);
}

export async function deletePackage(id: string): Promise<void> {
  await api.delete(`/photographer/packages/${encodeURIComponent(id)}`);
}
