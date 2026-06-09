/**
 * Photographer's clients — GET /photographer/clients.
 * Field names mapped defensively (nested client objects vary).
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type ClientItem = {
  id: ID;
  name: string;
  email?: string;
  avatar?: string;
  bookings?: number;
  totalSpent?: number;
  currency?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

function mapClient(r: Raw): ClientItem {
  const name =
    [str(r.firstName), str(r.lastName)].filter(Boolean).join(' ') ||
    str(r.name) ||
    str(r.clientName) ||
    'Client';
  return {
    id: String(r.id ?? r.clientId ?? r.customerId ?? ''),
    name,
    email: str(r.email),
    avatar: str(r.profilePicture) ?? str(r.avatar),
    bookings: num(r.bookings) ?? num(r.bookingsCount) ?? num(r.eventsCount),
    totalSpent: num(r.totalSpent) ?? num(r.totalSpentUsd),
    currency: str(r.currency) ?? str(r.currencyCode),
  };
}

export async function listClients(): Promise<ClientItem[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/photographer/clients');
  const d = res?.data;
  const arr = Array.isArray(d)
    ? (d as Raw[])
    : Array.isArray((d as { content?: unknown })?.content)
      ? ((d as { content: Raw[] }).content)
      : [];
  return arr.map(mapClient).filter((c) => c.id);
}
