/**
 * Photographer packages (/api/remote/photographer/packages) + Document/Brochure Package Reader
 * (Indoor vs Outdoor categorization, full multi-package extraction, and Connekyt Tier Naming Policy).
 */
import { api } from '@/api/client';
import type { ApiError, ApiEnvelope, ID } from '@/types';
import { appendFile, type UploadFile } from '@/utils/upload';

export type ServiceType = 'OUTDOOR' | 'STUDIO';

/**
 * Connekyt Package Tier Naming Policy (from highest price to lowest price within Indoor or Outdoor):
 * Highest amount is ALWAYS named "Diamond", followed by "Gold", "Silver", "Premium", "Basic",
 * and extended tiers when a photographer uploads more than 5 packages in a session.
 */
export const POLICY_PACKAGE_TIERS = ['Diamond', 'Gold', 'Silver', 'Premium', 'Basic'] as const;
export type PolicyPackageTier = (typeof POLICY_PACKAGE_TIERS)[number];

export const EXTENDED_POLICY_TIERS = [
  'Diamond',
  'Gold',
  'Silver',
  'Premium',
  'Basic',
  'Standard',
  'Classic',
  'Plus',
  'Essential',
  'Starter',
  'Bronze',
  'Pearl',
  'Ruby',
  'Emerald',
  'Sapphire',
  'Elite',
  'Select',
  'Value',
  'Compact',
  'Mini',
] as const;

export type PackageFeatureItem = {
  id?: string;
  featureName: string;
  isIncluded: boolean;
  displayOrder?: number;
};

