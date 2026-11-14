import { api } from '@/api/client';
import type { CurrencyCode, CurrencyInfo } from '@/store/currency';
import { useCurrency } from '@/store/currency';
import type { ApiEnvelope } from '@/types';
import {
  getDeadlineCalendarDays,
  isExpressMajorEvent,
  type HybridOfferDraft,
} from './offerBrief';

export interface AnalyzedPhotographerPackage {
  id: string;
  packageName: string;
  photographerName: string;
  price: number;
  currency: string;
  convertedPrice: number;
  clientCurrency: CurrencyCode;
  serviceType: 'STUDIO' | 'OUTDOOR';
  durationHours: number;
  includedPhotos: number;
  includedVideos: number;
  photobookPhotos: number;
  hasLiveStream: boolean;
  hasDroneCapturing?: boolean;
  droneCapturingPrice?: number;
  deliveryDays: number;
  description: string;
  features: string[];
}

export interface BestPackageMatchRef {
  id: string;
  packageName: string;
  photographerName: string;
  originalPrice: number;
  originalCurrency: string;
  convertedPrice: number;
  clientCurrency: CurrencyCode;
  derivedItemContribution: number;
}

export interface SelectedItemPackageAnalysis {
  itemKey:
    | 'PHOTOS'
    | 'VIDEOS'
    | 'LIVE_STREAM'
    | 'DRONE_CAPTURING'
    | 'INSTANT_UPDATES'
    | 'WISHES_AND_MEMORIES'
    | 'PHOTO_BOOKS'
    | 'PHOTO_ALBUMS'
    | 'WALL_PORTRAITS';
  itemLabel: string;
  category: 'DIGITAL' | 'PRINT';
  bestThreePackages: BestPackageMatchRef[];
  averagePrice: number;
}

export interface PackageDataRecommendationResult {
  clientCurrency: CurrencyCode;
  totalPackagesSearched: number;
  sessionPackagesSearched: number;
  foreignCurrencyPackagesConverted: number;
  selectedItemsAnalysis: SelectedItemPackageAnalysis[];
  digitalItemsSummation: number;
  printItemsSummation: number;
  totalSummation: number;
  topFullScopePackagesAverage: number;
  low: number;
  recommended: number;
  priority: number;
  high: number;
  minimumAllowedBudget: number;
  isExpressMajorFloor: boolean;
}

/**
 * Fallback exchange rates per 1 USD when live /public/currencies/rates has not populated yet.
 */
const FALLBACK_RATES_PER_USD: Record<string, number> = {
  USD: 1,
  RWF: 1400,
  EUR: 0.92,
  KES: 129,
  UGX: 3700,
  TZS: 2600,
};

export type CurrenciesLookup = CurrencyInfo[] | Record<string, CurrencyInfo> | undefined;

function getRatePerUsd(code: string, currencies?: CurrenciesLookup): number {
  const upper = (code || 'RWF').trim().toUpperCase();
  if (upper === 'USD') return 1;
  const matched = Array.isArray(currencies)
    ? currencies.find((c) => c.code.toUpperCase() === upper)
    : currencies?.[upper as CurrencyCode];
  const liveRate = matched?.rate;
  if (typeof liveRate === 'number' && liveRate > 0) {
    // Backend /public/currencies/rates returns rate per 1 USD (or rate relative to base).
    // Safeguard: if RWF rate is tiny (< 10), it's inverted; otherwise it's units per 1 USD.
    if (upper === 'RWF' && liveRate < 10) {
      return 1 / liveRate;
    }
    return liveRate;
  }
  return FALLBACK_RATES_PER_USD[upper] ?? 1400;
}

/**
 * Converts an amount from any currency (e.g. USD, RWF, EUR, KES, UGX, TZS) into the client's currency.
 */
export function convertPackageCurrency(
  amount: number,
  fromCurrency: string | undefined,
  toCurrency: CurrencyCode,
  currencies?: CurrenciesLookup,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const from = (fromCurrency || 'RWF').trim().toUpperCase();
  const to = (toCurrency || 'RWF').trim().toUpperCase();
  if (from === to) return amount;

  const fromPerUsd = getRatePerUsd(from, currencies);
  const toPerUsd = getRatePerUsd(to, currencies);
  const amountInUsd = amount / fromPerUsd;
  const converted = amountInUsd * toPerUsd;
  return converted;
}

/**
 * Rounds a price cleanly for display in the target currency.
 */
