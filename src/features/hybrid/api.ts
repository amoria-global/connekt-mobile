/**
 * API client for the Hybrid Booking Engine (/api/remote/**).
 * Reuses existing api client and authentication.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError } from '@/types';
import type {
  MatchPreviewPayload,
  MatchPreviewResult,
  MatchRequestPayload,
  MatchRequestResult,
  PhotographerOpportunity,
  CandidatesResponse,
  SelectPhotographerPayload,
  SelectPhotographerResult,
  ConvertToHybridRescueResult,
} from './types';

type Raw = Record<string, unknown>;

function assertOk(res: { action?: number; message?: string } | undefined, fallback: string): void {
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || fallback,
    } satisfies ApiError;
  }
}

function mapOpportunity(raw: any): PhotographerOpportunity {
  return {
    candidateId: String(raw?.candidateId ?? raw?.id ?? ''),
    matchRequestId: String(raw?.matchRequestId ?? raw?.requestId ?? ''),
    eventId: String(raw?.eventId ?? raw?.event?.id ?? ''),
    eventTitle: String(raw?.eventTitle ?? raw?.event?.title ?? raw?.title ?? 'Event Opportunity'),
    eventType: raw?.eventType ?? raw?.event?.eventType ?? raw?.category,
    eventDate: String(raw?.eventDate ?? raw?.event?.eventDate ?? raw?.date ?? ''),
    startTime: String(raw?.startTime ?? raw?.event?.startTime ?? ''),
    endTime: raw?.endTime ?? raw?.event?.endTime,
    durationHours: raw?.durationHours ?? raw?.duration,
    city: raw?.city ?? raw?.event?.city ?? (typeof raw?.location === 'string' ? raw.location.split(',').pop()?.trim() : undefined),
    venue: raw?.venue ?? raw?.event?.venue ?? raw?.location,
    distanceKm: typeof raw?.distanceKm === 'number' ? raw.distanceKm : typeof raw?.distance === 'number' ? raw.distance : undefined,
    minBudget: raw?.minBudget ?? raw?.budgetMin ?? raw?.price,
    maxBudget: raw?.maxBudget ?? raw?.budgetMax ?? raw?.price,
    currency: raw?.currency ?? raw?.currencyCode ?? 'RWF',
    matchReasons: Array.isArray(raw?.matchReasons) ? raw.matchReasons : undefined,
    expiresAt: raw?.expiresAt ?? raw?.expirationTime,
    status: raw?.status ?? 'INVITED',
  };
}

/**
 * 4.1 Real-time match preview & candidate count for the event wizard.
 */
export async function getMatchPreview(payload: MatchPreviewPayload): Promise<MatchPreviewResult> {
  try {
    // Add default coordinates for Kigali (-1.9441, 30.0619) if not provided,
    // so spatial/distance SQL queries on the backend have valid coordinates to evaluate.
    const enrichedPayload: MatchPreviewPayload = {
      ...payload,
      latitude: payload.latitude ?? -1.9441,
      longitude: payload.longitude ?? 30.0619,
    };

    const res = await api.post<any>('/events/match-preview', enrichedPayload);

    if (res?.action === 0) {
      console.warn('[MatchPreview] Backend returned action: 0, message:', res?.message);
      return { matchCount: 0 };
    }

    const raw = res?.data !== undefined ? res.data : res;

    // 1. Raw integer: { action: 1, data: 12 } or 12
    if (typeof raw === 'number') {
      return { matchCount: raw };
    }

    // 2. Array of matched photographers: [ { id: 1 }, ... ]
    if (Array.isArray(raw)) {
      return { matchCount: raw.length };
    }

    // 3. Object with count / matchCount / total / matches / content (Spring Page)
    if (raw && typeof raw === 'object') {
      const count =
        typeof raw.matchCount === 'number'
          ? raw.matchCount
          : typeof raw.count === 'number'
            ? raw.count
            : typeof raw.total === 'number'
              ? raw.total
              : typeof raw.totalElements === 'number'
                ? raw.totalElements
                : Array.isArray(raw.content)
                  ? raw.content.length
                  : Array.isArray(raw.matches)
                    ? raw.matches.length
                    : typeof raw.matchedCount === 'number'
                      ? raw.matchedCount
                      : null;

      if (count !== null) {
        return { matchCount: count, breakdown: raw.breakdown };
      }
    }

    return { matchCount: 0 };
  } catch (err) {
    console.warn('[MatchPreview] Error fetching match count:', err);
    return { matchCount: 0 };
  }
}

/**
 * 4.2 Publish event brief and trigger matching / candidate invitations.
 */
