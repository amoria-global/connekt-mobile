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

export const PHOTO_QUANTITY_PRESETS = [0, 100, 200] as const;
export const PHOTO_CUSTOM_OPTIONS = [30, 50, 150, 250, 300, 400, 500] as const;

export const SHORT_VIDEO_QTY_PRESETS = [0, 2, 5] as const;
export const SHORT_VIDEO_CUSTOM_OPTIONS = [1, 3, 4, 6, 8, 10] as const;
export const SHORT_VIDEO_DURATIONS = ['15s', '30s', '60s'] as const;

export const LONG_VIDEO_QTY_PRESETS = [0, 1, 2] as const;
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

export const PHOTO_BOOK_PAGES = ['20 pages', '30 pages', '40 pages', '60 pages'] as const;

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
  photoBookPages: string;

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
  startTime: '12:00',
  endTime: '18:00',
  city: 'Kigali',
  venue: '',

  coverageMode: 'BOTH',
  editedPhotos: 100,
  shortVideosQty: 2,
  shortVideosDuration: '30s',
  longVideosQty: 0,
  longVideosDuration: '15 min',
  instantUpdates: true,

  liveStream: false,
  instantWishesAndMemories: false,

  photoBooksQty: 1,
  photoBookSize: 'A4 (21 × 29.7 cm)',
  photoBookPages: '20 pages',

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
 * Returns true if the event is a Wedding, Corporate, Commercial, or Large event
 * (>= 7 hours).
 */
export function isMajorOrLargeEvent(draft: HybridOfferDraft, durationMinutes: number): boolean {
  const hours = Math.max(1, Math.round((durationMinutes || 360) / 60));
  const key = (draft.eventTypeKey || '').toLowerCase();
  const isMajorType =
    key.includes('wedding') ||
    key.includes('corporate') ||
    key.includes('commercial') ||
    key.includes('large');
  const isLargeDuration = hours >= 7;
  return isMajorType || isLargeDuration;
}

/**
 * Returns true when a Wedding, Corporate, Commercial, or Large event requests
 * digital delivery in less than 4 days — triggering the 7,000,000 RWF minimum
 * budget and pricing floor.
 */
export function isExpressMajorEvent(draft: HybridOfferDraft, durationMinutes: number): boolean {
  return isMajorOrLargeEvent(draft, durationMinutes) && getDeadlineCalendarDays(draft.digitalDeadline) < 4;
}

/**
 * Advisory price estimate in RWF based on requested coverage hours, digital
 * deliverables, live stream / instant wishes & memories sharing, print products,
 * and delivery turnaround.
 *
 * If the event is Wedding, Corporate, Commercial, or Large (>= 7h) AND digital
 * delivery is < 4 days, minimum pricing starts from RWF 7,000,000.
 */
