/**
 * API client for the Hybrid Booking Engine (/api/remote/**).
 * Reuses existing api client and authentication.
 *
 * Every call goes to one route and surfaces its failure. These functions used
 * to swallow errors and return made-up results (a fake match request, a local
 * match count, a silent "approved"), and to repeat a failed POST against an
 * alias route. A repeated POST can act twice, and a hidden failure tells a
 * photographer they are shortlisted when the server refused them.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError } from '@/types';
import type {
  MatchPreviewPayload,
  MatchPreviewResult,
  MatchRequestPayload,
  MatchRequestResult,
  PhotographerOpportunity,
  CandidateSummary,
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
    clientName: raw?.clientName ?? raw?.client?.name ?? raw?.customerName,
    eventType: raw?.eventType ?? raw?.event?.eventType ?? raw?.category,
    eventDate: String(raw?.eventDate ?? raw?.event?.eventDate ?? raw?.date ?? ''),
    startTime: String(raw?.startTime ?? raw?.event?.startTime ?? ''),
    endTime: raw?.endTime ?? raw?.event?.endTime,
    durationHours: raw?.durationHours ?? raw?.duration,
    city: raw?.eventCity ?? raw?.city ?? raw?.event?.city ?? (typeof raw?.location === 'string' ? raw.location.split(',').pop()?.trim() : undefined),
    eventCity: raw?.eventCity ?? raw?.city,
    venue: raw?.eventAddress ?? raw?.venue ?? raw?.event?.venue ?? raw?.location,
    eventAddress: raw?.eventAddress ?? raw?.venue,
    distanceKm: typeof raw?.distanceKm === 'number' ? raw.distanceKm : typeof raw?.distance === 'number' ? raw.distance : undefined,
    minBudget: raw?.estimatedEarnings ?? raw?.minBudget ?? raw?.budgetMin ?? raw?.price,
    maxBudget: raw?.estimatedEarnings ?? raw?.maxBudget ?? raw?.budgetMax ?? raw?.price,
    estimatedEarnings: typeof raw?.estimatedEarnings === 'number' ? raw.estimatedEarnings : undefined,
    currency: raw?.currency ?? raw?.currencyCode ?? 'RWF',
    escrowGuaranteed: raw?.escrowGuaranteed ?? true,
    instructions: raw?.instructions,
    matchReasons: Array.isArray(raw?.matchReasons) ? raw.matchReasons : undefined,
    expiresAt: raw?.expiresAt ?? raw?.expirationTime,
    invitedAt: raw?.invitedAt,
    candidateExpiresAt: raw?.candidateExpiresAt ?? (raw?.invitedAt ? new Date(new Date(raw.invitedAt).getTime() + 15 * 60000).toISOString() : (raw?.expiresAt ?? raw?.expirationTime)),
    status: raw?.status ?? 'INVITED',
  };
}

/**
 * 4.1 Real-time match preview & candidate count for the event wizard.
 * The count is the server's, including 0; on failure this throws so the
 * wizard can say it could not count rather than show a number.
 */
export async function getMatchPreview(payload: MatchPreviewPayload): Promise<MatchPreviewResult> {
  const res = await api.post<ApiEnvelope<Raw>>('/events/match-preview', payload);
  assertOk(res, 'Could not calculate matching photographers.');
  const raw = (res.data ?? {}) as Raw;
  if (typeof raw.matchCount !== 'number') {
    throw { status: 500, message: 'Could not calculate matching photographers.' } satisfies ApiError;
  }
  return {
    matchCount: raw.matchCount,
    breakdown: raw.breakdown as MatchPreviewResult['breakdown'],
  };
}

/**
 * 4.2 Publish event brief and trigger matching / candidate invitations.
 * Endpoint: POST /api/remote/events/{eventId}/match-request
 */