export async function createMatchRequest(
  eventId: string,
  payload: MatchRequestPayload,
): Promise<MatchRequestResult> {
  const res = await api.post<ApiEnvelope<MatchRequestResult>>(
    `/events/${encodeURIComponent(eventId)}/match-request`,
    payload,
  );
  assertOk(res, 'Could not publish event matching brief. Please try again.');
  return res.data!;
}

function parseOpportunities(res: any): PhotographerOpportunity[] {
  const raw = res?.data !== undefined ? res.data : res;
  let items: any[] = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.content)) {
      items = raw.content;
    } else if (Array.isArray(raw.opportunities)) {
      items = raw.opportunities;
    } else if (Array.isArray(raw.items)) {
      items = raw.items;
    }
  }
  return items.map(mapOpportunity).filter((o) => o.candidateId || o.eventId);
}

/**
 * 4.3 Photographer opportunities feed.
 * Handles arrays, Spring Boot Page ({ content: [...] }), and envelopes.
 */
export async function listOpportunities(status?: string): Promise<PhotographerOpportunity[]> {
  try {
    if (status) {
      const res = await api.get<any>(
        `/photographer/opportunities?status=${encodeURIComponent(status)}`,
      );
      return parseOpportunities(res);
    }
    const res = await api.get<any>(
      '/photographer/opportunities',
    );
    return parseOpportunities(res);
  } catch (err) {
    console.warn('[listOpportunities] Error fetching opportunities:', err);
    return [];
  }
}

/**
 * 4.4 Photographer approves opportunity (adds them to client candidate list).
 */
export async function approveOpportunity(candidateId: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>(
    `/opportunities/${encodeURIComponent(candidateId)}/approve`,
  );
  assertOk(res, 'Could not approve this opportunity.');
}

/**
 * 4.4 Photographer rejects opportunity (triggers queue backfill).
 */
export async function rejectOpportunity(candidateId: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>(
    `/opportunities/${encodeURIComponent(candidateId)}/reject`,
  );
  assertOk(res, 'Could not decline this opportunity.');
}

/**
 * 4.5 Client retrieves approved candidate shortlist ranked by recommendation tier.
 */
export async function listEventCandidates(eventId: string): Promise<CandidatesResponse> {
  try {
    const res = await api.get<any>(
      `/events/${encodeURIComponent(eventId)}/candidates`,
    );
    const data = res?.data !== undefined ? res.data : res;

    if (data && typeof data === 'object') {
      if (Array.isArray(data.candidates)) {
        return data as CandidatesResponse;
      }
      if (Array.isArray(data.content)) {
        return {
          eventId,
          status: data.status || 'MATCHING',
          totalApproved: data.content.length,
          candidates: data.content,
        };
      }
      if (Array.isArray(data)) {
        return {
          eventId,
          status: 'MATCHING',
          totalApproved: data.length,
          candidates: data,
        };
      }
    }

    return {
      eventId,
      status: 'MATCHING',
      totalApproved: 0,
      candidates: [],
    };
  } catch (err) {
    console.warn('[listEventCandidates] Error:', err);
    return {
      eventId,
      status: 'MATCHING',
      totalApproved: 0,
      candidates: [],
    };
  }
}

/**
 * 4.6 Client selects a candidate with concurrency protection and locks booking.
 * Returns declarationId to launch existing escrow checkout.
 */
export async function selectPhotographer(
  eventId: string,
  payload: SelectPhotographerPayload,
): Promise<SelectPhotographerResult> {
  const res = await api.post<ApiEnvelope<SelectPhotographerResult> & { error?: string }>(
    `/events/${encodeURIComponent(eventId)}/select-photographer`,
    payload,
  );

  if (res?.action !== 1) {
    if (res?.error === 'NO_LONGER_AVAILABLE') {
      throw {
        status: 409,
        message: 'This photographer is no longer available for your date. Please select another candidate.',
      } satisfies ApiError;
    }
    throw {
      status: 400,
      message: res?.message || 'Could not confirm photographer selection. Please try again.',
    } satisfies ApiError;
  }

  return res.data!;
}

/**
 * 7.0 Direct-to-Hybrid rescue hook: converts a declined direct booking event into a hybrid match brief.
 */
export async function convertToHybridRescue(eventId: string): Promise<ConvertToHybridRescueResult> {
  const res = await api.post<ApiEnvelope<ConvertToHybridRescueResult>>(
    `/events/${encodeURIComponent(eventId)}/convert-to-hybrid`,
  );
  assertOk(res, 'Could not convert event to hybrid match.');
  return res.data!;
}
