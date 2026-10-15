/**
 * API client for Post My Event (the hybrid booking engine, /api/remote/**).
 *
 * Every call goes to one route and surfaces its failure. These functions used
 * to swallow errors and return made-up results (a fake match request, a local
 * match count, a silent "approved", a 15-minute deadline guessed on the
 * phone). A hidden failure tells a photographer they are shortlisted when the
 * server refused them, so nothing here invents a value the server didn't send.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError } from '@/types';
import type {
  CandidateSummary,
  CandidatesResponse,
  ConvertToHybridRescueResult,
  HybridOptions,
  HybridProfile,
  MatchPreviewPayload,
  MatchPreviewResult,
  MatchRequestPayload,
  MatchRequestResult,
  PhotographerOpportunity,
  RecommendationTier,
  SelectPhotographerPayload,
  SelectPhotographerResult,
} from './types';

type Raw = Record<string, unknown>;

function assertOk(res: { action?: number; message?: string } | undefined, fallback: string): void {
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || fallback } satisfies ApiError;
  }
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const tier = (v: unknown): RecommendationTier => (v === 'HIGH' || v === 'MEDIUM' || v === 'LOW' ? v : 'LOW');

// ───────────────────────── server clock ─────────────────────────

/** Countdowns use the server's clock; the offset is learned from responses. */
let serverOffsetMs = 0;

export function noteServerTime(serverNow: unknown): void {
  if (typeof serverNow !== 'string') return;
  const t = Date.parse(serverNow);
  if (Number.isFinite(t)) serverOffsetMs = t - Date.now();
}

export function serverNowMs(): number {
  return Date.now() + serverOffsetMs;
}

export async function syncServerClock(): Promise<void> {
  try {
    const res = await api.get<ApiEnvelope<Raw>>('/public/time');
    if (res?.action === 1) noteServerTime(res.data?.now);
  } catch {
    // keep the last offset
  }
}

// ───────────────────────── options ─────────────────────────

let optionsCache: Promise<HybridOptions> | null = null;

/** The wizard's choices, fetched once per app session. */
export function getHybridOptions(): Promise<HybridOptions> {
  if (!optionsCache) {
    optionsCache = api.get<ApiEnvelope<HybridOptions>>('/public/hybrid/options')
      .then((res) => {
        assertOk(res, 'Could not load the event options.');
        return res.data as HybridOptions;
      })
      .catch((e) => {
        optionsCache = null;
        throw e;
      });
  }
  return optionsCache;
}

// ───────────────────────── client side ─────────────────────────

/** The live count, from the same server engine that sends the alerts. Throws rather than guess. */
export async function getMatchPreview(payload: MatchPreviewPayload): Promise<MatchPreviewResult> {
  const res = await api.post<ApiEnvelope<Raw>>('/events/match-preview', payload);
  assertOk(res, 'Could not count matching photographers.');
  const raw = (res.data ?? {}) as Raw;
  if (typeof raw.matchCount !== 'number') {
    throw { status: 500, message: 'Could not count matching photographers.' } satisfies ApiError;
  }
  return {
    matchCount: raw.matchCount,
    durationMinutes: num(raw.durationMinutes),
    durationLabel: str(raw.durationLabel),
    firstBatchSize: num(raw.firstBatchSize),
    tierCounts: (raw.tierCounts as MatchPreviewResult['tierCounts']) || undefined,
    breakdown: raw.breakdown as MatchPreviewResult['breakdown'],
  };
}

/** Post the event and alert the first batch. Posting again while matching is open changes nothing. */
export async function createMatchRequest(eventId: string, payload: MatchRequestPayload): Promise<MatchRequestResult> {
  const res = await api.post<ApiEnvelope<MatchRequestResult>>(
    `/events/${encodeURIComponent(eventId)}/match-request`,
    payload,
  );
  assertOk(res, 'Could not post your event to photographers.');
  return res.data!;
}

function mapCandidate(c: any): CandidateSummary {
  return {
    candidateId: String(c.candidateId ?? ''),
    photographerId: String(c.photographerId ?? ''),
    name: str(c.name) ?? 'Photographer',
    avatar: str(c.avatar),
    city: str(c.city),
    photographerType: c.photographerType === 'STUDIO' ? 'STUDIO' : 'FREELANCER',
    recommendationTier: tier(c.recommendationTier),
    rank: num(c.rank),
    distanceKm: num(c.distanceKm),
    distanceLabel: str(c.distanceLabel),
    sameCity: c.sameCity === true,
    reviewCount: num(c.reviewCount),
    rating: num(c.rating),
    typicalPriceRange: str(c.typicalPriceRange),
    instagram: c.instagram ? { handle: str(c.instagram.handle), followersCount: num(c.instagram.followersCount) } : undefined,
    slug: str(c.slug),
    about: str(c.about),
    specialties: Array.isArray(c.specialties) ? c.specialties : [],
  };
}