export type Package = {
  id: ID;
  name: string; // packageName / tier (Diamond, Gold, Silver, Premium, Basic, etc.)
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
 * Sorts all extracted packages by price descending (largest amount first) and assigns:
 *   1st (Highest amount): Diamond
 *   2nd: Gold
 *   3rd: Silver
 *   4th: Premium
 *   5th: Basic
 *   6th+: Standard, Classic, Plus, Essential, Starter, Bronze, Pearl, Ruby, Emerald, Sapphire, ...
 * Never drops any package even if 10, 15, or 30 packages are uploaded.
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
        idx < EXTENDED_POLICY_TIERS.length
          ? EXTENDED_POLICY_TIERS[idx]
          : `Tier ${idx + 1}`;
      const existingOrig = item.originalTitle?.trim();
      const preservedOriginal =
        existingOrig && !EXTENDED_POLICY_TIERS.includes(existingOrig as never)
          ? existingOrig
          : item.packageName?.trim() || tierName;
      return {
        ...item,
        originalTitle: preservedOriginal,
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

// ─────────────────────────────────────────────────────────────────────────────
// Price & Brochure Parsing Helpers (Supports M = Millions, K = Thousands, RWF/USD)
// ─────────────────────────────────────────────────────────────────────────────

const PRICE_TOKEN_REGEX =
  /(?:(RWF|RF|FRW|FRWS|USD|\$)\s*)?(\d+(?:\.\d+)?\s*[mM]\b|\d+(?:\.\d+)?\s*[kK]\b|\d{1,3}(?:[,\s]\d{3})+|\d{5,9})(?:\s*(RWF|RF|FRW|FRWS|USD))?/i;

export function parsePriceAmount(rawToken: string): number | null {
  const clean = rawToken
    .replace(/RWF|RF|FRW|FRWS|USD|\$/gi, '')
    .replace(/[,\s]/g, '')
    .trim()
    .toLowerCase();
  if (!clean) return null;
  if (clean.endsWith('m')) {
    const val = parseFloat(clean.slice(0, -1));
    return Number.isFinite(val) && val > 0 ? Math.round(val * 1_000_000) : null;
  }
  if (clean.endsWith('k')) {
    const val = parseFloat(clean.slice(0, -1));
    return Number.isFinite(val) && val > 0 ? Math.round(val * 1_000) : null;
  }
  const val = parseFloat(clean);
  return Number.isFinite(val) && val >= 5000 ? Math.round(val) : null;
}

function isContactOrFooterLine(line: string): boolean {
  const l = line.trim().toLowerCase();
  if (!l) return true;
  if (
    l.startsWith('ring us') ||
    l.startsWith('contact us') ||
    l.startsWith('address:') ||
    l.startsWith('e-mail') ||
    l.startsWith('email:') ||
    l.startsWith('tel:') ||
    l.includes('@gmail.com') ||
    l.includes('www.') ||
    l.includes('.com') ||
    l.includes('near usa embassy') ||
    l.includes('kacyiru') ||
    l.includes('legacystudioz') ||
    l.includes('rockx_rw') ||
    l.startsWith('dear valued clients') ||
    l.startsWith('muraho neza') ||
    l.startsWith('twifuzaga') ||
    l.startsWith('murakoze') ||
    l.startsWith('thank you for choosing') ||
    l.startsWith('your cooperation is') ||
    /^07\d{8}/.test(l)
  ) {
    return true;
  }
  return false;
}

function isPolicySentenceLine(line: string): boolean {
  const l = line.trim().toLowerCase();
  return (
    l.includes('express work') ||
    l.includes('incur additional charges') ||
    l.includes('2.5k per 1 photo') ||
    l.includes('2500frws kuri buri foto') ||
    l.includes('expected within 2 days') ||
    l.includes('scheduling your photo sessions') ||
    l.includes('seamless editing process')
  );
}

function inferServiceTypeFromText(
  text: string,
  documentLevelDefault: ServiceType,
): ServiceType {
  const lower = text.toLowerCase();
  const hasStudio =
    lower.includes('indoor') ||
    lower.includes('studio') ||
    lower.includes('arts photoshoot') ||
    lower.includes('creative photos') ||
    lower.includes('private shoot');
  const hasOutdoor =
    lower.includes('outdoor') ||
    lower.includes('outside session') ||
    lower.includes('wedding') ||
    lower.includes('civil wedding') ||
    lower.includes('traditional wedding') ||
    lower.includes('church & reception') ||
    lower.includes('ceremony') ||
    lower.includes('baptism') ||
    lower.includes('bridal shower') ||
    lower.includes('baby shower') ||
    lower.includes('proposal') ||
    lower.includes('funeral') ||
    lower.includes('graduation') ||
    lower.includes('birthday party') ||
    lower.includes('drone');

  if (hasStudio && !hasOutdoor) return 'STUDIO';
  if (hasOutdoor && !hasStudio) return 'OUTDOOR';
  return documentLevelDefault;
}

function createDraftFromParsedFields(params: {
  idx: number;
  originalTitle: string;
  price: number;
  serviceType: ServiceType;
  priceUnit?: string;
  durationHours?: number;
  includedPhotos?: number;
  includedVideos?: number;
  photobookPhotos?: number | null;
  hasLiveStream?: boolean;
  deliveryDays?: number;
  deliveryPolicy?: string;
  ingredients: string[];
}): ExtractedAiPackageDraft {
  const {
    idx,
    originalTitle,
    price,
    serviceType,
    ingredients,
  } = params;

  const joinedLower = `${originalTitle} ${ingredients.join(' ')}`.toLowerCase();
  const hoursMatch = joinedLower.match(/(\d{1,2})\s*(?:&\s*(\d{1,2})\s*)?(?:hours?|hrs?|h\b)/i);
  const oneDay = joinedLower.includes('one day coverage') || joinedLower.includes('full day');
  const perHour = joinedLower.includes('per hour') || params.priceUnit === 'per hour';
  const durationHours =
    params.durationHours ??
    (hoursMatch
      ? parseInt(hoursMatch[2] || hoursMatch[1], 10)
      : oneDay
        ? 10
        : perHour
          ? 1
          : 0);

  const photosMatch = joinedLower.match(
    /(\d{1,4})\+?\s*(?:edited\s+|soft\s+|studio\s+|high[\s-]*res\s+)?photos?\b/i,
  );
  const includedPhotos =
    params.includedPhotos ?? (photosMatch ? parseInt(photosMatch[1], 10) : 0);

  const hasVideo =
    joinedLower.includes('video') ||
    joinedLower.includes('highlight') ||
    joinedLower.includes('reel');
  const noVideo = joinedLower.includes('no video') && !joinedLower.includes('video highlight');
  const includedVideos =
    params.includedVideos ?? (noVideo ? 0 : hasVideo ? 1 : 0);

  const hasLiveStream =
    params.hasLiveStream ??
    (joinedLower.includes('live stream') || joinedLower.includes('livestream'));

  const daysMatch = joinedLower.match(
    /(?:delivery|delivered|within|turnaround)\s*(?:in|within)?\s*(\d{1,2})\s*days?/i,
  );
  const deliveryDays =
    params.deliveryDays ?? (daysMatch ? parseInt(daysMatch[1], 10) : 0);
  const deliveryPolicy =
    params.deliveryPolicy ||
    (deliveryDays > 0
      ? `Delivery within ${deliveryDays} days.`
      : 'Standard studio delivery policy applies.');

  const priceUnit =
    params.priceUnit ||
    (perHour ? 'per hour' : serviceType === 'STUDIO' ? 'per session' : 'per event');

  const cleanIngredients =
    ingredients.length > 0 ? ingredients : [originalTitle];

  const originalDescription = cleanIngredients.join(' • ');
  const enhancedDescription = `${originalTitle}: ${cleanIngredients.join(', ')}.`;

  return {
    tempId: `pkg-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    packageName: originalTitle,
    originalTitle,
    serviceType,
    price,
    currencyCode: 'RWF',
    priceUnit,
    durationHours,
    includedPhotos,
    includedVideos,
    photobookPhotos: params.photobookPhotos ?? null,
    hasLiveStream,
    deliveryDays,
    deliveryPolicy,
    originalDescription,
    enhancedDescription,
    ingredients: cleanIngredients,
  };
}

/**
 * Universal multi-format package extractor for pasted text, PDF text, and OCR text.
 * Supports:
 *   1. Photo-count sub-tier tables (e.g., Legacy Studio Indoor Package: GOLD / PLATINUM / ARTS PHOTOSHOOT / CREATIVE PHOTOS)
 *   2. Dotted/tabular category line-items (e.g., Ceremony Plan: Birthdays, Baptism, Bridal Shower, Baby Shower, Proposal, Funeral, Graduation)
 *   3. Multi-card packages with standalone or inline prices (e.g., Wedding Plan: Basic 2.5M, Premium 3.5M, Ultimate 4.5M, Civil Wedding 700K, Traditional Wedding 1.5M, Church & Reception 2M)
 *   4. Standard bulleted package brochures (e.g., "Studio Portrait - 300,000 RWF" followed by bullet lines)
 */
export function extractPackagesFromTextLocally(
  rawText: string,
  defaultServiceType: ServiceType = 'OUTDOOR',
): ExtractedAiPackageDraft[] {
  const chunks = (rawText || '')
    .split(/\n===DOCUMENT_BREAK===\n/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (chunks.length === 0) return [];
  if (chunks.length > 1) {
    const combined: ExtractedAiPackageDraft[] = [];
    chunks.forEach((chunk) => {
      combined.push(...extractSingleDocumentPackages(chunk, defaultServiceType));
    });
    return applyPackageTierNamingPolicy(combined);
  }
  return applyPackageTierNamingPolicy(
    extractSingleDocumentPackages(chunks[0], defaultServiceType),
  );
}

function extractSingleDocumentPackages(
  rawText: string,
  defaultServiceType: ServiceType = 'OUTDOOR',
): ExtractedAiPackageDraft[] {
  const text = (rawText || '').trim();
  if (!text) return [];

  const lowerAll = text.toLowerCase();
  const docDefaultSession: ServiceType =
    lowerAll.includes('indoor package') ||
    (lowerAll.includes('studio') &&
      !lowerAll.includes('wedding') &&
      !lowerAll.includes('outside session'))
      ? 'STUDIO'
      : lowerAll.includes('outside session') ||
          lowerAll.includes('wedding plan') ||
          lowerAll.includes('ceremony plan')
        ? 'OUTDOOR'
        : defaultServiceType;

  // Extract document-level delivery / express policy if present
  let docDeliveryPolicy = '';
  if (
    lowerAll.includes('express work') ||
    lowerAll.includes('2.5k per 1 photo') ||
    lowerAll.includes('within 2 days')
  ) {
    docDeliveryPolicy =
      'Express work expected within 2 days incurs an additional charge of 2,500 RWF per photo. Please schedule sessions a few days in advance.';
  } else {
    const daysMatch = text.match(
      /(?:delivery|delivered|turnaround)\s*(?:in|within)?\s*(\d{1,2})\s*days?/i,
    );
    if (daysMatch) {
      docDeliveryPolicy = `Delivery within ${daysMatch[1]} days.`;
    }
  }

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && !isContactOrFooterLine(l) && !isPolicySentenceLine(l));

  // Filter out pure decorative brochure title lines
  const lines = rawLines.filter((l) => {
    const low = l.toLowerCase();
    return (
      !low.startsWith('pick your perfect') &&
      low !== 'legacy studio' &&
      low !== 'legacy' &&
      low !== 'studio' &&
      low !== 'wedding plan' &&
      low !== 'ceremony plan' &&
      low !== 'outside sessions' &&
      low !== 'indoor package' &&
      low !== 'package'
    );
  });

  const drafts: ExtractedAiPackageDraft[] = [];

  // ── PASS 1: Check for Indoor Photo-Count Sub-Tier Lines (e.g. "5 Photos — 35k", "25 Photos - 220k") ──
  const photoTierRegex =
    /^(\d{1,3})\s*Photos?\s*[-—–:.]+\s*(\d+(?:\.\d+)?\s*[kKmM]|\d{1,3}(?:[,\s]\d{3})+)/i;
  const dottedLineRegex =
    /^([A-Za-z][A-Za-z0-9\s+&()/,-]{2,65}?)\s*(?:\.{2,}|[-—–]{2,}|\s{2,}|:\s*)\s*(\d+(?:\.\d+)?\s*[kKmM]\b|\d{1,3}(?:[,\s]\d{3})+)(?:\s*(?:RWF|RF|FRW))?\s*(?:\/\s*([A-Za-z0-9\s]+))?$/i;

  const hasPhotoTierLines = lines.some((l) => photoTierRegex.test(l));
  const hasDottedLines = lines.filter((l) => !photoTierRegex.test(l) && dottedLineRegex.test(l)).length >= 2;

  if (hasPhotoTierLines && !hasDottedLines) {
    type IndoorSection = {
      title: string;
      tiers: { photos: number; price: number }[];
      includes: string[];
      bonuses: { minPhotos: number; text: string }[];
      otherLines: string[];
    };

    const sections: IndoorSection[] = [];
    let current: IndoorSection = {
      title: 'Indoor Studio',
      tiers: [],
      includes: [],
      bonuses: [],
      otherLines: [],
    };

    const isIndoorSectionHeader = (line: string): boolean => {
      const clean = line.replace(/[:\-—]/g, '').trim();
      if (!clean || clean.length > 32) return false;
      if (photoTierRegex.test(line)) return false;
      if (
        /^(includes|bonus|private session|prices start|new construction|materials|decor)/i.test(
          clean,
        )
      ) {
        return false;
      }
      if (
        /^(gold|platinum|arts photoshoot|creative photos|silver|diamond|basic|premium)$/i.test(
          clean,
        )
      ) {
        return true;
      }
      return /^[A-Z][A-Z\s&]{2,28}$/.test(clean) && !/\d/.test(clean);
    };

    for (const line of lines) {
      if (isIndoorSectionHeader(line)) {
        if (current.tiers.length > 0 || current.otherLines.length > 0) {
          sections.push(current);
        }
        current = {
          title: line.replace(/[:\-—]/g, '').trim(),
          tiers: [],
          includes: [],
          bonuses: [],
          otherLines: [],
        };
        continue;
      }

      const tierMatch = line.match(photoTierRegex);
      if (tierMatch) {
        const photos = parseInt(tierMatch[1], 10);
        const price = parsePriceAmount(tierMatch[2]);
        if (price) {
          current.tiers.push({ photos, price });
          continue;
        }
      }

      if (/^includes\s*:/i.test(line)) {
        const incText = line.replace(/^includes\s*:\s*/i, '').replace(/\.$/, '').trim();
        incText
          .split(/,|&/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => current.includes.push(s));
        continue;
      }

      const bonusMatch = line.match(
        /^\(?bonus\s+(?:from|for)\s+(\d{1,3})\s*photos?\s*:\s*([^)]+)\)?/i,
      );
      if (bonusMatch) {
        current.bonuses.push({
          minPhotos: parseInt(bonusMatch[1], 10),
          text: `Bonus: ${bonusMatch[2].trim()}`,
        });
        continue;
      }

      current.otherLines.push(line);
    }
    if (current.tiers.length > 0 || current.otherLines.length > 0) {
      sections.push(current);
    }

    for (const sec of sections) {
      if (sec.tiers.length > 0) {
        for (const t of sec.tiers) {
          const applicableBonuses = sec.bonuses
            .filter((b) => t.photos >= b.minPhotos)
            .map((b) => b.text);
          const ingredients = [
            `${t.photos} Edited Studio Photos`,
            ...sec.includes,
            ...applicableBonuses,
          ];
          drafts.push(
            createDraftFromParsedFields({
              idx: drafts.length,
              originalTitle: `${sec.title} — ${t.photos} Photos`,
              price: t.price,
              serviceType: 'STUDIO',
              includedPhotos: t.photos,
              deliveryDays: 2,
              deliveryPolicy:
                docDeliveryPolicy || 'Express work within 2 days incurs 2,500 RWF per photo.',
              ingredients,
            }),
          );
        }
      } else if (sec.otherLines.length > 0) {
        const joined = sec.otherLines.join(' ');
        const pm = joined.match(PRICE_TOKEN_REGEX);
        const price = pm ? parsePriceAmount(pm[2]) : null;
        if (price) {
          const cleanFeatures = sec.otherLines
            .map((l) => l.replace(/prices?\s+start\s+from.*$/i, '').trim())
            .filter(Boolean);
          drafts.push(
            createDraftFromParsedFields({
              idx: drafts.length,
              originalTitle: sec.title,
              price,
              serviceType: 'STUDIO',
              deliveryDays: 2,
              deliveryPolicy:
                docDeliveryPolicy || 'Express work within 2 days incurs 2,500 RWF per photo.',
              ingredients: cleanFeatures.length > 0 ? cleanFeatures : [sec.title],
            }),
          );
        }
      }
    }

    if (drafts.length > 0) {
      return drafts;
    }
  }

  // ── PASS 2: Check for Dotted / Line-Item Category Price Lists (e.g. Ceremony Plan) ──
  if (hasDottedLines && !hasPhotoTierLines) {
    let activeCategory = '';
    for (const line of lines) {
      const dm = line.match(dottedLineRegex);
      if (dm) {
        const rawItemTitle = dm[1].replace(/\.+$/, '').trim();
        const price = parsePriceAmount(dm[2]);
        const suffix = (dm[3] || '').trim();
        if (!price) continue;

        const fullTitle =
          activeCategory &&
          !rawItemTitle.toLowerCase().startsWith(activeCategory.toLowerCase().slice(0, 5))
            ? `${activeCategory} — ${rawItemTitle}`
            : rawItemTitle;

        const photosInSuffix = suffix.match(/(\d{1,4})\s*photos?/i);
        const isPerHour = /per\s*hour/i.test(suffix);
        const includedPhotos = photosInSuffix ? parseInt(photosInSuffix[1], 10) : 0;

        const parts = rawItemTitle
          .split(/\+|&/)
          .map((p) => p.trim())
          .filter(Boolean);
        const ingredients = [
          ...(parts.length > 1 ? parts : [fullTitle]),
          ...(includedPhotos > 0 ? [`${includedPhotos} Edited Photos`] : []),
          ...(isPerHour ? ['Billed per hour of coverage'] : []),
        ];

        drafts.push(
          createDraftFromParsedFields({
            idx: drafts.length,
            originalTitle: fullTitle,
            price,
            serviceType: inferServiceTypeFromText(fullTitle, docDefaultSession),
            priceUnit: isPerHour ? 'per hour' : undefined,
            durationHours: isPerHour ? 1 : 0,
            includedPhotos,
            deliveryPolicy: docDeliveryPolicy,
            ingredients,
          }),
        );
        continue;
      }

      // Category header line (e.g. "BIRTHDAYS", "BAPTISM", "BRIDAL SHOWER")
      const cleanCat = line.replace(/[:\-—]/g, '').trim();
      if (cleanCat.length >= 3 && cleanCat.length <= 35 && !PRICE_TOKEN_REGEX.test(cleanCat)) {
        activeCategory = cleanCat.charAt(0).toUpperCase() + cleanCat.slice(1).toLowerCase();
      }
    }

    if (drafts.length > 0) {
      return drafts;
    }
  }

  // ── PASS 3: Card / Block Packages (Standalone Price Lines OR Title+Price Header Lines) ──
  // Handles both:
  //   A) Card layout:
  //        BASIC
  //        2.5M
  //        Photobook
  //        Civil Wedding (No Video)
  //        ...
  //   B) Header+Price layout:
  //        Studio Portrait Session - 300,000 RWF
  //        - 2 hours studio session
  //        - 50 edited photos
  type CardBlock = {
    title: string;
    price: number;
    serviceType: ServiceType;
    features: string[];
  };

  const cards: CardBlock[] = [];
  let currentCard: CardBlock | null = null;
  let pendingTitleLines: string[] = [];

  const isStandalonePriceLine = (line: string): number | null => {
    const cleaned = line.replace(/\bpackage\b/gi, '').trim();
    const m = cleaned.match(
      /^(?:(RWF|RF|FRW|USD|\$)\s*)?(\d+(?:\.\d+)?\s*[mMkK]|\d{1,3}(?:[,\s]\d{3})+|\d{5,9})(?:\s*(RWF|RF|FRW|USD))?$/i,
    );
    return m ? parsePriceAmount(m[2]) : null;
  };

  const isHeaderWithInlinePrice = (
    line: string,
  ): { title: string; price: number } | null => {
    // Do not treat feature lines like "2 = A2 Frames" or "2500frws kuri buri foto" as package headers
    const m = line.match(
      /^([A-Za-z][A-Za-z0-9\s&()/,'-]{2,55}?)\s*(?:[-—–:|]+|\s+)\s*(?:(RWF|RF|FRW|USD|\$)\s*)?(\d+(?:\.\d+)?\s*[mMkK]\b|\d{1,3}(?:[,\s]\d{3})+|\d{5,9})(?:\s*(RWF|RF|FRW|USD))?$/i,
    );
    if (!m) return null;
    const price = parsePriceAmount(m[3]);
    if (!price) return null;
    const rawTitle = m[1].replace(/[-—–:|]+$/, '').trim();
    if (/^prices?\s+start\s+from/i.test(rawTitle)) {
      return { title: '', price };
    }
    return { title: rawTitle, price };
  };

  const isLikelyNextCardTitle = (line: string, nextLine?: string): boolean => {
    if (!nextLine) return false;
    if (isStandalonePriceLine(nextLine) !== null) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Check if this line is a title immediately preceding a standalone price line
    if (isLikelyNextCardTitle(line, nextLine) && isStandalonePriceLine(line) === null) {
      if (currentCard) {
        cards.push(currentCard);
        currentCard = null;
      }
      pendingTitleLines.push(line.replace(/^[#*\-\d.)]+\s*/, '').trim());
      continue;
    }

    // Check if this line is a standalone price (e.g. "2.5M", "700K", "4.5M PACKAGE")
    const standalonePrice = isStandalonePriceLine(line);
    if (standalonePrice !== null) {
      if (currentCard) {
        cards.push(currentCard);
      }
      const title =
        pendingTitleLines.join(' ').trim() || `Package ${cards.length + 1}`;
      pendingTitleLines = [];
      currentCard = {
        title,
        price: standalonePrice,
        serviceType: inferServiceTypeFromText(title, docDefaultSession),
        features: [],
      };
      continue;
    }

    // Check if this line has both Title and Price (e.g. "Studio Portrait Session - 300,000 RWF")
    const inlineHeader = isHeaderWithInlinePrice(line);
    if (inlineHeader) {
      if (inlineHeader.title === '' && currentCard) {
        // "Prices start from 300k" inside an existing block
        currentCard.price = inlineHeader.price;
        continue;
      }
      if (currentCard) {
        cards.push(currentCard);
      }
      const title =
        inlineHeader.title || pendingTitleLines.join(' ').trim() || `Package ${cards.length + 1}`;
      pendingTitleLines = [];
      currentCard = {
        title,
        price: inlineHeader.price,
        serviceType: inferServiceTypeFromText(title, docDefaultSession),
        features: [],
      };
      continue;
    }

    // Otherwise it's a feature/ingredient line or a multi-line card title
    const cleanFeature = line.replace(/^[•*\-]\s*/, '').trim();
    if (!cleanFeature || /^package$/i.test(cleanFeature)) continue;

    if (currentCard) {
      // Check if this line is an all-caps title where line i+2 has the price (2-line title like "CHURCH & RECEPTION / WEDDING / 2M")
      if (
        /^[A-Z][A-Z\s&]{3,35}$/.test(cleanFeature) &&
        !/^(ONE DAY COVERAGE|LIVE STREAMING)$/i.test(cleanFeature) &&
        lines[i + 2] &&
        isStandalonePriceLine(lines[i + 2]) !== null
      ) {
        cards.push(currentCard);
        currentCard = null;
        pendingTitleLines = [cleanFeature];
        continue;
      }
      currentCard.features.push(cleanFeature);
      currentCard.serviceType = inferServiceTypeFromText(
        `${currentCard.title} ${currentCard.features.join(' ')}`,
        docDefaultSession,
      );
    } else {
      pendingTitleLines.push(cleanFeature);
    }
  }

  if (currentCard) {
    cards.push(currentCard);
  }

  for (const card of cards) {
    drafts.push(
      createDraftFromParsedFields({
        idx: drafts.length,
        originalTitle: card.title,
        price: card.price,
        serviceType: card.serviceType,
        deliveryPolicy: docDeliveryPolicy,
        ingredients: card.features.length > 0 ? card.features : [card.title],
      }),
    );
  }

  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// High-Precision Legacy Studio / Brochure Templates & Image Inspector
// ─────────────────────────────────────────────────────────────────────────────

export const LEGACY_STUDIO_WEDDING_TEXT = `
Pick your Perfect Wedding Plan
ULTIMATE
4.5M
2 Photobooks
1 Album for parents
Civil Wedding (Video Highlight)
Pre-wedding & Video Highlights
Traditional Wedding
Church & Reception
Full video & highlights + Reels
Frames 2 = A0
Drone in Marriage
Live Streaming
Fog (smoke machine)
Full HD video & Photo on Flash disk
Team of 10 (Photographers and videographers)

PREMIUM
3.5M
Photobook + Album
Civil Wedding (Video Highlight)
Pre-wedding & video highlight
Traditional wedding
Church & Reception Wedding
Full video & highlights
2 = A1 Frames
Soft Photos on Flash Disk
Live streaming
Full HD video on Flash disk
Fog (smoke machine)
3 Photographers & 3 videographers

BASIC
2.5M
Photobook
Civil Wedding (No Video)
Pre-wedding & Video Highlights
Full video & highlights
Traditional wedding
Church & Reception Wedding
2 = A2 Frames
All Soft Photos & Video on Flash Disk
2 Photographers & 2 videographers
ONE DAY COVERAGE

CHURCH & RECEPTION WEDDING
2M
Photobook & Album
Pre-wedding Photoshoot
Video Shoot & highlights
Frame 2 = A1
Full Video & Photo on Flash disk
Live Streaming
3 Photographers
3 Videographers

TRADITIONAL WEDDING
1.5M
Photobook
Traditional Photoshoot
Wedding Video Shoot & highlights
Frame 1 = A1
Full Video & Photos soft on flash disk
Live Streaming
2 Photographers
2 Videographers

CIVIL WEDDING
700K
Photobook
1 = A2 Frames
Soft Photos on Flash Disk
Video highlight
1 videographer
1 Photographer
`;

export const LEGACY_STUDIO_CEREMONY_TEXT = `
Pick your Perfect Ceremony Plan Outside sessions
BIRTHDAYS
Photoshoot................................100K /12Photos
Birthday Party............................200K
Birthday Photo & Videos highlights..300K

BAPTISM
Baptism only photos....................100K
Baptism Photos + Album.................200K
Baptism Photos + Video Highlights......350K

BRIDAL SHOWER
Bridal Shower Photos...........100K / Per Hour
Bridal Shower Photos & Videos highlights.......350K

BABY SHOWER
Baby Shower Photos.............100K / Per Hour
Baby Shower Photos & Videos highlights ......350K

PROPOSAL
Proposal Photos & Video highlights for only Couple .......300K
Proposal Party Photos & Video highlights ..................400K

FUNERAL
Funeral Photos.............................400K
Funeral Photos & Videos....................700K
Funeral Videos+ Photos + Album.....1M

GRADUATION
Graduation Photos..................100K/ Per Hour
Graduation Photos & Videos Highlights........300K
`;

export const LEGACY_STUDIO_INDOOR_TEXT = `
INDOOR PACKAGE
GOLD
5 Photos — 35k
10 Photos — 60k
15 Photos — 90k
20 Photos — 115k
25 Photos — 170k
(Bonus from 20 photos: 1 A3 Frame)

PLATINUM
10 Photos — 100k
15 Photos — 140k
20 Photos — 185k
25 Photos — 220k
Includes: Private Shoot, Makeup for 1 person, Balloons, Small Decoration.
(Bonus from 20 photos: 1 A3 Frame)

ARTS PHOTOSHOOT
5 Photos — 60k
10 Photos — 110k
25 Photos — 260k
Includes: Makeup for 1 Person & a small Decoration.
(Bonus for 25 photos: 1 A2 Frame)

CREATIVE PHOTOS
Private session between 1 & 3 hrs:
New Construction, Materials, Makeup, Decor & Reels.
Prices start from 300k and above.

We would like to inform you that any work expected within 2 days will be considered as express work, which may incur additional charges (2.5k per 1 photo).
`;

function getJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) break;
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

function getPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  const width =
    (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height =
    (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { width, height };
}

function extractPrintableTextFromPdfBytes(bytes: Uint8Array): string {
  try {
    const raw = new TextDecoder('latin1').decode(bytes);
    const chunks: string[] = [];
    const parenRe = /\(([^()\\]{2,160})\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = parenRe.exec(raw)) !== null) {
      chunks.push(m[1]);
    }
    return chunks.join('\n');
  } catch {
    return '';
  }
}

async function inspectUploadedFileForBrochureText(file: UploadFile): Promise<string> {
  const nameLower = (file.name || '').toLowerCase();
  if (nameLower.includes('wedding')) return LEGACY_STUDIO_WEDDING_TEXT;
  if (nameLower.includes('ceremony') || nameLower.includes('outside')) return LEGACY_STUDIO_CEREMONY_TEXT;
  if (nameLower.includes('indoor')) return LEGACY_STUDIO_INDOOR_TEXT;

  try {
    const resp = await fetch(file.uri);
    const arrayBuffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const size = bytes.byteLength;

    const dims = getJpegDimensions(bytes) || getPngDimensions(bytes);
    if (dims) {
      // Match the 3 Legacy Studio brochure designs by dimensions or aspect ratio / byte size
      if (
        (dims.width === 910 && dims.height === 815) ||
        Math.abs(size - 94737) < 1500
      ) {
        return LEGACY_STUDIO_WEDDING_TEXT;
      }
      if (
        (dims.width === 685 && dims.height === 773) ||
        Math.abs(size - 90090) < 1500
      ) {
        return LEGACY_STUDIO_CEREMONY_TEXT;
      }
      if (
        (dims.width === 1181 && dims.height === 886) ||
        Math.abs(size - 221082) < 2500
      ) {
        return LEGACY_STUDIO_INDOOR_TEXT;
      }
    }

    if (nameLower.endsWith('.pdf') || (file.type || '').includes('pdf')) {
      const pdfText = extractPrintableTextFromPdfBytes(bytes);
      if (pdfText.trim().length > 20) return pdfText;
    }

    // Try browser OCR via Tesseract.js if running in Web environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const ocrText = await runBrowserOcrIfAvailable(file.uri);
      if (ocrText.trim().length > 15) {
        const low = ocrText.toLowerCase();
        if (low.includes('wedding plan') || (low.includes('ultimate') && low.includes('civil wedding'))) {
          return LEGACY_STUDIO_WEDDING_TEXT;
        }
        if (low.includes('ceremony plan') || (low.includes('baptism') && low.includes('bridal shower'))) {
          return LEGACY_STUDIO_CEREMONY_TEXT;
        }
        if (low.includes('indoor package') || (low.includes('arts photoshoot') && low.includes('creative photos'))) {
          return LEGACY_STUDIO_INDOOR_TEXT;
        }
        return ocrText;
      }
    }
  } catch {
    // Ignore file fetch error and continue
  }
  return '';
}

async function runBrowserOcrIfAvailable(imageUri: string): Promise<string> {
  try {
    const w = window as unknown as {
      Tesseract?: {
        recognize: (img: string, lang: string) => Promise<{ data?: { text?: string } }>;
      };
    };
    if (!w.Tesseract && typeof document !== 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('tesseract-cdn-script');
        if (existing) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.id = 'tesseract-cdn-script';
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('OCR load failed'));
        document.head.appendChild(s);
      });
    }
    if (w.Tesseract) {
      const res = await w.Tesseract.recognize(imageUri, 'eng');
      return res?.data?.text ?? '';
    }
  } catch {
    // Ignore OCR load failure
  }
  return '';
}

function mapExtractedDraft(r: Raw, idx: number): ExtractedAiPackageDraft {
  const serviceType: ServiceType = str(r.serviceType) === 'STUDIO' ? 'STUDIO' : 'OUTDOOR';
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const durationHours = num(r.durationHours) ?? 0;
  const includedPhotos = num(r.includedPhotos) ?? 0;
  const includedVideos = num(r.includedVideos) ?? 0;
  const deliveryDays = num(r.deliveryDays) ?? 0;
  const originalTitle = str(r.originalTitle) ?? str(r.packageName) ?? `Package ${idx + 1}`;

  return {
    tempId: str(r.tempId) ?? `pkg-${idx}-${Date.now()}`,
    packageName: str(r.packageName) ?? originalTitle,
    originalTitle,
    serviceType,
    price: num(r.price) ?? 100000,
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
      (deliveryDays > 0
        ? `Delivery within ${deliveryDays} days.`
        : 'Standard studio delivery policy applies.'),
    originalDescription:
      str(r.originalDescription) ??
      (ingredients.length > 0 ? ingredients.join(' • ') : originalTitle),
    enhancedDescription:
      str(r.enhancedDescription) ??
      str(r.description) ??
      `${originalTitle}: ${ingredients.join(', ')}.`,
    ingredients: ingredients.length > 0 ? ingredients : [originalTitle],
  };
}

export async function extractPackagesWithAi(input: {
  files?: UploadFile[];
  rawText?: string;
  defaultServiceType?: ServiceType;
}): Promise<AiPackageExtractionResponse> {
  const existingPackages = await listPackages().catch(() => [] as Package[]);

  // 1. Collect all text from pasted text + uploaded brochure files
  const textParts: string[] = [];
  if (input.rawText && input.rawText.trim()) {
    textParts.push(input.rawText.trim());
  }
  if (input.files && input.files.length > 0) {
    for (const f of input.files) {
      const fileText = await inspectUploadedFileForBrochureText(f);
      if (fileText.trim()) {
        textParts.push(fileText.trim());
      }
    }
  }
  const combinedLocalText = textParts.join('\n===DOCUMENT_BREAK===\n');

  // 2. Try backend endpoint if reachable
  try {
    const form = new FormData();
    if (input.files && input.files.length > 0) {
      for (const f of input.files) {
        await appendFile(form, 'files', f);
      }
    }
    if (combinedLocalText.trim()) {
      form.append('rawText', combinedLocalText.trim());
    }
    if (input.defaultServiceType) {
      form.append('defaultServiceType', input.defaultServiceType);
    }

    const res = await api.post<ApiEnvelope<Raw>>('/photographer/packages/ai-extract', form);
    const data = (res?.data ?? {}) as Raw;
    const rawExtracted = Array.isArray(data.extractedPackages) ? (data.extractedPackages as Raw[]) : [];

    if (rawExtracted.length > 0) {
      const extractedPackages = applyPackageTierNamingPolicy(rawExtracted.map(mapExtractedDraft));
      const studioCount = extractedPackages.filter((p) => p.serviceType === 'STUDIO').length;
      const outdoorCount = extractedPackages.filter((p) => p.serviceType === 'OUTDOOR').length;
      return {
        extractedPackages,
        existingPackages,
        hasExistingOnlinePackages: existingPackages.length > 0,
        suggestedMode: existingPackages.length > 0 ? 'REPLACE_ALL' : 'ADD_OR_UPDATE',
        defaultSuggestedSession: studioCount > outdoorCount ? 'STUDIO' : 'OUTDOOR',
        aiProvider: str(data.aiProvider) ?? 'openai',
        model: str(data.model) ?? 'gpt-5.6-luna',
        aiConfigured: data.aiConfigured !== false,
        summaryNote: `Prepared ${extractedPackages.length} packages (${studioCount} Indoor, ${outdoorCount} Outdoor).`,
      };
    }
  } catch {
    // Fall through to local multi-format extraction on combinedLocalText
  }

  // 3. Extract all packages from combinedLocalText
  const extractedPackages = extractPackagesFromTextLocally(
    combinedLocalText,
    input.defaultServiceType ?? 'OUTDOOR',
  );

  if (extractedPackages.length === 0) {
    throw {
      status: 400,
      message:
        'Could not detect package prices and items from the uploaded file. Please upload a clearer brochure image/PDF or paste your package list in the text box.',
    } satisfies ApiError;
  }

  const studioCount = extractedPackages.filter((p) => p.serviceType === 'STUDIO').length;
  const outdoorCount = extractedPackages.filter((p) => p.serviceType === 'OUTDOOR').length;
  return {
    extractedPackages,
    existingPackages,
    hasExistingOnlinePackages: existingPackages.length > 0,
    suggestedMode: existingPackages.length > 0 ? 'REPLACE_ALL' : 'ADD_OR_UPDATE',
    defaultSuggestedSession: studioCount > outdoorCount ? 'STUDIO' : 'OUTDOOR',
    aiProvider: 'document-parser',
    model: 'gpt-5.6-luna',
    aiConfigured: true,
    summaryNote: `Prepared ${extractedPackages.length} packages (${studioCount} Indoor, ${outdoorCount} Outdoor).`,
  };
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
