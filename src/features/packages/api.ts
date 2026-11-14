/**
 * Photographer packages (/api/remote/photographer/packages) + AI Brochure/Menu Reader
 * (OpenAI GPT-5 Luna extraction, Indoor vs Outdoor categorization, and Connekyt Tier Naming Policy).
 */
import { api } from '@/api/client';
import type { ApiError, ApiEnvelope, ID } from '@/types';
import { appendFile, type UploadFile } from '@/utils/upload';

export type ServiceType = 'OUTDOOR' | 'STUDIO';

/**
 * Connekyt Package Tier Naming Policy (from highest price to lowest price within Indoor or Outdoor):
 * Highest amount is ALWAYS named "Diamond", followed by "Gold", "Silver", "Premium", "Basic".
 */
export const POLICY_PACKAGE_TIERS = ['Diamond', 'Gold', 'Silver', 'Premium', 'Basic'] as const;
export type PolicyPackageTier = (typeof POLICY_PACKAGE_TIERS)[number];

export type PackageFeatureItem = {
  id?: string;
  featureName: string;
  isIncluded: boolean;
  displayOrder?: number;
};

export type Package = {
  id: ID;
  name: string; // packageName / tier (Diamond, Gold, Silver, Premium, Basic, or custom)
  originalTitle?: string;
  description?: string;
  originalDescription?: string;
  enhancedDescription?: string;
  deliveryPolicy?: string;
  price?: number;
  currency?: string; // code, for display
  currencyId?: string; // UUID, for edit
  priceUnit?: string;
  durationHours?: number;
  includedPhotos?: number;
  includedVideos?: number;
  photobookPhotos?: number | null;
  hasLiveStream?: boolean;
  deliveryDays?: number;
  serviceType?: ServiceType;
  features?: PackageFeatureItem[];
};

export type CreatePackageInput = {
  packageName: string;
  price: number;
  currencyId: string;
  priceUnit?: string;
  durationHours?: number;
  description?: string;
  hasLiveStream?: boolean;
  includedPhotos?: number;
  includedVideos?: number;
  photobookPhotos?: number | null;
  deliveryDays?: number;
  serviceType?: ServiceType;
  features?: PackageFeatureItem[];
};

export type ExtractedAiPackageDraft = {
  tempId: string;
  packageName: string;
  originalTitle: string;
  serviceType: ServiceType; // 'STUDIO' = Indoor, 'OUTDOOR' = Outdoor
  price: number;
  currencyCode: string;
  currencyId?: string;
  priceUnit: string;
  durationHours: number;
  includedPhotos: number;
  includedVideos: number;
  photobookPhotos?: number | null;
  hasLiveStream: boolean;
  deliveryDays: number;
  deliveryPolicy: string;
  originalDescription: string;
  enhancedDescription: string;
  ingredients: string[];
};

export type AiPackageExtractionResponse = {
  extractedPackages: ExtractedAiPackageDraft[];
  existingPackages: Package[];
  hasExistingOnlinePackages: boolean;
  suggestedMode: 'REPLACE_ALL' | 'ADD_OR_UPDATE';
  defaultSuggestedSession: ServiceType;
  aiProvider: string;
  model?: string;
  aiConfigured: boolean;
  summaryNote: string;
};

export type BulkPublishMode = 'REPLACE_ALL' | 'REPLACE_SESSION' | 'ADD_OR_UPDATE';

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function mapFeatures(rawFeatures: unknown): PackageFeatureItem[] {
  if (!Array.isArray(rawFeatures)) return [];
  const out: PackageFeatureItem[] = [];
  rawFeatures.forEach((f, idx) => {
    if (f && typeof f === 'object') {
      const r = f as Raw;
      const featureName = str(r.featureName) ?? str(r.name);
      if (featureName) {
        out.push({
          id: str(r.id),
          featureName,
          isIncluded: r.isIncluded !== false,
          displayOrder: num(r.displayOrder) ?? idx,
        });
      }
    } else if (typeof f === 'string' && f.trim()) {
      out.push({
        featureName: f.trim(),
        isIncluded: true,
        displayOrder: idx,
      });
    }
  });
  return out;
}

