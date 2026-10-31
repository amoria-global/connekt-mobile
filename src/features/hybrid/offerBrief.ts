/**
 * Structured data model, preset options, price estimator, and brief
 * serializer/parser for the 4-page Hybrid Event Offer flow:
 *   Page 1: Event details
 *   Page 2: Coverage & print products (Digital coverage, Live stream & instant wishes & memories sharing, Print products)
 *   Page 3: Delivery & price estimate (with Recommended pricing comparison)
 *   Page 4: Review & publish
 */
import type { Ionicons } from '@expo/vector-icons';
import type { PhotographerOpportunity } from './types';
import { durationText } from './hybridUi';
import type { PackageBenchmarkStats } from './types';

export type ClientEntityType = 'INDIVIDUAL' | 'ORGANIZATION';
export type DigitalCoverageMode = 'PHOTOGRAPHY' | 'VIDEO' | 'BOTH';
export type PackageOptionTier = 'WITHIN_BUDGET' | 'RECOMMENDED' | 'PRIORITY';
export type PricingDecisionMode = 'RECOMMENDED' | 'MY_OFFER_ANYWAY';

export const EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF = 7000000;

export type EventTypePreset = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const EVENT_TYPE_PRESETS: EventTypePreset[] = [
  { key: 'Wedding', label: 'Wedding', icon: 'heart-outline' },
  { key: 'Birthday', label: 'Birthday', icon: 'gift-outline' },
  { key: 'Corporate', label: 'Corporate', icon: 'business-outline' },
  { key: 'Conference', label: 'Conference', icon: 'people-outline' },
  { key: 'Commercial', label: 'Commercial', icon: 'megaphone-outline' },
  { key: 'Fashion', label: 'Fashion', icon: 'shirt-outline' },
  { key: 'Other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export const POPULAR_VENUES_BY_CITY: Record<string, string[]> = {
  Kigali: [
    'Kigali Convention Centre',
    'BK Arena',
    'Kigali Marriott Hotel',
    'Radisson Blu Hotel Kigali',
    'Intare Conference Arena',
    'Norrsken House Kigali',
    'Heaven Restaurant & Boutique Hotel',
    'CanalOlympia Rebero',
  ],
  Musanze: ['One&Only Gorilla’s Nest', 'Tiloreza Volcanoes Ecolodge', 'Fatima Hotel Musanze'],
  Rubavu: ['Lake Kivu Serena Hotel', 'Kivu Marina Bay', 'Gorillas Lake Kivu Hotel'],
  Huye: ['Credo Hotel Huye', 'Galileo Hotel', 'Huye Stadium'],
};

export const PHOTO_QUANTITY_PRESETS = [0, 300, 400, 600] as const;
export const PHOTO_CUSTOM_OPTIONS = [100, 150, 200, 250, 500, 800, 1000] as const;

export const SHORT_VIDEO_QTY_PRESETS = [0, 2, 5] as const;
export const SHORT_VIDEO_CUSTOM_OPTIONS = [1, 3, 4, 6, 8, 10] as const;
export const SHORT_VIDEO_DURATIONS = ['15s', '30s', '60s'] as const;

export const LONG_VIDEO_QTY_PRESETS = [1, 2] as const;
export const LONG_VIDEO_CUSTOM_OPTIONS = [3, 4, 5] as const;
export const LONG_VIDEO_DURATIONS = ['5 min', '15 min', '30 min'] as const;

export const PRINT_QTY_PRESETS = [0, 1, 2] as const;
export const PRINT_QTY_CUSTOM_OPTIONS = [3, 4, 5, 10] as const;

export const PHOTO_BOOK_SIZES = [
  'A4 (21 × 29.7 cm)',
  'A5 (14.8 × 21 cm)',
  'A3 (29.7 × 42 cm)',
  '30 × 30 cm Square',
] as const;

/** How many photos go into a photo book. */
export const PHOTO_BOOK_PHOTO_PRESETS = [300, 400, 500] as const;
export const PHOTO_BOOK_PHOTO_CUSTOM_OPTIONS = [100, 150, 200, 250, 600, 800, 1000] as const;

/**
 * The width and height, in centimetres, written in a size label such as "A4 (21 × 29.7 cm)" or "60 × 90 cm".
 * The booking cards draw a paper of those proportions beside each size.
 */
export function paperDimensions(label: string): { w: number; h: number } | null {
  const m = (label || '').match(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

export const PHOTO_ALBUM_SIZES = [
  '30 × 30 cm',
  '20 × 20 cm',
  '25 × 25 cm',
  '30 × 40 cm',
] as const;

export const PHOTO_ALBUM_PRINTS = ['30 prints', '50 prints', '80 prints', '100 prints'] as const;

export const WALL_PORTRAIT_SIZES = [
  '60 × 90 cm',
  '30 × 40 cm',
  '40 × 60 cm',
  '80 × 120 cm',
] as const;

export const WALL_PORTRAIT_FRAMES = ['Framed', 'Unframed', 'Canvas wrap'] as const;

export const EDITING_STYLES = [
  'Natural & true to life',
  'Warm & cinematic',
  'Bright & airy',
  'Editorial & crisp',
] as const;

export const USAGE_RIGHTS = [
  'Personal & family',
  'Commercial & brand',
  'Social media & press',
] as const;

export const DIGITAL_DEADLINE_PRESETS = ['4 days', '7 days', '14 days'] as const;
export const DIGITAL_DEADLINE_CUSTOM_OPTIONS = ['24 hours', '2 days', '3 days', '21 days', '30 days'] as const;

export const PRINT_PRODUCTION_TIMES = [
  'Standard (7–10 days)',
  'Express (3–5 days)',
  'Flexible (14–21 days)',
  'Propose production & handover date',
] as const;

export const PRINT_COLLECTION_METHODS = [
  'Collect from photographer',
  'Deliver to my home address',
  'Handover at venue / studio',
] as const;

export type HybridOfferDraft = {
  // Page 1: Event details
  clientType: ClientEntityType;
  eventTypeKey: string;
  eventTypeId: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  venue: string;

  // Page 2: Coverage, Live Stream & Instant Wishes & Memories, and Print Products
  coverageMode: DigitalCoverageMode;
  editedPhotos: number;
  shortVideosQty: number;
  shortVideosDuration: string;
  longVideosQty: number;
  longVideosDuration: string;
  instantUpdates: boolean;

  liveStream: boolean;
  instantWishesAndMemories: boolean;

  photoBooksQty: number;
  photoBookSize: string;
  photoBookPhotos: number;

  photoAlbumsQty: number;
  photoAlbumSize: string;
  photoAlbumPrints: string;

  wallPortraitsQty: number;
  wallPortraitSize: string;
  wallPortraitFrame: string;

  editingStyle: string;
  usageRights: string;

  // Page 3: Delivery & price estimate
  digitalDeadline: string;
  printProductionTime: string;
  printProposedDate: string;
  printCollectionMethod: string;
  printDeliveryAddress: string;
  budgetMode: 'PRESET' | 'FLEXIBLE';
  minBudgetInput: string;
  maxBudgetInput: string;
  packageOption: PackageOptionTier;
  pricingDecision: PricingDecisionMode;
};

export const DEFAULT_OFFER_DRAFT: HybridOfferDraft = {
  clientType: 'INDIVIDUAL',
  eventTypeKey: 'Wedding',
  eventTypeId: '',
  date: '',
  startTime: '06:00',
  endTime: '22:00',
  city: 'Kigali',
  venue: '',

  coverageMode: 'BOTH',
  editedPhotos: 300,
  shortVideosQty: 2,
  shortVideosDuration: '30s',
  longVideosQty: 1,
  longVideosDuration: '15 min',
  instantUpdates: true,

  liveStream: false,
  instantWishesAndMemories: false,

  photoBooksQty: 1,
  photoBookSize: 'A4 (21 × 29.7 cm)',
  photoBookPhotos: 300,

  photoAlbumsQty: 0,
  photoAlbumSize: '30 × 30 cm',
  photoAlbumPrints: '50 prints',

  wallPortraitsQty: 2,
  wallPortraitSize: '60 × 90 cm',
  wallPortraitFrame: 'Framed',

  editingStyle: 'Natural & true to life',
  usageRights: 'Personal & family',

  digitalDeadline: '7 days',
  printProductionTime: 'Standard (7–10 days)',
  printProposedDate: '',
  printCollectionMethod: 'Collect from photographer',
  printDeliveryAddress: '',
  budgetMode: 'PRESET',
  minBudgetInput: '0',
  maxBudgetInput: '100,000',
  packageOption: 'RECOMMENDED',
  pricingDecision: 'MY_OFFER_ANYWAY',
};

/**
 * Parses a deadline string (e.g. '24 hours', '2 days', '4 days', '7 days')
 * into approximate calendar days.
 */
export function getDeadlineCalendarDays(deadline: string): number {
  const clean = (deadline || '').trim().toLowerCase();
  if (!clean) return 7;
  const numMatch = clean.match(/(\d+(\.\d+)?)/);
  if (!numMatch) return 7;
  const val = parseFloat(numMatch[1]);
  if (clean.includes('hour') || clean.includes('hr')) {
    return val / 24;
  }
  if (clean.includes('week') || clean.includes('wk')) {
    return val * 7;
  }
  return val;
}

/**
 * Organisations booking commercial, conference (corporate) or wedding coverage, and large events, are
 * recommended a higher budget and a fast delivery. The hours of the event play no part in this.
 */
export function isMajorOrLargeEvent(draft: HybridOfferDraft, _durationMinutes?: number): boolean {
  const key = (draft.eventTypeKey || '').toLowerCase();
  if (key.includes('large')) return true;
  if (draft.clientType !== 'ORGANIZATION') return false;
  return (
    key.includes('wedding') ||
    key.includes('conference') ||
    key.includes('corporate') ||
    key.includes('commercial')
  );
}

/**
 * True when such an event wants its photos in 4 days or less. Then the estimate starts from RWF 7,000,000.
 * That is a recommendation only: the client can offer any budget they like.
 */
export function isExpressMajorEvent(draft: HybridOfferDraft, durationMinutes: number): boolean {
  return isMajorOrLargeEvent(draft, durationMinutes) && getDeadlineCalendarDays(draft.digitalDeadline) <= 4;
}

function parseDurationSeconds(raw: string): number {
  const s = (raw || '').trim().toLowerCase();
  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  const val = numMatch ? parseFloat(numMatch[1]) : 30;
  if (s.includes('min')) return val * 60;
  if (s.includes('hour') || s.includes('hr')) return val * 3600;
  return val;
}

function parseDurationMinutes(raw: string): number {
  const s = (raw || '').trim().toLowerCase();
  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  const val = numMatch ? parseFloat(numMatch[1]) : 5;
  if (s.includes('hour') || s.includes('hr')) return val * 60;
  if (s.includes('sec') || /^\d+\s*s$/.test(s)) return Math.max(1, val / 60);
  return val;
}

function parseLeadingInt(raw: string, fallback: number): number {
  const m = (raw || '').match(/(\d+)/);
  if (!m) return fallback;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getPrintProposedLeadDays(eventDateIso: string, proposedDateIso: string): number {
  if (!proposedDateIso) return 14;
  const baseMs = eventDateIso ? Date.parse(`${eventDateIso}T00:00:00`) : Date.now();
  const propMs = Date.parse(`${proposedDateIso}T00:00:00`);
  if (!Number.isFinite(baseMs) || !Number.isFinite(propMs)) return 14;
  return Math.max(1, Math.round((propMs - baseMs) / (1000 * 60 * 60 * 24)));
}

/**
 * Advisory price estimate in RWF based on requested coverage hours, digital
 * deliverables (photos, short/long videos & durations, instant updates, editing/usage),
 * live stream, instant wishes & memories sharing, print products (books, albums,
 * wall portraits with sizes/pages/prints/frames), digital delivery deadline, and
 * print production & collection/delivery method, compared against existing
 * photographer package benchmarks.
 *
 * If the event is Wedding, Corporate, Commercial, or Large (>= 7h) AND digital
 * delivery is < 4 days, minimum pricing starts from RWF 7,000,000.
 */
export function estimateOfferPriceRwf(
  draft: HybridOfferDraft,
  durationMinutes: number,
  benchmarks?: PackageBenchmarkStats | null
): {
  low: number;
  recommended: number;
  priority: number;
  isSmallEventTariff: boolean;
  isExpressMajorFloor: boolean;
  minimumAllowedBudget: number;
} {
  const isExpressMajorFloor = isExpressMajorEvent(draft, durationMinutes);

  // Baseline from uploaded photographer packages (or calibrated RWF market averages)
  const basePkgPrice =
    benchmarks?.avgPrice && benchmarks.avgPrice > 50000 ? benchmarks.avgPrice : 260000;
  const basePkgHours =
    benchmarks?.avgDurationHours && benchmarks.avgDurationHours > 0
      ? benchmarks.avgDurationHours
      : 6;
  // The hours a client asks for do not change the estimate: it is priced as the usual package day.
  const exactHours = basePkgHours;
  const isSmallEventTariff = exactHours < 7;
  const basePkgPhotos =
    benchmarks?.avgIncludedPhotos && benchmarks.avgIncludedPhotos > 0
      ? benchmarks.avgIncludedPhotos
      : 100;
  const basePkgVideos =
    typeof benchmarks?.avgIncludedVideos === 'number' && benchmarks.avgIncludedVideos >= 0
      ? benchmarks.avgIncludedVideos
      : 1;
  const extraPhotoRate =
    benchmarks?.avgExtraPhotoPrice && benchmarks.avgExtraPhotoPrice > 0
      ? benchmarks.avgExtraPhotoPrice
      : 900;
  const extraVideoRate =
    benchmarks?.avgExtraVideoPrice && benchmarks.avgExtraVideoPrice > 0
      ? benchmarks.avgExtraVideoPrice
      : 28000;
  const liveStreamBase =
    benchmarks?.avgLiveStreamSupplement && benchmarks.avgLiveStreamSupplement > 0
      ? benchmarks.avgLiveStreamSupplement
      : 85000;

  // 1. Duration & Coverage Mode vs Package Baseline
  const hourDiffRatio = (exactHours - basePkgHours) / basePkgHours;
  const timeMult =
    hourDiffRatio >= 0
      ? 1.0 + 0.72 * hourDiffRatio
      : Math.max(0.45, 1.0 + 0.48 * hourDiffRatio);

  const modeMult =
    draft.coverageMode === 'BOTH' ? 1.15 : draft.coverageMode === 'VIDEO' ? 0.92 : 0.85;

  const evKey = (draft.eventTypeKey || '').toLowerCase();
  const eventTypeMult =
    evKey === 'wedding' || evKey === 'commercial'
      ? 1.12
      : evKey === 'corporate' || evKey === 'concert'
        ? 1.08
        : evKey === 'portrait'
          ? 0.85
          : 0.98;
  const clientTypeMult = draft.clientType === 'ORGANIZATION' ? 1.07 : 1.0;

  let digitalScope = basePkgPrice * timeMult * modeMult * eventTypeMult * clientTypeMult;

  // 2. Digital Deliverables (Edited Photos, Short Videos, Long Videos, Instant Updates, Style/Usage)
  if (draft.coverageMode !== 'VIDEO') {
    const photoDelta = draft.editedPhotos - basePkgPhotos;
    if (photoDelta > 0) {
      digitalScope += photoDelta * extraPhotoRate;
    } else if (photoDelta < 0) {
      digitalScope += Math.max(-45000, photoDelta * (extraPhotoRate * 0.45));
    }
  } else {
    digitalScope -= 25000;
  }

  if (draft.coverageMode !== 'PHOTOGRAPHY') {
    const shortSec = parseDurationSeconds(draft.shortVideosDuration);
    const shortDurFactor = Math.max(0.65, Math.min(2.6, shortSec / 30));
    const shortCost = draft.shortVideosQty * extraVideoRate * shortDurFactor;

    // Long videos are not part of the estimate.
    const totalVideoCost = shortCost;
    const includedVideoCredit = Math.min(totalVideoCost, basePkgVideos * extraVideoRate);
    digitalScope += Math.max(0, totalVideoCost - includedVideoCredit);
  }

  if (draft.instantUpdates) {
    digitalScope += 35000;
  }

  if (draft.editingStyle === 'Editorial / magazine' || draft.editingStyle === 'Cinematic') {
    digitalScope += 15000;
  }
  if (draft.usageRights === 'Full commercial buyout') {
    digitalScope *= 1.18;
  } else if (draft.usageRights === 'Social media & brand promotion') {
    digitalScope *= 1.06;
  }

  // 3. Live Stream & Instant Wishes & Memories Sharing
  if (draft.liveStream) {
    digitalScope += liveStreamBase + Math.round(exactHours * 12000);
  }
  if (draft.instantWishesAndMemories) {
    digitalScope += 35000;
  }

  // 4. Print Products (Photo Books, Photo Albums, Wall Portraits)
  let printBaseCost = 0;
  if (draft.photoBooksQty > 0) {
    const sizeStr = draft.photoBookSize.toLowerCase();
    const bookUnit = sizeStr.includes('30')
      ? 85000
      : sizeStr.includes('a5')
        ? 45000
        : 60000;
    const photos = Math.max(1, draft.photoBookPhotos || 300);
    const photoMult = Math.max(0.8, 1.0 + (photos - 300) * 0.0015);
    printBaseCost += Math.round(draft.photoBooksQty * bookUnit * photoMult);
  }

  if (draft.photoAlbumsQty > 0) {
    const sizeStr = draft.photoAlbumSize.toLowerCase();
    const albumUnit = sizeStr.includes('30')
      ? 70000
      : sizeStr.includes('20')
        ? 45000
        : 55000;
    const prints = parseLeadingInt(draft.photoAlbumPrints, 50);
    const printMult = Math.max(0.75, 1.0 + (prints - 50) * 0.01);
    printBaseCost += Math.round(draft.photoAlbumsQty * albumUnit * printMult);
  }

  if (draft.wallPortraitsQty > 0) {
    const sizeStr = draft.wallPortraitSize.toLowerCase();
    const portraitUnit = sizeStr.includes('60') && sizeStr.includes('90')
      ? 65000
      : sizeStr.includes('50')
        ? 48000
        : sizeStr.includes('30')
          ? 25000
          : 36000;
    const frameStr = draft.wallPortraitFrame.toLowerCase();
    const frameMult = frameStr.includes('unframed')
      ? 0.72
      : frameStr.includes('frameless')
        ? 0.9
        : frameStr.includes('gold')
          ? 1.2
          : 1.0;
    printBaseCost += Math.round(draft.wallPortraitsQty * portraitUnit * frameMult);
  }

  // 5. Digital Delivery Deadline & Print Delivery Turnaround Multipliers
  const deadlineDays = getDeadlineCalendarDays(draft.digitalDeadline);
  const digitalTurnaroundMult =
    deadlineDays <= 1
      ? 1.38
      : deadlineDays <= 2
        ? 1.26
        : deadlineDays <= 3
          ? 1.18
          : deadlineDays <= 4
            ? 1.12
            : deadlineDays <= 6
              ? 1.06
              : deadlineDays <= 8
                ? 1.0
                : deadlineDays <= 14
                  ? 0.93
                  : 0.89;

  let printProductionMult = 1.0;
  if (draft.printProductionTime === 'Express production (7–10 days)') {
    printProductionMult = 1.25;
  } else if (draft.printProductionTime === 'Propose production & handover date') {
    const leadDays = getPrintProposedLeadDays(draft.date, draft.printProposedDate);
    printProductionMult =
      leadDays <= 7 ? 1.35 : leadDays <= 12 ? 1.2 : leadDays <= 18 ? 1.1 : 1.0;
  }

  const hasAnyPrints =
    draft.photoBooksQty > 0 || draft.photoAlbumsQty > 0 || draft.wallPortraitsQty > 0;
  let printLogisticsFee = 0;
  if (draft.printCollectionMethod === 'Deliver to my home address') {
    printLogisticsFee = draft.printDeliveryAddress.trim().length > 0 ? 18000 : 15000;
  } else if (draft.printCollectionMethod === 'Ship by courier') {
    printLogisticsFee = 25000;
  }

  const adjustedPrintTotal = hasAnyPrints
    ? Math.round(printBaseCost * printProductionMult) + printLogisticsFee
    : 35000 + printLogisticsFee;

  // Essential: Digital-only at relaxed 14-day turnaround
  const essentialRaw = digitalScope * 0.92;
  // Complete: Full digital scope at chosen digital deadline + full print scope & print delivery
  const completeRaw = digitalScope * digitalTurnaroundMult + adjustedPrintTotal;
  // Priority: Express digital & priority print handling + dedicated fast-track crew
  const priorityDigitalMult = Math.max(digitalTurnaroundMult + 0.16, 1.24);
  const priorityPrintMult = Math.max(printProductionMult + 0.15, 1.25);
  const priorityRaw =
    digitalScope * priorityDigitalMult +
    (hasAnyPrints ? Math.round(printBaseCost * priorityPrintMult) : 45000) +
    printLogisticsFee +
    55000;

  let low = Math.max(50000, Math.round(essentialRaw / 10000) * 10000);
  let recommended = Math.max(low + 40000, Math.round(completeRaw / 10000) * 10000);
  let priority = Math.max(recommended + 60000, Math.round(priorityRaw / 10000) * 10000);

  if (isExpressMajorFloor) {
    const extraScopeAboveBaseline = Math.max(0, low - 250000);
    low = Math.round((EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF + extraScopeAboveBaseline) / 10000) * 10000;
    recommended =
      Math.round(
        Math.max(low + 450000, low + adjustedPrintTotal + (completeRaw - essentialRaw)) / 10000
      ) * 10000;
    priority =
      Math.round(Math.max(recommended + 650000, recommended + (priorityRaw - completeRaw) + 400000) / 10000) *
      10000;
  }

  return {
    low,
    recommended,
    priority,
    isSmallEventTariff,
    isExpressMajorFloor,
    // Never a requirement: any budget from RWF 50,000 can be offered.
    minimumAllowedBudget: 50000,
  };
}

export function formatCoverageModeLabel(mode: DigitalCoverageMode): string {
  if (mode === 'PHOTOGRAPHY') return 'Photography';
  if (mode === 'VIDEO') return 'Video';
  return 'Photography + video';
}

export function formatLiveStreamSummary(draft: Pick<HybridOfferDraft, 'liveStream'>): string {
  return draft.liveStream ? 'Yes' : 'Not requested';
}

export function formatInstantWishesSummary(
  draft: Pick<HybridOfferDraft, 'instantWishesAndMemories'>
): string {
  return draft.instantWishesAndMemories ? 'Yes' : 'Not requested';
}

export function formatPhotoBookSummary(draft: Pick<HybridOfferDraft, 'photoBooksQty' | 'photoBookSize' | 'photoBookPhotos'>): string {
  if (!draft.photoBooksQty || draft.photoBooksQty <= 0) return 'None';
  const shortSize = draft.photoBookSize.split(' ')[0] || draft.photoBookSize;
  return `${draft.photoBooksQty} • ${shortSize} • ${draft.photoBookPhotos} photos`;
}

export function formatPhotoAlbumSummary(draft: Pick<HybridOfferDraft, 'photoAlbumsQty' | 'photoAlbumSize' | 'photoAlbumPrints'>): string {
  if (!draft.photoAlbumsQty || draft.photoAlbumsQty <= 0) return 'None';
  return `${draft.photoAlbumsQty} • ${draft.photoAlbumSize} • ${draft.photoAlbumPrints}`;
}

export function formatWallPortraitSummary(draft: Pick<HybridOfferDraft, 'wallPortraitsQty' | 'wallPortraitSize' | 'wallPortraitFrame'>): string {
  if (!draft.wallPortraitsQty || draft.wallPortraitsQty <= 0) return 'None';
  return `${draft.wallPortraitsQty} • ${draft.wallPortraitSize} • ${draft.wallPortraitFrame}`;
}

export function formatShortVideosSummary(draft: Pick<HybridOfferDraft, 'coverageMode' | 'shortVideosQty' | 'shortVideosDuration'>): string {
  if (draft.coverageMode === 'PHOTOGRAPHY' || !draft.shortVideosQty || draft.shortVideosQty <= 0) return 'None';
  const dur = draft.shortVideosDuration.replace(/s$/, ' seconds');
  return `${draft.shortVideosQty} × ${dur}`;
}

export function formatLongVideosSummary(draft: Pick<HybridOfferDraft, 'coverageMode' | 'longVideosQty' | 'longVideosDuration'>): string {
  if (draft.coverageMode === 'PHOTOGRAPHY' || !draft.longVideosQty || draft.longVideosQty <= 0) return 'None';
  return `${draft.longVideosQty} × ${draft.longVideosDuration}`;
}

export function formatPrintHandoverSummary(
  draft: Pick<
    HybridOfferDraft,
    'printProductionTime' | 'printProposedDate' | 'printCollectionMethod' | 'printDeliveryAddress'
  >
): string {
  const prodPart =
    draft.printProductionTime === 'Propose production & handover date' && draft.printProposedDate
      ? `Proposed handover: ${draft.printProposedDate}`
      : draft.printProductionTime;

  if (draft.printCollectionMethod === 'Deliver to my home address') {
    const addr = draft.printDeliveryAddress.trim();
    return addr
      ? `${prodPart} · Deliver to home (${addr})`
      : `${prodPart} · Deliver to my home address`;
  }
  return `${prodPart} · ${draft.printCollectionMethod}`;
}

/**
 * Formats the two compact summary lines shown inside the "Your offer" card
 * and "Complete" package card on the Recommended pricing section.
 */
export function formatOfferDeliverablesSummaryLines(
  draft: HybridOfferDraft,
  durationMinutes: number
): {
  digitalLine: string;
  completeDigitalLine: string;
  printLine: string;
  completePrintLine: string;
} {
  const hours = Math.max(1, Math.round((durationMinutes || 360) / 60));
  const eventName = (draft.eventTypeKey || 'event').toLowerCase();
  const digitalParts: string[] = [`${hours}-hour ${eventName}`];
  const completeDigitalParts: string[] = [`${hours} hours`];

  if (draft.coverageMode !== 'VIDEO' && draft.editedPhotos > 0) {
    digitalParts.push(`${draft.editedPhotos} photos`);
    completeDigitalParts.push(`${draft.editedPhotos} photos`);
  }
  if (draft.coverageMode !== 'PHOTOGRAPHY' && draft.shortVideosQty > 0) {
    const sv = `${draft.shortVideosQty} short video${draft.shortVideosQty === 1 ? '' : 's'} (${draft.shortVideosDuration})`;
    digitalParts.push(sv);
    completeDigitalParts.push(sv);
  }
  if (draft.coverageMode !== 'PHOTOGRAPHY' && draft.longVideosQty > 0) {
    const lv = `${draft.longVideosQty} long video${draft.longVideosQty === 1 ? '' : 's'} (${draft.longVideosDuration})`;
    digitalParts.push(lv);
    completeDigitalParts.push(lv);
  }
  if (draft.liveStream) {
    digitalParts.push('Live stream');
    completeDigitalParts.push('Live stream');
  }
  if (draft.instantWishesAndMemories) {
    digitalParts.push('Wishes & memories');
    completeDigitalParts.push('Wishes & memories');
  }
  if (draft.instantUpdates) {
    digitalParts.push('Same-day highlights');
    completeDigitalParts.push('Same-day highlights');
  }

  const printParts: string[] = [];
  const completePrintParts: string[] = [];
  if (draft.photoBooksQty > 0) {
    const shortSize = draft.photoBookSize.split(' ')[0] || draft.photoBookSize;
    const pb = `${draft.photoBooksQty} ${shortSize} photo book${draft.photoBooksQty === 1 ? '' : 's'} (${draft.photoBookPhotos} photos)`;
    printParts.push(pb);
    completePrintParts.push(pb);
  }
  if (draft.photoAlbumsQty > 0) {
    const pa = `${draft.photoAlbumsQty} album${draft.photoAlbumsQty === 1 ? '' : 's'} (${draft.photoAlbumSize}, ${draft.photoAlbumPrints})`;
    printParts.push(pa);
    completePrintParts.push(pa);
  }
  if (draft.wallPortraitsQty > 0) {
    const frameWord = draft.wallPortraitFrame.toLowerCase().includes('unframed')
      ? 'unframed'
      : 'framed';
    const wp = `${draft.wallPortraitsQty} ${frameWord} portrait${draft.wallPortraitsQty === 1 ? '' : 's'} (${draft.wallPortraitSize})`;
    printParts.push(wp);
    completePrintParts.push(wp);
  }

  return {
    digitalLine: digitalParts.join(' • '),
    completeDigitalLine: completeDigitalParts.join(' • '),
    printLine: printParts.length > 0 ? printParts.join(' • ') : 'No print products selected',
    completePrintLine:
      completePrintParts.length > 0
        ? completePrintParts.join(' • ')
        : 'Digital gallery & highlights included',
  };
}

/**
 * Serializes the structured offer brief into a compact, human-readable string
 * stored in `instructions` so the backend delivers it to photographers in
 * `PhotographerOpportunity.instructions`.
 */
export function serializeOfferBrief(draft: HybridOfferDraft, durationMinutes: number): string {
  const parts = [
    `[OFFER_SCOPE]`,
    `Mode: ${formatCoverageModeLabel(draft.coverageMode)}`,
    `Client: ${draft.clientType === 'ORGANIZATION' ? 'Organization' : 'Individual'}`,
    `Coverage: ${durationText(durationMinutes) || '6 hours'}`,
    `Photos: ${draft.coverageMode === 'VIDEO' ? 0 : draft.editedPhotos}`,
    `ShortVideos: ${formatShortVideosSummary(draft)}`,
    `LongVideos: ${formatLongVideosSummary(draft)}`,
    `LiveStream: ${formatLiveStreamSummary(draft)}`,
    `InstantWishes: ${formatInstantWishesSummary(draft)}`,
    `PhotoBook: ${formatPhotoBookSummary(draft)}`,
    `PhotoAlbum: ${formatPhotoAlbumSummary(draft)}`,
    `WallPortraits: ${formatWallPortraitSummary(draft)}`,
    `InstantUpdates: ${draft.instantUpdates ? 'Yes (same day)' : 'Not requested'}`,
    `DigitalDelivery: Within ${draft.digitalDeadline} after the event`,
    `PrintDelivery: ${formatPrintHandoverSummary(draft)}`,
    `PackageTier: ${draft.packageOption}`,
    `PricingDecision: ${draft.pricingDecision}`,
    `Style: ${draft.editingStyle} (${draft.usageRights})`,
  ];
  return parts.join(' | ');
}

export type ParsedOfferBrief = {
  coverageModeLabel: string;
  clientTypeLabel: string;
  coverageHoursLabel: string;
  editedPhotosLabel: string;
  shortVideosLabel: string;
  longVideosLabel: string;
  liveStreamLabel: string;
  instantWishesLabel: string;
  photoBookLabel: string;
  photoAlbumLabel: string;
  wallPortraitsLabel: string;
  instantUpdatesLabel: string;
  digitalDeliveryLabel: string;
  printDeliveryLabel: string;
  packageTierLabel: string;
  pricingDecisionLabel: string;
  styleLabel?: string;
  rawNotes?: string;
};

/**
 * Parses a `PhotographerOpportunity` (including any serialized `[OFFER_SCOPE]`
 * in `instructions`) into structured fields matching Image 3 (`uploaded_media_2`).
 */
export function parseOpportunityOfferBrief(opp: PhotographerOpportunity): ParsedOfferBrief {
  const fallbackHours =
    opp.durationLabel ||
    (opp.durationHours ? `${opp.durationHours} hours` : undefined) ||
    (opp.durationMinutes ? durationText(opp.durationMinutes) : undefined) ||
    '6 hours';

  const defaults: ParsedOfferBrief = {
    coverageModeLabel: 'Photography + video',
    clientTypeLabel: 'Individual',
    coverageHoursLabel: fallbackHours,
    editedPhotosLabel: '100',
    shortVideosLabel: '2 × 30 seconds',
    longVideosLabel: 'None',
    liveStreamLabel: 'Not requested',
    instantWishesLabel: 'Not requested',
    photoBookLabel: '1 • A4 • 300 photos',
    photoAlbumLabel: '1 • 30 × 30 cm • 50 prints',
    wallPortraitsLabel: '2 • 60 × 90 cm • Framed',
    instantUpdatesLabel: 'Not requested',
    digitalDeliveryLabel: 'Within 7 days after the event',
    printDeliveryLabel: 'Propose production & handover date',
    packageTierLabel: 'Recommended',
    pricingDecisionLabel: 'MY_OFFER_ANYWAY',
  };

  const rawFull = opp.instructions?.trim();
  if (!rawFull) return defaults;
  const draftStateIdx = rawFull.indexOf('[DRAFT_STATE]');
  const raw = (draftStateIdx >= 0 ? rawFull.slice(0, draftStateIdx) : rawFull).trim();
  if (!raw) return defaults;

  if (!raw.includes('[OFFER_SCOPE]')) {
    return {
      ...defaults,
      rawNotes: raw,
    };
  }

  const map: Record<string, string> = {};
  for (const segment of raw.split('|').map((s) => s.trim())) {
    const colonIdx = segment.indexOf(':');
    if (colonIdx > 0) {
      const k = segment.slice(0, colonIdx).trim();
      const v = segment.slice(colonIdx + 1).trim();
      map[k] = v;
    }
  }

  return {
    coverageModeLabel: map.Mode || defaults.coverageModeLabel,
    clientTypeLabel: map.Client || defaults.clientTypeLabel,
    coverageHoursLabel: map.Coverage || defaults.coverageHoursLabel,
    editedPhotosLabel: map.Photos || defaults.editedPhotosLabel,
    shortVideosLabel: map.ShortVideos || defaults.shortVideosLabel,
    longVideosLabel: map.LongVideos || defaults.longVideosLabel,
    liveStreamLabel: map.LiveStream || defaults.liveStreamLabel,
    instantWishesLabel: map.InstantWishes || map.InstantMemory || defaults.instantWishesLabel,
    photoBookLabel: map.PhotoBook || defaults.photoBookLabel,
    photoAlbumLabel: map.PhotoAlbum || defaults.photoAlbumLabel,
    wallPortraitsLabel: map.WallPortraits || defaults.wallPortraitsLabel,
    instantUpdatesLabel: map.InstantUpdates || defaults.instantUpdatesLabel,
    digitalDeliveryLabel: map.DigitalDelivery || defaults.digitalDeliveryLabel,
    printDeliveryLabel: map.PrintDelivery || defaults.printDeliveryLabel,
    packageTierLabel: map.PackageTier || defaults.packageTierLabel,
    pricingDecisionLabel: map.PricingDecision || defaults.pricingDecisionLabel,
    styleLabel: map.Style,
  };
}

/**
 * Serializes both the readable `[OFFER_SCOPE]` brief and the full JSON draft state
 * (including the wizard step) so drafts saved on the backend can be resumed losslessly.
 */
export function serializeDraftOfferDescription(
  draft: HybridOfferDraft,
  durationMinutes: number,
  step: 1 | 2 | 3 | 4 | 5
): string {
  const brief = serializeOfferBrief(draft, durationMinutes);
  const stateJson = JSON.stringify({ step, draft });
  return `${brief}\n[DRAFT_STATE]${stateJson}`;
}

/**
 * Restores a `HybridOfferDraft` and wizard step from an event description saved via
 * `serializeDraftOfferDescription`.
 */
export function deserializeDraftOfferDescription(
  description?: string | null
): { step: 1 | 2 | 3 | 4 | 5; draft: HybridOfferDraft } | null {
  if (!description) return null;
  const idx = description.indexOf('[DRAFT_STATE]');
  if (idx < 0) return null;
  const jsonPart = description.slice(idx + '[DRAFT_STATE]'.length).trim();
  if (!jsonPart) return null;
  try {
    const parsed = JSON.parse(jsonPart) as {
      step?: number;
      draft?: Partial<HybridOfferDraft>;
    };
    if (!parsed || typeof parsed !== 'object' || !parsed.draft) return null;
    const rawStep = Number(parsed.step);
    const step: 1 | 2 | 3 | 4 | 5 =
      rawStep === 2 || rawStep === 3 || rawStep === 4 || rawStep === 5 ? rawStep : 1;
    return {
      step,
      draft: {
        ...DEFAULT_OFFER_DRAFT,
        ...parsed.draft,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Strips any `[DRAFT_STATE]` suffix from an event description for clean display.
 */
export function stripDraftStateFromDescription(description?: string | null): string {
  if (!description) return '';
  const idx = description.indexOf('[DRAFT_STATE]');
  return (idx >= 0 ? description.slice(0, idx) : description).trim();
}

export function hasOfferScopeBrief(text?: string | null): boolean {
  return typeof text === 'string' && text.includes('[OFFER_SCOPE]');
}

export function parseEventOfferBrief(
  text?: string | null,
  fallbackHours = '6 hours',
): ParsedOfferBrief | null {
  if (!hasOfferScopeBrief(text)) return null;
  return parseOpportunityOfferBrief(({
    candidateId: '',
    eventId: '',
    instructions: text ?? undefined,
    durationLabel: fallbackHours,
  }) as PhotographerOpportunity);
}

export function cleanEventDescription(description?: string | null): string {
  const withoutDraft = stripDraftStateFromDescription(description);
  if (!withoutDraft) return '';
  if (!withoutDraft.includes('[OFFER_SCOPE]')) return withoutDraft;

  const map: Record<string, string> = {};
  const freeLines: string[] = [];
  for (const segment of withoutDraft.split('|').map((s) => s.trim())) {
    if (!segment || segment === '[OFFER_SCOPE]') continue;
    const colonIdx = segment.indexOf(':');
    if (colonIdx > 0) {
      const k = segment.slice(0, colonIdx).trim();
      const v = segment.slice(colonIdx + 1).trim();
      map[k] = v;
    } else {
      freeLines.push(segment);
    }
  }
  return (map.Notes || freeLines.join(' ')).trim();
}
