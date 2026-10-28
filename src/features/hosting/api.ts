/**
 * Photographer-hosted events: a photographer creates an event and streams it themselves.
 *
 * Backend (PhotographerHostedEventController @ /api/remote/photographer/hosted-events), all behind a
 * server flag. The server decides who may host; the app only reads it:
 *   GET  /eligibility        → { enabled, canHostFree, canHostPaid, reason }
 *   POST /                   → the created event (creator and streamer are the host)
 *   GET  /?bucket=           → the host's own events (upcoming | live | ended)
 *   GET  /earnings-preview   → what the host keeps of a ticket, computed by the server
 * Publishing, the cover photo and going live reuse the existing event and stream endpoints.
 */
import { api, requireOk } from '@/api/client';
import { mapEvent, type RawEvent } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import type { ApiEnvelope } from '@/types';

type Raw = Record<string, unknown>;

export type HostingReason = 'HOSTING_DISABLED' | 'NOT_A_PHOTOGRAPHER' | 'KYC_REQUIRED_FOR_PAID';

export type HostingEligibility = {
  enabled: boolean;
  canHostFree: boolean;
  canHostPaid: boolean;
  reason: HostingReason | null;
};

export type HostedEventInput = {
  title: string;
  description?: string;
  /** YYYY-MM-DD */
  eventDate: string;
  /** HH:mm */
  startTime?: string;
  endTime?: string;
  location?: string;
  /** Positive makes the event paid. */
  streamFee?: number;
  streamFeeCurrencyId?: string;
  /** Required by the server: whether viewers may invite others to send wishes. */
  allowWishInvites: boolean;
};

export type EarningsPreview = {
  hostPercent: string;
  platformPercent: string;
  hostEarnsPerTicket: number;
};

const REASONS: HostingReason[] = ['HOSTING_DISABLED', 'NOT_A_PHOTOGRAPHER', 'KYC_REQUIRED_FOR_PAID'];

export function parseEligibility(data: unknown): HostingEligibility {
  const d = (data ?? {}) as Raw;
  const reason = REASONS.find((r) => r === d.reason) ?? null;
  return {
    enabled: d.enabled === true,
    canHostFree: d.canHostFree === true,
    canHostPaid: d.canHostPaid === true,
    reason,
  };
}

export async function getHostingEligibility(): Promise<HostingEligibility> {
  const res = requireOk(await api.get<ApiEnvelope<unknown>>('/photographer/hosted-events/eligibility'));
  return parseEligibility(res?.data);
}

export async function createHostedEvent(input: HostedEventInput): Promise<EventItem> {
  const res = await api.post<ApiEnvelope<RawEvent>>('/photographer/hosted-events', input);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not create the event. Please try again.' };
  }
  const event = mapEvent((res.data ?? {}) as RawEvent);
  if (!event.id) throw { status: 502, message: 'The server did not return the new event.' };
  return event;
}

export async function listHostedEvents(bucket?: 'upcoming' | 'live' | 'ended'): Promise<EventItem[]> {
  const qs = bucket ? `?bucket=${bucket}` : '';
  const res = requireOk(await api.get<ApiEnvelope<unknown>>(`/photographer/hosted-events${qs}`));
  const list = Array.isArray(res?.data) ? (res.data as RawEvent[]) : [];
  return list.map(mapEvent).filter((e) => e.id);
}

export async function getEarningsPreview(fee: number): Promise<EarningsPreview> {
  const res = requireOk(
    await api.get<ApiEnvelope<unknown>>(`/photographer/hosted-events/earnings-preview?fee=${encodeURIComponent(String(fee))}`),
  );
  const d = (res?.data ?? {}) as Raw;
  const earns = typeof d.hostEarnsPerTicket === 'number' ? d.hostEarnsPerTicket : Number(d.hostEarnsPerTicket);
  return {
    hostPercent: String(d.hostPercent ?? ''),
    platformPercent: String(d.platformPercent ?? ''),
    hostEarnsPerTicket: Number.isFinite(earns) ? earns : 0,
  };
}