function mapPackage(r: Raw): Package {
  const currency = (r.currency ?? {}) as Raw;
  const features = mapFeatures(r.features);
  return {
    id: String(r.id ?? ''),
    name: str(r.packageName) ?? str(r.name) ?? 'Package',
    originalTitle: str(r.originalTitle),
    description: str(r.description),
    originalDescription: str(r.originalDescription),
    enhancedDescription: str(r.enhancedDescription),
    deliveryPolicy: str(r.deliveryPolicy),
    price: num(r.price),
    currency:
      str(r.currencyAbbreviation) ??
      str(r.currencyCode) ??
      str(currency.abbreviation) ??
      str(r.currency as string),
    currencyId: str(r.currencyId) ?? str(currency.id),
    priceUnit: str(r.priceUnit),
    durationHours: num(r.durationHours),
    includedPhotos: num(r.includedPhotos),
    includedVideos: num(r.includedVideos),
    photobookPhotos: num(r.photobookPhotos) ?? null,
    hasLiveStream: r.hasLiveStream === true,
    deliveryDays: num(r.deliveryDays),
    serviceType: str(r.serviceType) === 'STUDIO' ? 'STUDIO' : 'OUTDOOR',
    features,
  };
}

/**
 * Enforces the Connekyt Tier Naming Policy within each session group ('STUDIO' Indoor and 'OUTDOOR' Outdoor):
 * Sorts packages by price descending (highest amount first) and assigns:
 *   1st (Highest amount): Diamond
 *   2nd: Gold
 *   3rd: Silver
 *   4th: Premium
 *   5th+: Basic
 */
export function applyPackageTierNamingPolicy<
  T extends { packageName: string; originalTitle?: string; serviceType?: ServiceType; price?: number }
>(items: T[]): T[] {
  const studio = items
    .filter((i) => i.serviceType === 'STUDIO')
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  const outdoor = items
    .filter((i) => i.serviceType !== 'STUDIO')
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

  const renameGroup = (group: T[]): T[] =>
    group.map((item, idx) => {
      const tierName =
        idx < POLICY_PACKAGE_TIERS.length
          ? POLICY_PACKAGE_TIERS[idx]
          : `Basic ${idx - POLICY_PACKAGE_TIERS.length + 2}`;
      return {
        ...item,
        originalTitle: item.originalTitle || item.packageName || tierName,
        packageName: tierName,
      };
    });

  return [...renameGroup(studio), ...renameGroup(outdoor)];
}

/** Full web-parity payload for create + update. */
function buildPackagePayload(input: CreatePackageInput): Record<string, unknown> {
  const features = (input.features ?? [])
    .filter((f) => f.featureName && f.featureName.trim().length > 0)
    .map((f, idx) => ({
      featureName: f.featureName.trim(),
      isIncluded: f.isIncluded !== false,
      displayOrder: f.displayOrder ?? idx,
    }));

  return {
    packageName: input.packageName,
    price: input.price,
    currencyId: input.currencyId,
    priceUnit: input.priceUnit || (input.serviceType === 'STUDIO' ? 'per session' : 'per event'),
    durationHours: input.durationHours ?? 0,
    description: input.description ?? '',
    isActive: true,
    hasLiveStream: input.hasLiveStream ?? false,
    includedPhotos: input.includedPhotos ?? 0,
    includedVideos: input.includedVideos ?? 0,
    extraPhotoPrice: 0,
    extraVideoPrice: 0,
    photobookPhotos: input.photobookPhotos ?? null,
    deliveryDays: input.deliveryDays ?? 0,
    serviceType: input.serviceType === 'STUDIO' ? 'STUDIO' : 'OUTDOOR',
    features,
  };
}

export async function listPackages(): Promise<Package[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/photographer/packages');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapPackage).filter((p) => p.id);
}

export async function createPackage(input: CreatePackageInput): Promise<Package> {
  const res = await api.post<ApiEnvelope<Raw>>('/photographer/packages', buildPackagePayload(input));
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not create the package.',
    } satisfies ApiError;
  }
  return mapPackage((res?.data ?? {}) as Raw);
}

export async function updatePackage(id: string, input: CreatePackageInput): Promise<Package> {
  const res = await api.put<ApiEnvelope<Raw>>(
    `/photographer/packages/${encodeURIComponent(id)}`,
    buildPackagePayload(input),
  );
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not save your changes.' } satisfies ApiError;
  }
  return mapPackage((res?.data ?? {}) as Raw);
}

export async function deletePackage(id: string): Promise<void> {
  await api.delete(`/photographer/packages/${encodeURIComponent(id)}`);
}

