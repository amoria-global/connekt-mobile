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

/**
 * 4.1 Real-time match preview & candidate count for the event wizard.
 */
export async function getMatchPreview(payload: MatchPreviewPayload): Promise<MatchPreviewResult> {
  const res = await api.post<ApiEnvelope<MatchPreviewResult>>('/events/match-preview', payload);
  if (res?.action === 0) {
    return { matchCount: 0 };
  }
  return res?.data ?? { matchCount: 0 };
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

/**
 * 4.3 Photographer opportunities feed.
 */
export async function listOpportunities(status?: string): Promise<PhotographerOpportunity[]> {
  if (status) {
    const res = await api.get<ApiEnvelope<PhotographerOpportunity[]> | PhotographerOpportunity[]>(
      `/photographer/opportunities?status=${encodeURIComponent(status)}`,
    );
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  }
  const res = await api.get<ApiEnvelope<PhotographerOpportunity[]> | PhotographerOpportunity[]>(
    '/photographer/opportunities',
  );
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
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
  const res = await api.get<ApiEnvelope<CandidatesResponse>>(
    `/events/${encodeURIComponent(eventId)}/candidates`,
  );
  if (res?.data) {
    return res.data;
  }
  return {
    eventId,
    status: 'MATCHING',
    totalApproved: 0,
    candidates: [],
  };
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
