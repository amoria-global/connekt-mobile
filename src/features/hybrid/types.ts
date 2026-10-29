/**
 * Types for Post My Event (the hybrid booking engine). Field names are the
 * backend's DTOs. Optional fields stay undefined when the server didn't send
 * them; nothing here is filled with an invented value.
 */

export type PhotographerType = 'FREELANCER' | 'STUDIO' | 'ANY';
export type LocationCoverage = 'SAME_CITY' | 'NEARBY_CITY' | 'ANY';
export type RecommendationTier = 'HIGH' | 'MEDIUM' | 'LOW';

/** The wizard's choices, the same lists the web dashboard shows. */
export type HybridOptions = {
  enabled: boolean;
  country: string;
  timezone: string;
  currency: string;
  eventTypes: { id: string; name: string }[];
  photographerSpecialties: { value: string; label: string }[];
  cities: { name: string; latitude: number; longitude: number }[];
  photographerTypes: { value: PhotographerType; label: string; description: string }[];
  coverageOptions: { value: LocationCoverage; label: string; description: string }[];
  budgetPresets: { label: string; min: number | null; max: number | null }[];
  timeStepMinutes: number;
  matchWindowHours: number[];
  defaultMatchWindowHours: number;
  inviteWindowMinutes: number;
  firstBatchSize: number;
  escrowOptions: number[];
  instagramRequired: boolean;
};

export type MatchPreviewPayload = {
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss
  endTime?: string; // HH:mm:ss
  city: string;
  latitude?: number;
  longitude?: number;
  minBudget?: number;
  maxBudget?: number;
  currency?: string;
  photographerType?: PhotographerType;
  /** Event type; ranks only. */
  specialty?: string;
  /** Required photographer specialty; filters. */
  photographerSpecialty?: string;
  locationCoverage?: LocationCoverage;
  eventId?: string;
  /** Client deliverables & turnaround scope for internal package recommendation pricing. */
  editedPhotos?: number;
  shortVideosQty?: number;
  longVideosQty?: number;
  digitalDeliveryDays?: number;
  hasLiveStream?: boolean;
  allowWishInvites?: boolean;
  photoBooksQty?: number;
  photoAlbumsQty?: number;
  wallPortraitsQty?: number;
};

export type MatchPreviewBreakdown = {
  total?: number;
  availableOnDate?: number;
  availableForFullEvent?: number;
  withinBudget?: number;
  typeMatched?: number;
  specialtyMatched?: number;
  inCoverage?: number;
  instagramEnriched?: number;
  sameCity?: number;
  nearbyFallback?: boolean;
};

export type MatchPreviewResult = {
  matchCount: number;
  durationMinutes?: number;
  durationLabel?: string;
  firstBatchSize?: number;
  tierCounts?: Partial<Record<RecommendationTier, number>>;
  breakdown?: MatchPreviewBreakdown;
  /** Advisory package price bands computed from active uploaded photographer packages. */
  packagePriceLow?: number;
  packagePriceRecommended?: number;
  packagePricePriority?: number;
};

export type MatchRequestPayload = {
  minBudget?: number;
  maxBudget?: number;
  currency?: string;
  photographerType?: PhotographerType;
  specialty?: string;
  photographerSpecialty?: string;
  locationCoverage?: LocationCoverage;
  expirationHours?: number;
  instructions?: string;
  city?: string;
  country?: string;
  venue?: string;
  latitude?: number;
  longitude?: number;
  hasLiveStream?: boolean;
  allowWishInvites?: boolean;
  minimumPhotos?: number;
  clientType?: string;
  digitalDeliveryDays?: number;
  printDeliveryMethod?: string;
  printDeliveryAddress?: string;
  printProposedDate?: string;
};

export type MatchRequestResult = {
  matchRequestId: string;
  status: string;
  invitedCount: number;
  expiresAt: string;
  alreadyPublished?: boolean;
};

export type OpportunityStatus =
  | 'INVITED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'SELECTED'
  | 'NOT_SELECTED'
  | 'NO_LONGER_AVAILABLE';

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
  durationMinutes?: number;
  /** "4 hrs", "2 hrs 30 min". */
  durationLabel?: string;
  eventStartAt?: string;
  city?: string;
  venue?: string;
  distanceKm?: number;
  distanceMeasured?: boolean;
  /** "2.8 km away", "In Kigali", "About 95 km away". */
  distanceLabel?: string;
  sameCity?: boolean;
  minBudget?: number;
  maxBudget?: number;
  currency?: string;
  matchReasons?: string[];
  instructions?: string;
  requiredSpecialty?: string;
  photographerTypeRequested?: string;
  expiresAt?: string;
  invitedAt?: string;
  /** When this invite closes. */
  responseDeadlineAt?: string;
  candidateExpiresAt?: string;
  serverNow?: string;
  status?: OpportunityStatus;
  /** Photographer's own closest uploaded package matched on the server. */
  matchedPackageId?: string;
  matchedPackageName?: string;
  matchedPackagePrice?: number;
  matchedPackageCurrency?: string;
  hasLiveStream?: boolean;
  allowWishInvites?: boolean;
  minimumPhotos?: number;
};

export type CandidateInstagram = {
  handle?: string;
  followersCount?: number;
};

export type CandidateSummary = {
  candidateId: string;
  photographerId: string;
  name: string;
  avatar?: string;
  city?: string;
  photographerType?: 'FREELANCER' | 'STUDIO';
  recommendationTier: RecommendationTier;
  rank?: number;
  distanceKm?: number;
  distanceLabel?: string;
  sameCity?: boolean;
  reviewCount?: number;
  /** Undefined when the photographer has no reviews. */
  rating?: number;
  typicalPriceRange?: string;
  instagram?: CandidateInstagram;
  slug?: string;
  about?: string;
  specialties: string[];
};

export type CandidatesResponse = {
  eventId: string;
  status: string;
  bookingMode?: string;
  eventTitle?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  durationLabel?: string;
  eventStartAt?: string;
  city?: string;
  venue?: string;
  minBudget?: number;
  maxBudget?: number;
  totalApproved: number;
  candidates: CandidateSummary[];
  tierCounts?: Partial<Record<RecommendationTier, number>>;
  matchStatus?: string;
  invitedCount?: number;
  pendingCount?: number;
  declinedCount?: number;
  expiredCount?: number;
  noLongerAvailableCount?: number;
  windowExpiresAt?: string;
  canRepost?: boolean;
  canConvertToDirect?: boolean;
  serverNow?: string;
};

export type SelectPhotographerPayload = {
  candidateId: string;
  photographerId: string;
  packageId?: string;
  escrowPercentage?: number;
  notes?: string;
};

export type SelectPhotographerResult = {
  bookingId: string;
  declarationId: string;
  depositAmount: number;
  currency: string;
  escrowPercentage: number;
  eventStartAt?: string;
  eventTimezone?: string;
  alreadySelected?: boolean;
};

export type ConvertToHybridRescueResult = {
  matchRequestId: string;
  status: string;
  invitedCount?: number;
};

export type HybridProfile = {
  instagramHandle?: string;
  instagramStatus: 'NONE' | 'PENDING' | 'CONNECTED' | 'NOT_FOUND';
  city?: string;
  resolvedCity?: string;
  needsCity: boolean;
  needsInstagram: boolean;
};