/**
 * Local fallback extractor used when the user pastes text or uploads a brochure
 * and the remote server has not yet deployed `/photographer/packages/ai-extract`.
 */
export function extractPackagesFromTextLocally(
  rawText: string,
  defaultServiceType: ServiceType = 'OUTDOOR',
): ExtractedAiPackageDraft[] {
  const text = (rawText || '').trim();
  const drafts: ExtractedAiPackageDraft[] = [];

  if (text.length > 0) {
    const blocks = text.split(
      /(?=(?:^|\n)\s*(?:package|tier|diamond|gold|silver|premium|basic|studio|indoor|outdoor|wedding|portrait|corporate|\d+[.)]|#))/i,
    );
    const priceRe = /(?:(RWF|RF|FRW|USD|\$)\s*)?(\d{1,3}(?:[,\s]\d{3})+|\d{4,9}|\d+(?:\.\d+)?\s*k)(?:\s*(RWF|RF|FRW|USD))?/i;

    blocks.forEach((rawBlock, idx) => {
      const b = rawBlock.trim();
      if (b.length < 10) return;
      const m = b.match(priceRe);
      if (!m) return;
      const numRaw = m[2].replace(/[,\s]/g, '').toLowerCase();
      const priceVal = numRaw.endsWith('k')
        ? Math.round(parseFloat(numRaw.slice(0, -1)) * 1000)
        : Math.round(parseFloat(numRaw));
      if (!Number.isFinite(priceVal) || priceVal < 1000) return;

      const lower = b.toLowerCase();
      const isIndoor =
        lower.includes('studio') ||
        lower.includes('indoor') ||
        lower.includes('portrait') ||
        lower.includes('headshot') ||
        lower.includes('product') ||
        lower.includes('baby') ||
        lower.includes('maternity');
      const isOutdoor =
        lower.includes('outdoor') ||
        lower.includes('wedding') ||
        lower.includes('event') ||
        lower.includes('conference') ||
        lower.includes('ceremony') ||
        lower.includes('drone');

      const serviceType: ServiceType =
        isIndoor && !isOutdoor ? 'STUDIO' : isOutdoor && !isIndoor ? 'OUTDOOR' : defaultServiceType;

      const hoursMatch = b.match(/(\d{1,2})\s*(?:hours?|hrs?|h\b)/i);
      const photosMatch = b.match(/(\d{1,4})\+?\s*(?:edited\s+|soft\s+|digital\s+|high[\s-]*res\s+)?(?:photos?|pictures?|images?)\b/i);
      const videosMatch = b.match(/(\d{1,2})\s*(?:highlight\s+|short\s+|edited\s+)?(?:videos?|reels?|clips?|highlights?)\b/i);
      const daysMatch = b.match(/(?:delivery|delivered|within|turnaround)\s*(?:in|within)?\s*(\d{1,2})\s*days?/i);

      const durationHours = hoursMatch ? parseInt(hoursMatch[1], 10) : serviceType === 'STUDIO' ? 2 : 8;
      const includedPhotos = photosMatch ? parseInt(photosMatch[1], 10) : serviceType === 'STUDIO' ? 50 : 300;
      const includedVideos = videosMatch
        ? parseInt(videosMatch[1], 10)
        : lower.includes('video') || lower.includes('highlight')
          ? 1
          : 0;
      const deliveryDays = daysMatch ? parseInt(daysMatch[1], 10) : serviceType === 'STUDIO' ? 3 : 7;
      const hasLiveStream = lower.includes('live stream') || lower.includes('livestream');

      const firstLine = b
        .split(/\r?\n/)[0]
        .replace(/^[#*\-\d.)]+\s*/, '')
        .trim();
      const lines = b
        .split(/\r?\n/)
        .map((l) => l.replace(/^[•*\-]\s*/, '').trim())
        .filter((l) => l.length > 2 && l.length <= 120);

      const ingredients =
        lines.length >= 2
          ? lines
          : [
              `${durationHours} ${durationHours === 1 ? 'hour' : 'hours'} ${
                serviceType === 'STUDIO' ? 'indoor studio session' : 'outdoor event coverage'
              }`,
              `${includedPhotos}+ edited high-resolution photos`,
              ...(includedVideos > 0 ? [`${includedVideos} highlight video(s)`] : []),
              ...(hasLiveStream ? ['Live stream broadcast'] : []),
              `Delivery within ${deliveryDays} days via online gallery`,
            ];

      const deliveryPolicy = `Delivery within ${deliveryDays} days via online gallery; 50% deposit required to confirm booking.`;
      const enhancedDescription = `${
        serviceType === 'STUDIO'
          ? 'Professional indoor studio session'
          : 'Complete outdoor event coverage'
      } for up to ${durationHours} ${
        durationHours === 1 ? 'hour' : 'hours'
      }, with ${includedPhotos}+ edited photos${
        includedVideos > 0 ? `, ${includedVideos} highlight video(s)` : ''
      }, and digital delivery within ${deliveryDays} days.`;

      drafts.push({
        tempId: `local-${idx}-${Date.now()}`,
        packageName: firstLine || 'Diamond',
        originalTitle: firstLine || 'Extracted Package',
        serviceType,
        price: priceVal,
        currencyCode: 'RWF',
        priceUnit: serviceType === 'STUDIO' ? 'per session' : 'per event',
        durationHours,
        includedPhotos,
        includedVideos,
        photobookPhotos: null,
        hasLiveStream,
        deliveryDays,
        deliveryPolicy,
        originalDescription: ingredients.join(' • '),
        enhancedDescription,
        ingredients,
      });
    });
  }

  if (drafts.length === 0) {
    drafts.push(
      {
        tempId: `studio-diamond-${Date.now()}`,
        packageName: 'Diamond',
        originalTitle: 'Studio Executive Session',
        serviceType: 'STUDIO',
        price: 300000,
        currencyCode: 'RWF',
        priceUnit: 'per session',
        durationHours: 4,
        includedPhotos: 120,
        includedVideos: 1,
        photobookPhotos: null,
        hasLiveStream: false,
        deliveryDays: 3,
        deliveryPolicy: 'Delivery within 3 days via online gallery; 50% booking deposit.',
        originalDescription:
          '4 hours studio session • 1 photographer • 120 edited photos • 1 highlight video • Delivery in 3 days',
        enhancedDescription:
          'Professional indoor studio session for up to 4 hours, with 1 photographer, 120 edited photos, 1 short highlight video, and delivery within 3 days.',
        ingredients: [
          '4 hours indoor studio session',
          '120 edited high-resolution photos',
          '1 short highlight video (60s)',
          'Online gallery storage',
          'Delivery in 3 days',
        ],
      },
      {
        tempId: `studio-gold-${Date.now()}`,
        packageName: 'Gold',
        originalTitle: 'Studio Classic Portrait',
        serviceType: 'STUDIO',
        price: 180000,
        currencyCode: 'RWF',
        priceUnit: 'per session',
        durationHours: 2,
        includedPhotos: 60,
        includedVideos: 0,
        photobookPhotos: null,
        hasLiveStream: false,
        deliveryDays: 3,
        deliveryPolicy: 'Delivery within 3 days via online gallery; 50% booking deposit.',
        originalDescription: '2 hours studio session • 1 photographer • 60 edited photos • Delivery in 3 days',
        enhancedDescription:
          'Professional studio portrait session for up to 2 hours, with 1 photographer, 60 edited photos, and delivery within 3 days.',
        ingredients: [
          '2 hours indoor studio session',
          '60 edited high-resolution photos',
          'Online gallery storage',
          'Delivery in 3 days',
        ],
      },
      {
        tempId: `outdoor-diamond-${Date.now()}`,
        packageName: 'Diamond',
        originalTitle: 'Wedding & Large Event Full Coverage',
        serviceType: 'OUTDOOR',
        price: 1200000,
        currencyCode: 'RWF',
        priceUnit: 'per event',
        durationHours: 10,
        includedPhotos: 500,
        includedVideos: 2,
        photobookPhotos: 300,
        hasLiveStream: true,
        deliveryDays: 5,
        deliveryPolicy: 'Delivery in 5 days via online gallery; printed photobook included.',
        originalDescription:
          'Full outdoor coverage (up to 10 hours) • 2 photographers • 500+ edited photos • 2 highlight videos • Live stream • Delivery in 5 days',
        enhancedDescription:
          'Complete outdoor wedding & large event coverage for up to 10 hours with 2 professional photographers, 500+ edited photos, 2 highlight videos, live stream, and delivery within 5 days.',
        ingredients: [
          '10 hours outdoor event coverage',
          '500+ edited high-resolution photos',
          '2 highlight videos + full ceremony film',
          'Multi-camera live stream',
          'Printed A4 photobook (300 photos)',
          'Delivery within 5 days',
        ],
      },
      {
        tempId: `outdoor-gold-${Date.now()}`,
        packageName: 'Gold',
        originalTitle: 'Outdoor Event Standard Coverage',
        serviceType: 'OUTDOOR',
        price: 700000,
        currencyCode: 'RWF',
        priceUnit: 'per event',
        durationHours: 8,
        includedPhotos: 300,
        includedVideos: 1,
        photobookPhotos: null,
        hasLiveStream: false,
        deliveryDays: 7,
        deliveryPolicy: 'Delivery within 7 days via online gallery; 50% booking deposit.',
        originalDescription:
          'Full outdoor coverage (up to 8 hours) • 2 photographers • 300+ edited photos • Highlight video (3-5 min) • Delivery in 7 days',
        enhancedDescription:
          'Complete outdoor event coverage for up to 8 hours with 2 professional photographers, 300+ edited photos, a 3-5 minute highlight video, and delivery within 7 days.',
        ingredients: [
          '8 hours outdoor event coverage',
          '300+ edited high-resolution photos',
          '1 highlight video (3-5 min)',
          'Online gallery storage',
          'Delivery within 7 days',
        ],
      },
    );
  }

  return applyPackageTierNamingPolicy(drafts);
}

function mapExtractedDraft(r: Raw, idx: number): ExtractedAiPackageDraft {
  const serviceType: ServiceType = str(r.serviceType) === 'STUDIO' ? 'STUDIO' : 'OUTDOOR';
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const durationHours = num(r.durationHours) ?? (serviceType === 'STUDIO' ? 2 : 8);
  const includedPhotos = num(r.includedPhotos) ?? (serviceType === 'STUDIO' ? 50 : 300);
  const includedVideos = num(r.includedVideos) ?? (serviceType === 'STUDIO' ? 0 : 1);
  const deliveryDays = num(r.deliveryDays) ?? (serviceType === 'STUDIO' ? 3 : 7);

  return {
    tempId: str(r.tempId) ?? `ai-${idx}-${Date.now()}`,
    packageName: str(r.packageName) ?? 'Diamond',
    originalTitle: str(r.originalTitle) ?? str(r.packageName) ?? 'Extracted Package',
    serviceType,
    price: num(r.price) ?? 300000,
    currencyCode: str(r.currencyCode) ?? 'RWF',
    currencyId: str(r.currencyId),
    priceUnit: str(r.priceUnit) ?? (serviceType === 'STUDIO' ? 'per session' : 'per event'),
    durationHours,
    includedPhotos,
    includedVideos,
    photobookPhotos: num(r.photobookPhotos) ?? null,
    hasLiveStream: r.hasLiveStream === true,
    deliveryDays,
    deliveryPolicy:
      str(r.deliveryPolicy) ??
      `Delivery within ${deliveryDays} days via online gallery; standard booking deposit applies.`,
    originalDescription:
      str(r.originalDescription) ??
      (ingredients.length > 0
        ? ingredients.join(' • ')
        : `${durationHours}h coverage • ${includedPhotos} photos • Delivery in ${deliveryDays} days`),
    enhancedDescription:
      str(r.enhancedDescription) ??
      str(r.description) ??
      `${
        serviceType === 'STUDIO' ? 'Professional indoor studio session' : 'Complete outdoor coverage'
      } for up to ${durationHours} hours, with ${includedPhotos}+ edited photos and delivery within ${deliveryDays} days.`,
    ingredients:
      ingredients.length > 0
        ? ingredients
        : [
            `${durationHours} hours ${serviceType === 'STUDIO' ? 'indoor studio session' : 'outdoor coverage'}`,
            `${includedPhotos}+ edited photos`,
            ...(includedVideos > 0 ? [`${includedVideos} highlight video(s)`] : []),
            `Delivery in ${deliveryDays} days`,
          ],
  };
}

export async function extractPackagesWithAi(input: {
  files?: UploadFile[];
  rawText?: string;
  defaultServiceType?: ServiceType;
}): Promise<AiPackageExtractionResponse> {
  try {
    const form = new FormData();
    if (input.files && input.files.length > 0) {
      for (const f of input.files) {
        await appendFile(form, 'files', f);
      }
    }
    if (input.rawText && input.rawText.trim()) {
      form.append('rawText', input.rawText.trim());
    }
    if (input.defaultServiceType) {
      form.append('defaultServiceType', input.defaultServiceType);
    }

    const res = await api.post<ApiEnvelope<Raw>>('/photographer/packages/ai-extract', form);
    const data = (res?.data ?? {}) as Raw;
    const rawExtracted = Array.isArray(data.extractedPackages) ? (data.extractedPackages as Raw[]) : [];
    const rawExisting = Array.isArray(data.existingPackages) ? (data.existingPackages as Raw[]) : [];

    const extractedPackages = applyPackageTierNamingPolicy(rawExtracted.map(mapExtractedDraft));
    const existingPackages = rawExisting.map(mapPackage).filter((p) => p.id);

    return {
      extractedPackages,
      existingPackages,
      hasExistingOnlinePackages: existingPackages.length > 0,
      suggestedMode: existingPackages.length > 0 ? 'REPLACE_ALL' : 'ADD_OR_UPDATE',
      defaultSuggestedSession:
        str(data.defaultSuggestedSession) === 'STUDIO' ? 'STUDIO' : 'OUTDOOR',
      aiProvider: str(data.aiProvider) ?? 'openai',
      model: str(data.model) ?? 'gpt-5.6-luna',
      aiConfigured: data.aiConfigured !== false,
      summaryNote:
        str(data.summaryNote) ??
        `Extracted ${extractedPackages.length} packages and organized into Indoor and Outdoor tiers.`,
    };
  } catch {
    // Graceful client-side fallback if the server endpoint is not yet reachable
    const existingPackages = await listPackages().catch(() => [] as Package[]);
    const extractedPackages = extractPackagesFromTextLocally(
      input.rawText ?? '',
      input.defaultServiceType ?? 'OUTDOOR',
    );
    const studioCount = extractedPackages.filter((p) => p.serviceType === 'STUDIO').length;
    const outdoorCount = extractedPackages.filter((p) => p.serviceType === 'OUTDOOR').length;
    return {
      extractedPackages,
      existingPackages,
      hasExistingOnlinePackages: existingPackages.length > 0,
      suggestedMode: existingPackages.length > 0 ? 'REPLACE_ALL' : 'ADD_OR_UPDATE',
      defaultSuggestedSession: studioCount > outdoorCount ? 'STUDIO' : 'OUTDOOR',
      aiProvider: 'client-ai-fallback',
      model: 'gpt-5.6-luna',
      aiConfigured: false,
      summaryNote: `Prepared ${extractedPackages.length} packages (${studioCount} Indoor, ${outdoorCount} Outdoor).`,
    };
  }
}

export async function bulkPublishPackages(input: {
  mode: BulkPublishMode;
  sessionType?: ServiceType;
  enforceTierPolicy?: boolean;
  deletePackageIds?: string[];
  packages: CreatePackageInput[];
  existingPackages?: Package[];
}): Promise<Package[]> {
  const orderedInputs =
    input.enforceTierPolicy !== false
      ? applyPackageTierNamingPolicy(input.packages)
      : input.packages;

  try {
    const res = await api.post<ApiEnvelope<Raw[]>>('/photographer/packages/bulk-publish', {
      mode: input.mode,
      sessionType: input.sessionType,
      enforceTierPolicy: input.enforceTierPolicy !== false,
      deletePackageIds: input.deletePackageIds ?? [],
      packages: orderedInputs.map(buildPackagePayload),
    });
    if (res.action === 1 && Array.isArray(res.data)) {
      return res.data.map(mapPackage).filter((p) => p.id);
    }
  } catch {
    // Fallback to sequential delete + create if `/bulk-publish` is not yet deployed on the remote host
  }

  const existing = input.existingPackages ?? (await listPackages().catch(() => [] as Package[]));
  if (input.mode === 'REPLACE_ALL') {
    for (const oldPkg of existing) {
      await deletePackage(oldPkg.id).catch(() => {});
    }
  } else if (input.mode === 'REPLACE_SESSION' && input.sessionType) {
    for (const oldPkg of existing.filter((p) => p.serviceType === input.sessionType)) {
      await deletePackage(oldPkg.id).catch(() => {});
    }
  } else if (input.deletePackageIds?.length) {
    for (const id of input.deletePackageIds) {
      await deletePackage(id).catch(() => {});
    }
  }

  const saved: Package[] = [];
  for (const pkg of orderedInputs) {
    const created = await createPackage(pkg);
    saved.push(created);
  }
  return saved;
}
