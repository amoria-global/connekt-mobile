import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoneyInput, useMoneyCurrency } from '@/components/ui/MoneyInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { Chip, IconTile, SegmentedTabs } from '@/features/photographer/kit';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { OptionsNote } from '@/components/ui/OptionsNote';
import {
  DEFAULT_PACKAGE_ADDON_TEMPLATES,
  EXTENDED_POLICY_TIERS,
  POLICY_PACKAGE_TIERS,
  QUICK_DELIVERY_POLICY_PRESETS,
  QUICK_OTHER_POLICY_PRESETS,
  applyPackageTierNamingPolicy,
  bulkPublishPackages,
  createPackage,
  draftsMissingPrice,
  extractPackagesWithAi,
  listPackages,
  normalizePackageAddons,
  updatePackage,
  type BulkPublishMode,
  type CreatePackageInput,
  type ExtractedAiPackageDraft,
  type Package,
  type PackageAddonItem,
  type PackageFeatureItem,
  type ServiceType,
} from '@/features/packages/api';
import { useErrors } from '@/features/errors/useErrors';
import { listCurrencies } from '@/features/reference/api';
import { tp } from '@/i18n/plural';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme, onFill, shadows } from '@/theme';
import type { UploadFile } from '@/utils/upload';

type FlowMode = 'ai' | 'manual';
type AiStep = 1 | 2 | 3 | 'done';

type PickedBrochureFile = UploadFile & {
  id: string;
  sizeLabel?: string;
  badge: 'PDF' | 'JPG' | 'PNG' | 'DOC';
};

const PRICE_UNITS = [
  { value: 'per session', label: 'Per session' },
  { value: 'per event', label: 'Per event' },
  { value: 'per hour', label: 'Per hour' },
  { value: 'per day', label: 'Per day' },
] as const;

const QUICK_MANUAL_ITEMS_INDOOR = [
  '2 hours indoor studio session',
  'Professional studio lighting & backdrops',
  '50 edited high-resolution photos',
  'Online gallery storage',
  'Delivery within 3 days',
];

const QUICK_MANUAL_ITEMS_OUTDOOR = [
  'Full outdoor event coverage (up to 8 hours)',
  '2 professional photographers',
  '300+ edited high-resolution photos',
  'Highlight video (3-5 min)',
  'Printed A4 photobook',
  'Delivery within 7 days',
];

function badgeFromMimeOrName(name?: string, type?: string): 'PDF' | 'JPG' | 'PNG' | 'DOC' {
  const lower = `${name ?? ''} ${type ?? ''}`.toLowerCase();
  if (lower.includes('pdf')) return 'PDF';
  if (lower.includes('png')) return 'PNG';
  if (lower.includes('doc')) return 'DOC';
  return 'JPG';
}