export function estimateOfferPriceRwf(draft: HybridOfferDraft, durationMinutes: number): {
  low: number;
  recommended: number;
  priority: number;
  isSmallEventTariff: boolean;
  isExpressMajorFloor: boolean;
  minimumAllowedBudget: number;
} {
  const hours = Math.max(1, Math.round((durationMinutes || 360) / 60));
  const isSmallEventTariff = hours < 7;
  const isExpressMajorFloor = isExpressMajorEvent(draft, durationMinutes);

  // Digital-only base ("Essential" tier)
  const hourlyRate =
    draft.coverageMode === 'BOTH' ? 48000 : draft.coverageMode === 'VIDEO' ? 38000 : 32000;
  let digitalTotal = hours * hourlyRate;

  if (draft.coverageMode !== 'VIDEO') {
    digitalTotal += draft.editedPhotos * 800;
  }
  if (draft.coverageMode !== 'PHOTOGRAPHY') {
    const shortDurMult = draft.shortVideosDuration === '60s' ? 1.3 : draft.shortVideosDuration === '30s' ? 1.0 : 0.85;
    digitalTotal += Math.round(draft.shortVideosQty * 26000 * shortDurMult);

    const longDurMult = draft.longVideosDuration === '30 min' ? 1.6 : draft.longVideosDuration === '15 min' ? 1.25 : 1;
    digitalTotal += Math.round(draft.longVideosQty * 55000 * longDurMult);
  }
  if (draft.liveStream) {
    digitalTotal += 80000;
  }
  if (draft.instantWishesAndMemories) {
    digitalTotal += 30000;
  }

  // Print additions ("Complete" tier)
  let printAndExtras = 0;
  if (draft.photoBooksQty > 0) {
    const pageMult = draft.photoBookPages.startsWith('60')
      ? 1.5
      : draft.photoBookPages.startsWith('40')
        ? 1.3
        : draft.photoBookPages.startsWith('30')
          ? 1.15
          : 1;
    printAndExtras += Math.round(draft.photoBooksQty * 60000 * pageMult);
  }
  if (draft.photoAlbumsQty > 0) {
    const printMult = draft.photoAlbumPrints.startsWith('100')
      ? 1.45
      : draft.photoAlbumPrints.startsWith('80')
        ? 1.25
        : 1;
    printAndExtras += Math.round(draft.photoAlbumsQty * 55000 * printMult);
  }
  if (draft.wallPortraitsQty > 0) {
    const frameMult = draft.wallPortraitFrame === 'Unframed' ? 0.75 : 1;
    printAndExtras += Math.round(draft.wallPortraitsQty * 35000 * frameMult);
  }

  if (printAndExtras === 0) {
    printAndExtras = 60000;
  }

  let low = Math.max(50000, Math.round(digitalTotal / 10000) * 10000);
  let recommended = Math.round((low + printAndExtras) / 10000) * 10000;
  let priority = Math.round((recommended + 100000) / 10000) * 10000;

  if (isExpressMajorFloor) {
    low = Math.max(EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF, low);
    recommended = Math.max(low + Math.max(300000, printAndExtras), recommended);
    priority = Math.max(recommended + 500000, priority);
  }

  return {
    low,
    recommended,
    priority,
    isSmallEventTariff,
    isExpressMajorFloor,
    minimumAllowedBudget: isExpressMajorFloor ? EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF : 50000,
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

export function formatPhotoBookSummary(draft: Pick<HybridOfferDraft, 'photoBooksQty' | 'photoBookSize' | 'photoBookPages'>): string {
  if (!draft.photoBooksQty || draft.photoBooksQty <= 0) return 'None';
  const shortSize = draft.photoBookSize.split(' ')[0] || draft.photoBookSize;
  return `${draft.photoBooksQty} • ${shortSize} • ${draft.photoBookPages}`;
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
    const sv = `${draft.shortVideosQty} short video${draft.shortVideosQty === 1 ? '' : 's'}`;
    digitalParts.push(sv);
    completeDigitalParts.push(sv);
  }
  if (draft.coverageMode !== 'PHOTOGRAPHY' && draft.longVideosQty > 0) {
    const lv = `${draft.longVideosQty} long video${draft.longVideosQty === 1 ? '' : 's'}`;
    digitalParts.push(lv);
    completeDigitalParts.push(lv);
  }
  if (draft.liveStream) {
    digitalParts.push('Live stream');
    completeDigitalParts.push('Live stream');
  }
  if (draft.instantWishesAndMemories) {
    digitalParts.push('Instant wishes & memories');
  }

  const printParts: string[] = [];
  const completePrintParts: string[] = [];
  if (draft.photoBooksQty > 0) {
    const pb = `${draft.photoBooksQty} photo book${draft.photoBooksQty === 1 ? '' : 's'}`;
    printParts.push(pb);
    completePrintParts.push(pb);
  }
  if (draft.photoAlbumsQty > 0) {
    const pa = `${draft.photoAlbumsQty} photo album${draft.photoAlbumsQty === 1 ? '' : 's'}`;
    printParts.push(pa);
    completePrintParts.push(pa);
  }
  if (draft.wallPortraitsQty > 0) {
    printParts.push(`${draft.wallPortraitsQty} wall portrait${draft.wallPortraitsQty === 1 ? '' : 's'}`);
    const frameWord = draft.wallPortraitFrame === 'Framed' ? 'framed ' : '';
    completePrintParts.push(`${draft.wallPortraitsQty} ${frameWord}portrait${draft.wallPortraitsQty === 1 ? '' : 's'}`);
  }

  return {
    digitalLine: digitalParts.join(' • '),
    completeDigitalLine: completeDigitalParts.join(' • '),
    printLine: printParts.length > 0 ? printParts.join(' • ') : 'No print products selected',
    completePrintLine: completePrintParts.length > 0 ? completePrintParts.join(' • ') : 'Digital gallery & highlights included',
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
    photoBookLabel: '1 • A4 • 20 pages',
    photoAlbumLabel: '1 • 30 × 30 cm • 50 prints',
    wallPortraitsLabel: '2 • 60 × 90 cm • Framed',
    instantUpdatesLabel: 'Not requested',
    digitalDeliveryLabel: 'Within 7 days after the event',
    printDeliveryLabel: 'Propose production & handover date',
    packageTierLabel: 'Recommended',
    pricingDecisionLabel: 'MY_OFFER_ANYWAY',
  };

  const raw = opp.instructions?.trim();
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