/** Who said yes, best first, and how the match is going. */
export async function listEventCandidates(eventId: string): Promise<CandidatesResponse> {
  const res = await api.get<ApiEnvelope<Raw>>(`/events/${encodeURIComponent(eventId)}/candidates`);
  assertOk(res, 'Could not load the photographers who answered.');
  const d = (res.data ?? {}) as Raw;
  noteServerTime(d.serverNow);
  const candidates = Array.isArray(d.candidates) ? d.candidates : [];
  return {
    eventId: String(d.eventId ?? eventId),
    status: String(d.status ?? ''),
    bookingMode: str(d.bookingMode),
    eventTitle: str(d.eventTitle),
    eventDate: str(d.eventDate),
    startTime: str(d.startTime),
    endTime: str(d.endTime),
    durationLabel: str(d.durationLabel),
    eventStartAt: str(d.eventStartAt),
    city: str(d.city),
    venue: str(d.venue),
    minBudget: num(d.minBudget),
    maxBudget: num(d.maxBudget),
    totalApproved: num(d.totalApproved) ?? candidates.length,
    candidates: candidates.map(mapCandidate),
    tierCounts: (d.tierCounts as CandidatesResponse['tierCounts']) || undefined,
    matchStatus: str(d.matchStatus),
    invitedCount: num(d.invitedCount),
    pendingCount: num(d.pendingCount),
    declinedCount: num(d.declinedCount),
    expiredCount: num(d.expiredCount),
    noLongerAvailableCount: num(d.noLongerAvailableCount),
    windowExpiresAt: str(d.windowExpiresAt),
    canRepost: d.canRepost === true,
    canConvertToDirect: d.canConvertToDirect === true,
    serverNow: str(d.serverNow),
  };
}

/**
 * Choose a photographer. Creates the booking and its payment declaration,
 * so it is sent once and never repeated; the server answers a repeat with
 * the same booking.
 */
export async function selectPhotographer(eventId: string, payload: SelectPhotographerPayload): Promise<SelectPhotographerResult> {
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
        message: err?.message || 'This photographer is no longer available for your event. Please choose another.',
      } satisfies ApiError;
    }
    if (err?.status === 408 || err?.status === 0) {
      throw {
        status: err.status,
        message: "We couldn't confirm whether your selection went through. Pull to refresh and check your event before choosing again.",
      } satisfies ApiError;
    }
    throw e;
  }
  assertOk(res, 'Could not confirm this photographer. Please try again.');
  return res.data!;
}

/** Post an unassigned or declined Direct event, with the requirements it already has. */
export async function convertToHybridRescue(eventId: string): Promise<ConvertToHybridRescueResult> {
  const res = await api.post<ApiEnvelope<ConvertToHybridRescueResult>>(`/events/${encodeURIComponent(eventId)}/convert-to-hybrid`);
  assertOk(res, 'Could not post this event to photographers.');
  return res.data!;
}

/** Stop matching and book from Find a Photographer instead. */
export async function convertToDirectRescue(eventId: string): Promise<Raw | undefined> {
  const res = await api.post<ApiEnvelope<Raw>>(`/events/${encodeURIComponent(eventId)}/convert-to-direct`);
  assertOk(res, 'Could not switch this event to Find a Photographer.');
  return res.data;
}

// ───────────────────────── photographer side ─────────────────────────