export function roundForCurrency(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (currency) {
    case 'USD':
    case 'EUR':
      return Math.max(5, Math.round(amount / 5) * 5);
    case 'KES':
      return Math.max(100, Math.round(amount / 100) * 100);
    case 'UGX':
    case 'TZS':
      return Math.max(5000, Math.round(amount / 5000) * 5000);
    case 'RWF':
    default:
      return Math.max(5000, Math.round(amount / 5000) * 5000);
  }
}

/**
 * Baseline real photographer packages (Studio/Indoor and Outdoor/Events, including RWF and USD packages)
 * used to supplement live API packages when fewer than 3 packages match a specific deliverable.
 */
const BASELINE_PLATFORM_PACKAGES: Omit<
  AnalyzedPhotographerPackage,
  'convertedPrice' | 'clientCurrency'
>[] = [
  // Outdoor / Event Packages (RWF & USD)
  {
    id: 'pkg-outdoor-diamond-1',
    packageName: 'Diamond',
    photographerName: 'Legacy Studio',
    price: 1500000,
    currency: 'RWF',
    serviceType: 'OUTDOOR',
    durationHours: 10,
    includedPhotos: 500,
    includedVideos: 2,
    photobookPhotos: 300,
    hasLiveStream: true,
    hasDroneCapturing: true,
    droneCapturingPrice: 150000,
    deliveryDays: 5,
    description:
      'Photobook, Traditional Photoshoot, Wedding Video Shoot & highlights, Frame 1 = A1, Full Video & Photos soft on flash disk, Live Streaming, 2 Photographers, 2 Videographers',
    features: [
      'Photobook (300 photos)',
      'Wedding Video Shoot & highlights',
      'Frame 1 = A1 wall portrait',
      'Full Video & Photos soft on flash disk',
      'Live Streaming',
      'Add-on: Drone Capturing (+150,000 RWF)',
      'Instant wishes & guest memories',
    ],
  },
  {
    id: 'pkg-outdoor-gold-2',
    packageName: 'Gold',
    photographerName: 'Legacy Studio',
    price: 700000,
    currency: 'RWF',
    serviceType: 'OUTDOOR',
    durationHours: 8,
    includedPhotos: 300,
    includedVideos: 1,
    photobookPhotos: 200,
    hasLiveStream: false,
    hasDroneCapturing: false,
    droneCapturingPrice: 0,
    deliveryDays: 7,
    description:
      'Civil Wedding package: Photobook, 1 A2 Frame, Soft Photos on Flash Disk, Video highlight, 1 Videographer, 1 Photographer',
    features: [
      'Photobook',
      '1 A2 Frame wall portrait',
      '300 Soft Photos on Flash Disk',
      '1 Video highlight',
    ],
  },
  {
    id: 'pkg-outdoor-silver-3',
    packageName: 'Silver',
    photographerName: 'Kigali Frames Collective',
    price: 450,
    currency: 'USD',
    serviceType: 'OUTDOOR',
    durationHours: 8,
    includedPhotos: 350,
    includedVideos: 2,
    photobookPhotos: 250,
    hasLiveStream: true,
    hasDroneCapturing: true,
    droneCapturingPrice: 120,
    deliveryDays: 7,
    description:
      'Full day outdoor event coverage with 350 edited photos, 2 highlight & ceremony videos, live stream, A4 photo book & photo album, and 1 framed wall portrait.',
    features: [
      '350 edited high-resolution photos',
      '2 highlight & full ceremony videos',
      'Multi-camera live stream',
      'Add-on: Drone Capturing (+120 USD)',
      'A4 Photo book & Photo album',
      '1 Framed wall portrait (60x90 cm)',
      'Same-day instant updates',
    ],
  },
  {
    id: 'pkg-outdoor-premium-4',
    packageName: 'Premium',
    photographerName: 'Amoria Visuals',
    price: 350000,
    currency: 'RWF',
    serviceType: 'OUTDOOR',
    durationHours: 6,
    includedPhotos: 200,
    includedVideos: 1,
    photobookPhotos: 150,
    hasLiveStream: false,
    hasDroneCapturing: true,
    droneCapturingPrice: 120000,
    deliveryDays: 7,
    description:
      'Ceremony & reception coverage with 200 edited photos, video highlights, photo album, and same-day social media teasers.',
    features: [
      '200 edited photos',
      '1 video highlight',
      'Add-on: Drone Capturing (+120,000 RWF)',
      'Photo album included',
      'Same-day instant updates',
    ],
  },
  {
    id: 'pkg-outdoor-basic-5',
    packageName: 'Basic',
    photographerName: 'Vision Studio RW',
    price: 220,
    currency: 'USD',
    serviceType: 'OUTDOOR',
    durationHours: 5,
    includedPhotos: 150,
    includedVideos: 1,
    photobookPhotos: 0,
    hasLiveStream: true,
    deliveryDays: 5,
    description:
      'Outdoor ceremony & party package with 150 edited photos, 1 highlight video, live streaming, and guest wishes capture.',
    features: [
      '150 edited photos',
      '1 highlight video',
      'Live streaming',
      'Instant wishes & memories',
    ],
  },
  // Indoor / Studio Packages (RWF & USD)
  {
    id: 'pkg-indoor-diamond-1',
    packageName: 'Diamond',
    photographerName: 'Legacy Studio',
    price: 300000,
    currency: 'RWF',
    serviceType: 'STUDIO',
    durationHours: 3,
    includedPhotos: 35,
    includedVideos: 1,
    photobookPhotos: 100,
    hasLiveStream: false,
    deliveryDays: 2,
    description:
      'Creative Photos private session between 1 & 3 hrs: Makeup, Decor, Reels video, 1 A2 Frame wall portrait, Photo album, Express 2-day delivery.',
    features: [
      '35 edited studio photos',
      '1 studio reel video',
      'Photo book & album',
      '1 A2 Frame wall portrait',
      'Express 2-day instant delivery',
    ],
  },
  {
    id: 'pkg-indoor-gold-2',
    packageName: 'Gold',
    photographerName: 'Legacy Studio',
    price: 220000,
    currency: 'RWF',
    serviceType: 'STUDIO',
    durationHours: 2,
    includedPhotos: 25,
    includedVideos: 1,
    photobookPhotos: 0,
    hasLiveStream: false,
    deliveryDays: 3,
    description:
      'Platinum 25 Photos studio package: Private Shoot, Makeup for 1 person, Balloons, Small Decoration, Bonus 1 A3 Frame wall portrait.',
    features: [
      '25 edited studio photos',
      'Private shoot & makeup',
      '1 A3 Frame wall portrait',
      'Short highlight reel',
    ],
  },
  {
    id: 'pkg-indoor-silver-3',
    packageName: 'Silver',
    photographerName: 'Kigali Portrait House',
    price: 130,
    currency: 'USD',
    serviceType: 'STUDIO',
    durationHours: 2,
    includedPhotos: 20,
    includedVideos: 1,
    photobookPhotos: 50,
    hasLiveStream: false,
    deliveryDays: 3,
    description:
      'Studio portrait & family session with 20 retouched photos, 1 behind-the-scenes short video, mini photo book/album, and 1 A3 framed portrait.',
    features: [
      '20 retouched studio photos',
      '1 short video reel',
      'Mini photo book & album',
      '1 A3 framed wall portrait',
    ],
  },
];

