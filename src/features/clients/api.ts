/**
 * Photographer's clients — GET /photographer/clients.
 * Field names mapped defensively (nested client objects vary).
 */
import { api, requireOk } from '@/api/client';
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

export async function listClients(isCoordinator = false): Promise<ClientItem[]> {
  const endpoint = isCoordinator ? '/coordinator/clients' : '/photographer/clients';
  // A refused or failed read is not "no clients". It is rethrown unless a fallback below finds clients.
  let failure: unknown;
  try {
    const res = requireOk(await api.get<ApiEnvelope<unknown>>(endpoint));
    const d = res?.data;
    const arr = Array.isArray(d)
      ? (d as Raw[])
      : Array.isArray((d as { content?: unknown })?.content)
        ? ((d as { content: Raw[] }).content)
        : [];
    if (arr.length > 0 || !isCoordinator) {
      return arr.map(mapClient).filter((c) => c.id);
    }
  } catch (e) {
    // If not supported yet, a coordinator falls through to legacy derivation; anyone else sees the failure.
    if (!isCoordinator) throw e;
    failure = e;
  }

  if (isCoordinator) {
    try {
      const res = requireOk(await api.get<ApiEnvelope<unknown>>('/coordinator/bookings'));
      const d = res?.data;
      const arr = Array.isArray(d)
        ? (d as Raw[])
        : Array.isArray((d as { content?: unknown })?.content)
          ? ((d as { content: Raw[] }).content)
          : [];
      if (arr.length > 0) {
        return arr.map(mapClient).filter((c) => c.id);
      }
    } catch {
      // Fall through to events derivation
    }
    try {
      const res = requireOk(await api.get<ApiEnvelope<unknown>>('/coordinator/events?page=0&size=100'));
      const d = res?.data;
      const arr = Array.isArray(d)
        ? (d as Raw[])
        : Array.isArray((d as { content?: unknown })?.content)
          ? ((d as { content: Raw[] }).content)
          : [];
      const clientMap = new Map<string, ClientItem>();
      for (const r of arr) {
        const name = str(r.clientName) ?? str(r.customerName) ?? str(r.organizer);
        const id = String(r.customerId ?? r.clientId ?? name ?? '');
        if (name && id) {
          if (!clientMap.has(id)) {
            clientMap.set(id, {
              id,
              name,
              avatar: str(r.clientAvatar) ?? str(r.customerAvatar),
              bookings: 1,
            });
          } else {
            const c = clientMap.get(id)!;
            c.bookings = (c.bookings ?? 0) + 1;
          }
        }
      }
      // This read worked, so an empty answer is a real one.
      return Array.from(clientMap.values());
    } catch (e) {
      failure ??= e;
    }
  }

  if (failure) throw failure;
  return [];
}

/** IDs of the photographer's favorite clients. */
export async function listFavoriteClientIds(): Promise<string[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/photographer/favorite-clients');
  const d = res?.data;
  const arr = Array.isArray(d)
    ? (d as Raw[])
    : Array.isArray((d as { content?: unknown })?.content)
      ? ((d as { content: Raw[] }).content)
      : [];
  return arr.map((r) => String(r.id ?? r.clientId ?? r.customerId ?? r ?? '')).filter(Boolean);
}

/** Toggles favorite for a client; returns the new favorite state. */
export async function toggleFavoriteClient(id: string): Promise<boolean | undefined> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/photographer/favorite-clients/${encodeURIComponent(id)}`,
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  return typeof d.isFavorite === 'boolean' ? d.isFavorite : undefined;
}

export type ClientDetail = ClientItem & {
  phone?: string;
  location?: string;
  events: { id: string; title: string; date?: string; status?: string }[];
};

export async function getClient(id: string, isCoordinator = false): Promise<ClientDetail> {
  const endpoint = isCoordinator
    ? `/coordinator/clients/${encodeURIComponent(id)}`
    : `/photographer/clients/${encodeURIComponent(id)}`;

  try {
    const res = requireOk(await api.get<ApiEnvelope<Raw>>(endpoint));
    const d = (res?.data ?? {}) as Raw;
    const rawEvents = Array.isArray(d.events) ? (d.events as Raw[]) : [];
    return {
      ...mapClient(d),
      phone: str(d.phone),
      location: str(d.location) ?? str(d.city),
      events: rawEvents
        .map((e) => ({
          id: String(e.id ?? ''),
          title: str(e.title) ?? str(e.name) ?? 'Event',
          date: str(e.eventDate) ?? str(e.date),
          status: str(e.status),
        }))
        .filter((e) => e.id),
    };
  } catch (err) {
    if (!isCoordinator) throw err;
    // Fallback below if coordinator endpoint fails on legacy instance
    try {
      const res = requireOk(await api.get<ApiEnvelope<unknown>>(`/coordinator/events?page=0&size=100`));
      const d = res?.data;
      const arr = Array.isArray(d)
        ? (d as Raw[])
        : Array.isArray((d as { content?: unknown })?.content)
          ? ((d as { content: Raw[] }).content)
          : [];
      const matched = arr.filter((e) => {
        const cid = String(e.customerId ?? e.clientId ?? e.clientName ?? e.organizer ?? '');
        return cid === id || str(e.clientName) === id;
      });
      const first = matched[0] || {};
      const name = str(first.clientName) ?? str(first.customerName) ?? str(first.organizer) ?? id;
      return {
        id,
        name,
        avatar: str(first.clientAvatar) ?? str(first.customerAvatar),
        bookings: matched.length,
        events: matched
          .map((e) => ({
            id: String(e.id ?? ''),
            title: str(e.title) ?? str(e.name) ?? 'Event',
            date: str(e.eventDate) ?? str(e.date),
            status: str(e.status),
          }))
          .filter((e) => e.id),
      };
    } catch {
      throw err;
    }
  }
}
