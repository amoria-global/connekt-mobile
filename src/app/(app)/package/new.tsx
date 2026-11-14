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
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { OptionsNote } from '@/components/ui/OptionsNote';
import {
  POLICY_PACKAGE_TIERS,
  applyPackageTierNamingPolicy,
  bulkPublishPackages,
  createPackage,
  extractPackagesWithAi,
  listPackages,
  updatePackage,
  type BulkPublishMode,
  type CreatePackageInput,
  type ExtractedAiPackageDraft,
  type Package,
  type PackageFeatureItem,
  type ServiceType,
} from '@/features/packages/api';
import { listCurrencies } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme, onFill } from '@/theme';
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
  const [publishingBatch, setPublishingBatch] = useState(false);
  const [pdfPickerModalOpen, setPdfPickerModalOpen] = useState(false);
  const webFileInputRef = useRef<HTMLInputElement | null>(null);

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
    edit?.deliveryPolicy ?? 'Delivery via online gallery; 50% booking deposit required.',
  );
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
      setExtractedDrafts(res.extractedPackages);
      if (res.hasExistingOnlinePackages && params.replace === '1') {
        setPublishMode('REPLACE_ALL');
      } else if (res.hasExistingOnlinePackages) {
        setPublishMode(res.suggestedMode);
      }
      const hasStudio = res.extractedPackages.some((p) => p.serviceType === 'STUDIO');
      const hasOutdoor = res.extractedPackages.some((p) => p.serviceType === 'OUTDOOR');
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
        price: studio ? 120000 : 400000,
        currencyCode: 'RWF',
        priceUnit: studio ? 'per session' : 'per event',
        durationHours: studio ? 2 : 6,
        includedPhotos: studio ? 50 : 200,
        includedVideos: studio ? 0 : 1,
        photobookPhotos: null,
        hasLiveStream: false,
        deliveryDays: studio ? 3 : 7,
        deliveryPolicy: `Delivery within ${studio ? 3 : 7} days via online gallery; 50% booking deposit.`,
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
  }, []);

  const studioDrafts = useMemo(
    () => extractedDrafts.filter((d) => d.serviceType === 'STUDIO'),
    [extractedDrafts],
  );
  const outdoorDrafts = useMemo(
    () => extractedDrafts.filter((d) => d.serviceType === 'OUTDOOR'),
    [extractedDrafts],
  );
  const activeSessionDrafts = reviewSessionTab === 'STUDIO' ? studioDrafts : outdoorDrafts;

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

    setPublishingBatch(true);
    try {
      const normalized = applyPackageTierNamingPolicy(extractedDrafts);
      const inputs: CreatePackageInput[] = normalized.map((d) => ({
        packageName: d.packageName,
        price: Math.max(1000, Number(d.price) || 100000),
        currencyId: d.currencyId || resolvedCurrencyId,
        priceUnit: d.priceUnit || (d.serviceType === 'STUDIO' ? 'per session' : 'per event'),
        durationHours: d.durationHours,
        includedPhotos: d.includedPhotos,
        includedVideos: d.includedVideos,
        photobookPhotos: d.photobookPhotos ?? null,
        hasLiveStream: d.hasLiveStream,
        deliveryDays: d.deliveryDays,
        serviceType: d.serviceType,
        description: d.enhancedDescription || d.originalDescription,
        features: d.ingredients.map((itemName, idx) => ({
          featureName: itemName,
          isIncluded: true,
          displayOrder: idx,
        })),
      }));

      await bulkPublishPackages({
        mode: publishMode,
        enforceTierPolicy: true,
        packages: inputs,
        existingPackages,
      });

      setAiStep('done');
    } catch (err) {
      setServerError(isApiError(err) ? err.message : t('b2_pkgNewErrGeneric'));
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
      priceUnit: manualPriceUnit,
      durationHours: Number(manualDurationHours) || 0,
      includedPhotos: Number(manualIncludedPhotos) || 0,
      includedVideos: Number(manualIncludedVideos) || 0,
      hasLiveStream: manualHasLiveStream,
      deliveryDays: Number(manualDeliveryDays) || 0,
      serviceType: manualServiceType,
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
          <View style={styles.modeSwitchContainer}>
            <Pressable
              onPress={() => {
                setFlowMode('ai');
                setServerError(null);
              }}
              style={[styles.modeSwitchTab, flowMode === 'ai' && styles.modeSwitchTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: flowMode === 'ai' }}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={15}
                color={flowMode === 'ai' ? onFill : colors.primary}
              />
              <Text
                style={[
                  styles.modeSwitchText,
                  flowMode === 'ai' && styles.modeSwitchTextActive,
                ]}
              >
                Upload Document
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFlowMode('manual');
                setServerError(null);
              }}
              style={[styles.modeSwitchTab, flowMode === 'manual' && styles.modeSwitchTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: flowMode === 'manual' }}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={flowMode === 'manual' ? onFill : colors.primary}
              />
              <Text
                style={[
                  styles.modeSwitchText,
                  flowMode === 'manual' && styles.modeSwitchTextActive,
                ]}
              >
                Manual Upload
              </Text>
            </Pressable>
          </View>
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
                    [1, '1. Upload Document'],
                    [2, '2. Organize Packages'],
                    [3, '3. Publish Package'],
                  ] as [1 | 2 | 3, string][]
                ).map(([n, label]) => {
                  const active = aiStep === n;
                  const done = typeof aiStep === 'number' && aiStep > n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => {
                        if (done) setAiStep(n);
                      }}
                      style={[
                        styles.stepPill,
                        active && styles.stepPillActive,
                        done && styles.stepPillDone,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepPillText,
                          (active || done) && styles.stepPillTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════════
                STEP 1: UPLOAD DOCUMENT (PDF, JPG, PNG)
               ═══════════════════════════════════════════════════════════════════ */}
            {aiStep === 1 ? (
              <View style={styles.cardBox}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.sectionTitle}>Upload Document</Text>
                    <Text style={styles.subtitleText}>
                      Upload your package brochure or price list (PDF, JPG, PNG).
                    </Text>
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
                {/* Organize Packages Header */}
                <View style={styles.policyInfoCard}>
                  <Ionicons name="layers-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.policyInfoTitle}>Organize Packages</Text>
                    <Text style={styles.policyInfoSub}>
                      Choose Indoor or Outdoor and review your package details before publishing.
                    </Text>
                  </View>
                </View>

                {/* Organize Packages: Indoor vs Outdoor Cards (Matches Step 4 in Reference Image) */}
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
                          </View>

                          <View style={styles.pricePillPurple}>
                            <Text style={styles.pricePillPurpleText}>
                              {`${Number(item.price || 0).toLocaleString('en-US')} ${item.currencyCode || 'RWF'}`}
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

                        {/* Key Summary Metrics */}
                        <View style={styles.metricsSummaryList}>
                          <Text style={styles.metricLine}>
                            {`📷  ${item.durationHours} hours ${
                              item.serviceType === 'STUDIO' ? 'studio session' : 'outdoor coverage'
                            }`}
                          </Text>
                          <Text style={styles.metricLine}>
                            {`🖼️  ${item.includedPhotos} edited photos${
                              item.includedVideos > 0 ? ` · ${item.includedVideos} video(s)` : ''
                            }`}
                          </Text>
                          <Text style={styles.metricLine}>
                            {`⏱️  Delivery in ${item.deliveryDays} days (${item.deliveryPolicy})`}
                          </Text>
                        </View>

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
                              {POLICY_PACKAGE_TIERS.map((tName) => {
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
                                  value={String(item.price)}
                                  onChangeText={(v) => {
                                    const n = Number(v.replace(/\D/g, ''));
                                    updateDraftItem(item.tempId, { price: n }, true);
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
                      onPress={() => setAiStep(3)}
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
                  <View style={styles.iconCircle}>
                    <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.sectionTitle}>Publish Package</Text>
                    <Text style={styles.subtitleText}>
                      Your package is set and can now be published to your profile.
                    </Text>
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
                          <Text style={styles.compactReviewName}>{d.packageName}</Text>
                          <Text style={styles.compactReviewMeta}>
                            {`${d.durationHours}h · ${d.includedPhotos} photos · Delivery in ${d.deliveryDays}d`}
                          </Text>
                        </View>
                        <Text style={styles.compactReviewPrice}>
                          {`${Number(d.price).toLocaleString('en-US')} ${d.currencyCode}`}
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
                          <Text style={styles.compactReviewName}>{d.packageName}</Text>
                          <Text style={styles.compactReviewMeta}>
                            {`${d.durationHours}h · ${d.includedPhotos} photos · Delivery in ${d.deliveryDays}d`}
                          </Text>
                        </View>
                        <Text style={styles.compactReviewPrice}>
                          {`${Number(d.price).toLocaleString('en-US')} ${d.currencyCode}`}
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

            <Input
              label="Delivery Policy & Booking Conditions"
              placeholder="e.g. Delivery within 3 days via online gallery; 50% deposit required."
              value={manualDeliveryPolicy}
              onChangeText={setManualDeliveryPolicy}
            />

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
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: c.surface,
    padding: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
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
    fontWeight: fontWeight.extrabold,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
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
    fontWeight: fontWeight.extrabold,
    color: c.textMuted,
  },
  stepPillTextActive: {
    color: onFill,
  },
  cardBox: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
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
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  subtitleText: {
    fontSize: fontSize.xs,
    color: c.textSoft,
    lineHeight: 17,
  },
  uploadDropzone: {
    borderWidth: 1.5,
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
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dropzoneTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
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
    fontWeight: fontWeight.extrabold,
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
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  uploadSourceBtnText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
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
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  fileTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  fileTypeBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: onFill,
  },
  pickedFileName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
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
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  pasteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
    fontSize: fontSize.xs,
    color: c.text,
    backgroundColor: c.card,
    textAlignVertical: 'top',
  },
  group: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
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
    fontWeight: fontWeight.bold,
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
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  choicePillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  choicePillText: {
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
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
    fontWeight: fontWeight.extrabold,
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
    fontWeight: fontWeight.extrabold,
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
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
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
    fontWeight: fontWeight.extrabold,
    color: onFill,
  },
  sessionCategoryTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  sessionCategorySub: {
    fontSize: 11,
    color: c.textSoft,
  },
  emptySessionBox: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    gap: spacing.sm,
  },
  extractedCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.sm,
  },
  extractedCardDiamond: {
    borderColor: c.primary,
    borderWidth: 1.5,
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
    fontWeight: fontWeight.extrabold,
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
    fontWeight: fontWeight.extrabold,
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
    fontWeight: fontWeight.extrabold,
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
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  miniSessionChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  miniSessionChipText: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
  },
  miniSessionChipTextActive: {
    color: onFill,
  },
  metricsSummaryList: {
    backgroundColor: c.card,
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
    backgroundColor: c.card,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  descColumnHeader: {
    fontSize: 10.5,
    fontWeight: fontWeight.extrabold,
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
    fontWeight: fontWeight.extrabold,
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
    fontWeight: fontWeight.extrabold,
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
    backgroundColor: c.surface,
  },
  addExtraBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
  },
  secondaryNavBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryNavBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  sessionReviewBlock: {
    backgroundColor: c.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
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
    fontWeight: fontWeight.extrabold,
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
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  compactReviewMeta: {
    fontSize: 11,
    color: c.textSoft,
  },
  compactReviewPrice: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
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
    backgroundColor: c.card,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
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
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.xs,
    color: c.text,
    backgroundColor: c.card,
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
    fontWeight: fontWeight.extrabold,
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
    backgroundColor: c.card,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: c.borderSoft,
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
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.borderSoft,
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
}));