function parseRawPackage(
  raw: Record<string, any>,
  photographerName: string,
  clientCurrency: CurrencyCode,
  currencies?: CurrenciesLookup,
): AnalyzedPhotographerPackage | null {
  const rawPrice = Number(raw.price ?? 0);
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) return null;
  if (raw.isActive === false) return null;

  const currency =
    (typeof raw.currencyAbbreviation === 'string' && raw.currencyAbbreviation.trim()) ||
    (typeof raw.currencyCode === 'string' && raw.currencyCode.trim()) ||
    (typeof raw.currency === 'string' && raw.currency.trim()) ||
    'RWF';

  const convertedPrice = convertPackageCurrency(rawPrice, currency, clientCurrency, currencies);
  if (!Number.isFinite(convertedPrice) || convertedPrice <= 0) return null;

  const features: string[] = Array.isArray(raw.features)
    ? raw.features
        .map((f: any) =>
          typeof f === 'string' ? f : typeof f?.featureName === 'string' ? f.featureName : '',
        )
        .filter(Boolean)
    : [];

  const description = typeof raw.description === 'string' ? raw.description : '';
  const combinedText = `${raw.packageName || raw.name || ''} ${description} ${features.join(' ')}`.toLowerCase();

  const rawServiceType = String(raw.serviceType || '').toUpperCase();
  const serviceType: 'STUDIO' | 'OUTDOOR' =
    rawServiceType === 'STUDIO' ||
    rawServiceType === 'INDOOR' ||
    combinedText.includes('indoor') ||
    combinedText.includes('studio')
      ? 'STUDIO'
      : 'OUTDOOR';

  const includedPhotos =
    typeof raw.includedPhotos === 'number' && raw.includedPhotos > 0
      ? raw.includedPhotos
      : serviceType === 'STUDIO'
        ? 20
        : 250;

  const includedVideos =
    typeof raw.includedVideos === 'number' && raw.includedVideos >= 0
      ? raw.includedVideos
      : /video|highlight|reel|film|cinematic/i.test(combinedText)
        ? 1
        : 0;

  const photobookPhotos =
    typeof raw.photobookPhotos === 'number' && raw.photobookPhotos >= 0
      ? raw.photobookPhotos
      : /photobook|photo book/i.test(combinedText)
        ? 200
        : 0;

  const hasLiveStream =
    Boolean(raw.hasLiveStream) || /live\s*stream|livestream/i.test(combinedText);

  let droneCapturingPrice =
    typeof raw.droneCapturingPrice === 'number' && raw.droneCapturingPrice > 0
      ? raw.droneCapturingPrice
      : 0;
  if (!droneCapturingPrice) {
    for (const fStr of features) {
      const m = fStr.match(/^Add-on:\s*Drone[^()]*\(\+?([\d,.\s]+)\s*([A-Za-z]{3})?\)/i);
      if (m) {
        const parsedDrone = parseFloat(m[1].replace(/[,\s]/g, ''));
        if (Number.isFinite(parsedDrone) && parsedDrone > 0) {
          droneCapturingPrice = Math.round(parsedDrone);
          break;
        }
      }
    }
  }
  const hasDroneCapturing = droneCapturingPrice > 0;

  const durationHours =
    typeof raw.durationHours === 'number' && raw.durationHours > 0
      ? raw.durationHours
      : serviceType === 'STUDIO'
        ? 2
        : 8;

  const deliveryDays =
    typeof raw.deliveryDays === 'number' && raw.deliveryDays > 0 ? raw.deliveryDays : 7;

  return {
    id: String(raw.id || `${photographerName}-${raw.packageName || raw.name || Math.random()}`),
    packageName: String(raw.packageName || raw.name || 'Package'),
    photographerName: photographerName || 'Verified Photographer',
    price: rawPrice,
    currency: currency.toUpperCase(),
    convertedPrice,
    clientCurrency,
    serviceType,
    durationHours,
    includedPhotos,
    includedVideos,
    photobookPhotos,
    hasLiveStream,
    hasDroneCapturing,
    droneCapturingPrice,
    deliveryDays,
    description,
    features,
  };
}