function formatBytes(bytes?: number): string | undefined {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return undefined;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function NewPackageScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    data?: string;
    mode?: string;
    replace?: string;
    serviceType?: string;
  }>();

  const isEditing = !!params.editId;
  const edit = useMemo<Package | null>(() => {
    if (!params.data) return null;
    try {
      return JSON.parse(params.data) as Package;
    } catch {
      return null;
    }
  }, [params.data]);

  const initialMode: FlowMode =
    isEditing || params.mode === 'manual' ? 'manual' : 'ai';

  const [flowMode, setFlowMode] = useState<FlowMode>(initialMode);
  const [aiStep, setAiStep] = useState<AiStep>(1);

  const currencies = useAsync(useCallback(() => listCurrencies(), []));
  const existingPackagesAsync = useAsync(useCallback(() => listPackages(), []));
  const [currencyId, setCurrencyId] = useMoneyCurrency(currencies.data, edit?.currencyId);

  // ───────── AI Upload & Extraction State ─────────
  const [pickedFiles, setPickedFiles] = useState<PickedBrochureFile[]>([]);
  const [brochureText, setBrochureText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [defaultSession, setDefaultSession] = useState<ServiceType>(
    params.serviceType === 'STUDIO' ? 'STUDIO' : 'OUTDOOR',
  );
  const [publishMode, setPublishMode] = useState<BulkPublishMode>(
    params.replace === '1' ? 'REPLACE_ALL' : 'ADD_OR_UPDATE',
  );
  const [extracting, setExtracting] = useState(false);
  const [extractedDrafts, setExtractedDrafts] = useState<ExtractedAiPackageDraft[]>([]);
  const [reviewSessionTab, setReviewSessionTab] = useState<ServiceType>('STUDIO');
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [newDraftIngredientText, setNewDraftIngredientText] = useState<Record<string, string>>({});
  const { showError } = useErrors();
  const [publishingBatch, setPublishingBatch] = useState(false);
  const [pdfPickerModalOpen, setPdfPickerModalOpen] = useState(false);
  const webFileInputRef = useRef<HTMLInputElement | null>(null);

  // ───────── Studio / Menu-Upload Policies & Self-Priced Add-ons State ─────────
  const [policyModalTarget, setPolicyModalTarget] = useState<'studio' | 'manual' | null>(null);
  const [addonsModalTarget, setAddonsModalTarget] = useState<'studio' | 'manual' | null>(null);
  const [studioDeliveryPolicy, setStudioDeliveryPolicy] = useState<string>('');
  const [studioOtherPolicies, setStudioOtherPolicies] = useState<string[]>([]);
  const [newStudioPolicyText, setNewStudioPolicyText] = useState<string>('');
  const [policyReadFromMenu, setPolicyReadFromMenu] = useState<boolean>(false);
  const [detectedDroneInMenu, setDetectedDroneInMenu] = useState<boolean>(false);
  const [studioAddonPrices, setStudioAddonPrices] = useState<Record<string, string>>({
    drone_capturing: '',
    express_delivery: '',
    extra_hour: '',
    fog_machine: '',
    extra_crew: '',
  });
  const [studioCustomAddons, setStudioCustomAddons] = useState<
    { key: string; name: string; priceText: string }[]
  >([]);
  const [newStudioAddonName, setNewStudioAddonName] = useState('');
  const [newStudioAddonPrice, setNewStudioAddonPrice] = useState('');

  // ───────── Manual Custom Upload / Edit State ─────────
  const [manualServiceType, setManualServiceType] = useState<ServiceType>(
    edit?.serviceType ?? (params.serviceType === 'STUDIO' ? 'STUDIO' : 'OUTDOOR'),
  );
  const [manualTier, setManualTier] = useState<string>(edit?.name ?? 'Diamond');
  const [customTitleText, setCustomTitleText] = useState<string>(
    edit?.name && !POLICY_PACKAGE_TIERS.includes(edit.name as never) ? edit.name : '',
  );
  const [useCustomTitle, setUseCustomTitle] = useState<boolean>(
    Boolean(edit?.name && !POLICY_PACKAGE_TIERS.includes(edit.name as never)),
  );
  const [manualPrice, setManualPrice] = useState<string>(
    edit?.price != null ? String(edit.price) : '',
  );
  const [manualPriceUnit, setManualPriceUnit] = useState<string>(
    edit?.priceUnit ?? (manualServiceType === 'STUDIO' ? 'per session' : 'per event'),
  );
  const [manualDurationHours, setManualDurationHours] = useState<string>(
    edit?.durationHours != null ? String(edit.durationHours) : manualServiceType === 'STUDIO' ? '2' : '8',
  );
  const [manualDeliveryDays, setManualDeliveryDays] = useState<string>(
    edit?.deliveryDays != null ? String(edit.deliveryDays) : manualServiceType === 'STUDIO' ? '3' : '7',
  );
  const [manualIncludedPhotos, setManualIncludedPhotos] = useState<string>(
    edit?.includedPhotos != null ? String(edit.includedPhotos) : manualServiceType === 'STUDIO' ? '50' : '300',
  );
  const [manualIncludedVideos, setManualIncludedVideos] = useState<string>(
    edit?.includedVideos != null ? String(edit.includedVideos) : manualServiceType === 'STUDIO' ? '0' : '1',
  );
  const [manualHasLiveStream, setManualHasLiveStream] = useState<boolean>(
    edit?.hasLiveStream ?? false,
  );
  const [manualDeliveryPolicy, setManualDeliveryPolicy] = useState<string>(
    edit?.deliveryPolicy ?? '',
  );
  const [manualOtherPolicies, setManualOtherPolicies] = useState<string[]>(
    () => edit?.otherPolicies ?? [],
  );
  const [newManualPolicyText, setNewManualPolicyText] = useState<string>('');
  const [manualAddonPrices, setManualAddonPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {
      drone_capturing:
        edit?.droneCapturingPrice && edit.droneCapturingPrice > 0
          ? String(edit.droneCapturingPrice)
          : '',
      express_delivery: '',
      extra_hour: '',
      fog_machine: '',
      extra_crew: '',
    };
    for (const addon of edit?.addons ?? []) {
      if (addon.price > 0 && addon.key in initial) {
        initial[addon.key] = String(addon.price);
      }
    }
    return initial;
  });
  const [manualCustomAddons, setManualCustomAddons] = useState<
    { key: string; name: string; priceText: string }[]
  >(() =>
    (edit?.addons ?? [])
      .filter(
        (a) =>
          a.price > 0 &&
          !DEFAULT_PACKAGE_ADDON_TEMPLATES.some((t) => t.key === a.key),
      )
      .map((a) => ({
        key: a.key,
        name: a.name,
        priceText: String(a.price),
      })),
  );
  const [newManualAddonName, setNewManualAddonName] = useState('');
  const [newManualAddonPrice, setNewManualAddonPrice] = useState('');
  const [manualDescription, setManualDescription] = useState<string>(edit?.description ?? '');
  const [manualItems, setManualItems] = useState<string[]>(() => {
    const fromFeatures = (edit?.features ?? [])
      .filter((f) => f.isIncluded !== false)
      .map((f) => f.featureName);
    if (fromFeatures.length > 0) return fromFeatures;
    return manualServiceType === 'STUDIO'
      ? ['2 hours indoor studio session', '50 edited high-resolution photos', 'Delivery within 3 days']
      : ['8 hours outdoor event coverage', '300+ edited high-resolution photos', 'Delivery within 7 days'];
  });
  const [newItemText, setNewItemText] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const existingPackages = useMemo(
    () => existingPackagesAsync.data ?? [],
    [existingPackagesAsync.data],
  );

  // ───────── File / Photo / PDF Pickers ─────────
  const handlePickPhotos = async () => {
    setServerError(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.length) return;
    const added: PickedBrochureFile[] = res.assets.map((a, idx) => {
      const name = a.fileName || `Package_Brochure_${idx + 1}.jpg`;
      const type = a.mimeType || 'image/jpeg';
      return {
        id: `${Date.now()}-${idx}`,
        uri: a.uri,
        name,
        type,
        sizeLabel: formatBytes(a.fileSize),
        badge: badgeFromMimeOrName(name, type),
      };
    });
    setPickedFiles((prev) => [...prev, ...added]);
  };

  const handleTakeBrochurePhoto = async () => {
    setServerError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setServerError('Camera permission is needed to photograph your package menu.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const name = a.fileName || `Menu_Photo_${Date.now()}.jpg`;
    const type = a.mimeType || 'image/jpeg';
    setPickedFiles((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        uri: a.uri,
        name,
        type,
        sizeLabel: formatBytes(a.fileSize),
        badge: badgeFromMimeOrName(name, type),
      },
    ]);
  };

  const handleOpenPdfDocumentPicker = () => {
    setServerError(null);
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
      return;
    }
    setPdfPickerModalOpen(true);
  };

  const buildAddonsListFromInputs = useCallback(
    (
      priceMap: Record<string, string>,
      customList: { key: string; name: string; priceText: string }[],
      currencyCode = 'RWF',
    ): PackageAddonItem[] => {
      const items: PackageAddonItem[] = [];
      for (const tpl of DEFAULT_PACKAGE_ADDON_TEMPLATES) {
        const raw = (priceMap[tpl.key] || '').replace(/[^\d.]/g, '');
        const numVal = raw ? Math.round(Number(raw)) : 0;
        const price = Number.isFinite(numVal) && numVal > 0 ? numVal : 0;
        items.push({
          key: tpl.key,
          name: tpl.name,
          price,
          currencyCode,
          // Having an amount (> 0) toggles the add-on ON for this photographer; 0/empty leaves it OFF
          enabled: price > 0,
        });
      }
      for (const c of customList) {
        const raw = (c.priceText || '').replace(/[^\d.]/g, '');
        const numVal = raw ? Math.round(Number(raw)) : 0;
        const price = Number.isFinite(numVal) && numVal > 0 ? numVal : 0;
        if (c.name.trim()) {
          items.push({
            key: c.key,
            name: c.name.trim(),
            price,
            currencyCode,
            enabled: price > 0,
          });
        }
      }
      return normalizePackageAddons(items, undefined, currencyCode);
    },
    [],
  );

  const studioAddonsList = useMemo(
    () => buildAddonsListFromInputs(studioAddonPrices, studioCustomAddons, 'RWF'),
    [buildAddonsListFromInputs, studioAddonPrices, studioCustomAddons],
  );

  const manualAddonsList = useMemo(
    () => buildAddonsListFromInputs(manualAddonPrices, manualCustomAddons, edit?.currency || 'RWF'),
    [buildAddonsListFromInputs, edit?.currency, manualAddonPrices, manualCustomAddons],
  );

  // ───────── Run Document Upload & Extraction ─────────
  const handleRunAiExtract = async () => {
    setServerError(null);
    if (pickedFiles.length === 0 && !brochureText.trim()) {
      setServerError(
        'Please upload a PDF or photo of your package brochure, or paste your package text below.',
      );
      return;
    }
    setExtracting(true);
    try {
      const res = await extractPackagesWithAi({
        files: pickedFiles,
        rawText: brochureText.trim() || undefined,
        defaultServiceType: defaultSession,
      });

      const menuDeliv = (res.extractedDeliveryPolicy || '').trim();
      const menuOthers = res.extractedOtherPolicies ?? [];
      const hasMenuPolicies = Boolean(menuDeliv || menuOthers.length > 0);
      setPolicyReadFromMenu(hasMenuPolicies);
      setDetectedDroneInMenu(Boolean(res.detectedDroneInMenu));

      const effectiveDeliveryPolicy = studioDeliveryPolicy.trim() || menuDeliv;
      if (!studioDeliveryPolicy.trim() && menuDeliv) {
        setStudioDeliveryPolicy(menuDeliv);
      }

      const mergedOtherPolicies = Array.from(
        new Set([...studioOtherPolicies, ...menuOthers].map((p) => p.trim()).filter(Boolean)),
      );
      if (mergedOtherPolicies.length !== studioOtherPolicies.length) {
        setStudioOtherPolicies(mergedOtherPolicies);
      }

      const activeAddons = studioAddonsList.filter((a) => a.enabled && a.price > 0);
      const droneAddon = activeAddons.find((a) => a.key === 'drone_capturing');
      const dronePrice = droneAddon && droneAddon.price > 0 ? droneAddon.price : null;

      const enrichedDrafts = res.extractedPackages.map((d) => ({
        ...d,
        deliveryPolicy: effectiveDeliveryPolicy || d.deliveryPolicy,
        otherPolicies:
          mergedOtherPolicies.length > 0 ? mergedOtherPolicies : (d.otherPolicies ?? []),
        addons: activeAddons,
        droneCapturingPrice: dronePrice,
        hasDroneCapturing: Boolean(dronePrice && dronePrice > 0),
      }));

      setExtractedDrafts(enrichedDrafts);
      if (res.hasExistingOnlinePackages && params.replace === '1') {
        setPublishMode('REPLACE_ALL');
      } else if (res.hasExistingOnlinePackages) {
        setPublishMode(res.suggestedMode);
      }
      const hasStudio = enrichedDrafts.some((p) => p.serviceType === 'STUDIO');
      const hasOutdoor = enrichedDrafts.some((p) => p.serviceType === 'OUTDOOR');
      setReviewSessionTab(hasStudio && !hasOutdoor ? 'STUDIO' : hasOutdoor ? 'OUTDOOR' : 'STUDIO');
      setAiStep(2);
    } catch (err) {
      setServerError(
        isApiError(err) ? err.message : 'Could not read the uploaded package document. Please try again.',
      );
    } finally {
      setExtracting(false);
    }
  };

  // ───────── Draft Helpers in Step 2 (Organize & Review) ─────────
  const updateDraftItem = useCallback(
    (tempId: string, patch: Partial<ExtractedAiPackageDraft>, reApplyPolicy = false) => {
      setExtractedDrafts((prev) => {
        const next = prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d));
        return reApplyPolicy ? applyPackageTierNamingPolicy(next) : next;
      });
    },
    [],
  );

  const deleteDraftItem = useCallback((tempId: string) => {
    setExtractedDrafts((prev) => applyPackageTierNamingPolicy(prev.filter((d) => d.tempId !== tempId)));
  }, []);

  const addExtraDraftPackage = useCallback((session: ServiceType) => {
    setExtractedDrafts((prev) => {
      const studio = session === 'STUDIO';
      const newDraft: ExtractedAiPackageDraft = {
        tempId: `extra-${Date.now()}`,
        packageName: 'Basic',
        originalTitle: studio ? 'Custom Studio Session' : 'Custom Outdoor Package',
        serviceType: session,
        price: null,
        currencyCode: 'RWF',
        priceUnit: studio ? 'per session' : 'per event',
        durationHours: studio ? 2 : 6,
        includedPhotos: studio ? 50 : 200,
        includedVideos: studio ? 0 : 1,
        photobookPhotos: null,
        hasLiveStream: false,
        deliveryDays: studio ? 3 : 7,
        deliveryPolicy:
          studioDeliveryPolicy.trim() ||
          `Delivery within ${studio ? 3 : 7} days via online gallery; 50% booking deposit.`,
        otherPolicies: studioOtherPolicies,
        addons: studioAddonsList.filter((a) => a.enabled && a.price > 0),
        droneCapturingPrice:
          studioAddonsList.find((a) => a.key === 'drone_capturing' && a.price > 0)?.price ?? null,
        hasDroneCapturing: Boolean(
          studioAddonsList.find((a) => a.key === 'drone_capturing' && a.price > 0),
        ),
        originalDescription: `${studio ? '2 hours studio session • 50 edited photos' : '6 hours outdoor coverage • 200 edited photos'}`,
        enhancedDescription: `${
          studio ? 'Professional indoor studio session' : 'Complete outdoor event coverage'
        } with edited high-resolution gallery delivery.`,
        ingredients: studio
          ? ['2 hours indoor studio session', '50 edited photos', 'Delivery in 3 days']
          : ['6 hours outdoor coverage', '200 edited photos', '1 highlight video', 'Delivery in 7 days'],
      };
      return applyPackageTierNamingPolicy([...prev, newDraft]);
    });
  }, [studioAddonsList, studioDeliveryPolicy, studioOtherPolicies]);

  const studioDrafts = useMemo(
    () => extractedDrafts.filter((d) => d.serviceType === 'STUDIO'),
    [extractedDrafts],
  );
  const outdoorDrafts = useMemo(
    () => extractedDrafts.filter((d) => d.serviceType === 'OUTDOOR'),
    [extractedDrafts],
  );
  const activeSessionDrafts = reviewSessionTab === 'STUDIO' ? studioDrafts : outdoorDrafts;

  const handleProceedToStep3 = () => {
    setServerError(null);
    const unpriced = draftsMissingPrice(extractedDrafts);
    if (unpriced.length > 0) {
      setServerError(tp(t as never, 'b2_pkgl_priceNeededBlock', unpriced.length));
      return;
    }
    setAiStep(3);
  };

  // ───────── Publish Batch in Step 3 ─────────
  const handlePublishBatch = async () => {
    setServerError(null);
    const resolvedCurrencyId =
      currencyId || currencies.data?.[0]?.id || extractedDrafts.find((d) => d.currencyId)?.currencyId;
    if (!resolvedCurrencyId) {
      setServerError(t('b2_pkgNewErrCurrency'));
      return;
    }
    if (extractedDrafts.length === 0) {
      setServerError('Add at least one package before publishing.');
      return;
    }
    const unpriced = draftsMissingPrice(extractedDrafts);
    if (unpriced.length > 0) {
      setServerError(tp(t as never, 'b2_pkgl_priceNeededBlock', unpriced.length));
      return;
    }

    setPublishingBatch(true);
    try {
      const activeStudioAddons = studioAddonsList.filter((a) => a.enabled && a.price > 0);
      const studioDronePrice =
        activeStudioAddons.find((a) => a.key === 'drone_capturing')?.price ?? null;
      const normalized = applyPackageTierNamingPolicy(extractedDrafts);
      const inputs: CreatePackageInput[] = normalized.map((d) => {
        const pkgAddons =
          d.addons && d.addons.some((a) => a.enabled && a.price > 0)
            ? d.addons.filter((a) => a.enabled && a.price > 0)
            : activeStudioAddons;
        const pkgDronePrice =
          d.droneCapturingPrice && d.droneCapturingPrice > 0
            ? d.droneCapturingPrice
            : studioDronePrice;
        const pkgDeliveryPolicy = studioDeliveryPolicy.trim() || d.deliveryPolicy;
        const pkgOtherPolicies =
          d.otherPolicies && d.otherPolicies.length > 0 ? d.otherPolicies : studioOtherPolicies;

        return {
          packageName: d.packageName,
          price: d.price as number, // never null here: the guard above blocks an unpriced draft
          currencyId: d.currencyId || resolvedCurrencyId,
          currencyCode: d.currencyCode || 'RWF',
          priceUnit: d.priceUnit || (d.serviceType === 'STUDIO' ? 'per session' : 'per event'),
          durationHours: d.durationHours,
          includedPhotos: d.includedPhotos,
          includedVideos: d.includedVideos,
          photobookPhotos: d.photobookPhotos ?? null,
          hasLiveStream: d.hasLiveStream,
          deliveryDays: d.deliveryDays,
          serviceType: d.serviceType,
          deliveryPolicy: pkgDeliveryPolicy,
          otherPolicies: pkgOtherPolicies,
          addons: pkgAddons,
          droneCapturingPrice: pkgDronePrice,
          hasDroneCapturing: Boolean(pkgDronePrice && pkgDronePrice > 0),
          description: d.enhancedDescription || d.originalDescription,
          features: d.ingredients.map((itemName, idx) => ({
            featureName: itemName,
            isIncluded: true,
            displayOrder: idx,
          })),
        };
      });

      await bulkPublishPackages({
        mode: publishMode,
        enforceTierPolicy: true,
        packages: inputs,
        existingPackages,
      });

      setAiStep('done');
    } catch (err) {
      showError(err, { intent: 'save' }, { onRetry: () => void handlePublishBatch(), where: 'package.bulkPublish' });
    } finally {
      setPublishingBatch(false);
    }
  };

  // ───────── Submit Manual Custom Package ─────────
  const handleManualSubmit = async () => {
    setServerError(null);
    const resolvedCurrencyId = currencyId || currencies.data?.[0]?.id;
    if (!resolvedCurrencyId) {
      setServerError(t('b2_pkgNewErrCurrency'));
      return;
    }
    const priceNum = Number(String(manualPrice).replace(/,/g, '').trim());
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setServerError('Please enter a valid package price.');
      return;
    }

    const chosenName =
      useCustomTitle && customTitleText.trim()
        ? customTitleText.trim()
        : manualTier;

    const features: PackageFeatureItem[] = manualItems
      .map((s) => s.trim())
      .filter(Boolean)
      .map((featureName, idx) => ({
        featureName,
        isIncluded: true,
        displayOrder: idx,
      }));

    const activeManualAddons = manualAddonsList.filter((a) => a.enabled && a.price > 0);
    const manualDronePrice =
      activeManualAddons.find((a) => a.key === 'drone_capturing')?.price ?? null;
    const selectedCurrCode =
      currencies.data?.find((c) => c.id === resolvedCurrencyId)?.code || edit?.currency || 'RWF';

    const combinedDescription = [
      manualDescription.trim(),
      manualDeliveryPolicy.trim() ? `Delivery policy: ${manualDeliveryPolicy.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    const input: CreatePackageInput = {
      packageName: chosenName,
      price: priceNum,
      currencyId: resolvedCurrencyId,
      currencyCode: selectedCurrCode,
      priceUnit: manualPriceUnit,
      durationHours: Number(manualDurationHours) || 0,
      includedPhotos: Number(manualIncludedPhotos) || 0,
      includedVideos: Number(manualIncludedVideos) || 0,
      hasLiveStream: manualHasLiveStream,
      deliveryDays: Number(manualDeliveryDays) || 0,
      serviceType: manualServiceType,
      deliveryPolicy: manualDeliveryPolicy.trim(),
      otherPolicies: manualOtherPolicies.filter((p) => p.trim().length > 0),
      addons: activeManualAddons,
      droneCapturingPrice: manualDronePrice,
      hasDroneCapturing: Boolean(manualDronePrice && manualDronePrice > 0),
      description: combinedDescription || features.map((f) => f.featureName).join(' • '),
      features,
    };

    setManualSubmitting(true);
    try {
      if (isEditing && params.editId) {
        await updatePackage(params.editId, input);
      } else {
        await createPackage(input);
      }
      router.back();
    } catch (err) {
      setServerError(isApiError(err) ? err.message : t('b2_pkgNewErrGeneric'));
    } finally {
      setManualSubmitting(false);
    }
  };

  const renderPoliciesAndAddonsSection = (target: 'studio' | 'manual') => {
    const isStudio = target === 'studio';
    const deliveryVal = (isStudio ? studioDeliveryPolicy : manualDeliveryPolicy).trim();
    const otherList = isStudio ? studioOtherPolicies : manualOtherPolicies;
    const hasDelivery = Boolean(deliveryVal);
    const activeAddons = (isStudio ? studioAddonsList : manualAddonsList).filter(
      (a) => a.enabled && a.price > 0,
    );
    const droneAddon = activeAddons.find((a) => a.key === 'drone_capturing');

    return (
      <View style={styles.stageActionTriggersRow}>
        {/* 1. Add Delivery Policy Button (Opens Delivery Policy Modal) */}
        <Pressable
          onPress={() => {
            setServerError(null);
            setPolicyModalTarget(target);
          }}
          style={[
            styles.stageTriggerCard,
            hasDelivery && styles.stageTriggerCardDone,
          ]}
          accessibilityRole="button"
          testID={`open-delivery-policy-modal-${target}`}
        >
          <View style={styles.rowBetween}>
            <View style={styles.stageTriggerIconWrap}>
              <Ionicons
                name={hasDelivery ? 'shield-checkmark' : 'shield-checkmark-outline'}
                size={18}
                color={hasDelivery ? colors.primary : colors.textSoft}
              />
            </View>
            <View
              style={[
                styles.stageTriggerBadge,
                hasDelivery ? styles.stageTriggerBadgeSaved : styles.stageTriggerBadgeNeutral,
              ]}
            >
              <Text
                style={[
                  styles.stageTriggerBadgeText,
                  hasDelivery
                    ? styles.stageTriggerBadgeTextSaved
                    : styles.stageTriggerBadgeTextNeutral,
                ]}
              >
                {hasDelivery
                  ? isStudio && policyReadFromMenu
                    ? '✓ FROM MENU'
                    : '✓ SAVED'
                  : 'OPTIONAL'}
              </Text>
            </View>
          </View>
          <Text style={styles.stageTriggerTitle}>
            {hasDelivery ? 'Delivery Policy' : 'Add Delivery Policy'}
          </Text>
          <Text style={styles.stageTriggerSub} numberOfLines={1}>
            {hasDelivery
              ? `${deliveryVal}${otherList.length > 0 ? ` (+${otherList.length} more)` : ''}`
              : 'Tap to add delivery & studio rules'}
          </Text>
        </Pressable>

        {/* 2. Add-ons & Drone Capturing Button (Opens Add-ons Modal) */}
        <Pressable
          onPress={() => {
            setServerError(null);
            setAddonsModalTarget(target);
          }}
          style={[
            styles.stageTriggerCard,
            activeAddons.length > 0 && styles.stageTriggerCardDone,
          ]}
          accessibilityRole="button"
          testID={`open-addons-modal-${target}`}
        >
          <View style={styles.rowBetween}>
            <View style={styles.stageTriggerIconWrap}>
              <Ionicons
                name="airplane"
                size={18}
                color={activeAddons.length > 0 ? colors.primary : colors.textSoft}
              />
            </View>
            <View
              style={[
                styles.stageTriggerBadge,
                activeAddons.length > 0
                  ? styles.stageTriggerBadgeSaved
                  : styles.stageTriggerBadgeNeutral,
              ]}
            >
              <Text
                style={[
                  styles.stageTriggerBadgeText,
                  activeAddons.length > 0
                    ? styles.stageTriggerBadgeTextSaved
                    : styles.stageTriggerBadgeTextNeutral,
                ]}
              >
                {droneAddon
                  ? `DRONE ON · +${Math.round(droneAddon.price / 1000)}K`
                  : activeAddons.length > 0
                    ? `${activeAddons.length} ACTIVE`
                    : 'OPTIONAL'}
              </Text>
            </View>
          </View>
          <Text style={styles.stageTriggerTitle}>Add-ons & Drone</Text>
          <Text style={styles.stageTriggerSub} numberOfLines={1}>
            {activeAddons.length > 0
              ? activeAddons.map((a) => `${a.name} (+${a.price.toLocaleString()})`).join(' · ')
              : detectedDroneInMenu
                ? 'Drone spotted in menu · Tap to price'
                : 'Drone Capturing & self-priced extras'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderPolicyAndAddonsModals = () => {
    const activeTarget = policyModalTarget || addonsModalTarget || 'studio';
    const isStudio = activeTarget === 'studio';

    const deliveryVal = isStudio ? studioDeliveryPolicy : manualDeliveryPolicy;
    const setDeliveryVal = isStudio
      ? (val: string) => {
          setStudioDeliveryPolicy(val);
          setExtractedDrafts((prev) =>
            prev.map((d) => ({ ...d, deliveryPolicy: val || d.deliveryPolicy })),
          );
        }
      : setManualDeliveryPolicy;

    const otherList = isStudio ? studioOtherPolicies : manualOtherPolicies;
    const setOtherList = isStudio
      ? (updater: (prev: string[]) => string[]) => {
          setStudioOtherPolicies((prev) => {
            const next = updater(prev);
            setExtractedDrafts((drafts) =>
              drafts.map((d) => ({ ...d, otherPolicies: next })),
            );
            return next;
          });
        }
      : setManualOtherPolicies;

    const newPolicyInput = isStudio ? newStudioPolicyText : newManualPolicyText;
    const setNewPolicyInput = isStudio ? setNewStudioPolicyText : setNewManualPolicyText;

    const addonPrices = isStudio ? studioAddonPrices : manualAddonPrices;
    const updateAddonPrice = (key: string, rawVal: string) => {
      const cleanDigits = rawVal.replace(/[^\d]/g, '');
      if (isStudio) {
        setStudioAddonPrices((prev) => {
          const next = { ...prev, [key]: cleanDigits };
          const updatedAddons = buildAddonsListFromInputs(next, studioCustomAddons, 'RWF');
          const activeOnly = updatedAddons.filter((a) => a.enabled && a.price > 0);
          const dronePrice =
            activeOnly.find((a) => a.key === 'drone_capturing')?.price ?? null;
          setExtractedDrafts((drafts) =>
            drafts.map((d) => ({
              ...d,
              addons: activeOnly,
              droneCapturingPrice: dronePrice,
              hasDroneCapturing: Boolean(dronePrice && dronePrice > 0),
            })),
          );
          return next;
        });
      } else {
        setManualAddonPrices((prev) => ({ ...prev, [key]: cleanDigits }));
      }
    };

    const customAddons = isStudio ? studioCustomAddons : manualCustomAddons;
    const newAddonName = isStudio ? newStudioAddonName : newManualAddonName;
    const setNewAddonName = isStudio ? setNewStudioAddonName : setNewManualAddonName;
    const newAddonPrice = isStudio ? newStudioAddonPrice : newManualAddonPrice;
    const setNewAddonPrice = isStudio ? setNewStudioAddonPrice : setNewManualAddonPrice;

    const handleAddCustomAddon = () => {
      const cleanName = newAddonName.trim();
      const cleanDigits = newAddonPrice.replace(/[^\d]/g, '');
      if (!cleanName) return;
      const newEntry = {
        key: `custom_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`,
        name: cleanName,
        priceText: cleanDigits,
      };
      if (isStudio) {
        setStudioCustomAddons((prev) => {
          const next = [...prev, newEntry];
          const updatedAddons = buildAddonsListFromInputs(studioAddonPrices, next, 'RWF').filter(
            (a) => a.enabled && a.price > 0,
          );
          setExtractedDrafts((drafts) =>
            drafts.map((d) => ({ ...d, addons: updatedAddons })),
          );
          return next;
        });
      } else {
        setManualCustomAddons((prev) => [...prev, newEntry]);
      }
      setNewAddonName('');
      setNewAddonPrice('');
    };

    const handleUpdateCustomAddonPrice = (key: string, val: string) => {
      const cleanDigits = val.replace(/[^\d]/g, '');
      if (isStudio) {
        setStudioCustomAddons((prev) => {
          const next = prev.map((c) => (c.key === key ? { ...c, priceText: cleanDigits } : c));
          const updatedAddons = buildAddonsListFromInputs(studioAddonPrices, next, 'RWF').filter(
            (a) => a.enabled && a.price > 0,
          );
          setExtractedDrafts((drafts) =>
            drafts.map((d) => ({ ...d, addons: updatedAddons })),
          );
          return next;
        });
      } else {
        setManualCustomAddons((prev) =>
          prev.map((c) => (c.key === key ? { ...c, priceText: cleanDigits } : c)),
        );
      }
    };

    const handleRemoveCustomAddon = (key: string) => {
      if (isStudio) {
        setStudioCustomAddons((prev) => {
          const next = prev.filter((c) => c.key !== key);
          const updatedAddons = buildAddonsListFromInputs(studioAddonPrices, next, 'RWF').filter(
            (a) => a.enabled && a.price > 0,
          );
          setExtractedDrafts((drafts) =>
            drafts.map((d) => ({ ...d, addons: updatedAddons })),
          );
          return next;
        });
      } else {
        setManualCustomAddons((prev) => prev.filter((c) => c.key !== key));
      }
    };

    const dronePriceNum = Number((addonPrices.drone_capturing || '').replace(/[^\d]/g, '')) || 0;
    const isDroneEnabled = dronePriceNum > 0;

    return (
      <>
        {/* ─── MODAL 1: DELIVERY POLICY & STUDIO RULES (OPTIONAL) ─── */}
        <Modal
          visible={policyModalTarget !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setPolicyModalTarget(null)}
        >
          <GlassScrim style={styles.modalBackdrop} onPress={() => setPolicyModalTarget(null)}>
            <GlassSheetHost style={styles.modalSheet}>
              <View style={styles.rowBetween}>
                <View style={styles.tierTitleRow}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Delivery Policy</Text>
                  <View style={[styles.stageTriggerBadge, styles.stageTriggerBadgeNeutral]}>
                    <Text style={[styles.stageTriggerBadgeText, styles.stageTriggerBadgeTextNeutral]}>
                      OPTIONAL
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setPolicyModalTarget(null)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSoft} />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ gap: spacing.sm }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Input
                  label="Delivery Turnaround Policy"
                  placeholder="e.g. Delivery in 5–7 days via online gallery"
                  value={deliveryVal}
                  onChangeText={setDeliveryVal}
                />

                <View style={styles.chipsRow}>
                  {QUICK_DELIVERY_POLICY_PRESETS.map((preset) => {
                    const active = deliveryVal.trim() === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => setDeliveryVal(preset)}
                        style={[styles.quickAddChip, active && styles.chipActive]}
                      >
                        <Ionicons
                          name={active ? 'checkmark' : 'add'}
                          size={12}
                          color={active ? onFill : colors.primary}
                        />
                        <Text
                          style={[styles.quickAddChipText, active && styles.chipTextActive]}
                          numberOfLines={1}
                        >
                          {preset}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { marginTop: spacing.xs }]}>Other Policies</Text>
                <View style={styles.chipsRow}>
                  {QUICK_OTHER_POLICY_PRESETS.map((preset) => {
                    const active = otherList.includes(preset);
                    return (
                      <Pressable
                        key={preset}
                        onPress={() =>
                          setOtherList((prev) =>
                            prev.includes(preset)
                              ? prev.filter((p) => p !== preset)
                              : [...prev, preset],
                          )
                        }
                        style={[styles.quickAddChip, active && styles.chipActive]}
                      >
                        <Ionicons
                          name={active ? 'checkmark' : 'add'}
                          size={12}
                          color={active ? onFill : colors.primary}
                        />
                        <Text
                          style={[styles.quickAddChipText, active && styles.chipTextActive]}
                          numberOfLines={1}
                        >
                          {preset}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.addItemInputRow}>
                  <TextInput
                    value={newPolicyInput}
                    onChangeText={setNewPolicyInput}
                    placeholder="Add custom rule..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.addItemTextInput}
                    onSubmitEditing={() => {
                      const clean = newPolicyInput.trim();
                      if (!clean) return;
                      setOtherList((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
                      setNewPolicyInput('');
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      const clean = newPolicyInput.trim();
                      if (!clean) return;
                      setOtherList((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
                      setNewPolicyInput('');
                    }}
                    style={styles.addItemBtn}
                  >
                    <Text style={styles.addItemBtnText}>+ Add</Text>
                  </Pressable>
                </View>

                {otherList.length > 0 ? (
                  <View style={styles.chipsRow}>
                    {otherList.map((pol, idx) => (
                      <Pressable
                        key={`${pol}-${idx}`}
                        onPress={() => setOtherList((prev) => prev.filter((_, i) => i !== idx))}
                        style={styles.removableItemChip}
                      >
                        <Text style={styles.removableItemChipText}>{pol}</Text>
                        <Ionicons name="close-circle" size={14} color={colors.error} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              <Button
                title="Save Delivery Policy"
                onPress={() => {
                  setServerError(null);
                  setPolicyModalTarget(null);
                }}
              />
            </GlassSheetHost>
          </GlassScrim>
        </Modal>

        {/* ─── MODAL 2: SELF-PRICED ADD-ONS & DRONE CAPTURING ─── */}
        <Modal
          visible={addonsModalTarget !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setAddonsModalTarget(null)}
        >
          <GlassScrim style={styles.modalBackdrop} onPress={() => setAddonsModalTarget(null)}>
            <GlassSheetHost style={styles.modalSheet}>
              <View style={styles.rowBetween}>
                <View style={styles.tierTitleRow}>
                  <Ionicons name="airplane" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Add-ons & Drone Capturing</Text>
                </View>
                <Pressable onPress={() => setAddonsModalTarget(null)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSoft} />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 440 }}
                contentContainerStyle={{ gap: spacing.sm }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Featured Drone Capturing Card */}
                <View
                  style={[
                    styles.droneFeatureCard,
                    isDroneEnabled && styles.droneFeatureCardActive,
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.tierTitleRow}>
                      <Ionicons
                        name="airplane"
                        size={16}
                        color={isDroneEnabled ? colors.primary : colors.textSoft}
                      />
                      <Text style={styles.droneFeatureTitle}>Drone Capturing</Text>
                    </View>
                    <View
                      style={[
                        styles.addonToggleIndicator,
                        isDroneEnabled
                          ? styles.addonToggleIndicatorOn
                          : styles.addonToggleIndicatorOff,
                      ]}
                    >
                      <Ionicons
                        name={isDroneEnabled ? 'checkmark-circle' : 'close-circle-outline'}
                        size={14}
                        color={isDroneEnabled ? onFill : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.addonToggleIndicatorText,
                          isDroneEnabled
                            ? styles.addonToggleIndicatorTextOn
                            : styles.addonToggleIndicatorTextOff,
                        ]}
                      >
                        {isDroneEnabled ? `ON · +${dronePriceNum.toLocaleString()} RWF` : 'OFF'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addonAmountInputRow}>
                    <TextInput
                      value={addonPrices.drone_capturing || ''}
                      onChangeText={(v) => updateAddonPrice('drone_capturing', v)}
                      placeholder="Enter amount (RWF) to toggle ON — e.g. 150000"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      style={styles.addonAmountInput}
                      testID={`drone-capturing-price-${activeTarget}`}
                    />
                    {isDroneEnabled ? (
                      <Pressable
                        onPress={() => updateAddonPrice('drone_capturing', '')}
                        style={styles.clearAddonBtn}
                      >
                        <Text style={styles.clearAddonBtnText}>Turn OFF</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Other Self-Priced Add-ons */}
                {DEFAULT_PACKAGE_ADDON_TEMPLATES.filter((tItem) => !tItem.isDrone).map((tpl) => {
                  const rawVal = addonPrices[tpl.key] || '';
                  const priceVal = Number(rawVal.replace(/[^\d]/g, '')) || 0;
                  const enabled = priceVal > 0;
                  return (
                    <View
                      key={tpl.key}
                      style={[styles.addonRowCard, enabled && styles.addonRowCardActive]}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.addonRowTitle}>{tpl.name}</Text>
                        <View
                          style={[
                            styles.addonMiniBadge,
                            enabled ? styles.addonMiniBadgeOn : styles.addonMiniBadgeOff,
                          ]}
                        >
                          <Text
                            style={[
                              styles.addonMiniBadgeText,
                              enabled ? styles.addonMiniBadgeTextOn : styles.addonMiniBadgeTextOff,
                            ]}
                          >
                            {enabled ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                      </View>
                      <TextInput
                        value={rawVal}
                        onChangeText={(v) => updateAddonPrice(tpl.key, v)}
                        placeholder="Amount (RWF)"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        style={styles.addonCompactInput}
                      />
                    </View>
                  );
                })}

                {customAddons.map((c) => {
                  const pVal = Number((c.priceText || '').replace(/[^\d]/g, '')) || 0;
                  const enabled = pVal > 0;
                  return (
                    <View
                      key={c.key}
                      style={[styles.addonRowCard, enabled && styles.addonRowCardActive]}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.addonRowTitle}>{c.name}</Text>
                        <View
                          style={[
                            styles.addonMiniBadge,
                            enabled ? styles.addonMiniBadgeOn : styles.addonMiniBadgeOff,
                          ]}
                        >
                          <Text
                            style={[
                              styles.addonMiniBadgeText,
                              enabled ? styles.addonMiniBadgeTextOn : styles.addonMiniBadgeTextOff,
                            ]}
                          >
                            {enabled ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                      </View>
                      <TextInput
                        value={c.priceText}
                        onChangeText={(v) => handleUpdateCustomAddonPrice(c.key, v)}
                        placeholder="Amount"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        style={styles.addonCompactInput}
                      />
                      <Pressable onPress={() => handleRemoveCustomAddon(c.key)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  );
                })}

                <View style={styles.addItemInputRow}>
                  <TextInput
                    value={newAddonName}
                    onChangeText={setNewAddonName}
                    placeholder="Custom add-on..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.addItemTextInput, { flex: 1.3 }]}
                  />
                  <TextInput
                    value={newAddonPrice}
                    onChangeText={(v) => setNewAddonPrice(v.replace(/[^\d]/g, ''))}
                    placeholder="Amount"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    style={[styles.addItemTextInput, { flex: 0.9 }]}
                  />
                  <Pressable onPress={handleAddCustomAddon} style={styles.addItemBtn}>
                    <Text style={styles.addItemBtnText}>+ Add</Text>
                  </Pressable>
                </View>
              </ScrollView>

              <Button title="Save Add-ons" onPress={() => setAddonsModalTarget(null)} />
            </GlassSheetHost>
          </GlassScrim>
        </Modal>
      </>
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Top Mode Switcher: Upload Document vs Manual Upload */}
        {!isEditing ? (
          <SegmentedTabs<FlowMode>
            label="How to add packages"
            value={flowMode}
            onChange={(k) => {
              setFlowMode(k);
              setServerError(null);
            }}
            tabs={[
              { key: 'ai', label: 'Upload document' },
              { key: 'manual', label: 'Add manually' },
            ]}
          />
        ) : (
          <Text style={styles.title}>{t('b2_pkgNewEditTitle')}</Text>
        )}

        {flowMode === 'ai' ? (
          <>
            {/* 3-Step Progress Indicator */}
            {aiStep !== 'done' ? (
              <View style={styles.stepBarCard}>
                {(
                  [
                    [1, '1 Upload'],
                    [2, '2 Organize'],
                    [3, '3 Publish'],
                  ] as [1 | 2 | 3, string][]
                ).map(([n, label]) => (
                  <Chip
                    key={n}
                    label={label}
                    selected={aiStep === n}
                    onPress={() => {
                      if (typeof aiStep === 'number' && aiStep > n) setAiStep(n);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════════
                STEP 1: UPLOAD DOCUMENT (PDF, JPG, PNG)
               ═══════════════════════════════════════════════════════════════════ */}
            {aiStep === 1 ? (
              <View style={styles.cardBox}>
                <View style={styles.cardHeaderRow}>
                  <IconTile icon="document-text-outline" />
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.eyebrow}>STEP 1 OF 3</Text>
                    <Text style={styles.sectionTitle}>Upload Document</Text>
                  </View>
                </View>

                {/* Hidden Web input for PDF/images on Web */}
                {Platform.OS === 'web'
                  ? React.createElement('input', {
                      ref: webFileInputRef,
                      type: 'file',
                      accept: '.pdf,image/*,.doc,.docx',
                      multiple: true,
                      style: { display: 'none' },
                      onChange: (e: { target?: { files?: FileList | null } }) => {
                        const fileList = e.target?.files;
                        if (!fileList || fileList.length === 0) return;
                        Array.from(fileList).forEach((f, idx) => {
                          const uri = URL.createObjectURL(f);
                          setPickedFiles((prev) => [
                            ...prev,
                            {
                              id: `web-${Date.now()}-${idx}`,
                              uri,
                              name: f.name,
                              type: f.type || 'application/pdf',
                              sizeLabel: formatBytes(f.size),
                              badge: badgeFromMimeOrName(f.name, f.type),
                            },
                          ]);
                        });
                      },
                    })
                  : null}

                {/* Dashed Dropzone / Upload Area */}
                <Pressable
                  onPress={handlePickPhotos}
                  style={styles.uploadDropzone}
                  accessibilityRole="button"
                  accessibilityLabel="Tap to upload package brochure or photo"
                >
                  <View style={styles.uploadCloudCircle}>
                    <Ionicons name="cloud-upload" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.dropzoneTitle}>
                    Drag & drop your package brochure or tap to upload
                  </Text>
                  <Text style={styles.dropzoneSub}>
                    Upload your package brochure (PDF, JPG, PNG)
                  </Text>

                  <View style={styles.formatBadgesRow}>
                    <View style={[styles.formatBadge, { backgroundColor: colors.dangerFill }]}>
                      <Text style={styles.formatBadgeText}>PDF</Text>
                    </View>
                    <View style={[styles.formatBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.formatBadgeText}>JPG</Text>
                    </View>
                    <View style={[styles.formatBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.formatBadgeText}>PNG</Text>
                    </View>
                  </View>
                </Pressable>

                {/* Upload Source Buttons: PDF/Document, Gallery Photo, Camera Scan */}
                <View style={styles.uploadButtonsRow}>
                  <Pressable
                    onPress={handleOpenPdfDocumentPicker}
                    style={styles.uploadSourceBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Choose PDF or Document"
                  >
                    <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                    <Text style={styles.uploadSourceBtnText}>Select PDF / File</Text>
                  </Pressable>

                  <Pressable
                    onPress={handlePickPhotos}
                    style={styles.uploadSourceBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Choose Photo from Gallery"
                  >
                    <Ionicons name="images-outline" size={16} color={colors.primary} />
                    <Text style={styles.uploadSourceBtnText}>Gallery Photo</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleTakeBrochurePhoto}
                    style={styles.uploadSourceBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Take Photo of Menu"
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.primary} />
                    <Text style={styles.uploadSourceBtnText}>Camera Scan</Text>
                  </Pressable>
                </View>

                {/* Selected Files List */}
                {pickedFiles.length > 0 ? (
                  <View style={styles.pickedFilesList}>
                    {pickedFiles.map((f) => (
                      <View key={f.id} style={styles.pickedFileRow}>
                        <View
                          style={[
                            styles.fileTypeBadge,
                            f.badge === 'PDF'
                              ? { backgroundColor: colors.dangerFill }
                              : f.badge === 'PNG'
                                ? { backgroundColor: colors.primary }
                                : { backgroundColor: colors.accent },
                          ]}
                        >
                          <Text style={styles.fileTypeBadgeText}>{f.badge}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickedFileName} numberOfLines={1}>
                            {f.name}
                          </Text>
                          {f.sizeLabel ? (
                            <Text style={styles.pickedFileSize}>{f.sizeLabel}</Text>
                          ) : null}
                        </View>
                        <Pressable
                          onPress={() =>
                            setPickedFiles((prev) => prev.filter((item) => item.id !== f.id))
                          }
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${f.name}`}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Optional Paste Package Text Toggle */}
                <Pressable
                  onPress={() => setShowPasteBox((v) => !v)}
                  style={styles.pasteToggleRow}
                  accessibilityRole="button"
                >
                  <Ionicons name="clipboard-outline" size={15} color={colors.primary} />
                  <Text style={styles.pasteToggleText}>
                    {showPasteBox
                      ? 'Hide pasted brochure / menu text'
                      : 'Or paste package menu text directly'}
                  </Text>
                  <Ionicons
                    name={showPasteBox ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={colors.textMuted}
                  />
                </Pressable>

                {showPasteBox ? (
                  <TextInput
                    value={brochureText}
                    onChangeText={setBrochureText}
                    placeholder="Paste your package brochure or price menu here (e.g. Studio Portrait 150,000 RWF - 2 hours, 50 edited photos, delivery in 3 days)..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={styles.pasteInput}
                  />
                ) : null}

                {/* Default Session Category Suggestion */}
                <View style={styles.group}>
                  <Text style={styles.label}>
                    Default session category (when a package does not specify Indoor vs Outdoor)
                  </Text>
                  <View style={styles.twoColRow}>
                    {(
                      [
                        ['STUDIO', 'home-outline', 'Indoor (Studio session)'],
                        ['OUTDOOR', 'sunny-outline', 'Outdoor (Outside studio)'],
                      ] as [ServiceType, keyof typeof Ionicons.glyphMap, string][]
                    ).map(([val, icon, label]) => {
                      const active = defaultSession === val;
                      return (
                        <Pressable
                          key={val}
                          onPress={() => setDefaultSession(val)}
                          style={[styles.choicePill, active && styles.choicePillActive]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <Ionicons
                            name={icon}
                            size={15}
                            color={active ? onFill : colors.primary}
                          />
                          <Text
                            style={[
                              styles.choicePillText,
                              active && styles.choicePillTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Existing Online Packages Suggestion Banner */}
                {existingPackages.length > 0 ? (
                  <View style={styles.existingBanner}>
                    <View style={styles.existingBannerHeader}>
                      <Ionicons name="layers-outline" size={16} color={colors.primary} />
                      <Text style={styles.existingBannerTitle}>
                        {`You have ${existingPackages.length} online package(s) (${
                          existingPackages.filter((p) => p.serviceType === 'STUDIO').length
                        } Indoor, ${
                          existingPackages.filter((p) => p.serviceType !== 'STUDIO').length
                        } Outdoor)`}
                      </Text>
                    </View>
                    <Text style={styles.existingBannerSub}>
                      Default suggestion: Replace existing online packages with your newly uploaded brochure, or keep and merge them.
                    </Text>
                    <View style={styles.twoColRow}>
                      <Pressable
                        onPress={() => setPublishMode('REPLACE_ALL')}
                        style={[
                          styles.choicePill,
                          publishMode === 'REPLACE_ALL' && styles.choicePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choicePillText,
                            publishMode === 'REPLACE_ALL' && styles.choicePillTextActive,
                          ]}
                        >
                          Replace Existing (Suggested)
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPublishMode('ADD_OR_UPDATE')}
                        style={[
                          styles.choicePill,
                          publishMode === 'ADD_OR_UPDATE' && styles.choicePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choicePillText,
                            publishMode === 'ADD_OR_UPDATE' && styles.choicePillTextActive,
                          ]}
                        >
                          Keep & Update
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

                <Button
                  title={extracting ? 'Uploading...' : 'Upload'}
                  onPress={handleRunAiExtract}
                  loading={extracting}
                />
              </View>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════════
                STEP 2: ORGANIZE & REVIEW PACKAGES PER SESSION (INDOOR VS OUTDOOR)
               ═══════════════════════════════════════════════════════════════════ */}
            {aiStep === 2 ? (
              <View style={{ gap: spacing.md }}>
                {/* Top Stage Modal Buttons: Add Delivery Policy (Required) & Add-ons / Drone */}
                {renderPoliciesAndAddonsSection('studio')}

                {/* Organize Packages: Indoor vs Outdoor Cards */}
                <View style={styles.twoColRow}>
                  <Pressable
                    onPress={() => setReviewSessionTab('STUDIO')}
                    style={[
                      styles.sessionCategoryCard,
                      reviewSessionTab === 'STUDIO' && styles.sessionCategoryCardActive,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: reviewSessionTab === 'STUDIO' }}
                  >
                    <View style={styles.sessionCategoryTop}>
                      <Ionicons
                        name="home-outline"
                        size={18}
                        color={reviewSessionTab === 'STUDIO' ? onFill : colors.primary}
                      />
                      <View style={styles.sessionCountBadge}>
                        <Text style={styles.sessionCountBadgeText}>{studioDrafts.length}</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.sessionCategoryTitle,
                        reviewSessionTab === 'STUDIO' && { color: onFill },
                      ]}
                    >
                      Indoor Packages
                    </Text>
                    <Text
                      style={[
                        styles.sessionCategorySub,
                        reviewSessionTab === 'STUDIO' && { color: 'rgba(255,255,255,0.85)' },
                      ]}
                    >
                      Studio, Portrait, Product
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setReviewSessionTab('OUTDOOR')}
                    style={[
                      styles.sessionCategoryCard,
                      reviewSessionTab === 'OUTDOOR' && styles.sessionCategoryCardActive,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: reviewSessionTab === 'OUTDOOR' }}
                  >
                    <View style={styles.sessionCategoryTop}>
                      <Ionicons
                        name="sunny-outline"
                        size={18}
                        color={reviewSessionTab === 'OUTDOOR' ? onFill : colors.primary}
                      />
                      <View style={styles.sessionCountBadge}>
                        <Text style={styles.sessionCountBadgeText}>{outdoorDrafts.length}</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.sessionCategoryTitle,
                        reviewSessionTab === 'OUTDOOR' && { color: onFill },
                      ]}
                    >
                      Outdoor Packages
                    </Text>
                    <Text
                      style={[
                        styles.sessionCategorySub,
                        reviewSessionTab === 'OUTDOOR' && { color: 'rgba(255,255,255,0.85)' },
                      ]}
                    >
                      Wedding, Event, Landscape
                    </Text>
                  </Pressable>
                </View>

                {/* Extracted Package Cards for Active Session */}
                {activeSessionDrafts.length === 0 ? (
                  <View style={styles.emptySessionBox}>
                    <Text style={styles.subtitleText}>
                      {`No ${reviewSessionTab === 'STUDIO' ? 'Indoor (Studio)' : 'Outdoor'} packages in this tab yet.`}
                    </Text>
                    <Pressable
                      onPress={() => addExtraDraftPackage(reviewSessionTab)}
                      style={styles.addExtraBtn}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                      <Text style={styles.addExtraBtnText}>
                        {`+ Add ${reviewSessionTab === 'STUDIO' ? 'Indoor' : 'Outdoor'} Package`}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  activeSessionDrafts.map((item, idx) => {
                    const isExpanded = expandedDraftId === item.tempId;
                    const isDiamond = idx === 0 || item.packageName === 'Diamond';
                    const draftIngInput = newDraftIngredientText[item.tempId] ?? '';

                    return (
                      <View
                        key={item.tempId}
                        style={[styles.extractedCard, isDiamond && styles.extractedCardDiamond]}
                      >
                        <View style={styles.extractedTopRow}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={styles.tierTitleRow}>
                              <Ionicons
                                name={isDiamond ? 'diamond' : 'layers-outline'}
                                size={16}
                                color={isDiamond ? colors.accent : colors.primary}
                              />
                              <Text style={styles.extractedTierName}>{item.packageName}</Text>
                            </View>
                            {item.originalTitle && item.originalTitle !== item.packageName ? (
                              <Text style={styles.originalTitleHint}>{item.originalTitle}</Text>
                            ) : null}
                          </View>

                          <View style={styles.pricePillPurple}>
                            <Text style={styles.pricePillPurpleText}>
                              {item.price ? `${Number(item.price).toLocaleString('en-US')} ${item.currencyCode || 'RWF'}` : t('b2_pkgl_priceNeeded')}
                            </Text>
                          </View>
                        </View>

                        {/* Session Switcher (Move between Indoor and Outdoor) */}
                        <View style={styles.moveSessionRow}>
                          <Text style={styles.moveSessionLabel}>Session:</Text>
                          {(
                            [
                              ['STUDIO', 'Indoor (Studio)'],
                              ['OUTDOOR', 'Outdoor (Events)'],
                            ] as [ServiceType, string][]
                          ).map(([sType, sLabel]) => {
                            const on = item.serviceType === sType;
                            return (
                              <Pressable
                                key={sType}
                                onPress={() =>
                                  updateDraftItem(item.tempId, { serviceType: sType }, true)
                                }
                                style={[
                                  styles.miniSessionChip,
                                  on && styles.miniSessionChipActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.miniSessionChipText,
                                    on && styles.miniSessionChipTextActive,
                                  ]}
                                >
                                  {sLabel}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {/* Key Summary Metrics (only shown when present in brochure) */}
                        {(item.durationHours > 0 ||
                          item.includedPhotos > 0 ||
                          item.includedVideos > 0 ||
                          item.deliveryDays > 0 ||
                          Boolean(item.deliveryPolicy)) ? (
                          <View style={styles.metricsSummaryList}>
                            {item.durationHours > 0 ? (
                              <Text style={styles.metricLine}>
                                {`📷  ${item.durationHours} ${
                                  item.durationHours === 1 ? 'hour' : 'hours'
                                } ${
                                  item.serviceType === 'STUDIO' ? 'studio session' : 'outdoor coverage'
                                }`}
                              </Text>
                            ) : null}
                            {item.includedPhotos > 0 || item.includedVideos > 0 ? (
                              <Text style={styles.metricLine}>
                                {`🖼️  ${
                                  item.includedPhotos > 0
                                    ? `${item.includedPhotos} edited photos`
                                    : ''
                                }${
                                  item.includedPhotos > 0 && item.includedVideos > 0 ? ' · ' : ''
                                }${item.includedVideos > 0 ? `${item.includedVideos} video(s)` : ''}`}
                              </Text>
                            ) : null}
                            {item.deliveryDays > 0 || item.deliveryPolicy ? (
                              <Text style={styles.metricLine}>
                                {item.deliveryDays > 0
                                  ? `⏱️  Delivery in ${item.deliveryDays} days${
                                    item.deliveryPolicy && !/^delivery\b/i.test(item.deliveryPolicy)
                                      ? ` (${item.deliveryPolicy})`
                                      : ''
                                  }`
                                  : `⏱️  ${item.deliveryPolicy}`}
                              </Text>
                            ) : null}
                            {(item.otherPolicies ?? []).map((pol, pIdx) => (
                              <Text key={`pol-${pIdx}`} style={styles.metricLine}>
                                {`📋  ${pol}`}
                              </Text>
                            ))}
                            {(item.addons ?? [])
                              .filter((a) => a.enabled && a.price > 0)
                              .map((addon) => (
                                <Text key={addon.key} style={styles.metricLine}>
                                  {`${addon.key === 'drone_capturing' ? '🚁' : '✨'}  ${addon.name} (Self-priced): +${addon.price.toLocaleString()} ${addon.currencyCode || item.currencyCode || 'RWF'}`}
                                </Text>
                              ))}
                          </View>
                        ) : null}

                        {/* Package Items & Description */}
                        <View style={styles.descriptionsComparisonBox}>
                          <View style={styles.descColumn}>
                            <Text style={styles.descColumnHeader}>Included Items</Text>
                            {item.ingredients.map((ing, i) => (
                              <Text key={`${ing}-${i}`} style={styles.descBulletText}>
                                {`• ${ing}`}
                              </Text>
                            ))}
                          </View>
                          <View style={styles.descColumn}>
                            <Text style={styles.descColumnHeader}>Description</Text>
                            <Text style={styles.descBodyText}>{item.enhancedDescription}</Text>
                          </View>
                        </View>

                        {/* Expandable Inline Editor */}
                        {isExpanded ? (
                          <View style={styles.inlineEditorBox}>
                            <Text style={styles.label}>Package Title</Text>
                            <View style={styles.chipsRow}>
                              {EXTENDED_POLICY_TIERS.slice(
                                0,
                                Math.max(POLICY_PACKAGE_TIERS.length, activeSessionDrafts.length),
                              ).map((tName) => {
                                const on = item.packageName === tName;
                                return (
                                  <Pressable
                                    key={tName}
                                    onPress={() =>
                                      updateDraftItem(item.tempId, { packageName: tName }, false)
                                    }
                                    style={[styles.chip, on && styles.chipActive]}
                                  >
                                    <Text style={[styles.chipText, on && styles.chipTextActive]}>
                                      {tName}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>

                            <View style={styles.twoColRow}>
                              <View style={{ flex: 1 }}>
                                <Input
                                  label="Price (RWF)"
                                  keyboardType="number-pad"
                                  value={item.price ? String(item.price) : ''}
                                  placeholder={t('b2_pkgl_priceNeeded')}
                                  onChangeText={(v) => {
                                    const n = Number(v.replace(/\D/g, ''));
                                    updateDraftItem(item.tempId, { price: n > 0 ? n : null }, true);
                                  }}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Input
                                  label="Duration (Hours)"
                                  keyboardType="number-pad"
                                  value={String(item.durationHours)}
                                  onChangeText={(v) =>
                                    updateDraftItem(item.tempId, {
                                      durationHours: Number(v.replace(/\D/g, '')) || 1,
                                    })
                                  }
                                />
                              </View>
                            </View>

                            <View style={styles.twoColRow}>
                              <View style={{ flex: 1 }}>
                                <Input
                                  label="Edited Photos"
                                  keyboardType="number-pad"
                                  value={String(item.includedPhotos)}
                                  onChangeText={(v) =>
                                    updateDraftItem(item.tempId, {
                                      includedPhotos: Number(v.replace(/\D/g, '')) || 0,
                                    })
                                  }
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Input
                                  label="Delivery Days"
                                  keyboardType="number-pad"
                                  value={String(item.deliveryDays)}
                                  onChangeText={(v) =>
                                    updateDraftItem(item.tempId, {
                                      deliveryDays: Number(v.replace(/\D/g, '')) || 1,
                                    })
                                  }
                                />
                              </View>
                            </View>

                            <Input
                              label="Delivery Policy & Conditions"
                              value={item.deliveryPolicy}
                              onChangeText={(v) =>
                                updateDraftItem(item.tempId, { deliveryPolicy: v })
                              }
                            />

                            <Input
                              label="Enhanced Description"
                              value={item.enhancedDescription}
                              multiline
                              onChangeText={(v) =>
                                updateDraftItem(item.tempId, { enhancedDescription: v })
                              }
                            />

                            {/* Add / Remove Ingredients */}
                            <Text style={styles.label}>Package Ingredients / Items</Text>
                            <View style={styles.chipsRow}>
                              {item.ingredients.map((ing, ingIdx) => (
                                <Pressable
                                  key={`${ing}-${ingIdx}`}
                                  onPress={() =>
                                    updateDraftItem(item.tempId, {
                                      ingredients: item.ingredients.filter((_, i) => i !== ingIdx),
                                    })
                                  }
                                  style={styles.removableItemChip}
                                >
                                  <Text style={styles.removableItemChipText}>{ing}</Text>
                                  <Ionicons name="close-circle" size={14} color={colors.error} />
                                </Pressable>
                              ))}
                            </View>
                            <View style={styles.addItemInputRow}>
                              <TextInput
                                value={draftIngInput}
                                onChangeText={(v) =>
                                  setNewDraftIngredientText((prev) => ({
                                    ...prev,
                                    [item.tempId]: v,
                                  }))
                                }
                                placeholder="Add package item (e.g. Drone shots, Makeup artist)..."
                                placeholderTextColor={colors.textMuted}
                                style={styles.addItemTextInput}
                              />
                              <Pressable
                                onPress={() => {
                                  const clean = draftIngInput.trim();
                                  if (!clean) return;
                                  updateDraftItem(item.tempId, {
                                    ingredients: [...item.ingredients, clean],
                                  });
                                  setNewDraftIngredientText((prev) => ({
                                    ...prev,
                                    [item.tempId]: '',
                                  }));
                                }}
                                style={styles.addItemBtn}
                              >
                                <Text style={styles.addItemBtnText}>+ Add</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}

                        {/* Card Footer Buttons: Edit Details & Delete */}
                        <View style={styles.twoColRow}>
                          <Pressable
                            onPress={() =>
                              setExpandedDraftId(isExpanded ? null : item.tempId)
                            }
                            style={styles.editDetailsBtn}
                            accessibilityRole="button"
                          >
                            <Ionicons name="create-outline" size={15} color={colors.primary} />
                            <Text style={styles.editDetailsBtnText}>
                              {isExpanded ? 'Done Editing' : 'Edit Details'}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => deleteDraftItem(item.tempId)}
                            style={styles.deleteOutlineBtn}
                            accessibilityRole="button"
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.error} />
                            <Text style={styles.deleteOutlineBtnText}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}

                <Pressable
                  onPress={() => addExtraDraftPackage(reviewSessionTab)}
                  style={styles.addExtraBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.addExtraBtnText}>
                    {`+ Add Extra ${reviewSessionTab === 'STUDIO' ? 'Indoor' : 'Outdoor'} Package`}
                  </Text>
                </Pressable>

                {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

                <View style={styles.twoColRow}>
                  <Pressable
                    onPress={() => setAiStep(1)}
                    style={styles.secondaryNavBtn}
                  >
                    <Text style={styles.secondaryNavBtnText}>Back</Text>
                  </Pressable>
                  <View style={{ flex: 2 }}>
                    <Button
                      title="Review & Publish Packages"
                      onPress={handleProceedToStep3}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════════
                STEP 3: FINAL REVIEW PER SESSION & PUBLISH PACKAGES
               ═══════════════════════════════════════════════════════════════════ */}
            {aiStep === 3 ? (
              <View style={styles.cardBox}>
                <View style={styles.cardHeaderRow}>
                  <IconTile icon="checkmark-done-outline" />
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.eyebrow}>STEP 3 OF 3</Text>
                    <Text style={styles.sectionTitle}>Publish Package</Text>
                  </View>
                </View>

                {/* Session Summary Group 1: Indoor (Studio) */}
                <View style={styles.sessionReviewBlock}>
                  <View style={styles.sessionReviewHeader}>
                    <Ionicons name="home-outline" size={16} color={colors.primary} />
                    <Text style={styles.sessionReviewTitle}>
                      {`Indoor Packages (Studio session) · ${studioDrafts.length}`}
                    </Text>
                  </View>
                  {studioDrafts.length === 0 ? (
                    <Text style={styles.subtitleText}>No Indoor packages selected.</Text>
                  ) : (
                    studioDrafts.map((d) => (
                      <View key={d.tempId} style={styles.compactReviewRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.compactReviewName}>
                            {d.originalTitle && d.originalTitle !== d.packageName
                              ? `${d.packageName} · ${d.originalTitle}`
                              : d.packageName}
                          </Text>
                          <Text style={styles.compactReviewMeta} numberOfLines={1}>
                            {d.ingredients.slice(0, 3).join(' · ')}
                          </Text>
                        </View>
                        <Text style={styles.compactReviewPrice}>
                          {d.price ? `${Number(d.price).toLocaleString('en-US')} ${d.currencyCode}` : t('b2_pkgl_priceNeeded')}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Session Summary Group 2: Outdoor (Events) */}
                <View style={styles.sessionReviewBlock}>
                  <View style={styles.sessionReviewHeader}>
                    <Ionicons name="sunny-outline" size={16} color={colors.primary} />
                    <Text style={styles.sessionReviewTitle}>
                      {`Outdoor Packages (Outside studio) · ${outdoorDrafts.length}`}
                    </Text>
                  </View>
                  {outdoorDrafts.length === 0 ? (
                    <Text style={styles.subtitleText}>No Outdoor packages selected.</Text>
                  ) : (
                    outdoorDrafts.map((d) => (
                      <View key={d.tempId} style={styles.compactReviewRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.compactReviewName}>
                            {d.originalTitle && d.originalTitle !== d.packageName
                              ? `${d.packageName} · ${d.originalTitle}`
                              : d.packageName}
                          </Text>
                          <Text style={styles.compactReviewMeta} numberOfLines={1}>
                            {d.ingredients.slice(0, 3).join(' · ')}
                          </Text>
                        </View>
                        <Text style={styles.compactReviewPrice}>
                          {d.price ? `${Number(d.price).toLocaleString('en-US')} ${d.currencyCode}` : t('b2_pkgl_priceNeeded')}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* How to handle existing online packages */}
                {existingPackages.length > 0 ? (
                  <View style={styles.group}>
                    <Text style={styles.label}>
                      {`How should we handle your ${existingPackages.length} existing online package(s)?`}
                    </Text>
                    <View style={styles.twoColRow}>
                      <Pressable
                        onPress={() => setPublishMode('REPLACE_ALL')}
                        style={[
                          styles.choicePill,
                          publishMode === 'REPLACE_ALL' && styles.choicePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choicePillText,
                            publishMode === 'REPLACE_ALL' && styles.choicePillTextActive,
                          ]}
                        >
                          Replace Old Packages
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPublishMode('ADD_OR_UPDATE')}
                        style={[
                          styles.choicePill,
                          publishMode === 'ADD_OR_UPDATE' && styles.choicePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choicePillText,
                            publishMode === 'ADD_OR_UPDATE' && styles.choicePillTextActive,
                          ]}
                        >
                          Keep & Update
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

                <View style={styles.twoColRow}>
                  <Pressable
                    onPress={() => setAiStep(2)}
                    style={styles.secondaryNavBtn}
                  >
                    <Text style={styles.secondaryNavBtnText}>Back to Edit</Text>
                  </Pressable>
                  <View style={{ flex: 2 }}>
                    <Button
                      title="Publish Packages"
                      onPress={handlePublishBatch}
                      loading={publishingBatch}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════════
                AI STEP DONE: PACKAGE READY! (Matches Step 6 in Reference Image)
               ═══════════════════════════════════════════════════════════════════ */}
            {aiStep === 'done' ? (
              <View style={[styles.cardBox, { alignItems: 'center', paddingVertical: spacing.xl }]}>
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark" size={34} color={onFill} />
                </View>
                <Text style={styles.title}>Packages Ready & Published!</Text>
                <Text style={[styles.subtitleText, { textAlign: 'center' }]}>
                  {`Published ${studioDrafts.length} Indoor and ${outdoorDrafts.length} Outdoor package(s) to your profile. Clients can now book or select your packages on offers.`}
                </Text>
                <View style={{ width: '100%', marginTop: spacing.md }}>
                  <Button title="Done · View My Packages" onPress={() => router.back()} />
                </View>
              </View>
            ) : null}
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════
             MANUAL CUSTOM UPLOAD / EDIT FLOW
             (Select Session, Select Tier Title, Create Items into List, Pricing & Delivery Policy)
             ═══════════════════════════════════════════════════════════════════ */
          <View style={styles.cardBox}>
            <View style={styles.cardHeaderRow}>
              <IconTile icon="create-outline" />
              <View style={styles.cardHeaderText}>
                <Text style={styles.eyebrow}>{isEditing ? 'EDIT PACKAGE' : 'ADD MANUALLY'}</Text>
                <Text style={styles.sectionTitle}>Package details</Text>
              </View>
            </View>
            {/* 1. Session Type: Indoor (Studio) vs Outdoor (Outside studio) */}
            <View style={styles.group}>
              <Text style={styles.label}>1. Session Category (Indoor or Outdoor)</Text>
              <Segmented
                value={manualServiceType}
                onChange={(v) => {
                  setManualServiceType(v);
                  setManualPriceUnit(v === 'STUDIO' ? 'per session' : 'per event');
                }}
                options={[
                  { label: 'Indoor (Studio session)', value: 'STUDIO' },
                  { label: 'Outdoor (Outside studio)', value: 'OUTDOOR' },
                ]}
              />
            </View>

            {/* 2. Tier Name / Package Title */}
            <View style={styles.group}>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>2. Select Package Title</Text>
                <Pressable onPress={() => setUseCustomTitle((v) => !v)}>
                  <Text style={styles.linkText}>
                    {useCustomTitle ? 'Select Tier' : 'Custom Title'}
                  </Text>
                </Pressable>
              </View>

              {!useCustomTitle ? (
                <View style={styles.chipsRow}>
                  {POLICY_PACKAGE_TIERS.map((tierItem) => {
                    const active = manualTier === tierItem;
                    return (
                      <Pressable
                        key={tierItem}
                        onPress={() => setManualTier(tierItem)}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {tierItem}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Input
                  label="Custom Package Title"
                  placeholder="e.g. Studio Basic"
                  value={customTitleText}
                  onChangeText={setCustomTitleText}
                />
              )}
            </View>

            {/* 3. Pricing & Currency */}
            {!currencies.data?.length ? (
              <OptionsNote
                what="currencies"
                loading={currencies.loading}
                onRetry={() => void currencies.refresh()}
              />
            ) : null}
            <MoneyInput
              label="3. Package Price & Currency"
              value={manualPrice}
              onChangeText={setManualPrice}
              currencyId={currencyId}
              onCurrencyChange={setCurrencyId}
              currencies={currencies.data ?? []}
              placeholder="300000"
              showLimits={false}
              testID="package-price"
            />

            <View style={styles.group}>
              <Text style={styles.label}>{t('b2_pkgNewPriceUnit')}</Text>
              <Segmented
                value={manualPriceUnit}
                onChange={setManualPriceUnit}
                options={PRICE_UNITS.map((u) => ({ label: u.label, value: u.value }))}
              />
            </View>

            {/* 4. Create Items Manually into List (Ingredients) */}
            <View style={styles.group}>
              <Text style={styles.label}>
                4. Package Items & Ingredients List (Included in Package)
              </Text>
              <View style={styles.addItemInputRow}>
                <TextInput
                  value={newItemText}
                  onChangeText={setNewItemText}
                  placeholder="Type item (e.g. 2 hours studio session, 50 edited photos)..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.addItemTextInput}
                  onSubmitEditing={() => {
                    const clean = newItemText.trim();
                    if (!clean) return;
                    setManualItems((prev) => [...prev, clean]);
                    setNewItemText('');
                  }}
                />
                <Pressable
                  onPress={() => {
                    const clean = newItemText.trim();
                    if (!clean) return;
                    setManualItems((prev) => [...prev, clean]);
                    setNewItemText('');
                  }}
                  style={styles.addItemBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.addItemBtnText}>+ Add Item</Text>
                </Pressable>
              </View>

              {/* Quick-Add Preset Chips */}
              <View style={styles.chipsRow}>
                {(manualServiceType === 'STUDIO'
                  ? QUICK_MANUAL_ITEMS_INDOOR
                  : QUICK_MANUAL_ITEMS_OUTDOOR
                )
                  .filter((q) => !manualItems.includes(q))
                  .map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => setManualItems((prev) => [...prev, q])}
                      style={styles.quickAddChip}
                    >
                      <Ionicons name="add" size={12} color={colors.primary} />
                      <Text style={styles.quickAddChipText}>{q}</Text>
                    </Pressable>
                  ))}
              </View>

              {/* Current Items List */}
              {manualItems.length > 0 ? (
                <View style={styles.manualItemsListBox}>
                  {manualItems.map((itemText, idx) => (
                    <View key={`${itemText}-${idx}`} style={styles.manualItemRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={styles.manualItemText}>{itemText}</Text>
                      <Pressable
                        onPress={() =>
                          setManualItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* 5. Coverage Metrics & Delivery Turnaround */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label={t('b2_pkgNewDurationHours')}
                  placeholder="2"
                  keyboardType="number-pad"
                  value={manualDurationHours}
                  onChangeText={setManualDurationHours}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={t('b2_pkgNewDeliveryDays')}
                  placeholder="3"
                  keyboardType="number-pad"
                  value={manualDeliveryDays}
                  onChangeText={setManualDeliveryDays}
                />
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label={t('b2_pkgNewIncludedPhotos')}
                  placeholder="50"
                  keyboardType="number-pad"
                  value={manualIncludedPhotos}
                  onChangeText={setManualIncludedPhotos}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={t('b2_pkgNewIncludedVideos')}
                  placeholder="1"
                  keyboardType="number-pad"
                  value={manualIncludedVideos}
                  onChangeText={setManualIncludedVideos}
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>{t('b2_pkgNewIncludesLiveStream')}</Text>
              <Switch
                value={manualHasLiveStream}
                onValueChange={setManualHasLiveStream}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            {/* 6. Delivery Policy, Studio Policies & Self-Priced Add-ons (Drone Capturing & Extras) */}
            {renderPoliciesAndAddonsSection('manual')}

            <Input
              label={t('b2_pkgNewDescription')}
              placeholder={t('b2_pkgNewDescriptionPlaceholder')}
              value={manualDescription}
              onChangeText={setManualDescription}
              multiline
              style={styles.multiline}
            />

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button
              title={isEditing ? t('b2_pkgNewSaveChanges') : 'Publish Package'}
              onPress={handleManualSubmit}
              loading={manualSubmitting}
            />
          </View>
        )}
      </ScrollView>

      {/* Modals for Delivery Policy (Required) & Self-Priced Add-ons (Drone Capturing & Extras) */}
      {renderPolicyAndAddonsModals()}

      {/* Native PDF / Document Picker Modal via WebView for iOS & Android */}
      {Platform.OS !== 'web' ? (
        <Modal
          visible={pdfPickerModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPdfPickerModalOpen(false)}
        >
          <GlassScrim style={styles.modalBackdrop} onPress={() => setPdfPickerModalOpen(false)}>
            <GlassSheetHost style={styles.modalSheet}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Select PDF or Brochure File</Text>
                <Pressable onPress={() => setPdfPickerModalOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSoft} />
                </Pressable>
              </View>
              <Text style={styles.subtitleText}>
                Tap Choose File below to pick a PDF brochure, Word document, or image from your device files.
              </Text>
              <View style={{ height: 150, borderRadius: radii.md, overflow: 'hidden' }}>
                <WebView
                  originWhitelist={['*']}
                  source={{
                    html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:120px;margin:0;background:${colors.background};}label{display:inline-block;padding:14px 24px;background:${colors.primary};color:${onFill};font-weight:700;border-radius:12px;font-size:15px;cursor:pointer;}</style></head><body><label>Choose PDF / Brochure File<input id="f" type="file" accept="application/pdf,image/*,.doc,.docx" style="display:none"/></label><script>document.getElementById('f').addEventListener('change',function(e){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){window.ReactNativeWebView.postMessage(JSON.stringify({name:file.name,type:file.type||'application/pdf',size:file.size,dataUri:reader.result}));};reader.readAsDataURL(file);});</script></body></html>`,
                  }}
                  onMessage={(event) => {
                    try {
                      const msg = JSON.parse(event.nativeEvent.data) as {
                        name: string;
                        type: string;
                        size?: number;
                        dataUri: string;
                      };
                      if (msg?.dataUri) {
                        setPickedFiles((prev) => [
                          ...prev,
                          {
                            id: `doc-${Date.now()}`,
                            uri: msg.dataUri,
                            name: msg.name || 'Packages.pdf',
                            type: msg.type || 'application/pdf',
                            sizeLabel: formatBytes(msg.size),
                            badge: badgeFromMimeOrName(msg.name, msg.type),
                          },
                        ]);
                        setPdfPickerModalOpen(false);
                      }
                    } catch {
                      setPdfPickerModalOpen(false);
                    }
                  }}
                />
              </View>
            </GlassSheetHost>
          </GlassScrim>
        </Modal>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: c.well,
    padding: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  modeSwitchTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  modeSwitchTabActive: {
    backgroundColor: c.primary,
  },
  modeSwitchText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  modeSwitchTextActive: {
    color: onFill,
  },
  stepBarCard: {
    flexDirection: 'row',
    gap: 6,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
  },
  stepPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  stepPillDone: {
    backgroundColor: c.tint,
    borderColor: c.primary,
  },
  stepPillText: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
  },
  stepPillTextActive: {
    color: onFill,
  },
  cardBox: {
    backgroundColor: c.glassTop,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.stroke,
    gap: spacing.md,
    boxShadow: shadows.glass,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardHeaderText: { flex: 1, gap: 2 },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
    color: c.textMuted,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
  },
  subtitleText: {
    fontSize: fontSize.xs,
    color: c.textSoft,
    lineHeight: 17,
  },
  uploadDropzone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: c.tint,
  },
  uploadCloudCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.well,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dropzoneTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
    textAlign: 'center',
  },
  dropzoneSub: {
    fontSize: 11.5,
    color: c.textSoft,
    textAlign: 'center',
  },
  formatBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  formatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  formatBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: onFill,
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  uploadSourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
  },
  uploadSourceBtnText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  pickedFilesList: {
    gap: spacing.xs,
  },
  pickedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  fileTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  fileTypeBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: onFill,
  },
  pickedFileName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  pickedFileSize: {
    fontSize: 10.5,
    color: c.textMuted,
  },
  pasteToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  pasteToggleText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.primary,
  },
  pasteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radii.md,
    padding: spacing.sm,
    fontSize: fontSize.xs,
    color: c.text,
    backgroundColor: c.well,
    textAlignVertical: 'top',
  },
  group: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.primary,
  },
  choicePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
  },
  choicePillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  choicePillText: {
    fontSize: 11.5,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  choicePillTextActive: {
    color: onFill,
  },
  existingBanner: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
    gap: spacing.xs,
  },
  existingBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  existingBannerTitle: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  existingBannerSub: {
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 15,
  },
  policyInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
  },
  policyInfoTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  policyInfoSub: {
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 15,
  },
  sessionCategoryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
    gap: 3,
  },
  sessionCategoryCardActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  sessionCategoryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sessionCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  sessionCountBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: onFill,
  },
  sessionCategoryTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  sessionCategorySub: {
    fontSize: 11,
    color: c.textSoft,
  },
  emptySessionBox: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    gap: spacing.sm,
  },
  extractedCard: {
    backgroundColor: c.glassTop,
    boxShadow: shadows.glass,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.stroke,
    gap: spacing.sm,
  },
  extractedCardDiamond: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  extractedTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  extractedTierName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  highestAmountPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  highestAmountPillText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  originalTitleHint: {
    fontSize: 11,
    color: c.textMuted,
  },
  pricePillPurple: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  pricePillPurpleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: onFill,
  },
  moveSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moveSessionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.textMuted,
  },
  miniSessionChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
  },
  miniSessionChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  miniSessionChipText: {
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  miniSessionChipTextActive: {
    color: onFill,
  },
  metricsSummaryList: {
    backgroundColor: c.well,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 3,
  },
  metricLine: {
    fontSize: fontSize.xs,
    color: c.text,
    fontWeight: fontWeight.semibold,
  },
  descriptionsComparisonBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  descColumn: {
    flex: 1,
    minWidth: 140,
    backgroundColor: c.well,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.stroke,
  },
  descColumnHeader: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    color: c.primary,
    marginBottom: 2,
  },
  descBulletText: {
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 15,
  },
  descBodyText: {
    fontSize: 11,
    color: c.text,
    lineHeight: 15,
  },
  inlineEditorBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  editDetailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  editDetailsBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  deleteOutlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.error,
  },
  deleteOutlineBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.error,
  },
  addExtraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.primary,
    backgroundColor: c.well,
  },
  addExtraBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  secondaryNavBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryNavBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  sessionReviewBlock: {
    backgroundColor: c.well,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.stroke,
    gap: spacing.xs,
  },
  sessionReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sessionReviewTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  compactReviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  compactReviewName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  compactReviewMeta: {
    fontSize: 11,
    color: c.textSoft,
  },
  compactReviewPrice: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.well,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  chipTextActive: {
    color: onFill,
  },
  policyHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
  },
  policyHintText: {
    flex: 1,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  addItemInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  addItemTextInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.xs,
    color: c.text,
    backgroundColor: c.well,
  },
  addItemBtn: {
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: onFill,
  },
  quickAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.tint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.primary,
  },
  quickAddChipText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.primary,
  },
  manualItemsListBox: {
    backgroundColor: c.well,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  manualItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualItemText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: c.text,
  },
  removableItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  removableItemChipText: {
    fontSize: 11,
    color: c.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiline: {
    height: 84,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  serverError: {
    color: c.error,
    fontSize: fontSize.xs,
    textAlign: 'center',
    fontWeight: fontWeight.semibold,
  },
  modalBackdrop: {
    justifyContent: 'flex-end',
  },
  modalSheet: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  stageActionTriggersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stageTriggerCard: {
    flex: 1,
    backgroundColor: c.well,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1.5,
    borderColor: c.stroke,
  },
  stageTriggerCardRequired: {
    borderColor: c.error,
    backgroundColor: c.well,
  },
  stageTriggerCardDone: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  stageTriggerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageTriggerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  stageTriggerBadgeSaved: {
    backgroundColor: c.primary,
  },
  stageTriggerBadgeRequired: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: c.error,
  },
  stageTriggerBadgeNeutral: {
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  stageTriggerBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  stageTriggerBadgeTextSaved: {
    color: onFill,
  },
  stageTriggerBadgeTextRequired: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: onFill,
    letterSpacing: 0.3,
  },
  stageTriggerBadgeTextNeutral: {
    color: c.textSoft,
  },
  stageTriggerTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  stageTriggerSub: {
    fontSize: 10,
    color: c.textSoft,
  },
  policiesAndAddonsContainer: {
    gap: spacing.md,
  },
  policySectionBox: {
    backgroundColor: c.well,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  menuReadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
  },
  menuReadBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: c.primary,
  },
  addonStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  addonStatusPillOn: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  addonStatusPillOff: {
    backgroundColor: c.well,
    borderColor: c.stroke,
  },
  addonStatusPillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  addonStatusPillTextOn: {
    color: onFill,
  },
  addonStatusPillTextOff: {
    color: c.textMuted,
  },
  droneFeatureCard: {
    backgroundColor: c.well,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  droneFeatureCardActive: {
    backgroundColor: c.tint,
    borderColor: c.primary,
    borderWidth: 1.5,
  },
  droneFeatureTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  droneFeatureSub: {
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 15,
  },
  uniqueFeatureBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  uniqueFeatureBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: onFill,
    letterSpacing: 0.3,
  },
  addonToggleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  addonToggleIndicatorOn: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  addonToggleIndicatorOff: {
    backgroundColor: c.well,
    borderColor: c.stroke,
  },
  addonToggleIndicatorText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  addonToggleIndicatorTextOn: {
    color: onFill,
  },
  addonToggleIndicatorTextOff: {
    color: c.textMuted,
  },
  addonAmountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  addonAmountPrefix: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  addonAmountInput: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
    backgroundColor: c.well,
  },
  clearAddonBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
  },
  clearAddonBtnText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  addonRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  addonRowCardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  addonRowTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  addonRowDesc: {
    fontSize: 10,
    color: c.textMuted,
  },
  addonMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  addonMiniBadgeOn: {
    backgroundColor: c.primary,
  },
  addonMiniBadgeOff: {
    backgroundColor: c.well,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.stroke,
  },
  addonMiniBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
  },
  addonMiniBadgeTextOn: {
    color: onFill,
  },
  addonMiniBadgeTextOff: {
    color: c.textMuted,
  },
  addonCompactInput: {
    width: 112,
    minHeight: 36,
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
    backgroundColor: c.well,
    textAlign: 'right',
  },
}));
