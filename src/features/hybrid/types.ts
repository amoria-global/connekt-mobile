/**
 * Types and contracts for the Connekyt Hybrid Booking Engine.
 * Matches backend endpoints under /api/remote/** (V315 migration).
 */
import type { ID } from '@/types';

export type PhotographerType = 'FREELANCER' | 'STUDIO' | 'ANY';
export type LocationCoverage = 'SAME_CITY' | 'NEARBY_CITY' | 'ANY';
export type RecommendationTier = 'HIGH' | 'MEDIUM' | 'LOW';

export type MatchPreviewPayload = {
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss or HH:mm
  endTime?: string; // HH:mm:ss or HH:mm
  city: string;
  latitude?: number;
  longitude?: number;
  minBudget?: number;
  maxBudget?: number;
  currency?: string;
  photographerType?: PhotographerType;
  specialty?: string;
  locationCoverage?: LocationCoverage;
};

export type MatchPreviewBreakdown = {
  availableOnDate?: number;
  withinBudget?: number;
  typeMatched?: number;
  instagramEnriched?: number;
};

export type MatchPreviewResult = {
  matchCount: number;
  breakdown?: MatchPreviewBreakdown;
};

export type MatchRequestPayload = {
  minBudget?: number;
  maxBudget?: number;
  currency?: string;
  photographerType?: PhotographerType;
  specialty?: string;
  locationCoverage?: LocationCoverage;
  expirationHours?: number;
};

export type MatchRequestResult = {
  matchRequestId: string;
  status: string;
  invitedCount: number;
  expiresAt: string;
};

export type PhotographerOpportunity = {
  candidateId: string;
  matchRequestId: string;
  eventId: string;
  eventTitle: string;
  eventType?: string;
  eventDate: string;
  startTime: string;
  endTime?: string;
  durationHours?: number;
  city?: string;
  venue?: string;
  distanceKm?: number;
  minBudget?: number;
  maxBudget?: number;
  currency?: string;
  matchReasons?: string[];
  expiresAt?: string;
  status?: 'INVITED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
};

export type CandidateInstagram = {
  handle?: string;
  followersCount?: number;
  followsCount?: number;
  profilePicUrl?: string;
  biography?: string;
};

export type CandidateSummary = {
  candidateId: string;
  photographerId: string;
  name: string;
  avatar?: string;
  photographerType?: 'FREELANCER' | 'STUDIO';
  recommendationTier: RecommendationTier;
  compositeScore: number;
  distanceKm?: number;
  reviewCount?: number;
  rating?: number;
  typicalPriceRange?: string;
  instagram?: CandidateInstagram;
  packages?: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    durationHours?: number;
    includedPhotos?: number;
  }>;
};

export type CandidatesResponse = {
  eventId: string;
  status: string;
  totalApproved: number;
  candidates: CandidateSummary[];
};

export type SelectPhotographerPayload = {
  candidateId: string;
  photographerId: string;
  packageId?: string;
  escrowPercentage?: 50 | 70 | 100;
};

export type SelectPhotographerResult = {
  bookingId: string;
  declarationId: string;
  depositAmount: number;
  currency: string;
  escrowPercentage: number;
  eventStartAt?: string;
  eventTimezone?: string;
};

export type ConvertToHybridRescueResult = {
  matchRequestId: string;
  status: string;
  initialMatchCount?: number;
};