export async function createMatchRequest(
  eventId: string,
  payload: MatchRequestPayload,
): Promise<MatchRequestResult> {
  const res = await api.post<ApiEnvelope<MatchRequestResult>>(
    `/events/${encodeURIComponent(eventId)}/match-request`,
    payload,
  );
  assertOk(res, 'Could not post your event to photographers.');
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

function mapCandidate(c: any): CandidateSummary {
  return {
    candidateId: String(c.candidateId ?? c.id ?? ''),
    photographerId: String(c.photographerId ?? c.userId ?? ''),
    name: c.photographerName || c.name || 'Photographer',
    photographerName: c.photographerName,
    avatar: c.profilePictureUrl || c.avatar,
    profilePictureUrl: c.profilePictureUrl,
    city: c.city,
    photographerType: c.photographerType ?? (c.studio ? 'STUDIO' : 'FREELANCER'),
    recommendationTier: c.recommendationTier || 'TOP_MATCH',
    compositeScore: typeof c.compositeScore === 'number' ? c.compositeScore : 90,
    rank: typeof c.rank === 'number' ? c.rank : undefined,
    distanceKm: typeof c.distanceKm === 'number' ? c.distanceKm : undefined,
    reviewCount: typeof c.reviewCount === 'number' ? c.reviewCount : undefined,
    rating: typeof c.rating === 'number' ? c.rating : undefined,
    typicalPriceRange: c.typicalPriceRange,
    portfolioImages: Array.isArray(c.portfolioImages) ? c.portfolioImages : undefined,
    instagram: c.instagram,
    packages: Array.isArray(c.packages) ? c.packages : [],
  };
}

/**
 * 4.3 Photographer opportunities feed.
 * Endpoint: GET /api/remote/photographer/opportunities?status=PENDING_RESPONSE
 */
export async function listOpportunities(status?: string): Promise<PhotographerOpportunity[]> {
  const queryStatus = status || 'PENDING_RESPONSE';
  const res = await api.get<ApiEnvelope<unknown>>(
    `/photographer/opportunities?status=${encodeURIComponent(queryStatus)}`,
  );
  assertOk(res, 'Could not load opportunities.');
  return parseOpportunities(res);
}

/**
 * 4.4 Photographer approves opportunity (adds them to client candidate list).
 * Endpoint: POST /api/remote/opportunities/{candidateId}/approve
 * Throws on refusal, e.g. 409 once the invite has expired or been decided.
 */
export async function approveOpportunity(candidateId: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>(
    `/opportunities/${encodeURIComponent(candidateId)}/approve`,
  );
  assertOk(res, 'Could not approve this opportunity.');
}

/**
 * 4.4 Photographer rejects opportunity (triggers queue backfill).
 * Endpoint: POST /api/remote/opportunities/{candidateId}/reject
 */
export async function rejectOpportunity(candidateId: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>(
    `/opportunities/${encodeURIComponent(candidateId)}/reject`,
  );
  assertOk(res, 'Could not decline this opportunity.');
}

/**
 * 4.5 Client retrieves approved candidate shortlist ranked by recommendation tier.
 * Endpoint: GET /api/remote/events/{eventId}/candidates
 */
export async function listEventCandidates(eventId: string): Promise<CandidatesResponse> {
  const res = await api.get<ApiEnvelope<Raw>>(`/events/${encodeURIComponent(eventId)}/candidates`);
  assertOk(res, 'Could not load candidates.');
  const data = (res.data ?? {}) as Raw;
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  return {
    eventId: String(data.eventId ?? eventId),
    status: String(data.status ?? ''),
    totalApproved: typeof data.totalApproved === 'number' ? data.totalApproved : candidates.length,
    candidates: candidates.map(mapCandidate),
    matchStatus: typeof data.matchStatus === 'string' ? data.matchStatus : undefined,
    invitedCount: typeof data.invitedCount === 'number' ? data.invitedCount : undefined,
    pendingCount: typeof data.pendingCount === 'number' ? data.pendingCount : undefined,
    declinedCount: typeof data.declinedCount === 'number' ? data.declinedCount : undefined,
    expiredCount: typeof data.expiredCount === 'number' ? data.expiredCount : undefined,
    windowExpiresAt: typeof data.windowExpiresAt === 'string' ? data.windowExpiresAt : undefined,
  };
}

/**
 * 4.6 Client selects a candidate with concurrency protection and locks booking.
 * Endpoint: POST /api/remote/events/{eventId}/select-photographer
 * Returns declarationId to launch existing escrow checkout.
 *
 * Sent once, never repeated: this creates the booking and its payment
 * declaration. After a timeout the selection may already have gone through,
 * so the client is told to refresh rather than to try again.
 */
export async function selectPhotographer(
  eventId: string,
  payload: SelectPhotographerPayload,
): Promise<SelectPhotographerResult> {
  let res: ApiEnvelope<SelectPhotographerResult>;
  try {
    res = await api.post<ApiEnvelope<SelectPhotographerResult>>(
      `/events/${encodeURIComponent(eventId)}/select-photographer`,
      {
        candidateId: payload.candidateId,
        photographerId: payload.photographerId,
        packageId: payload.packageId,
        escrowPercentage: payload.escrowPercentage ?? 50,
        notes: payload.notes,
      },
    );
  } catch (e) {
    const err = e as ApiError;
    if (err?.status === 409 || err?.body?.error === 'NO_LONGER_AVAILABLE') {
      throw {
        status: 409,
        message: 'This photographer is no longer available for your event. Please select another candidate.',
      } satisfies ApiError;
    }
    if (err?.status === 408 || err?.status === 0) {
      throw {
        status: err.status,
        message:
          "We couldn't confirm whether your selection went through. Pull to refresh and check your event before selecting again.",
      } satisfies ApiError;
    }
    throw e;
  }

  assertOk(res, 'Could not confirm photographer selection. Please try again.');
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

/**
 * 7.1 Hybrid-to-Direct rescue hook: converts a timed-out hybrid event into direct booking mode.
 */
export async function convertToDirectRescue(eventId: string): Promise<Raw | undefined> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/events/${encodeURIComponent(eventId)}/convert-to-direct`,
  );
  assertOk(res, 'Could not convert event to direct booking.');
  return res.data;
}
