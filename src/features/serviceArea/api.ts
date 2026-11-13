/**
 * Service area: the area or neighbourhood a photographer works in, shown to clients as an approximate position on the map.
 *
 * The app only ever sends the id of the place the photographer chose. The server looks the area up itself and stores its centre,
 * so no coordinates are sent when saving (and any that were sent would be ignored). Search results, the confirm step and the
 * saved area all come from our own backend, which holds the Google key.
 */
import { api, requireOk } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type AreaSuggestion = {
  placeId: string;
  /** "Gishushu" */
  name: string;
  /** "Kigali, Rwanda" */
  secondary: string;
};

/** One area, as the confirm step shows it. The centre is only for drawing the preview. */
export type AreaDetails = {
  placeId: string;
  name: string;
  /** "Remera · Gasabo, Kigali" */
  context: string;
  country: string | null;
  /** False for a street or a business: the picker only takes areas and neighbourhoods. */
  isArea: boolean;
  /** False for a country Connekyt does not support yet. */
  supported: boolean;
  latitude: number | null;
  longitude: number | null;
};

/** The photographer's own saved area. `set` false means they are not on the map. */
export type ServiceArea = {
  set: boolean;
  name: string | null;
  context: string | null;
  country: string | null;
  setAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

type RawPrediction = { placeId?: unknown; mainText?: unknown; secondaryText?: unknown; description?: unknown };
type RawArea = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Areas and neighbourhoods matching what is being typed, in the countries Connekyt supports. Throws when search is unavailable. */
export async function searchAreas(query: string, signal?: AbortSignal): Promise<AreaSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await api.get<ApiEnvelope<{ predictions?: RawPrediction[] }>>(
    `/public/places/areas?input=${encodeURIComponent(q)}`,
    { skipAuth: true },
  );
  if (signal?.aborted) return [];
  const raw = Array.isArray(res?.data?.predictions) ? res.data.predictions : [];
  const seen = new Set<string>();
  const out: AreaSuggestion[] = [];
  for (const p of raw) {
    const placeId = str(p?.placeId);
    const description = str(p?.description);
    const name = str(p?.mainText) || description.split(',')[0].trim();
    if (!placeId || !name || seen.has(placeId)) continue;
    seen.add(placeId);
    const secondary = str(p?.secondaryText) || description.split(',').slice(1).join(',').trim();
    out.push({ placeId, name, secondary });
  }
  return out;
}

/** The chosen area, with its centre for the preview. Nothing is saved yet. */
export async function getAreaDetails(placeId: string): Promise<AreaDetails> {
  const res = requireOk(
    await api.get<ApiEnvelope<RawArea>>(`/public/places/area?placeId=${encodeURIComponent(placeId)}`, { skipAuth: true }),
  );
  const d = (res.data ?? {}) as RawArea;
  return {
    placeId: str(d.placeId) || placeId,
    name: str(d.name),
    context: str(d.context),
    country: str(d.country) || null,
    isArea: d.isArea === true,
    supported: d.supported === true,
    latitude: num(d.latitude),
    longitude: num(d.longitude),
  };
}

function toArea(d: RawArea | undefined): ServiceArea {
  const x = d ?? {};
  return {
    set: x.set === true,
    name: str(x.name) || null,
    context: str(x.context) || null,
    country: str(x.country) || null,
    setAt: str(x.setAt) || null,
    latitude: num(x.latitude),
    longitude: num(x.longitude),
  };
}

export async function getServiceArea(): Promise<ServiceArea> {
  const res = requireOk(await api.get<ApiEnvelope<RawArea>>('/photographer/service-area'));
  return toArea(res.data as RawArea | undefined);
}

/** Saves the area. Only the place id is sent: the server looks the centre up itself. */
export async function saveServiceArea(placeId: string): Promise<ServiceArea> {
  const res = requireOk(await api.put<ApiEnvelope<RawArea>>('/photographer/service-area', { placeId }));
  return toArea(res.data as RawArea | undefined);
}

/** Takes the photographer off the map straight away. */
export async function removeServiceArea(): Promise<ServiceArea> {
  const res = requireOk(await api.delete<ApiEnvelope<RawArea>>('/photographer/service-area'));
  return toArea(res.data as RawArea | undefined);
}
