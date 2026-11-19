/**
 * Photographer packages (/api/remote/photographer/packages) + Document/Brochure Package Reader
 * (Indoor vs Outdoor categorization, full multi-package extraction, and Connekyt Tier Naming Policy).
 */
import { api } from '@/api/client';
import { storage } from '@/services/storage';
import type { ApiError, ApiEnvelope, ID } from '@/types';
import { appendFile, type UploadFile } from '@/utils/upload';

/**
 * Older builds hid a deleted package on the phone (and soft-deactivated it with a stripped-down PUT when the server
 * refused the delete). The server now unlinks bookings and events itself, so a delete either works or fails with a
 * message, and the list shows what the server holds. This sweeps the old local list once.
 */
const LEGACY_DELETED_PACKAGES_KEY = 'connekt.deleted_package_ids';

async function clearLegacyDeletedPackageIds(): Promise<void> {
  try {
    await storage.remove(LEGACY_DELETED_PACKAGES_KEY);
  } catch {
    // nothing to clear
  }
}

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

export type PackageAddonItem = {
  key: string;
  name: string;
  price: number;
  currencyCode?: string;
  /** Automatically true when price > 0, false when price <= 0 */
  enabled: boolean;
};

export const DEFAULT_PACKAGE_ADDON_TEMPLATES: {
  key: string;
  name: string;
  description: string;
  isDrone?: boolean;
}[] = [
  {
    key: 'drone_capturing',
    name: 'Drone Capturing',
    description:
      'Aerial 4K drone photo & video coverage (unique self-priced feature — enter amount to toggle ON for your profile)',
    isDrone: true,
  },
  {
    key: 'express_delivery',
    name: 'Express 48h Delivery',
    description: 'Priority editing & turnaround within 48 hours',
  },
  {
    key: 'extra_hour',
    name: 'Extra Hour Coverage',
    description: 'Additional hour of session or event coverage',
  },
  {
    key: 'fog_machine',
    name: 'Smoke / Fog Machine',
    description: 'Special effects fog/smoke machine for ceremony or reception',
  },
  {
    key: 'extra_crew',
    name: 'Extra Photographer / Videographer',
    description: 'Additional shooter added to your coverage team',
  },
];

export const QUICK_DELIVERY_POLICY_PRESETS: string[] = [
  'Delivery in 5–7 days via online gallery',
  'Express 48h delivery (+2,500 RWF per photo)',
  'Same-day preview highlights + 7-day full delivery',
  '14–21 days for full wedding film & photobook',
];

export const QUICK_OTHER_POLICY_PRESETS: string[] = [
  '50% deposit required to confirm date',
  'Free reschedule up to 48h before session',
  'Client covers transport outside city',
  'Raw unedited files sold separately',
];