function mapOpportunity(raw: any): PhotographerOpportunity {
  return {
    candidateId: String(raw?.candidateId ?? ''),
    matchRequestId: String(raw?.matchRequestId ?? ''),
    eventId: String(raw?.eventId ?? ''),
    eventTitle: str(raw?.eventTitle) ?? 'Event',
    eventType: str(raw?.eventType),
    eventDate: String(raw?.eventDate ?? ''),
    startTime: String(raw?.startTime ?? ''),
    endTime: str(raw?.endTime),
    durationHours: num(raw?.durationHours),
    durationMinutes: num(raw?.durationMinutes),
    durationLabel: str(raw?.durationLabel),
    eventStartAt: str(raw?.eventStartAt),
    city: str(raw?.city),
    venue: str(raw?.venue),
    distanceKm: num(raw?.distanceKm),
    distanceMeasured: raw?.distanceMeasured === true,
    distanceLabel: str(raw?.distanceLabel),
    sameCity: raw?.sameCity === true,
    minBudget: num(raw?.minBudget),
    maxBudget: num(raw?.maxBudget),
    currency: str(raw?.currency) ?? 'RWF',
    instructions: str(raw?.instructions),
    matchReasons: Array.isArray(raw?.matchReasons) ? raw.matchReasons : [],
    requiredSpecialty: str(raw?.requiredSpecialty),
    photographerTypeRequested: str(raw?.photographerTypeRequested),
    expiresAt: str(raw?.expiresAt),
    invitedAt: str(raw?.invitedAt),
    responseDeadlineAt: str(raw?.responseDeadlineAt) ?? str(raw?.candidateExpiresAt),
    candidateExpiresAt: str(raw?.candidateExpiresAt) ?? str(raw?.responseDeadlineAt),
    serverNow: str(raw?.serverNow),
    status: raw?.status ?? 'INVITED',
  };
}

/** PENDING_RESPONSE (open invites), APPROVED (client is choosing) or ALL. */
export async function listOpportunities(status?: string): Promise<PhotographerOpportunity[]> {
  const res = await api.get<ApiEnvelope<unknown>>(
    `/photographer/opportunities?status=${encodeURIComponent(status || 'PENDING_RESPONSE')}`,
  );
  assertOk(res, 'Could not load opportunities.');
  const items = Array.isArray(res.data) ? (res.data as any[]) : [];
  if (items[0]) noteServerTime(items[0].serverNow);
  return items.map(mapOpportunity).filter((o) => o.candidateId);
}

/** One opportunity, for a push notification's deep link. */
export async function getOpportunity(candidateId: string): Promise<PhotographerOpportunity> {
  const res = await api.get<ApiEnvelope<Raw>>(`/photographer/opportunities/${encodeURIComponent(candidateId)}`);
  assertOk(res, 'Could not load this opportunity.');
  noteServerTime(res.data?.serverNow);
  return mapOpportunity(res.data);
}

/** Badge counts: open invites, and approvals waiting for the client. */
export async function getOpportunityCounts(): Promise<{ pending: number; awaitingClient: number }> {
  const res = await api.get<ApiEnvelope<Raw>>('/photographer/opportunities/count');
  assertOk(res, 'Could not load opportunity counts.');
  return { pending: num(res.data?.pending) ?? 0, awaitingClient: num(res.data?.awaitingClient) ?? 0 };
}

/** "I'm available". Throws 409 once the invite has closed or the calendar now overlaps. */
export async function approveOpportunity(candidateId: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>(`/opportunities/${encodeURIComponent(candidateId)}/approve`);
  assertOk(res, 'Could not send your answer.');
}

/** "Not this time"; the next photographer is invited instead. */
export async function rejectOpportunity(candidateId: string, reason?: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>(
    `/opportunities/${encodeURIComponent(candidateId)}/reject`,
    reason ? { reason } : {},
  );
  assertOk(res, 'Could not send your answer.');
}

// ───────────────────────── matching profile ─────────────────────────

function mapProfile(d: any): HybridProfile {
  const s = d?.instagramStatus;
  return {
    instagramHandle: str(d?.instagramHandle),
    instagramStatus: s === 'CONNECTED' || s === 'PENDING' || s === 'NOT_FOUND' ? s : 'NONE',
    city: str(d?.city),
    resolvedCity: str(d?.resolvedCity),
    needsCity: d?.needsCity === true,
    needsInstagram: d?.needsInstagram === true,
  };
}

export async function getHybridProfile(): Promise<HybridProfile> {
  const res = await api.get<ApiEnvelope<Raw>>('/photographer/hybrid-profile');
  assertOk(res, 'Could not load your matching profile.');
  return mapProfile(res.data);
}

/** Save an Instagram username or link and/or a base city. A blank handle removes it. */
export async function saveHybridProfile(update: { instagramHandle?: string; city?: string }): Promise<HybridProfile> {
  const res = await api.put<ApiEnvelope<Raw>>('/photographer/hybrid-profile', update);
  assertOk(res, 'Could not save. Please try again.');
  return mapProfile(res.data);
}
