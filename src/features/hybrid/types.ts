/**
 * Types for Post My Event (the hybrid booking engine). Field names are the
 * backend's DTOs. Optional fields stay undefined when the server didn't send
 * them; nothing here is filled with an invented value.
 */

export type PhotographerType = 'FREELANCER' | 'STUDIO' | 'ANY';
export type LocationCoverage = 'SAME_CITY' | 'NEARBY_CITY' | 'ANY';
export type SmartMatchTier = 'PREMIUM' | 'PREFERRED' | 'SUGGESTED' | 'ALTERNATIVE';
export type RecommendationTier = 'HIGH' | 'MEDIUM' | 'LOW' | SmartMatchTier;
export type OpportunityDeliveryPolicy = 'CLIENT' | 'PHOTOGRAPHER_PACKAGE';

export type PackageBenchmarkStats = {
  packageCount?: number;
  avgPrice?: number;
  avgHourlyRate?: number;
  avgDurationHours?: number;
  avgIncludedPhotos?: number;
  avgIncludedVideos?: number;
  avgExtraPhotoPrice?: number;
  avgExtraVideoPrice?: number;
  avgDeliveryDays?: number;
  avgLiveStreamSupplement?: number;
  avgPhotobookSupplement?: number;
};

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
  packageBenchmarks?: PackageBenchmarkStats;
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
  coverageMode?: string;
  clientType?: string;
  editedPhotos?: number;
  shortVideosQty?: number;
  shortVideosDuration?: string;
  longVideosQty?: number;
  longVideosDuration?: string;
  instantUpdates?: boolean;
  digitalDeliveryDays?: number;
  hasLiveStream?: boolean;
  allowWishInvites?: boolean;
  photoBooksQty?: number;
  photoBookSize?: string;
  photoBookPages?: string;
  photoAlbumsQty?: number;
  photoAlbumSize?: string;
  photoAlbumPrints?: string;
  wallPortraitsQty?: number;
  wallPortraitSize?: string;
  wallPortraitFrame?: string;
  printProductionTime?: string;
  printProposedDate?: string;
  printCollectionMethod?: string;
  editingStyle?: string;
  usageRights?: string;
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
  title?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
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

export type HybridDraftPayload = {
  eventId?: string;
  title?: string;
  eventType?: string;
  eventCategoryId?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  city?: string;
  venue?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  minBudget?: number;
  maxBudget?: number;
  hasLiveStream?: boolean;
  allowWishInvites?: boolean;
  minimumPhotos?: number;
  draftStep?: 1 | 2 | 3 | 4;
};

export type HybridDraftResponse = {
  id: string;
  title?: string;
  description?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  city?: string;
  venue?: string;
  location?: string;
  minBudget?: number;
  maxBudget?: number;
  eventStatus?: string;
  bookingStatus?: string;
  isPublished?: boolean;
  updatedAt?: string;
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
  matchedPackageDeliveryDays?: number;
  matchedPackageDescription?: string;
  deliveryPolicy?: OpportunityDeliveryPolicy;
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
  smartTier?: SmartMatchTier;
  /** Smart Match score out of 100, relative to the others who accepted this event. */
  matchScore?: number;
  primarySpecialty?: string;
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
  approvedAt?: string;
  deliveryPolicy?: OpportunityDeliveryPolicy;
  packageDeliveryDays?: number;
  packageDeliveryDescription?: string;
  matchedPackageId?: string;
  matchedPackageName?: string;
  matchedPackagePrice?: number;
  matchedPackageCurrency?: string;
  matchedPackagePhotos?: number;
  matchedPackageVideos?: number;
  matchedPackageHours?: number;
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