/**
 * Fetches all latest active photographer packages across the platform and converts their prices
 * into the client's currency.
 */
export async function fetchAllPlatformPackagesForPricing(
  clientCurrency: CurrencyCode,
): Promise<AnalyzedPhotographerPackage[]> {
  // Ensure latest currency rates are loaded
  try {
    await useCurrency.getState().load();
  } catch {
    // ignore if offline
  }
  const currencies = useCurrency.getState().currencies;
  const collected: AnalyzedPhotographerPackage[] = [];
  const seenIds = new Set<string>();

  try {
    const res = await api.get<ApiEnvelope<{ content?: Record<string, any>[] }>>(
      '/public/photographers/list?page=0&size=100&sortBy=createdAt&sortDir=desc',
    );
    const photographers = Array.isArray(res.data?.content) ? res.data.content : [];
    for (const p of photographers) {
      const pName =
        [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() ||
        p?.businessName ||
        'Verified Photographer';
      const pkgs = Array.isArray(p?.packages) ? p.packages : [];
      for (const rawPkg of pkgs) {
        const parsed = parseRawPackage(rawPkg, pName, clientCurrency, currencies);
        if (parsed && !seenIds.has(parsed.id)) {
          seenIds.add(parsed.id);
          collected.push(parsed);
        }
      }
    }
  } catch {
    // Fallback to baseline packages below if network call fails
  }

  // Always supplement with baseline real platform packages so every item category has >= 3 packages
  for (const base of BASELINE_PLATFORM_PACKAGES) {
    if (!seenIds.has(base.id)) {
      seenIds.add(base.id);
      collected.push({
        ...base,
        convertedPrice: convertPackageCurrency(
          base.price,
          base.currency,
          clientCurrency,
          currencies,
        ),
        clientCurrency,
      });
    }
  }

  return collected;
}

function toBestMatchRef(
  pkg: AnalyzedPhotographerPackage,
  derivedItemContribution: number,
): BestPackageMatchRef {
  return {
    id: pkg.id,
    packageName: pkg.packageName,
    photographerName: pkg.photographerName,
    originalPrice: pkg.price,
    originalCurrency: pkg.currency,
    convertedPrice: Math.round(pkg.convertedPrice),
    clientCurrency: pkg.clientCurrency,
    derivedItemContribution: Math.round(derivedItemContribution),
  };
}

function avgOf(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

/**
 * Searches through all photographer packages, selects the best 3 matching packages for EACH item
 * the user selected, converts any foreign currency (USD, EUR, KES, UGX, TZS, RWF) to the client's
 * currency, and computes the recommendation as the summation and average of the package data.
 */
export function analyzePackagesForDraft(
  draft: HybridOfferDraft,
  durationMinutes: number,
  allPackages: AnalyzedPhotographerPackage[],
  clientCurrency: CurrencyCode = 'RWF',
): PackageDataRecommendationResult {
  const currencies = useCurrency.getState().currencies;
  const normalizedPackages: AnalyzedPhotographerPackage[] = (
    allPackages.length > 0
      ? allPackages
      : BASELINE_PLATFORM_PACKAGES.map((b) => ({
          ...b,
          convertedPrice: convertPackageCurrency(b.price, b.currency, clientCurrency, currencies),
          clientCurrency,
        }))
  ).map((p) => ({
    ...p,
    convertedPrice: convertPackageCurrency(p.price, p.currency, clientCurrency, currencies),
    clientCurrency,
  }));

  const isIndoor = draft.sessionType === 'INDOOR';
  const targetServiceType = isIndoor ? 'STUDIO' : 'OUTDOOR';
  const sessionFiltered = normalizedPackages.filter((p) => p.serviceType === targetServiceType);
  const candidatePool = sessionFiltered.length >= 3 ? sessionFiltered : normalizedPackages;

  const foreignCurrencyPackagesConverted = normalizedPackages.filter(
    (p) => p.currency.toUpperCase() !== clientCurrency.toUpperCase(),
  ).length;

  const hours = Math.max(1, Math.min(24, (durationMinutes || 240) / 60));
  const selectedItemsAnalysis: SelectedItemPackageAnalysis[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DIGITAL PHOTOGRAPHY / EDITED PHOTOS (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  const requestedPhotos = draft.coverageMode === 'VIDEO' ? 0 : Math.max(0, draft.editedPhotos);
  if (requestedPhotos > 0) {
    const scoredPhotoPkgs = [...candidatePool]
      .filter((p) => p.includedPhotos > 0)
      .sort((a, b) => {
        const diffA =
          Math.abs(a.includedPhotos - requestedPhotos) / Math.max(25, requestedPhotos) +
          Math.abs(a.durationHours - hours) / Math.max(2, hours);
        const diffB =
          Math.abs(b.includedPhotos - requestedPhotos) / Math.max(25, requestedPhotos) +
          Math.abs(b.durationHours - hours) / Math.max(2, hours);
        return diffA - diffB;
      })
      .slice(0, 3);

    const bestThree = scoredPhotoPkgs.map((pkg) => {
      // Derive the photography base share from the package price, scaled gently to requested photo count & hours
      const hasHeavyExtras =
        pkg.photobookPhotos > 0 || pkg.includedVideos > 0 || pkg.hasLiveStream;
      const basePhotoShareRatio = hasHeavyExtras ? 0.56 : 0.85;
      const photoScale = Math.max(
        0.55,
        Math.min(1.55, Math.pow(requestedPhotos / Math.max(15, pkg.includedPhotos), 0.45)),
      );
      const hourScale = Math.max(
        0.65,
        Math.min(1.4, Math.pow(hours / Math.max(1, pkg.durationHours), 0.35)),
      );
      const contribution = pkg.convertedPrice * basePhotoShareRatio * photoScale * hourScale;
      return toBestMatchRef(pkg, contribution);
    });

    selectedItemsAnalysis.push({
      itemKey: 'PHOTOS',
      itemLabel: `${requestedPhotos} edited photos (${Math.round(hours)}h coverage)`,
      category: 'DIGITAL',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. SHORT & LONG VIDEO COVERAGE (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  const shortVideos = draft.coverageMode === 'PHOTOGRAPHY' ? 0 : Math.max(0, draft.shortVideosQty);
  const longVideos = draft.coverageMode === 'PHOTOGRAPHY' ? 0 : Math.max(0, draft.longVideosQty);
  const totalVideos = shortVideos + longVideos;
  if (totalVideos > 0) {
    const videoPool = [...candidatePool].sort((a, b) => {
      const aHasVideo = a.includedVideos > 0 ? 0 : 1;
      const bHasVideo = b.includedVideos > 0 ? 0 : 1;
      if (aHasVideo !== bHasVideo) return aHasVideo - bHasVideo;
      return Math.abs(a.includedVideos - totalVideos) - Math.abs(b.includedVideos - totalVideos);
    });
    const bestThreeVideoPkgs = videoPool.slice(0, 3);
    const isVideoOnly = draft.coverageMode === 'VIDEO';
    const videoShareRatio = isVideoOnly ? 0.72 : 0.24;
    const videoQtyScale = Math.max(0.75, Math.min(1.65, 0.75 + totalVideos * 0.14));

    const bestThree = bestThreeVideoPkgs.map((pkg) => {
      const contribution = pkg.convertedPrice * videoShareRatio * videoQtyScale;
      return toBestMatchRef(pkg, contribution);
    });

    const videoParts: string[] = [];
    if (shortVideos > 0) videoParts.push(`${shortVideos} short`);
    if (longVideos > 0) videoParts.push(`${longVideos} full-length`);

    selectedItemsAnalysis.push({
      itemKey: 'VIDEOS',
      itemLabel: `Video coverage (${videoParts.join(' + ')})`,
      category: 'DIGITAL',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. LIVE STREAM (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  if (draft.liveStream) {
    const livePool = [...normalizedPackages].sort((a, b) => {
      const aLive = a.hasLiveStream ? 0 : 1;
      const bLive = b.hasLiveStream ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return a.convertedPrice - b.convertedPrice;
    });
    const bestThreeLivePkgs = livePool.slice(0, 3);
    const bestThree = bestThreeLivePkgs.map((pkg) => {
      const contribution = pkg.convertedPrice * 0.16;
      return toBestMatchRef(pkg, contribution);
    });

    selectedItemsAnalysis.push({
      itemKey: 'LIVE_STREAM',
      itemLabel: 'Live stream coverage',
      category: 'DIGITAL',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3B. DRONE CAPTURING (Unique Self-Priced Add-on — Only Photographers With Amount > 0)
  // ─────────────────────────────────────────────────────────────────────────
  if (draft.droneCapturing) {
    const droneEnabledPool = [...normalizedPackages]
      .filter((p) => p.hasDroneCapturing && (p.droneCapturingPrice ?? 0) > 0)
      .sort((a, b) => (a.droneCapturingPrice ?? 0) - (b.droneCapturingPrice ?? 0));
    const bestThreeDronePkgs = (
      droneEnabledPool.length >= 3 ? droneEnabledPool : [...droneEnabledPool, ...normalizedPackages]
    ).slice(0, 3);

    const bestThree = bestThreeDronePkgs.map((pkg) => {
      const selfDroneAmount =
        pkg.droneCapturingPrice && pkg.droneCapturingPrice > 0
          ? convertPackageCurrency(pkg.droneCapturingPrice, pkg.currency, clientCurrency, currencies)
          : pkg.convertedPrice * 0.14;
      return toBestMatchRef(pkg, selfDroneAmount);
    });

    selectedItemsAnalysis.push({
      itemKey: 'DRONE_CAPTURING',
      itemLabel: 'Drone Capturing (Self-priced aerial 4K coverage)',
      category: 'DIGITAL',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. INSTANT SAME-DAY UPDATES (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  if (draft.instantUpdates) {
    const expressPool = [...candidatePool].sort((a, b) => a.deliveryDays - b.deliveryDays);
    const bestThreeExpress = expressPool.slice(0, 3);
    const bestThree = bestThreeExpress.map((pkg) => {
      const contribution = pkg.convertedPrice * 0.1;
      return toBestMatchRef(pkg, contribution);
    });

    selectedItemsAnalysis.push({
      itemKey: 'INSTANT_UPDATES',
      itemLabel: 'Instant same-day updates',
      category: 'DIGITAL',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. INSTANT WISHES & MEMORIES (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  if (draft.instantWishesAndMemories) {
    const wishesPool = [...candidatePool].sort((a, b) => {
      const aScore = a.includedVideos > 0 || a.hasLiveStream ? 0 : 1;
      const bScore = b.includedVideos > 0 || b.hasLiveStream ? 0 : 1;
      return aScore - bScore;
    });
    const bestThreeWishes = wishesPool.slice(0, 3);
    const bestThree = bestThreeWishes.map((pkg) => {
      const contribution = pkg.convertedPrice * 0.09;
      return toBestMatchRef(pkg, contribution);
    });

    selectedItemsAnalysis.push({
      itemKey: 'WISHES_AND_MEMORIES',
      itemLabel: 'Wishes & memories sharing',
      category: 'DIGITAL',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PHOTO BOOKS (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  if (draft.photoBooksQty > 0) {
    const bookPool = [...normalizedPackages].sort((a, b) => {
      const aHasBook =
        a.photobookPhotos > 0 ||
        /photobook|photo book/i.test(`${a.description} ${a.features.join(' ')}`)
          ? 0
          : 1;
      const bHasBook =
        b.photobookPhotos > 0 ||
        /photobook|photo book/i.test(`${b.description} ${b.features.join(' ')}`)
          ? 0
          : 1;
      if (aHasBook !== bHasBook) return aHasBook - bHasBook;
      return (
        Math.abs((a.photobookPhotos || 250) - draft.photoBookPhotos) -
        Math.abs((b.photobookPhotos || 250) - draft.photoBookPhotos)
      );
    });
    const bestThreeBookPkgs = bookPool.slice(0, 3);
    const sizeScale = draft.photoBookSize.includes('A3')
      ? 1.22
      : draft.photoBookSize.includes('30×30')
        ? 1.15
        : 1.0;
    const photosScale = Math.max(0.85, Math.min(1.45, draft.photoBookPhotos / 300));

    const bestThree = bestThreeBookPkgs.map((pkg) => {
      const unitBookShare = pkg.convertedPrice * 0.14 * sizeScale * photosScale;
      const contribution = unitBookShare * draft.photoBooksQty;
      return toBestMatchRef(pkg, contribution);
    });

    selectedItemsAnalysis.push({
      itemKey: 'PHOTO_BOOKS',
      itemLabel: `${draft.photoBooksQty} Photo book(s) (${draft.photoBookSize} · ${draft.photoBookPhotos} photos)`,
      category: 'PRINT',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. PHOTO ALBUMS (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  if (draft.photoAlbumsQty > 0) {
    const albumPool = [...normalizedPackages].sort((a, b) => {
      const aHasAlbum = /album|photobook/i.test(`${a.description} ${a.features.join(' ')}`) ? 0 : 1;
      const bHasAlbum = /album|photobook/i.test(`${b.description} ${b.features.join(' ')}`) ? 0 : 1;
      return aHasAlbum - bHasAlbum;
    });
    const bestThreeAlbumPkgs = albumPool.slice(0, 3);
    const parsedAlbumPrints =
      parseInt(String(draft.photoAlbumPrints).replace(/\D/g, ''), 10) || 50;
    const printsScale = Math.max(0.85, Math.min(1.4, parsedAlbumPrints / 150));

    const bestThree = bestThreeAlbumPkgs.map((pkg) => {
      const unitAlbumShare = pkg.convertedPrice * 0.12 * printsScale;
      const contribution = unitAlbumShare * draft.photoAlbumsQty;
      return toBestMatchRef(pkg, contribution);
    });

    selectedItemsAnalysis.push({
      itemKey: 'PHOTO_ALBUMS',
      itemLabel: `${draft.photoAlbumsQty} Photo album(s) (${draft.photoAlbumSize} · ${draft.photoAlbumPrints})`,
      category: 'PRINT',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. WALL PORTRAITS & FRAMES (Best 3 Packages)
  // ─────────────────────────────────────────────────────────────────────────
  if (draft.wallPortraitsQty > 0) {
    const framePool = [...normalizedPackages].sort((a, b) => {
      const aHasFrame = /frame|portrait|a0|a1|a2|a3|canvas|board/i.test(
        `${a.description} ${a.features.join(' ')}`,
      )
        ? 0
        : 1;
      const bHasFrame = /frame|portrait|a0|a1|a2|a3|canvas|board/i.test(
        `${b.description} ${b.features.join(' ')}`,
      )
        ? 0
        : 1;
      return aHasFrame - bHasFrame;
    });
    const bestThreeFramePkgs = framePool.slice(0, 3);
    const sizeScale = draft.wallPortraitSize.startsWith('70')
      ? 1.25
      : draft.wallPortraitSize.startsWith('60')
        ? 1.12
        : draft.wallPortraitSize.startsWith('50')
          ? 1.0
          : 0.85;

    const bestThree = bestThreeFramePkgs.map((pkg) => {
      const unitFrameShare = pkg.convertedPrice * 0.08 * sizeScale;
      const contribution = unitFrameShare * draft.wallPortraitsQty;
      return toBestMatchRef(pkg, contribution);
    });

    selectedItemsAnalysis.push({
      itemKey: 'WALL_PORTRAITS',
      itemLabel: `${draft.wallPortraitsQty} Wall portrait(s) (${draft.wallPortraitSize})`,
      category: 'PRINT',
      bestThreePackages: bestThree,
      averagePrice: roundForCurrency(
        avgOf(bestThree.map((b) => b.derivedItemContribution)),
        clientCurrency,
      ),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMATION & AVERAGE FROM ANALYZED PACKAGES DATA
  // ─────────────────────────────────────────────────────────────────────────
  const digitalItemsSummation = selectedItemsAnalysis
    .filter((item) => item.category === 'DIGITAL')
    .reduce((sum, item) => sum + item.averagePrice, 0);

  const printItemsSummation = selectedItemsAnalysis
    .filter((item) => item.category === 'PRINT')
    .reduce((sum, item) => sum + item.averagePrice, 0);

  const totalSummation = digitalItemsSummation + printItemsSummation;

  // Also compute the average of the top 3 overall packages that best match the user's session & photo count
  const topThreeFullPackages = [...candidatePool]
    .sort((a, b) => {
      const scoreA =
        Math.abs(a.includedPhotos - Math.max(20, requestedPhotos)) / Math.max(25, requestedPhotos || 100) +
        Math.abs(a.durationHours - hours) / Math.max(2, hours);
      const scoreB =
        Math.abs(b.includedPhotos - Math.max(20, requestedPhotos)) / Math.max(25, requestedPhotos || 100) +
        Math.abs(b.durationHours - hours) / Math.max(2, hours);
      return scoreA - scoreB;
    })
    .slice(0, 3);

  const topFullScopePackagesAverage = roundForCurrency(
    avgOf(topThreeFullPackages.map((p) => p.convertedPrice)),
    clientCurrency,
  );

  // Delivery timeline multiplier based on user's selected digital & print delivery schedule
  const calendarDays = getDeadlineCalendarDays(draft.digitalDeadline);
  const digitalUrgencyMultiplier =
    calendarDays <= 1
      ? 1.32
      : calendarDays <= 2
        ? 1.22
        : calendarDays <= 4
          ? 1.12
          : calendarDays <= 7
            ? 1.0
            : 0.94;

  const hasAnyPrintItems = printItemsSummation > 0;
  const printUrgencyMultiplier =
    hasAnyPrintItems && draft.printProductionTime === 'Express production (7–10 days)' ? 1.12 : 1.0;

  // Essential (low): deduced from the digital items summation & average (standard 14-day digital delivery, no print items)
  const rawLow = Math.max(
    digitalItemsSummation * 0.92,
    (digitalItemsSummation + topFullScopePackagesAverage * 0.55) / 1.55,
  );

  // Complete (recommended): deduced from the summation of all selected digital + print item averages
  // blended with the top 3 matched package average
  const summationAndPackageAvg =
    totalSummation > 0
      ? totalSummation * 0.72 + (topFullScopePackagesAverage + printItemsSummation) * 0.28
      : topFullScopePackagesAverage;

  const rawRecommended =
    summationAndPackageAvg * digitalUrgencyMultiplier * printUrgencyMultiplier;

  const isExpressMajorFloor = isExpressMajorEvent(draft, durationMinutes);
  const minStepIncrement = roundForCurrency(
    convertPackageCurrency(30000, 'RWF', clientCurrency, currencies),
    clientCurrency,
  );

  let low = roundForCurrency(rawLow, clientCurrency);
  let recommended = Math.max(
    low + minStepIncrement,
    roundForCurrency(rawRecommended, clientCurrency),
  );
  let priority = Math.max(
    recommended + minStepIncrement,
    roundForCurrency(recommended * 1.22, clientCurrency),
  );

  if (isExpressMajorFloor) {
    const expressFloorConverted = roundForCurrency(
      convertPackageCurrency(7000000, 'RWF', clientCurrency, currencies),
      clientCurrency,
    );
    const expressStepConverted = roundForCurrency(
      convertPackageCurrency(600000, 'RWF', clientCurrency, currencies),
      clientCurrency,
    );
    low = Math.max(low, expressFloorConverted);
    recommended = Math.max(recommended, low + expressStepConverted);
    priority = Math.max(priority, recommended + expressStepConverted);
  }

  return {
    clientCurrency,
    totalPackagesSearched: normalizedPackages.length,
    sessionPackagesSearched: candidatePool.length,
    foreignCurrencyPackagesConverted,
    selectedItemsAnalysis,
    digitalItemsSummation: roundForCurrency(digitalItemsSummation, clientCurrency),
    printItemsSummation: roundForCurrency(printItemsSummation, clientCurrency),
    totalSummation: roundForCurrency(totalSummation, clientCurrency),
    topFullScopePackagesAverage,
    low,
    recommended,
    priority,
    high: priority,
    minimumAllowedBudget: 0,
    isExpressMajorFloor,
  };
}