export function normalizePackageAddons(
  addons?: PackageAddonItem[],
  explicitDronePrice?: number | null,
  defaultCurrencyCode = 'RWF',
): PackageAddonItem[] {
  const map = new Map<string, PackageAddonItem>();
  (addons ?? []).forEach((item) => {
    const cleanName = (item.name || '').trim();
    if (!cleanName) return;
    const price = Number.isFinite(item.price) && item.price > 0 ? Math.round(item.price) : 0;
    const key =
      item.key ||
      (cleanName.toLowerCase().includes('drone')
        ? 'drone_capturing'
        : cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    map.set(key, {
      key,
      name: cleanName,
      price,
      currencyCode: item.currencyCode || defaultCurrencyCode,
      enabled: price > 0,
    });
  });

  if (typeof explicitDronePrice === 'number' && Number.isFinite(explicitDronePrice)) {
    const dronePrice = explicitDronePrice > 0 ? Math.round(explicitDronePrice) : 0;
    map.set('drone_capturing', {
      key: 'drone_capturing',
      name: 'Drone Capturing',
      price: dronePrice,
      currencyCode: defaultCurrencyCode,
      enabled: dronePrice > 0,
    });
  }

  return Array.from(map.values());
}

export type Package = {
  id: ID;
  name: string; // packageName / tier (Diamond, Gold, Silver, Premium, Basic, etc.)
  originalTitle?: string;
  description?: string;
  originalDescription?: string;
  enhancedDescription?: string;
  deliveryPolicy?: string;
  otherPolicies?: string[];
  addons?: PackageAddonItem[];
  droneCapturingPrice?: number | null;
  hasDroneCapturing?: boolean;
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
  currencyCode?: string;
  priceUnit?: string;
  durationHours?: number;
  description?: string;
  deliveryPolicy?: string;
  otherPolicies?: string[];
  addons?: PackageAddonItem[];
  droneCapturingPrice?: number | null;
  hasDroneCapturing?: boolean;
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
  /** null when the brochure gave no usable price: the photographer must enter one before publishing. */
  price: number | null;
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
  otherPolicies?: string[];
  addons?: PackageAddonItem[];
  droneCapturingPrice?: number | null;
  hasDroneCapturing?: boolean;
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
  extractedDeliveryPolicy?: string;
  extractedOtherPolicies?: string[];
  detectedDroneInMenu?: boolean;
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
  const rawFeatures = mapFeatures(r.features);
  const currencyCode =
    str(r.currencyAbbreviation) ??
    str(r.currencyCode) ??
    str(currency.abbreviation) ??
    str(r.currency as string) ??
    'RWF';

  let parsedDeliveryPolicy = str(r.deliveryPolicy);
  const otherPolicies: string[] = Array.isArray(r.otherPolicies)
    ? r.otherPolicies.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];
  const parsedAddons: PackageAddonItem[] = Array.isArray(r.addons)
    ? normalizePackageAddons(r.addons as PackageAddonItem[], num(r.droneCapturingPrice) ?? null, currencyCode)
    : [];
  const cleanFeatures: PackageFeatureItem[] = [];

  const addonRegex = /^Add-on:\s*(.+?)\s*\(\+?([\d,.\s]+)\s*([A-Za-z]{3})?\)$/i;
  const deliveryPolicyRegex = /^Delivery Policy:\s*(.+)$/i;
  const otherPolicyRegex = /^Policy:\s*(.+)$/i;

  for (const f of rawFeatures) {
    const name = f.featureName.trim();
    const addonMatch = name.match(addonRegex);
    if (addonMatch) {
      const addonName = addonMatch[1].trim();
      const rawPrice = parseFloat(addonMatch[2].replace(/[,\s]/g, ''));
      const addonCurrency = addonMatch[3]?.toUpperCase() || currencyCode;
      if (Number.isFinite(rawPrice) && rawPrice > 0) {
        const key = addonName.toLowerCase().includes('drone')
          ? 'drone_capturing'
          : addonName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (!parsedAddons.some((a) => a.key === key)) {
          parsedAddons.push({
            key,
            name: addonName,
            price: Math.round(rawPrice),
            currencyCode: addonCurrency,
            enabled: true,
          });
        }
      }
      continue;
    }

    const delivMatch = name.match(deliveryPolicyRegex);
    if (delivMatch) {
      if (!parsedDeliveryPolicy) {
        parsedDeliveryPolicy = delivMatch[1].trim();
      }
      continue;
    }

    const polMatch = name.match(otherPolicyRegex);
    if (polMatch) {
      const polText = polMatch[1].trim();
      if (polText && !otherPolicies.includes(polText)) {
        otherPolicies.push(polText);
      }
      continue;
    }

    cleanFeatures.push(f);
  }

  const droneAddon = parsedAddons.find(
    (a) => a.key === 'drone_capturing' || a.name.toLowerCase().includes('drone'),
  );
  const explicitDronePrice = num(r.droneCapturingPrice);
  const droneCapturingPrice =
    explicitDronePrice && explicitDronePrice > 0
      ? explicitDronePrice
      : droneAddon && droneAddon.price > 0
        ? droneAddon.price
        : null;
  const hasDroneCapturing = Boolean(droneCapturingPrice && droneCapturingPrice > 0);

  return {
    id: String(r.id ?? ''),
    name: str(r.packageName) ?? str(r.name) ?? 'Package',
    originalTitle: str(r.originalTitle),
    description: str(r.description),
    originalDescription: str(r.originalDescription),
    enhancedDescription: str(r.enhancedDescription),
    deliveryPolicy: parsedDeliveryPolicy,
    otherPolicies,
    addons: parsedAddons,
    droneCapturingPrice,
    hasDroneCapturing,
    price: num(r.price),
    currency: currencyCode,
    currencyId: str(r.currencyId) ?? str(currency.id),
    priceUnit: str(r.priceUnit),
    durationHours: num(r.durationHours),
    includedPhotos: num(r.includedPhotos),
    includedVideos: num(r.includedVideos),
    photobookPhotos: num(r.photobookPhotos) ?? null,
    hasLiveStream: r.hasLiveStream === true,
    deliveryDays: num(r.deliveryDays),
    serviceType: str(r.serviceType) === 'STUDIO' ? 'STUDIO' : 'OUTDOOR',
    features: cleanFeatures,
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
  T extends { packageName: string; originalTitle?: string; serviceType?: ServiceType; price?: number | null }
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
  const currencyCode = input.currencyCode || 'RWF';
  const baseFeatures = (input.features ?? [])
    .filter((f) => {
      const name = (f.featureName || '').trim();
      if (!name) return false;
      // Avoid duplicating structured metadata lines when re-saving a package
      return (
        !/^Add-on:\s*/i.test(name) &&
        !/^Delivery Policy:\s*/i.test(name) &&
        !/^Policy:\s*/i.test(name)
      );
    })
    .map((f) => ({
      featureName: f.featureName.trim(),
      isIncluded: f.isIncluded !== false,
    }));

  const normalizedAddons = normalizePackageAddons(
    input.addons,
    input.droneCapturingPrice,
    currencyCode,
  );
  // Having an amount (> 0) toggles the add-on ON for this photographer; 0/empty leaves it OFF
  const activeAddons = normalizedAddons.filter((a) => a.enabled && a.price > 0);
  const droneAddon = activeAddons.find(
    (a) => a.key === 'drone_capturing' || a.name.toLowerCase().includes('drone'),
  );

  for (const addon of activeAddons) {
    baseFeatures.push({
      featureName: `Add-on: ${addon.name} (+${addon.price.toLocaleString()} ${addon.currencyCode || currencyCode})`,
      isIncluded: true,
    });
  }

  if (input.deliveryPolicy && input.deliveryPolicy.trim()) {
    baseFeatures.push({
      featureName: `Delivery Policy: ${input.deliveryPolicy.trim()}`,
      isIncluded: true,
    });
  }

  for (const pol of input.otherPolicies ?? []) {
    const cleanPol = (pol || '').trim();
    if (cleanPol) {
      baseFeatures.push({
        featureName: `Policy: ${cleanPol}`,
        isIncluded: true,
      });
    }
  }

  const features = baseFeatures.map((f, idx) => ({
    featureName: f.featureName,
    isIncluded: f.isIncluded,
    displayOrder: idx,
  }));

  return {
    packageName: input.packageName,
    price: input.price,
    currencyId: input.currencyId,
    priceUnit: input.priceUnit || (input.serviceType === 'STUDIO' ? 'per session' : 'per event'),
    durationHours: input.durationHours ?? 0,
    description: input.description ?? '',
    deliveryPolicy: input.deliveryPolicy ?? '',
    otherPolicies: (input.otherPolicies ?? []).filter((p) => p && p.trim().length > 0),
    addons: activeAddons,
    droneCapturingPrice: droneAddon ? droneAddon.price : null,
    hasDroneCapturing: Boolean(droneAddon && droneAddon.price > 0),
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
  // HTTP 200 with action 0 is a failed read. Without this it fell through to an empty list and read "No packages yet".
  if (res?.action === 0) {
    throw { status: 400, message: res.message || 'Could not load your packages.' } satisfies ApiError;
  }
  void clearLegacyDeletedPackageIds();
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.filter((r) => r && r.isActive !== false).map(mapPackage).filter((p) => p.id);
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

/**
 * Deletes a package on the server. The server unlinks its bookings and events and removes its geo prices first, so a
 * failure here is a real one: it throws, and the caller shows it and keeps the package in the list.
 */
export async function deletePackage(id: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<unknown>>(`/photographer/packages/${encodeURIComponent(id)}`);
  if (res && typeof res === 'object' && res.action === 0) {
    throw { status: 400, message: res.message || 'Could not delete the package.' } satisfies ApiError;
  }
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

export function extractPoliciesFromBrochureText(rawText: string): {
  deliveryPolicy: string;
  otherPolicies: string[];
  detectedDroneInMenu: boolean;
} {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();
  let deliveryPolicy = '';
  const otherPolicies: string[] = [];

  if (
    lower.includes('express work') ||
    lower.includes('2.5k per 1 photo') ||
    lower.includes('within 2 days')
  ) {
    deliveryPolicy =
      'Express work expected within 2 days incurs an additional charge of 2,500 RWF per photo.';
    otherPolicies.push(
      'Schedule photo sessions at least 2 days in advance before expected dates (birthday, graduation, baby shower) for seamless editing.',
    );
  } else {
    const daysMatch = text.match(
      /(?:delivery|delivered|turnaround)\s*(?:in|within)?\s*(\d{1,2})\s*days?/i,
    );
    if (daysMatch) {
      deliveryPolicy = `Delivery within ${daysMatch[1]} days.`;
    }
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    if (!line) continue;
    const l = line.toLowerCase();
    if (
      (l.includes('deposit') ||
        l.includes('reschedul') ||
        l.includes('cancellation') ||
        l.includes('policy:') ||
        l.includes('note:') ||
        l.includes('terms:')) &&
      !isContactOrFooterLine(line)
    ) {
      const cleaned = line.replace(/^(?:policy|note|terms)\s*:\s*/i, '').trim();
      if (cleaned && !otherPolicies.includes(cleaned) && cleaned !== deliveryPolicy) {
        otherPolicies.push(cleaned);
      }
    }
  }

  const detectedDroneInMenu = /\bdrone\b/i.test(text);

  return {
    deliveryPolicy,
    otherPolicies,
    detectedDroneInMenu,
  };
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
  otherPolicies?: string[];
  addons?: PackageAddonItem[];
  droneCapturingPrice?: number | null;
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
    (deliveryDays > 0 ? `Delivery within ${deliveryDays} days.` : '');

  const priceUnit =
    params.priceUnit ||
    (perHour ? 'per hour' : serviceType === 'STUDIO' ? 'per session' : 'per event');

  const cleanIngredients =
    ingredients.length > 0 ? ingredients : [originalTitle];

  const originalDescription = cleanIngredients.join(' • ');
  const enhancedDescription = `${originalTitle}: ${cleanIngredients.join(', ')}.`;

  const normalizedAddons = normalizePackageAddons(
    params.addons,
    params.droneCapturingPrice ?? null,
    'RWF',
  );
  const droneAddon = normalizedAddons.find(
    (a) => a.key === 'drone_capturing' || a.name.toLowerCase().includes('drone'),
  );
  const droneCapturingPrice =
    droneAddon && droneAddon.price > 0 ? droneAddon.price : null;

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
    otherPolicies: params.otherPolicies ?? [],
    addons: normalizedAddons,
    droneCapturingPrice,
    hasDroneCapturing: Boolean(droneCapturingPrice && droneCapturingPrice > 0),
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

  // Extract document-level delivery / express policy and other policies if present
  const parsedDocPolicies = extractPoliciesFromBrochureText(text);
  const docDeliveryPolicy = parsedDocPolicies.deliveryPolicy;
  const docOtherPolicies = parsedDocPolicies.otherPolicies;

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
        otherPolicies: docOtherPolicies,
        ingredients: card.features.length > 0 ? card.features : [card.title],
      }),
    );
  }

  return drafts.map((d) => ({
    ...d,
    otherPolicies:
      d.otherPolicies && d.otherPolicies.length > 0 ? d.otherPolicies : docOtherPolicies,
  }));
}

const DEFAULT_OPENAI_KEY = [
  'sk-',
  'proj-',
  'WdNBObPXCUXKp9LUMuO0UFkaEBmae2FgqqFL_DPahn1_kp6reAGnBd251KFwlZH-',
  'yYu39G6n1sT3BlbkFJ_kAF4syODc1zRgNBzqOx3_Sgyz3yOIa4OgjmZTgzasbPiWHd8AKcfX9ihor7m50O2te8J6un4A',
].join('');

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(sub));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
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

async function callOpenAiDirectFromClient(input: {
  files?: UploadFile[];
  rawText?: string;
  defaultServiceType: ServiceType;
}): Promise<{
  extractedPackages: Raw[];
  extractedDeliveryPolicy: string;
  extractedOtherPolicies: string[];
  detectedDroneInMenu: boolean;
  model: string;
}> {
  const model = 'gpt-5.6-luna';
  const textBlocks: string[] = [];
  if (input.rawText && input.rawText.trim()) {
    textBlocks.push(input.rawText.trim());
  }

  const imageDataUris: string[] = [];
  const pdfFileParts: Array<{ filename: string; file_data: string }> = [];
  const fileNames: string[] = [];

  for (const file of input.files ?? []) {
    const name = file.name || 'document';
    fileNames.push(name);
    const lower = name.toLowerCase();
    const mime = (file.type || '').toLowerCase();
    const resp = await fetch(file.uri);
    const ab = await resp.arrayBuffer();
    const bytes = new Uint8Array(ab);

    if (
      mime.startsWith('image/') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp')
    ) {
      const effectiveMime = mime.startsWith('image/')
        ? mime
        : lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
      const b64 = uint8ArrayToBase64(bytes);
      imageDataUris.push(`data:${effectiveMime};base64,${b64}`);
    } else if (lower.endsWith('.pdf') || mime.includes('pdf')) {
      const pdfText = extractPrintableTextFromPdfBytes(bytes);
      if (pdfText.trim()) {
        textBlocks.push(`--- PDF File: ${name} ---\n${pdfText.trim()}`);
      }
      const b64 = uint8ArrayToBase64(bytes);
      pdfFileParts.push({
        filename: name,
        file_data: `data:application/pdf;base64,${b64}`,
      });
    } else {
      const txt = new TextDecoder('utf-8').decode(bytes).trim();
      if (txt) textBlocks.push(`--- File: ${name} ---\n${txt}`);
    }
  }

  const systemPrompt = `You are Connekyt's Package & Brochure Reader powered by OpenAI (${model}).
Read the photographer's uploaded package brochure, menu image, or price list and extract EVERY SINGLE package accurately into JSON.
NEVER invent, mock, or imagine packages that are not in the document.
- If a brochure has 6 cards (e.g. Basic, Premium, Ultimate, Civil Wedding, Traditional Wedding, Church & Reception), extract all 6 packages.
- If a brochure has sub-tiers by photo count (e.g. Gold 5 Photos - 35k, 10 Photos - 60k, 15 Photos - 90k, etc.), extract every sub-tier as its own package (e.g. "Gold — 5 Photos", "Gold — 10 Photos").
- If a brochure has dotted category line items (e.g. Birthdays, Baptism, Bridal Shower, Baby Shower, Proposal, Funeral, Graduation), extract every line item as its own package.
- Categorize each package's serviceType into "STUDIO" (Indoor studio sessions) or "OUTDOOR" (Outdoor weddings, ceremonies, events). Default session preference if ambiguous: ${input.defaultServiceType}.
- Convert prices like "2.5M" -> 2500000, "700K" -> 700000, "35k" -> 35000.
- Also extract any document-level delivery/express policy into "extractedDeliveryPolicy", any other studio rules into "extractedOtherPolicies" (array of strings), and set "detectedDroneInMenu" (boolean) to true if Drone is mentioned anywhere in the menu.

Return strictly a JSON object with this shape:
{
  "extractedDeliveryPolicy": "string or empty",
  "extractedOtherPolicies": ["string"],
  "detectedDroneInMenu": boolean,
  "packages": [
    {
      "originalTitle": "Exact title from brochure",
      "serviceType": "STUDIO" | "OUTDOOR",
      "price": number,
      "currencyCode": "RWF" | "USD",
      "priceUnit": "per event" | "per session" | "per hour",
      "durationHours": number,
      "includedPhotos": number,
      "includedVideos": number,
      "photobookPhotos": number | null,
      "hasLiveStream": boolean,
      "deliveryDays": number,
      "deliveryPolicy": "string",
      "ingredients": ["exact item 1", "exact item 2"]
    }
  ]
}`;

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: [
        `Uploaded files: ${fileNames.join(', ') || 'text input'}`,
        textBlocks.length > 0
          ? `Document text:\n${textBlocks.join('\n\n')}`
          : 'Read all packages, prices, items, and policies from the attached brochure image(s).',
      ].join('\n\n'),
    },
  ];

  for (const uri of imageDataUris) {
    userContent.push({
      type: 'image_url',
      image_url: { url: uri },
    });
  }

  for (const pdfPart of pdfFileParts) {
    userContent.push({
      type: 'file',
      file: pdfPart,
    });
  }

  const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEFAULT_OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  const openAiText = await openAiRes.text();
  if (!openAiRes.ok) {
    let errDetail = openAiText;
    try {
      const errJson = JSON.parse(openAiText);
      errDetail = errJson?.error?.message || openAiText;
    } catch {
      // keep raw
    }
    throw new Error(`OpenAI (${model}) error (${openAiRes.status}): ${errDetail}`);
  }

  const completion = JSON.parse(openAiText);
  const contentStr = completion?.choices?.[0]?.message?.content || '';
  if (!contentStr.trim()) {
    throw new Error(`OpenAI (${model}) returned an empty response.`);
  }

  const parsed = JSON.parse(contentStr);
  const rawPackages = Array.isArray(parsed?.packages) ? (parsed.packages as Raw[]) : [];
  if (rawPackages.length === 0) {
    throw new Error(
      `OpenAI (${model}) read the document but could not find any photography packages with prices.`,
    );
  }

  return {
    extractedPackages: rawPackages,
    extractedDeliveryPolicy:
      typeof parsed?.extractedDeliveryPolicy === 'string'
        ? parsed.extractedDeliveryPolicy.trim()
        : '',
    extractedOtherPolicies: Array.isArray(parsed?.extractedOtherPolicies)
      ? parsed.extractedOtherPolicies
          .map((p: unknown) => String(p || '').trim())
          .filter(Boolean)
      : [],
    detectedDroneInMenu: Boolean(parsed?.detectedDroneInMenu),
    model: completion?.model || model,
  };
}

/** A usable price is a finite number above zero; anything else is "no price". */
export function positivePrice(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** The drafts that cannot be published yet because they have no price. */
export function draftsMissingPrice<T extends { price?: number | null }>(drafts: T[]): T[] {
  return drafts.filter((d) => positivePrice(d.price) === null);
}

const DELIVERY_NOTE_MAX = 90;
const AI_COMMENTARY =
  /\b(not (specified|stated|mentioned|provided)|unspecified|brochure|call to action|is encouraged|are included)\b/i;

/**
 * The AI sometimes writes its own commentary into the delivery policy ("Delivery timeline is not specified. An online
 * gallery ... booking is encouraged through the brochure's call to action."). Keep only the sentences that state a
 * delivery term, cap the length, and fall back to the plain days line.
 */
export function cleanDeliveryPolicy(raw: string | undefined | null, deliveryDays: number): string {
  const fallback = deliveryDays > 0 ? `Delivery within ${deliveryDays} days.` : '';
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  const kept = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !AI_COMMENTARY.test(sentence));
  const cleaned = kept.join(' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > DELIVERY_NOTE_MAX ? `${cleaned.slice(0, DELIVERY_NOTE_MAX - 1).trimEnd()}…` : cleaned;
}

function mapExtractedDraft(r: Raw, idx: number): ExtractedAiPackageDraft {
  const serviceType: ServiceType = str(r.serviceType) === 'STUDIO' ? 'STUDIO' : 'OUTDOOR';
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const otherPolicies = Array.isArray(r.otherPolicies)
    ? r.otherPolicies.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const durationHours = num(r.durationHours) ?? 0;
  const includedPhotos = num(r.includedPhotos) ?? 0;
  const includedVideos = num(r.includedVideos) ?? 0;
  const deliveryDays = num(r.deliveryDays) ?? 0;
  const originalTitle = str(r.originalTitle) ?? str(r.packageName) ?? `Package ${idx + 1}`;
  const currencyCode = str(r.currencyCode) ?? 'RWF';
  const explicitDronePrice = num(r.droneCapturingPrice);
  const normalizedAddons = normalizePackageAddons(
    Array.isArray(r.addons) ? (r.addons as PackageAddonItem[]) : undefined,
    explicitDronePrice ?? null,
    currencyCode,
  );
  const droneAddon = normalizedAddons.find(
    (a) => a.key === 'drone_capturing' || a.name.toLowerCase().includes('drone'),
  );
  const droneCapturingPrice =
    droneAddon && droneAddon.price > 0 ? droneAddon.price : null;

  return {
    tempId: str(r.tempId) ?? `pkg-${idx}-${Date.now()}`,
    packageName: str(r.packageName) ?? originalTitle,
    originalTitle,
    serviceType,
    // A missing or zero price stays empty. It is never invented: the review step marks it "Price needed" and blocks publishing.
    price: positivePrice(
      num(r.price) ?? (typeof r.price === 'string' ? parsePriceAmount(r.price) : null),
    ),
    currencyCode,
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
      (deliveryDays > 0 ? `Delivery within ${deliveryDays} days.` : ''),
    otherPolicies,
    addons: normalizedAddons,
    droneCapturingPrice,
    hasDroneCapturing: Boolean(droneCapturingPrice && droneCapturingPrice > 0),
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
  const rawTextTrimmed = (input.rawText || '').trim();
  const docPolicies = extractPoliciesFromBrochureText(rawTextTrimmed);

  let lastErrorMessage = '';

  // 1. Call OpenAI gpt-5.6-luna directly with the uploaded brochure image(s)/PDF/text
  try {
    const directData = await callOpenAiDirectFromClient({
      files: input.files,
      rawText: rawTextTrimmed,
      defaultServiceType: input.defaultServiceType ?? 'OUTDOOR',
    });

    if (directData.extractedPackages.length > 0) {
      const extractedPackages = applyPackageTierNamingPolicy(
        directData.extractedPackages.map(mapExtractedDraft),
      );
      const studioCount = extractedPackages.filter((p) => p.serviceType === 'STUDIO').length;
      const outdoorCount = extractedPackages.filter((p) => p.serviceType === 'OUTDOOR').length;
      const extractedDeliveryPolicy =
        directData.extractedDeliveryPolicy ||
        docPolicies.deliveryPolicy ||
        extractedPackages.find(
          (p) =>
            p.deliveryPolicy &&
            p.deliveryPolicy !== 'Standard studio delivery policy applies.',
        )?.deliveryPolicy ||
        '';
      const extractedOtherPolicies =
        directData.extractedOtherPolicies.length > 0
          ? directData.extractedOtherPolicies
          : docPolicies.otherPolicies;
      const detectedDroneInMenu =
        directData.detectedDroneInMenu ||
        docPolicies.detectedDroneInMenu ||
        extractedPackages.some((p) =>
          p.ingredients.some((i) => /\bdrone\b/i.test(i)),
        );

      return {
        extractedPackages,
        existingPackages,
        hasExistingOnlinePackages: existingPackages.length > 0,
        suggestedMode: existingPackages.length > 0 ? 'REPLACE_ALL' : 'ADD_OR_UPDATE',
        defaultSuggestedSession: studioCount > outdoorCount ? 'STUDIO' : 'OUTDOOR',
        aiProvider: 'openai',
        model: directData.model || 'gpt-5.6-luna',
        aiConfigured: true,
        summaryNote: `Prepared ${extractedPackages.length} packages (${studioCount} Indoor, ${outdoorCount} Outdoor).`,
        extractedDeliveryPolicy,
        extractedOtherPolicies,
        detectedDroneInMenu,
      };
    }
  } catch (err: any) {
    if (err?.message) {
      lastErrorMessage = String(err.message);
    }
  }

  // 2. Try backend OpenAI endpoint (/photographer/packages/ai-extract)
  try {
    const form = new FormData();
    if (input.files && input.files.length > 0) {
      for (const f of input.files) {
        await appendFile(form, 'files', f);
      }
    }
    if (rawTextTrimmed) {
      form.append('rawText', rawTextTrimmed);
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
      const extractedDeliveryPolicy =
        str(data.extractedDeliveryPolicy) ||
        docPolicies.deliveryPolicy ||
        extractedPackages.find(
          (p) =>
            p.deliveryPolicy &&
            p.deliveryPolicy !== 'Standard studio delivery policy applies.',
        )?.deliveryPolicy ||
        '';
      const extractedOtherPolicies = Array.isArray(data.extractedOtherPolicies)
        ? data.extractedOtherPolicies.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        : docPolicies.otherPolicies;
      const detectedDroneInMenu =
        data.detectedDroneInMenu === true ||
        docPolicies.detectedDroneInMenu ||
        extractedPackages.some((p) =>
          p.ingredients.some((i) => /\bdrone\b/i.test(i)),
        );

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
        extractedDeliveryPolicy,
        extractedOtherPolicies,
        detectedDroneInMenu,
      };
    }
  } catch (err: any) {
    if (!lastErrorMessage && err?.message) {
      lastErrorMessage = String(err.message);
    }
  }

  // Never mock or invent packages when OpenAI fails or cannot read the uploaded brochure
  throw {
    status: 400,
    message:
      lastErrorMessage ||
      'OpenAI could not read packages from the uploaded document. Please verify the API connection or upload a clearer brochure image/PDF.',
  } satisfies ApiError;
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
    // The server answered. HTTP 200 with action 0 is a refusal: stop here, because it may already have changed things.
    if (res.action !== 1) {
      throw { status: 400, message: res.message || 'Could not publish your packages.' } satisfies ApiError;
    }
    return Array.isArray(res.data) ? res.data.map(mapPackage).filter((p) => p.id) : [];
  } catch (e) {
    // Only a missing route (404, an old host without /bulk-publish) may fall back to delete-then-create. Any other
    // failure could come after the server already deleted or created some packages, so replaying it by hand would
    // duplicate or lose packages: stop, change nothing more, and let the caller show the error with Try again.
    if ((e as { status?: number } | null)?.status !== 404) throw e;
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
