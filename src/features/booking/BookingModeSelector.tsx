/**
 * BookingModeSelector: the fork at the top of booking, and the 4-page
 * "Create Your Event Offer" (Post Brief / Hybrid) wizard behind it:
 *   Page 1: Event details
 *   Page 2: Coverage & print products (Digital coverage, Live stream & instant wishes & memories sharing, Print products)
 *   Page 3: Delivery & price estimate (with budget range, info tooltips, and compact Recommended pricing)
 *   Page 4: Review & publish
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { createMatchRequest, getHybridOptions, getMatchPreview } from '@/features/hybrid/api';
import type { HybridOptions, MatchPreviewResult } from '@/features/hybrid/types';
import {
  Chip,
  MODE_META,
  budgetLabel,
  durationBetween,
  durationText,
} from '@/features/hybrid/hybridUi';
import {
  DEFAULT_OFFER_DRAFT,
  DIGITAL_DEADLINE_CUSTOM_OPTIONS,
  DIGITAL_DEADLINE_PRESETS,
  EDITING_STYLES,
  EVENT_TYPE_PRESETS,
  EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF,
  LONG_VIDEO_CUSTOM_OPTIONS,
  LONG_VIDEO_DURATIONS,
  LONG_VIDEO_QTY_PRESETS,
  PHOTO_ALBUM_PRINTS,
  PHOTO_ALBUM_SIZES,
  PHOTO_BOOK_PAGES,
  PHOTO_BOOK_SIZES,
  PHOTO_CUSTOM_OPTIONS,
  PHOTO_QUANTITY_PRESETS,
  POPULAR_VENUES_BY_CITY,
  PRINT_COLLECTION_METHODS,
  PRINT_PRODUCTION_TIMES,
  PRINT_QTY_CUSTOM_OPTIONS,
  PRINT_QTY_PRESETS,
  SHORT_VIDEO_CUSTOM_OPTIONS,
  SHORT_VIDEO_DURATIONS,
  SHORT_VIDEO_QTY_PRESETS,
  USAGE_RIGHTS,
  WALL_PORTRAIT_FRAMES,
  WALL_PORTRAIT_SIZES,
  estimateOfferPriceRwf,
  formatCoverageModeLabel,
  formatInstantWishesSummary,
  formatLiveStreamSummary,
  formatLongVideosSummary,
  formatOfferDeliverablesSummaryLines,
  formatPhotoAlbumSummary,
  formatPhotoBookSummary,
  formatPrintHandoverSummary,
  formatShortVideosSummary,
  formatWallPortraitSummary,
  getDeadlineCalendarDays,
  serializeOfferBrief,
  type ClientEntityType,
  type DigitalCoverageMode,
  type HybridOfferDraft,
} from '@/features/hybrid/offerBrief';
import { createEvent } from '@/features/events/api';
import { useRole } from '@/features/auth/role';
import { useAuth, isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { translateSharedRw } from '@/i18n/kinyarwanda';
import { translateSharedSw } from '@/i18n/swahili';
import { fontSize, fontWeight, fonts, makeStyles, radii, spacing, useTheme, onFill } from '@/theme';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { SheetCornerClose } from '@/components/ui/SheetCloseButton';
import { glassTile } from '@/components/ui/GlassCard';
import { formatAmountWithCommas, parseAmountNumber } from '@/utils/amount';

export type BookingStep = 'select' | 1 | 2 | 3 | 4;

const WIZARD_STEPS = [
  { n: 1, title: 'EVENT DETAILS', short: 'Event details' },
  { n: 2, title: 'COVERAGE & PRINT PRODUCTS', short: 'Coverage & print' },
  { n: 3, title: 'DELIVERY & PRICE ESTIMATE', short: 'Delivery & budget' },
  { n: 4, title: 'REVIEW & PUBLISH', short: 'Review & publish' },
] as const;

const HOME_DELIVERY_AREAS_BY_CITY: Record<string, string[]> = {
  Kigali: ['Nyarutarama', 'Kimihurura', 'Kacyiru', 'Remera', 'Kibagabaga', 'Kiyovu', 'Gacuriro', 'Kanombe'],
  Musanze: ['Muhoza', 'Kinigi', 'Cyuve'],
  Rubavu: ['Gisenyi Town', 'Nyamyumba', 'Rubavu Sector'],
  Huye: ['Ngoma', 'Tumba', 'Butare Center'],
};

const STANDARD_BUDGET_RANGES: readonly { min: number; max: number; label: string }[] = [
  { min: 0, max: 100000, label: 'Up to 100,000 RWF' },
  { min: 100000, max: 200000, label: '100,000 – 200,000 RWF' },
  { min: 200000, max: 350000, label: '200,000 – 350,000 RWF' },
  { min: 350000, max: 500000, label: '350,000 – 500,000 RWF' },
  { min: 500000, max: 1000000, label: '500,000 – 1,000,000 RWF' },
  { min: 1000000, max: 2000000, label: '1,000,000 – 2,000,000 RWF' },
];

const EXPRESS_MAJOR_BUDGET_RANGES: readonly { min: number; max: number; label: string }[] = [
  { min: 7000000, max: 8500000, label: '7,000,000 – 8,500,000 RWF' },
  { min: 8500000, max: 10000000, label: '8,500,000 – 10,000,000 RWF' },
  { min: 10000000, max: 12500000, label: '10,000,000 – 12,500,000 RWF' },
];

export type ExistingHybridEvent = {
  id: string;
  title?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  city?: string;
  venue?: string;
};

export type BookingModeSelectorProps = {
  visible: boolean;
  onClose: () => void;
  onSelectDirect?: () => void;
  onSelectHybrid?: () => void;
  initialStep?: BookingStep;
  existingEvent?: ExistingHybridEvent | null;
  onPosted?: (eventId: string) => void;
};

type Step = BookingStep | 'done';

type PickerSheetKey =
  | null
  | 'start'
  | 'end'
  | 'city'
  | 'photosCustom'
  | 'shortVideosCustom'
  | 'shortVideoDurationCustom'
  | 'longVideosCustom'
  | 'longVideoDurationCustom'
  | 'photoBooksCustom'
  | 'photoBookSize'
  | 'photoBookPages'
  | 'photoAlbumsCustom'
  | 'photoAlbumSize'
  | 'photoAlbumPrints'
  | 'wallPortraitsCustom'
  | 'wallPortraitSize'
  | 'wallPortraitFrame'
  | 'digitalDeadlineCustom'
  | 'printProductionTime'
  | 'printCollectionMethod';

type InfoKey =
  | 'instantUpdates'
  | 'liveAndWishes'
  | 'printProducts'
  | 'digitalDelivery'
  | 'printDelivery'
  | 'budgetRange'
  | 'recPricing'
  | 'reviewProcess';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDaysIso = (baseIso: string, daysToAdd: number) => {
  const base = baseIso ? new Date(`${baseIso}T12:00:00`) : new Date();
  if (!Number.isFinite(base.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + daysToAdd);
    return isoDate(fallback);
  }
  base.setDate(base.getDate() + daysToAdd);
  return isoDate(base);
};
const prettyDate = (iso: string) => {
  const t = Date.parse(`${iso}T00:00:00`);
  const lang = useLanguage.getState().language;
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : iso;
};
function nextWeekday(weekday: number, weeksAhead = 0): Date {
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + weeksAhead * 7);
  return d;
}
function timeSlots(step: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

export function BookingModeSelector({
  visible,
  onClose,
  onSelectDirect,
  onSelectHybrid,
  initialStep = 'select',
  existingEvent,
  onPosted,
}: BookingModeSelectorProps) {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const tr = useCallback(
    (s: string) =>
      language === 'en'
        ? s
        : language === 'rw'
          ? translateSharedRw(s)
          : language === 'sw'
            ? translateSharedSw(s)
            : s,
    [language],
  );
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isCoordinator } = useRole();
  const user = useAuth((s) => s.user);
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>(initialStep);
  const [options, setOptions] = useState<HybridOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [draft, setDraft] = useState<HybridOfferDraft>(DEFAULT_OFFER_DRAFT);
  const [moreStyleOpen, setMoreStyleOpen] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [openInfo, setOpenInfo] = useState<Record<string, boolean>>({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [printDatePickerOpen, setPrintDatePickerOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<PickerSheetKey>(null);
  const [customSheetText, setCustomSheetText] = useState('');

  const [preview, setPreview] = useState<MatchPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; invited: number; status?: string } | null>(null);

  const toggleInfo = useCallback((k: InfoKey) => {
    setOpenInfo((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const scrollToTop = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [step, scrollToTop]);

  useEffect(() => {
    setCustomSheetText('');
  }, [activeSheet]);

  const updateDraft = useCallback(<K extends keyof HybridOfferDraft>(key: K, value: HybridOfferDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!visible) return;
    setStep(existingEvent ? 1 : initialStep);
    setError(null);
    setResult(null);
    setCreatedEventId(existingEvent?.id ?? null);
    if (existingEvent) {
      setDraft((prev) => ({
        ...prev,
        date: existingEvent.eventDate ? existingEvent.eventDate.slice(0, 10) : prev.date,
        startTime: existingEvent.startTime ? existingEvent.startTime.slice(0, 5) : prev.startTime,
        endTime: existingEvent.endTime ? existingEvent.endTime.slice(0, 5) : prev.endTime,
        city: existingEvent.city || prev.city,
        venue: existingEvent.venue || prev.venue,
      }));
    }
    getHybridOptions()
      .then((o) => {
        setOptions(o);
        setOptionsError(null);
        if (o.eventTypes.length > 0) {
          setDraft((prev) => {
            if (prev.eventTypeId) return prev;
            const match =
              o.eventTypes.find((t) => t.name.toLowerCase().includes(prev.eventTypeKey.toLowerCase())) ??
              o.eventTypes[0];
            return { ...prev, eventTypeId: match?.id ?? '' };
          });
        }
      })
      .catch((e) => setOptionsError(isApiError(e) ? e.message : tr('Could not load the event options.')));
  }, [visible, initialStep, existingEvent, tr]);

  const eventTypeObj = useMemo(() => {
    if (!options?.eventTypes.length) return undefined;
    return (
      options.eventTypes.find((t) => t.id === draft.eventTypeId) ??
      options.eventTypes.find((t) => t.name.toLowerCase().includes(draft.eventTypeKey.toLowerCase())) ??
      options.eventTypes[0]
    );
  }, [options, draft.eventTypeId, draft.eventTypeKey]);

  const cityInfo = options?.cities.find((c) => c.name === draft.city);
  const minutes = durationBetween(draft.startTime, draft.endTime);
  const overnight = draft.endTime <= draft.startTime;
  const slots = useMemo(() => timeSlots(options?.timeStepMinutes || 30), [options]);

  const localPriceEstimate = useMemo(
    () => estimateOfferPriceRwf(draft, minutes),
    [draft, minutes],
  );

  // Merge backend package comparison prices (computed from available photographers' uploaded packages)
  // with local baseline formula while enforcing the 7M express major event floor.
  const priceEstimate = useMemo(() => {
    const serverLow = preview?.packagePriceLow;
    const serverRec = preview?.packagePriceRecommended;
    const serverPri = preview?.packagePricePriority;
    if (
      typeof serverLow === 'number' &&
      serverLow > 0 &&
      typeof serverRec === 'number' &&
      serverRec > 0 &&
      typeof serverPri === 'number' &&
      serverPri > 0
    ) {
      const floor = localPriceEstimate.minimumAllowedBudget;
      const low = Math.max(floor, Math.round(serverLow / 10000) * 10000);
      const recommended = Math.max(low + 50000, Math.round(serverRec / 10000) * 10000);
      const priority = Math.max(recommended + 50000, Math.round(serverPri / 10000) * 10000);
      return {
        ...localPriceEstimate,
        low,
        recommended,
        priority,
        high: priority,
      };
    }
    return localPriceEstimate;
  }, [localPriceEstimate, preview?.packagePriceLow, preview?.packagePriceRecommended, preview?.packagePricePriority]);

  // Enforce the 7,000,000 RWF minimum budget floor automatically when Wedding/Corporate/Commercial/Large event + < 4 days digital delivery is selected
  useEffect(() => {
    if (priceEstimate.isExpressMajorFloor) {
      const currentMin = parseAmountNumber(draft.minBudgetInput);
      const currentMax = parseAmountNumber(draft.maxBudgetInput);
      if (currentMin < EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF || currentMax < EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF) {
        const minFormatted = formatAmountWithCommas(String(EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF));
        const maxFormatted = formatAmountWithCommas(String(Math.max(8500000, currentMax)));
        setDraft((prev) => ({
          ...prev,
          minBudgetInput: minFormatted,
          maxBudgetInput: maxFormatted,
        }));
      }
    }
  }, [priceEstimate.isExpressMajorFloor, draft.minBudgetInput, draft.maxBudgetInput]);

  // Client's typed/selected min & max budget range
  const hasExplicitZeroMin = draft.minBudgetInput.trim() === '0';
  const clientMinBudget = useMemo(() => {
    const minP = parseAmountNumber(draft.minBudgetInput);
    const maxP = parseAmountNumber(draft.maxBudgetInput);
    if (hasExplicitZeroMin && !priceEstimate.isExpressMajorFloor) {
      return 0;
    }
    const raw = minP || maxP || (priceEstimate.isExpressMajorFloor ? EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF : 0);
    return Math.max(priceEstimate.minimumAllowedBudget, raw);
  }, [draft.minBudgetInput, draft.maxBudgetInput, hasExplicitZeroMin, priceEstimate.minimumAllowedBudget, priceEstimate.isExpressMajorFloor]);

  const clientMaxBudget = useMemo(() => {
    const maxP = parseAmountNumber(draft.maxBudgetInput);
    const minP = parseAmountNumber(draft.minBudgetInput);
    const raw = maxP || minP || (priceEstimate.isExpressMajorFloor ? 8500000 : 100000);
    return Math.max(clientMinBudget, raw);
  }, [draft.minBudgetInput, draft.maxBudgetInput, clientMinBudget, priceEstimate.isExpressMajorFloor]);

  const isOpenFlexibleBudget =
    draft.budgetMode === 'FLEXIBLE' &&
    !draft.minBudgetInput.trim() &&
    !draft.maxBudgetInput.trim() &&
    !priceEstimate.isExpressMajorFloor;

  const clientRangeDisplay = useMemo(() => {
    if (isOpenFlexibleBudget) return tr('Flexible');
    if (clientMinBudget === 0 && clientMaxBudget > 0) {
      return `Up to RWF ${clientMaxBudget.toLocaleString('en-US')}`;
    }
    if (clientMinBudget === clientMaxBudget) {
      return `RWF ${clientMaxBudget.toLocaleString('en-US')}`;
    }
    return `RWF ${clientMinBudget.toLocaleString('en-US')} – ${clientMaxBudget.toLocaleString('en-US')}`;
  }, [isOpenFlexibleBudget, clientMinBudget, clientMaxBudget, tr]);

  // Price of whichever matching package card is selected
  const selectedPackagePrice = useMemo(() => {
    if (draft.packageOption === 'WITHIN_BUDGET') return priceEstimate.low;
    if (draft.packageOption === 'PRIORITY') return priceEstimate.priority;
    return priceEstimate.recommended;
  }, [draft.packageOption, priceEstimate]);

  const effectiveMinBudget = useMemo(() => {
    if (draft.pricingDecision === 'RECOMMENDED') return selectedPackagePrice;
    if (isOpenFlexibleBudget) return undefined;
    return clientMinBudget;
  }, [draft.pricingDecision, selectedPackagePrice, isOpenFlexibleBudget, clientMinBudget]);

  const effectiveMaxBudget = useMemo(() => {
    if (draft.pricingDecision === 'RECOMMENDED') return selectedPackagePrice;
    if (isOpenFlexibleBudget) return undefined;
    return clientMaxBudget;
  }, [draft.pricingDecision, selectedPackagePrice, isOpenFlexibleBudget, clientMaxBudget]);

  const effectiveBudgetDisplay = useMemo(() => {
    if (effectiveMinBudget === undefined && effectiveMaxBudget === undefined) {
      return tr('Flexible');
    }
    const minVal = effectiveMinBudget ?? 0;
    const maxVal = effectiveMaxBudget ?? minVal;
    if (minVal === 0 && maxVal > 0) {
      return `Up to RWF ${maxVal.toLocaleString('en-US')}`;
    }
    if (minVal === maxVal) {
      return `RWF ${maxVal.toLocaleString('en-US')}`;
    }
    return `RWF ${minVal.toLocaleString('en-US')} – ${maxVal.toLocaleString('en-US')}`;
  }, [effectiveMinBudget, effectiveMaxBudget, tr]);

  const fetchPreview = useCallback(async () => {
    if (!draft.date) return;
    setPreviewLoading(true);
    try {
      const res = await getMatchPreview({
        eventDate: draft.date,
        startTime: `${draft.startTime}:00`,
        endTime: `${draft.endTime}:00`,
        city: draft.city,
        latitude: cityInfo?.latitude,
        longitude: cityInfo?.longitude,
        minBudget: effectiveMinBudget,
        maxBudget: effectiveMaxBudget,
        currency: 'RWF',
        photographerType: 'ANY',
        specialty: eventTypeObj?.name || draft.eventTypeKey,
        photographerSpecialty: 'ANY',
        locationCoverage: 'ANY',
        eventId: existingEvent?.id,
        editedPhotos: draft.coverageMode === 'VIDEO' ? 0 : draft.editedPhotos,
        shortVideosQty: draft.coverageMode === 'PHOTOGRAPHY' ? 0 : draft.shortVideosQty,
        longVideosQty: draft.coverageMode === 'PHOTOGRAPHY' ? 0 : draft.longVideosQty,
        digitalDeliveryDays: getDeadlineCalendarDays(draft.digitalDeadline),
        hasLiveStream: draft.liveStream,
        allowWishInvites: draft.instantWishesAndMemories,
        photoBooksQty: draft.photoBooksQty,
        photoAlbumsQty: draft.photoAlbumsQty,
        wallPortraitsQty: draft.wallPortraitsQty,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [
    draft.date,
    draft.startTime,
    draft.endTime,
    draft.city,
    draft.eventTypeKey,
    draft.coverageMode,
    draft.editedPhotos,
    draft.shortVideosQty,
    draft.longVideosQty,
    draft.digitalDeadline,
    draft.liveStream,
    draft.instantWishesAndMemories,
    draft.photoBooksQty,
    draft.photoAlbumsQty,
    draft.wallPortraitsQty,
    cityInfo,
    effectiveMinBudget,
    effectiveMaxBudget,
    eventTypeObj,
    existingEvent,
  ]);

  useEffect(() => {
    if (!visible || (step !== 3 && step !== 4)) return;
    const t = setTimeout(fetchPreview, 350);
    return () => clearTimeout(t);
  }, [visible, step, fetchPreview]);

  const close = () => onClose();

  const goDirect = () => {
    close();
    setTimeout(() => (onSelectDirect ? onSelectDirect() : router.push('/photographers' as never)), 150);
  };

  const goHybrid = () => {
    if (onSelectHybrid) {
      close();
      setTimeout(onSelectHybrid, 150);
    } else {
      setStep(1);
    }
  };

  const validateStep1 = (): string | null => {
    if (!draft.eventTypeKey && !draft.eventTypeId) return tr('Choose what you are planning.');
    if (!draft.date) return tr('Select the event date.');
    const today = isoDate(new Date());
    if (draft.date < today) return tr('That date has passed. Choose a future date.');
    if (draft.date === today) {
      const now = new Date();
      if (draft.startTime <= `${pad(now.getHours())}:${pad(now.getMinutes())}`) {
        return tr('That start time has passed. Choose a later time.');
      }
    }
    if (!draft.venue.trim() && !draft.city.trim()) {
      return tr('Select or enter the event venue / location.');
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (
      draft.printProductionTime === 'Propose production & handover date' &&
      !draft.printProposedDate.trim()
    ) {
      return tr('Please select your proposed print production & handover date.');
    }
    if (
      draft.printCollectionMethod === 'Deliver to my home address' &&
      !draft.printDeliveryAddress.trim()
    ) {
      return tr('Please enter your exact home delivery address for print products.');
    }
    const minP = parseAmountNumber(draft.minBudgetInput);
    const maxP = parseAmountNumber(draft.maxBudgetInput);
    if (minP > 0 && maxP > 0 && minP > maxP) {
      return tr('Minimum budget cannot be higher than maximum budget.');
    }
    const checkAmt = maxP || minP;
    if (priceEstimate.isExpressMajorFloor && checkAmt > 0 && checkAmt < EXPRESS_MAJOR_EVENT_MIN_BUDGET_RWF) {
      return tr('For Wedding, Corporate, Commercial, or large events with delivery under 4 days, minimum budget starts from RWF 7,000,000.');
    }
    return null;
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      const e = validateStep1();
      if (e) return setError(e);
      setStep(2);
      scrollToTop();
    } else if (step === 2) {
      setStep(3);
      scrollToTop();
    } else if (step === 3) {
      const e3 = validateStep3();
      if (e3) return setError(e3);
      setStep(4);
      scrollToTop();
    }
  };

  const back = () => {
    setError(null);
    if (step === 1) setStep('select');
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
    scrollToTop();
  };

  const handleSelectCoverageMode = (mode: DigitalCoverageMode) => {
    setDraft((prev) => ({
      ...prev,
      coverageMode: mode,
      editedPhotos: mode === 'VIDEO' ? 0 : prev.editedPhotos === 0 ? 100 : prev.editedPhotos,
      shortVideosQty: mode === 'PHOTOGRAPHY' ? 0 : prev.shortVideosQty === 0 ? 2 : prev.shortVideosQty,
      longVideosQty: mode === 'PHOTOGRAPHY' ? 0 : prev.longVideosQty,
    }));
  };

  const handleUseRecommendedPricing = () => {
    setError(null);
    const e3 = validateStep3();
    if (e3) return setError(e3);
    const chosenDeadline = priceEstimate.isExpressMajorFloor
      ? draft.digitalDeadline
      : draft.packageOption === 'WITHIN_BUDGET'
        ? '14 days'
        : draft.packageOption === 'PRIORITY'
          ? '4 days'
          : '7 days';
    setDraft((prev) => ({
      ...prev,
      pricingDecision: 'RECOMMENDED',
      digitalDeadline: chosenDeadline,
    }));
    setStep(4);
    scrollToTop();
  };

  const handlePublishMyOfferAnyway = () => {
    setError(null);
    const e3 = validateStep3();
    if (e3) return setError(e3);
    setDraft((prev) => ({
      ...prev,
      pricingDecision: 'MY_OFFER_ANYWAY',
    }));
    setStep(4);
    scrollToTop();
  };

  const publish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let eventId = createdEventId;
      const resolvedEventType = eventTypeObj?.name || draft.eventTypeKey || 'Event';
      const generatedTitle =
        existingEvent?.title?.trim() ||
        `${resolvedEventType} · ${draft.venue.trim() || draft.city}`;
      const serializedBrief = serializeOfferBrief(draft, minutes);

      if (!eventId) {
        const ev = await createEvent(
          {
            title: generatedTitle,
            category: resolvedEventType,
            eventCategoryId: eventTypeObj?.id || undefined,
            eventDate: draft.date,
            startTime: draft.startTime,
            endTime: draft.endTime,
            location: [draft.venue.trim(), draft.city, options?.country].filter(Boolean).join(', '),
            description: serializedBrief,
            organizer:
              draft.clientType === 'ORGANIZATION'
                ? user?.organizationName ||
                  [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
                  'Organization'
                : [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Individual Client',
            eventVisibility: 'PUBLIC',
            allowWishInvites: draft.instantWishesAndMemories,
            hasLiveStream: draft.liveStream,
            attendanceMode: draft.liveStream ? 'HYBRID' : 'IN_PERSON',
            minimumPhotos: draft.coverageMode === 'VIDEO' ? 0 : draft.editedPhotos,
          },
          isCoordinator,
        );
        eventId = ev.id;
        setCreatedEventId(eventId);
      }

      let posted;
      try {
        posted = await createMatchRequest(eventId, {
          minBudget: effectiveMinBudget,
          maxBudget: effectiveMaxBudget,
          currency: 'RWF',
          photographerType: 'ANY',
          specialty: resolvedEventType,
          photographerSpecialty: 'ANY',
          locationCoverage: 'ANY',
          expirationHours: options?.defaultMatchWindowHours ?? 24,
          instructions: serializedBrief,
          city: draft.city,
          country: options?.country,
          venue: draft.venue.trim() || draft.city,
          latitude: cityInfo?.latitude,
          longitude: cityInfo?.longitude,
          hasLiveStream: draft.liveStream,
          allowWishInvites: draft.instantWishesAndMemories,
          minimumPhotos: draft.coverageMode === 'VIDEO' ? 0 : draft.editedPhotos,
          clientType: draft.clientType,
          digitalDeliveryDays: getDeadlineCalendarDays(draft.digitalDeadline),
          printDeliveryMethod: draft.printCollectionMethod,
          printDeliveryAddress: draft.printDeliveryAddress.trim() || undefined,
          printProposedDate: draft.printProposedDate.trim() || undefined,
        });
      } catch (e) {
        throw {
          message: `Your event was saved, but photographers weren't alerted: ${
            isApiError(e) ? e.message : 'please try again'
          }. Tap Publish Offer again to retry.`,
        };
      }
      setResult({ eventId, invited: posted?.invitedCount ?? 0, status: posted?.status });
      setStep('done');
      onPosted?.(eventId);
    } catch (e: any) {
      setError(e?.message || tr('Could not publish your offer. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    const id = result?.eventId;
    close();
    if (id && result?.invited) {
      setTimeout(() => router.push(`/event/candidates?id=${id}` as never), 200);
    }
  };

  const accent = MODE_META.HYBRID.color;
  const popularVenues = POPULAR_VENUES_BY_CITY[draft.city] ?? POPULAR_VENUES_BY_CITY.Kigali;
  const homeDeliveryAreas = HOME_DELIVERY_AREAS_BY_CITY[draft.city] ?? HOME_DELIVERY_AREAS_BY_CITY.Kigali;

  // ───────── Reusable UI Pieces ─────────

  const InfoBadgeButton = ({ infoKey, label }: { infoKey: InfoKey; label?: string }) => {
    const active = !!openInfo[infoKey];
    return (
      <Pressable
        onPress={() => toggleInfo(infoKey)}
        hitSlop={8}
        style={[styles.infoIconBtn, active && styles.infoIconBtnActive]}
        accessibilityRole="button"
        accessibilityLabel={label || tr('More information')}
      >
        <Ionicons
          name={active ? 'information-circle' : 'information-circle-outline'}
          size={16}
          color={active ? colors.primary : colors.textMuted}
        />
      </Pressable>
    );
  };

  const InfoPopover = ({ infoKey, text }: { infoKey: InfoKey; text: string }) => {
    if (!openInfo[infoKey]) return null;
    return (
      <View style={styles.infoPopoverBox}>
        <Ionicons name="information-circle" size={15} color={colors.primary} style={{ marginTop: 1 }} />
        <Text style={styles.infoPopoverText}>{text}</Text>
        <Pressable onPress={() => toggleInfo(infoKey)} hitSlop={8}>
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  };

  const DropdownPill = ({
    label,
    onPress,
    icon,
  }: {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
  }) => (
    <Pressable onPress={onPress} style={styles.dropdownPill} accessibilityRole="button">
      {icon ? <Ionicons name={icon} size={14} color={colors.primary} /> : null}
      <Text style={styles.dropdownPillText} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
    </Pressable>
  );

  const QtyPillGroup = ({
    presets,
    value,
    onSelect,
    onCustomPress,
  }: {
    presets: readonly number[];
    value: number;
    onSelect: (n: number) => void;
    onCustomPress: () => void;
  }) => {
    const isCustom = !presets.includes(value);
    return (
      <View style={styles.qtyPillRow}>
        {presets.map((n) => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onSelect(n)}
              style={[styles.qtyPill, active && styles.qtyPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.qtyPillText, active && styles.qtyPillTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onCustomPress}
          style={[styles.qtyPill, styles.qtyPillCustom, isCustom && styles.qtyPillActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: isCustom }}
        >
          <Text style={[styles.qtyPillText, isCustom && styles.qtyPillTextActive]}>
            {isCustom ? `${value} (Custom)` : tr('Custom')}
          </Text>
        </Pressable>
      </View>
    );
  };

  // ───────── Step Bodies ─────────

  let body: React.ReactNode = null;

  if (step === 'select') {
    body = (
      <View style={{ gap: spacing.md }}>
        {/* Option 1: Direct Selection */}
        <Pressable
          onPress={goDirect}
          accessibilityRole="button"
          accessibilityLabel={tr('Browse Photographers')}
          style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
        >
          <View style={styles.modeCardHeader}>
            <View style={[styles.modeIconBox, { backgroundColor: colors.tint }]}>
              <Ionicons name="camera" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.modeCardTitle}>{tr('Browse Photographers')}</Text>
                <View style={[styles.modeTypePill, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSoft }]}>
                  <Text style={[styles.modeTypePillText, { color: colors.textMuted }]}>{tr('Direct')}</Text>
                </View>
              </View>
              <Text style={styles.modeCardDesc}>
                {tr('Look through portfolios, compare packages, and reach out directly to the photographer you want.')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        {/* Option 2: Post Event Offer */}
        <Pressable
          onPress={goHybrid}
          accessibilityRole="button"
          accessibilityLabel={tr('Create Your Event Offer')}
          style={({ pressed }) => [
            styles.modeCard,
            styles.modeCardFeatured,
            pressed && styles.modeCardPressed,
          ]}
        >
          <View style={styles.modeCardHeader}>
            <View style={[styles.modeIconBox, { backgroundColor: isDark ? 'rgba(242, 12, 143, 0.16)' : 'rgba(242, 12, 143, 0.08)' }]}>
              <Ionicons name="calendar" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.modeCardTitle}>{tr('Create Your Event Offer')}</Text>
              </View>
              <Text style={styles.modeCardDesc}>
                {tr('Select event details, digital coverage, print products & delivery schedule. Available photographers accept or counter.')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>
      </View>
    );
  } else if (!options && !optionsError) {
    body = <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  } else if (optionsError) {
    body = <Text style={styles.error}>{optionsError}</Text>;
  } else if (options && !options.enabled) {
    body = (
      <Text style={styles.hint}>
        {tr('Post My Event is paused right now. Use Find a Photographer to book directly.')}
      </Text>
    );
  } else if (step === 1 && options) {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 OF 4: EVENT DETAILS
    // ═══════════════════════════════════════════════════════════════════════
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return isoDate(d);
    })();
    const sat = isoDate(nextWeekday(6));
    const nextSat = isoDate(nextWeekday(6, 1));

    body = (
      <View style={styles.pageCard}>
        {/* Individual or Organization */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{tr('Booking as')}</Text>
          <View style={styles.segmentedRow}>
            {(
              [
                ['INDIVIDUAL', 'person-outline', 'Individual'],
                ['ORGANIZATION', 'business-outline', 'Organization'],
              ] as [ClientEntityType, keyof typeof Ionicons.glyphMap, string][]
            ).map(([val, icon, label]) => {
              const active = draft.clientType === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => updateDraft('clientType', val)}
                  style={[styles.segmentCard, active && styles.segmentCardActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={icon} size={16} color={active ? onFill : colors.primary} />
                  <Text style={[styles.segmentCardText, active && styles.segmentCardTextActive]}>
                    {tr(label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* What are you planning? */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{tr('What are you planning?')}</Text>
          <View style={styles.eventTypeGrid}>
            {EVENT_TYPE_PRESETS.map((presetItem) => {
              const active = draft.eventTypeKey === presetItem.key;
              return (
                <Pressable
                  key={presetItem.key}
                  onPress={() => {
                    updateDraft('eventTypeKey', presetItem.key);
                    const matched = options.eventTypes.find((t) =>
                      t.name.toLowerCase().includes(presetItem.key.toLowerCase()),
                    );
                    if (matched) updateDraft('eventTypeId', matched.id);
                  }}
                  style={[styles.eventTypeCard, active && styles.eventTypeCardActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={presetItem.icon}
                    size={18}
                    color={active ? onFill : colors.primary}
                  />
                  <Text style={[styles.eventTypeCardText, active && styles.eventTypeCardTextActive]}>
                    {tr(presetItem.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {draft.eventTypeKey === 'Other' && options.eventTypes.length > 0 ? (
            <View style={[styles.wrap, { marginTop: spacing.xs }]}>
              {options.eventTypes.map((t) => (
                <Chip
                  key={t.id}
                  selected={draft.eventTypeId === t.id}
                  label={t.name}
                  onPress={() => updateDraft('eventTypeId', t.id)}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Date • Start & end time */}
        <View style={styles.sectionBlock}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>{tr('Date • Start & end time')}</Text>
            <View style={styles.durationPill}>
              <Ionicons name="time-outline" size={13} color={colors.primary} />
              <Text style={styles.durationPillText}>
                {durationText(minutes)}
                {overnight ? tr(' · next day') : ''}
              </Text>
            </View>
          </View>

          <View style={styles.wrap}>
            <Chip
              selected={draft.date === tomorrow}
              label={tr('Tomorrow')}
              onPress={() => updateDraft('date', tomorrow)}
            />
            <Chip
              selected={draft.date === sat}
              label={tr('This Saturday')}
              onPress={() => updateDraft('date', sat)}
            />
            <Chip
              selected={draft.date === nextSat}
              label={tr('Next Saturday')}
              onPress={() => updateDraft('date', nextSat)}
            />
          </View>

          <View style={styles.dateAndTimeGrid}>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={[styles.selectBox, { flex: 1.3, position: 'relative' }]}
              accessibilityRole="button"
              accessibilityLabel={tr('Select date')}
            >
              {Platform.OS === 'web' &&
                React.createElement('input', {
                  type: 'date',
                  min: new Date().toISOString().split('T')[0],
                  value: draft.date || '',
                  onClick: (e: any) => e.currentTarget?.showPicker?.(),
                  onChange: (e: any) => {
                    const val = e.target?.value;
                    if (val) updateDraft('date', val);
                  },
                  style: {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 2,
                  },
                })}
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text
                style={[styles.selectBoxText, !draft.date && { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {draft.date ? prettyDate(draft.date) : tr('Select date')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveSheet('start')}
              style={[styles.selectBox, { flex: 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`${tr('Start time')} ${draft.startTime}`}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.selectBoxText}>{draft.startTime}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => setActiveSheet('end')}
              style={[styles.selectBox, { flex: 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`${tr('End time')} ${draft.endTime}`}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.selectBoxText}>{draft.endTime}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Location • Venue */}
        <View style={styles.sectionBlock}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>{tr('Location • Venue')}</Text>
            <DropdownPill
              icon="location-outline"
              label={draft.city}
              onPress={() => setActiveSheet('city')}
            />
          </View>

          <View style={styles.wrap}>
            {popularVenues.map((v) => {
              const selected = draft.venue === v;
              return (
                <Chip
                  key={v}
                  selected={selected}
                  icon="navigate-outline"
                  label={v}
                  onPress={() => updateDraft('venue', v)}
                />
              );
            })}
          </View>

          <View style={styles.venueInputRow}>
            <Ionicons name="location-outline" size={17} color={colors.primary} />
            <TextInput
              value={draft.venue}
              onChangeText={(t) => updateDraft('venue', t)}
              maxLength={200}
              style={styles.venueInput}
              placeholder={tr('Search venue or enter location')}
              placeholderTextColor={colors.textMuted}
            />
            {draft.venue ? (
              <Pressable onPress={() => updateDraft('venue', '')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  } else if (step === 2 && options) {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 OF 4: COVERAGE & PRINT PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════
    const showPhotos = draft.coverageMode === 'PHOTOGRAPHY' || draft.coverageMode === 'BOTH';
    const showVideos = draft.coverageMode === 'VIDEO' || draft.coverageMode === 'BOTH';
    const isCustomShortDur = !(SHORT_VIDEO_DURATIONS as readonly string[]).includes(draft.shortVideosDuration);
    const isCustomLongDur = !(LONG_VIDEO_DURATIONS as readonly string[]).includes(draft.longVideosDuration);

    body = (
      <View style={{ gap: spacing.md }}>
        {/* CARD 1: DIGITAL COVERAGE */}
        <View style={styles.pageCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons name="camera" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeading}>{tr('Digital coverage')}</Text>
              <Text style={styles.cardSubheading}>{tr('What do you need?')}</Text>
            </View>
          </View>

          {/* Photography / Video / Both */}
          <View style={styles.segmentedRow}>
            {(
              [
                ['PHOTOGRAPHY', 'camera-outline', 'Photography'],
                ['VIDEO', 'videocam-outline', 'Video'],
                ['BOTH', 'film-outline', 'Both'],
              ] as [DigitalCoverageMode, keyof typeof Ionicons.glyphMap, string][]
            ).map(([modeKey, icon, label]) => {
              const active = draft.coverageMode === modeKey;
              return (
                <Pressable
                  key={modeKey}
                  onPress={() => handleSelectCoverageMode(modeKey)}
                  style={[styles.segmentCard, active && styles.segmentCardActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={icon} size={16} color={active ? onFill : colors.primary} />
                  <Text style={[styles.segmentCardText, active && styles.segmentCardTextActive]}>
                    {tr(label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Edited photos: Quantity */}
          {showPhotos ? (
            <View style={styles.deliverableRow}>
              <View style={styles.deliverableLabelCol}>
                <Text style={styles.deliverableTitle}>
                  {tr('Edited photos:')}{' '}
                  <Text style={styles.deliverableSubtitle}>{tr('Quantity')}</Text>
                </Text>
              </View>
              <QtyPillGroup
                presets={PHOTO_QUANTITY_PRESETS}
                value={draft.editedPhotos}
                onSelect={(n) => updateDraft('editedPhotos', n)}
                onCustomPress={() => setActiveSheet('photosCustom')}
              />
            </View>
          ) : null}

          {/* Short videos: Quantity + Duration */}
          {showVideos ? (
            <View style={styles.deliverableRow}>
              <View style={styles.deliverableLabelCol}>
                <Text style={styles.deliverableTitle}>
                  {tr('Short videos:')}{' '}
                  <Text style={styles.deliverableSubtitle}>{tr('Quantity + Duration')}</Text>
                </Text>
              </View>
              <QtyPillGroup
                presets={SHORT_VIDEO_QTY_PRESETS}
                value={draft.shortVideosQty}
                onSelect={(n) => updateDraft('shortVideosQty', n)}
                onCustomPress={() => setActiveSheet('shortVideosCustom')}
              />
              {draft.shortVideosQty > 0 ? (
                <View style={styles.subDurationRow}>
                  <Text style={styles.subDurationLabel}>{tr('Duration per video')}</Text>
                  <View style={styles.qtyPillRow}>
                    {SHORT_VIDEO_DURATIONS.map((dur) => {
                      const active = draft.shortVideosDuration === dur;
                      return (
                        <Pressable
                          key={dur}
                          onPress={() => updateDraft('shortVideosDuration', dur)}
                          style={[styles.qtyPill, active && styles.qtyPillActive]}
                        >
                          <Text style={[styles.qtyPillText, active && styles.qtyPillTextActive]}>
                            {dur}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => setActiveSheet('shortVideoDurationCustom')}
                      style={[styles.qtyPill, styles.qtyPillCustom, isCustomShortDur && styles.qtyPillActive]}
                    >
                      <Text style={[styles.qtyPillText, isCustomShortDur && styles.qtyPillTextActive]}>
                        {isCustomShortDur ? `${draft.shortVideosDuration} (Custom)` : tr('Custom')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Long videos: Quantity + Duration */}
          {showVideos ? (
            <View style={styles.deliverableRow}>
              <View style={styles.deliverableLabelCol}>
                <Text style={styles.deliverableTitle}>
                  {tr('Long videos:')}{' '}
                  <Text style={styles.deliverableSubtitle}>{tr('Quantity + Duration')}</Text>
                </Text>
              </View>
              <QtyPillGroup
                presets={LONG_VIDEO_QTY_PRESETS}
                value={draft.longVideosQty}
                onSelect={(n) => updateDraft('longVideosQty', n)}
                onCustomPress={() => setActiveSheet('longVideosCustom')}
              />
              {draft.longVideosQty > 0 ? (
                <View style={styles.subDurationRow}>
                  <Text style={styles.subDurationLabel}>{tr('Set duration if selected')}</Text>
                  <View style={styles.qtyPillRow}>
                    {LONG_VIDEO_DURATIONS.map((dur) => {
                      const active = draft.longVideosDuration === dur;
                      return (
                        <Pressable
                          key={dur}
                          onPress={() => updateDraft('longVideosDuration', dur)}
                          style={[styles.qtyPill, active && styles.qtyPillActive]}
                        >
                          <Text style={[styles.qtyPillText, active && styles.qtyPillTextActive]}>
                            {dur}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => setActiveSheet('longVideoDurationCustom')}
                      style={[styles.qtyPill, styles.qtyPillCustom, isCustomLongDur && styles.qtyPillActive]}
                    >
                      <Text style={[styles.qtyPillText, isCustomLongDur && styles.qtyPillTextActive]}>
                        {isCustomLongDur ? `${draft.longVideosDuration} (Custom)` : tr('Custom')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Instant updates (same day) with ⓘ */}
          <View style={[styles.deliverableRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Ionicons name="flash" size={16} color={colors.accent} />
                <Text style={styles.deliverableTitle}>{tr('Instant updates (same day)')}</Text>
                <InfoBadgeButton infoKey="instantUpdates" />
              </View>
              <View style={styles.qtyPillRow}>
                {([false, true] as const).map((flag) => {
                  const active = draft.instantUpdates === flag;
                  return (
                    <Pressable
                      key={String(flag)}
                      onPress={() => updateDraft('instantUpdates', flag)}
                      style={[styles.qtyPill, { minWidth: 64 }, active && styles.qtyPillActive]}
                    >
                      <Text style={[styles.qtyPillText, active && styles.qtyPillTextActive]}>
                        {flag ? tr('Yes') : tr('No')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <InfoPopover
              infoKey="instantUpdates"
              text={tr('Receive a few edited highlight photos or short clips on the same day of your event for social media.')}
            />
          </View>
        </View>

        {/* CARD 2: LIVE STREAM & INSTANT WISHES & MEMORIES SHARING */}
        <View style={styles.pageCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons name="radio-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardHeading}>
                {tr('Live stream & instant wishes & memories sharing')}
              </Text>
              <InfoBadgeButton infoKey="liveAndWishes" />
            </View>
          </View>
          <InfoPopover
            infoKey="liveAndWishes"
            text={tr(
              'Live stream broadcasts your event online for remote guests. Instant wishes & memories lets guests at the venue share wishes and view live event moments.',
            )}
          />

          {/* 1. LIVE STREAM (Yes / No) */}
          <View style={styles.printProductCard}>
            <View style={styles.rowBetween}>
              <View style={[styles.printProductTop, { flex: 1 }]}>
                <View style={styles.printIconBox}>
                  <Ionicons name="videocam-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.printProductTitle}>{tr('LIVE STREAM')}</Text>
                  <Text style={styles.printProductSub}>{tr('Live broadcast of your event')}</Text>
                </View>
              </View>
              <View style={styles.qtyPillRow}>
                {([false, true] as const).map((flag) => {
                  const active = draft.liveStream === flag;
                  return (
                    <Pressable
                      key={String(flag)}
                      onPress={() => updateDraft('liveStream', flag)}
                      style={[styles.qtyPill, { minWidth: 64 }, active && styles.qtyPillActive]}
                    >
                      <Text style={[styles.qtyPillText, active && styles.qtyPillTextActive]}>
                        {flag ? tr('Yes') : tr('No')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 2. INSTANT WISHES & MEMORIES SHARING (Yes / No) */}
          <View style={styles.printProductCard}>
            <View style={styles.rowBetween}>
              <View style={[styles.printProductTop, { flex: 1 }]}>
                <View style={styles.printIconBox}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.printProductTitle}>
                    {tr('INSTANT WISHES & MEMORIES SHARING')}
                  </Text>
                  <Text style={styles.printProductSub}>
                    {tr('Guests share wishes & memories during the event')}
                  </Text>
                </View>
              </View>
              <View style={styles.qtyPillRow}>
                {([false, true] as const).map((flag) => {
                  const active = draft.instantWishesAndMemories === flag;
                  return (
                    <Pressable
                      key={String(flag)}
                      onPress={() => updateDraft('instantWishesAndMemories', flag)}
                      style={[styles.qtyPill, { minWidth: 64 }, active && styles.qtyPillActive]}
                    >
                      <Text style={[styles.qtyPillText, active && styles.qtyPillTextActive]}>
                        {flag ? tr('Yes') : tr('No')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* CARD 3: PHOTO BOOKS, ALBUMS & PORTRAITS */}
        <View style={styles.pageCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons name="book-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardHeading}>{tr('Photo books, albums & portraits')}</Text>
              <InfoBadgeButton infoKey="printProducts" />
            </View>
          </View>
          <InfoPopover
            infoKey="printProducts"
            text={tr('Choose 0 if you only need digital coverage, or set the quantity, size, and finish for each print product.')}
          />

          {/* 1. PHOTO BOOKS */}
          <View style={styles.printProductCard}>
            <View style={styles.printProductTop}>
              <View style={styles.printIconBox}>
                <Ionicons name="book-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.printProductTitle}>{tr('PHOTO BOOKS')}</Text>
                <Text style={styles.printProductSub}>{tr('Quantity • Size • Page count')}</Text>
              </View>
            </View>
            <QtyPillGroup
              presets={PRINT_QTY_PRESETS}
              value={draft.photoBooksQty}
              onSelect={(n) => updateDraft('photoBooksQty', n)}
              onCustomPress={() => setActiveSheet('photoBooksCustom')}
            />
            {draft.photoBooksQty > 0 ? (
              <View style={styles.printDropdownsRow}>
                <DropdownPill
                  label={draft.photoBookSize}
                  onPress={() => setActiveSheet('photoBookSize')}
                />
                <DropdownPill
                  label={draft.photoBookPages}
                  onPress={() => setActiveSheet('photoBookPages')}
                />
              </View>
            ) : null}
          </View>

          {/* 2. PHOTO ALBUMS */}
          <View style={styles.printProductCard}>
            <View style={styles.printProductTop}>
              <View style={styles.printIconBox}>
                <Ionicons name="images-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.printProductTitle}>{tr('PHOTO ALBUMS')}</Text>
                <Text style={styles.printProductSub}>{tr('Quantity • Size • Print count')}</Text>
              </View>
            </View>
            <QtyPillGroup
              presets={PRINT_QTY_PRESETS}
              value={draft.photoAlbumsQty}
              onSelect={(n) => updateDraft('photoAlbumsQty', n)}
              onCustomPress={() => setActiveSheet('photoAlbumsCustom')}
            />
            {draft.photoAlbumsQty > 0 ? (
              <View style={styles.printDropdownsRow}>
                <DropdownPill
                  label={draft.photoAlbumSize}
                  onPress={() => setActiveSheet('photoAlbumSize')}
                />
                <DropdownPill
                  label={draft.photoAlbumPrints}
                  onPress={() => setActiveSheet('photoAlbumPrints')}
                />
              </View>
            ) : null}
          </View>

          {/* 3. WALL PORTRAITS */}
          <View style={styles.printProductCard}>
            <View style={styles.printProductTop}>
              <View style={styles.printIconBox}>
                <Ionicons name="easel-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.printProductTitle}>{tr('WALL PORTRAITS')}</Text>
                <Text style={styles.printProductSub}>{tr('Quantity • Size • Framed or unframed')}</Text>
              </View>
            </View>
            <QtyPillGroup
              presets={PRINT_QTY_PRESETS}
              value={draft.wallPortraitsQty}
              onSelect={(n) => updateDraft('wallPortraitsQty', n)}
              onCustomPress={() => setActiveSheet('wallPortraitsCustom')}
            />
            {draft.wallPortraitsQty > 0 ? (
              <View style={styles.printDropdownsRow}>
                <DropdownPill
                  label={draft.wallPortraitSize}
                  onPress={() => setActiveSheet('wallPortraitSize')}
                />
                <DropdownPill
                  label={draft.wallPortraitFrame}
                  onPress={() => setActiveSheet('wallPortraitFrame')}
                />
              </View>
            ) : null}
          </View>

          {/* More options: editing style & usage */}
          <Pressable
            onPress={() => setMoreStyleOpen((v) => !v)}
            style={styles.moreOptionsBar}
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={16} color={colors.primary} />
            <Text style={styles.moreOptionsText}>
              {tr('More options: editing style & usage')}
            </Text>
            <Ionicons
              name={moreStyleOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>

          {moreStyleOpen ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              <Text style={styles.subDurationLabel}>{tr('Editing style')}</Text>
              <View style={styles.wrap}>
                {EDITING_STYLES.map((st) => (
                  <Chip
                    key={st}
                    selected={draft.editingStyle === st}
                    label={st}
                    onPress={() => updateDraft('editingStyle', st)}
                  />
                ))}
              </View>
              <Text style={styles.subDurationLabel}>{tr('Usage')}</Text>
              <View style={styles.wrap}>
                {USAGE_RIGHTS.map((u) => (
                  <Chip
                    key={u}
                    selected={draft.usageRights === u}
                    label={u}
                    onPress={() => updateDraft('usageRights', u)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  } else if (step === 3 && options) {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3 OF 4: DELIVERY & PRICE ESTIMATE + RECOMMENDED PRICING
    // ═══════════════════════════════════════════════════════════════════════
    const isCustomDigitalDeadline = !(DIGITAL_DEADLINE_PRESETS as readonly string[]).includes(
      draft.digitalDeadline,
    );
    const isProposePrintDate = draft.printProductionTime === 'Propose production & handover date';
    const isHomeDelivery = draft.printCollectionMethod === 'Deliver to my home address';
    const summaryLines = formatOfferDeliverablesSummaryLines(draft, minutes);
    const completeDelta = priceEstimate.recommended - clientMaxBudget;
    const backendBudgetPresets = (options?.budgetPresets ?? []).filter(
      (p): p is { label: string; min: number; max: number } =>
        typeof p.min === 'number' && typeof p.max === 'number' && p.max > 0,
    );
    const budgetRangesList = priceEstimate.isExpressMajorFloor
      ? EXPRESS_MAJOR_BUDGET_RANGES
      : backendBudgetPresets.length > 0
        ? backendBudgetPresets
        : STANDARD_BUDGET_RANGES;

    const plus7Date = addDaysIso(draft.date, 7);
    const plus14Date = addDaysIso(draft.date, 14);
    const plus21Date = addDaysIso(draft.date, 21);

    body = (
      <View style={{ gap: spacing.sm }}>
        {/* CARD 1: DIGITAL & PRINT DELIVERY + CLIENT BUDGET RANGE */}
        <View style={styles.pageCardCompact}>
          {/* DIGITAL DELIVERY + ⓘ */}
          <View style={styles.sectionBlock}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIconBox}>
                <Ionicons name="cloud-download-outline" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardHeading}>{tr('DIGITAL DELIVERY')}</Text>
                <InfoBadgeButton infoKey="digitalDelivery" />
              </View>
            </View>
            <InfoPopover
              infoKey="digitalDelivery"
              text={tr(
                'Corporate, commercial, fashion & large events: recommend 4+ calendar days for final digital delivery. More work may need longer. Express delivery under 4 days for Wedding, Corporate, Commercial, or large events starts from RWF 7,000,000.',
              )}
            />

            <View style={styles.qtyPillRow}>
              {DIGITAL_DEADLINE_PRESETS.map((d) => {
                const active = draft.digitalDeadline === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => updateDraft('digitalDeadline', d)}
                    style={[styles.qtyPill, active && styles.qtyPillActive]}
                  >
                    <Text style={[styles.qtyPillText, active && styles.qtyPillTextActive]}>
                      {tr(d)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setActiveSheet('digitalDeadlineCustom')}
                style={[styles.qtyPill, styles.qtyPillCustom, isCustomDigitalDeadline && styles.qtyPillActive]}
              >
                <Text style={[styles.qtyPillText, isCustomDigitalDeadline && styles.qtyPillTextActive]}>
                  {isCustomDigitalDeadline ? `${draft.digitalDeadline} (Custom)` : tr('Custom')}
                </Text>
              </Pressable>
            </View>

            {/* Only show the active warning when < 4 days express floor is triggered */}
            {priceEstimate.isExpressMajorFloor ? (
              <View style={[styles.infoBanner, styles.warningBanner]}>
                <Ionicons name="warning" size={15} color={colors.pending} />
                <Text style={[styles.infoBannerText, { color: colors.text, fontWeight: fontWeight.bold }]}>
                  {tr(
                    'Express delivery (< 4 days) for Wedding, Corporate, Commercial, or large events starts from RWF 7,000,000.',
                  )}
                </Text>
              </View>
            ) : null}
          </View>

          {/* PRINT DELIVERY + ⓘ */}
          <View style={styles.sectionBlock}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIconBox}>
                <Ionicons name="cube-outline" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardHeading}>{tr('PRINT DELIVERY')}</Text>
                <InfoBadgeButton infoKey="printDelivery" />
              </View>
            </View>
            <InfoPopover
              infoKey="printDelivery"
              text={tr(
                'Print delivery is separate from digital delivery. Production starts after you select your favorite edited photos and approve the print proof.',
              )}
            />

            <View style={styles.printDropdownsRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.subDurationLabel}>{tr('Production time')}</Text>
                <DropdownPill
                  label={draft.printProductionTime}
                  onPress={() => setActiveSheet('printProductionTime')}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.subDurationLabel}>{tr('Collection / delivery')}</Text>
                <DropdownPill
                  label={draft.printCollectionMethod}
                  onPress={() => setActiveSheet('printCollectionMethod')}
                />
              </View>
            </View>

            {/* Custom Date Selector when "Propose production & handover date" is selected */}
            {isProposePrintDate ? (
              <View style={styles.homeAddressCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={styles.deliverableTitle}>
                    {tr('Select proposed production & handover date')}
                  </Text>
                </View>
                <View style={styles.wrap}>
                  {[
                    [plus7Date, '+7 days'],
                    [plus14Date, '+14 days'],
                    [plus21Date, '+21 days'],
                  ].map(([isoVal, lbl]) => (
                    <Chip
                      key={lbl}
                      selected={draft.printProposedDate === isoVal}
                      icon="calendar-outline"
                      label={`${lbl} (${prettyDate(isoVal)})`}
                      onPress={() => updateDraft('printProposedDate', isoVal)}
                    />
                  ))}
                </View>

                <Pressable
                  onPress={() => setPrintDatePickerOpen(true)}
                  style={[styles.selectBox, { position: 'relative' }]}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Select proposed handover date')}
                >
                  {Platform.OS === 'web' &&
                    React.createElement('input', {
                      type: 'date',
                      min: draft.date || new Date().toISOString().split('T')[0],
                      value: draft.printProposedDate || '',
                      onClick: (e: any) => e.currentTarget?.showPicker?.(),
                      onChange: (e: any) => {
                        const val = e.target?.value;
                        if (val) updateDraft('printProposedDate', val);
                      },
                      style: {
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 2,
                      },
                    })}
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text
                    style={[styles.selectBoxText, !draft.printProposedDate && { color: colors.textMuted }]}
                  >
                    {draft.printProposedDate
                      ? prettyDate(draft.printProposedDate)
                      : tr('Pick custom production & handover date')}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            {/* Exact home address input when "Deliver to my home address" is selected */}
            {isHomeDelivery ? (
              <View style={styles.homeAddressCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="home-outline" size={16} color={colors.primary} />
                  <Text style={styles.deliverableTitle}>
                    {tr('Where exactly should we deliver your print products?')}
                  </Text>
                </View>
                <View style={styles.wrap}>
                  {homeDeliveryAreas.map((area) => {
                    const selected = draft.printDeliveryAddress.includes(area);
                    return (
                      <Chip
                        key={area}
                        selected={selected}
                        icon="location-outline"
                        label={area}
                        onPress={() => updateDraft('printDeliveryAddress', `${area}, ${draft.city}`)}
                      />
                    );
                  })}
                </View>
                <View style={styles.venueInputRow}>
                  <Ionicons name="navigate-outline" size={17} color={colors.primary} />
                  <TextInput
                    value={draft.printDeliveryAddress}
                    onChangeText={(t) => updateDraft('printDeliveryAddress', t)}
                    maxLength={220}
                    style={styles.venueInput}
                    placeholder={tr('e.g. Nyarutarama KG 9 Ave, House #14 (near Golf Club)')}
                    placeholderTextColor={colors.textMuted}
                  />
                  {draft.printDeliveryAddress ? (
                    <Pressable onPress={() => updateDraft('printDeliveryAddress', '')} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* CLIENT BUDGET RANGE (Small-unit presets + Flexible custom inputs) */}
          <View style={styles.sectionBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>{tr('Your budget (preferred range)')}</Text>
                <InfoBadgeButton infoKey="budgetRange" />
              </View>
              <Text style={styles.budgetRangeActiveBadge}>{clientRangeDisplay}</Text>
            </View>
            <InfoPopover
              infoKey="budgetRange"
              text={tr(
                'Choose one of the suggested budget ranges or select Flexible to enter your own custom minimum and maximum budget in RWF. Small events under 7 hours use uploaded photographer tariffs.',
              )}
            />

            {/* Suggestion Range Presets (starting from small units) + Flexible Option */}
            <View style={styles.wrap}>
              {budgetRangesList.map((r) => {
                const minStr = r.min === 0 ? '0' : formatAmountWithCommas(String(r.min));
                const maxStr = formatAmountWithCommas(String(r.max));
                const active =
                  draft.budgetMode === 'PRESET' &&
                  draft.minBudgetInput === minStr &&
                  draft.maxBudgetInput === maxStr;
                return (
                  <Chip
                    key={r.label}
                    selected={active}
                    label={r.label}
                    onPress={() => {
                      updateDraft('budgetMode', 'PRESET');
                      updateDraft('minBudgetInput', minStr);
                      updateDraft('maxBudgetInput', maxStr);
                      updateDraft('pricingDecision', 'MY_OFFER_ANYWAY');
                    }}
                  />
                );
              })}
              <Chip
                selected={draft.budgetMode === 'FLEXIBLE'}
                icon="options-outline"
                label={tr('Flexible')}
                onPress={() => {
                  updateDraft('budgetMode', 'FLEXIBLE');
                  updateDraft('pricingDecision', 'MY_OFFER_ANYWAY');
                }}
              />
            </View>

            {/* Minimum & Maximum Input Boxes — ONLY shown when Flexible is clicked */}
            {draft.budgetMode === 'FLEXIBLE' ? (
              <View style={styles.budgetRangeRow}>
                <View style={styles.politeBudgetField}>
                  <Text style={styles.politeBudgetLabel}>{tr('Minimum offer')}</Text>
                  <View style={styles.politeBudgetInputRow}>
                    <View style={styles.currencyBadge}>
                      <Text style={styles.currencyTag}>RWF</Text>
                    </View>
                    <TextInput
                      value={draft.minBudgetInput}
                      onChangeText={(t) => {
                        updateDraft('minBudgetInput', formatAmountWithCommas(t));
                        updateDraft('pricingDecision', 'MY_OFFER_ANYWAY');
                      }}
                      keyboardType="number-pad"
                      placeholder={
                        priceEstimate.isExpressMajorFloor ? '7,000,000' : 'e.g. 150,000'
                      }
                      placeholderTextColor={colors.textMuted}
                      style={styles.budgetInput}
                    />
                    {draft.minBudgetInput ? (
                      <Pressable onPress={() => updateDraft('minBudgetInput', '')} hitSlop={8}>
                        <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.budgetRangeDashWrap}>
                  <Text style={styles.budgetRangeDash}>—</Text>
                </View>

                <View style={styles.politeBudgetField}>
                  <Text style={styles.politeBudgetLabel}>{tr('Maximum offer')}</Text>
                  <View style={styles.politeBudgetInputRow}>
                    <View style={styles.currencyBadge}>
                      <Text style={styles.currencyTag}>RWF</Text>
                    </View>
                    <TextInput
                      value={draft.maxBudgetInput}
                      onChangeText={(t) => {
                        updateDraft('maxBudgetInput', formatAmountWithCommas(t));
                        updateDraft('pricingDecision', 'MY_OFFER_ANYWAY');
                      }}
                      keyboardType="number-pad"
                      placeholder={
                        priceEstimate.isExpressMajorFloor ? '8,500,000' : 'e.g. 350,000'
                      }
                      placeholderTextColor={colors.textMuted}
                      style={styles.budgetInput}
                    />
                    {draft.maxBudgetInput ? (
                      <Pressable onPress={() => updateDraft('maxBudgetInput', '')} hitSlop={8}>
                        <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* CARD 2: RECOMMENDED PRICING & COMPARE MATCHING PACKAGES (Cool Vertical Display with Tightened Spacing) */}
        <View style={styles.recPricingContainer}>
          {/* Header with ⓘ */}
          <View style={styles.recHeaderCenter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.recMainTitle}>{tr('Recommended pricing.')}</Text>
              <InfoBadgeButton infoKey="recPricing" />
            </View>
            <Text style={styles.recSubtitle}>
              {tr('According to your shared data, this may fit (advisory only).')}
            </Text>
          </View>
          <InfoPopover
            infoKey="recPricing"
            text={tr(
              'According to your shared event scope and timeline, we compare what you need and in how long against available photographers’ supported packages. Prices are advisory only and require provider agreement.',
            )}
          />

          {/* "Your offer" summary card in vertical display */}
          <View style={styles.yourOfferCard}>
            <View style={styles.yourOfferIconCircle}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.yourOfferTitle}>{tr('Your offer')}</Text>
              <Text style={styles.yourOfferScopeText}>{summaryLines.digitalLine}</Text>
              <Text style={styles.yourOfferScopeText}>{summaryLines.printLine}</Text>
              <Text style={styles.yourOfferBudgetRow}>
                {tr('Budget:')}{' '}
                <Text style={styles.yourOfferBudgetHighlight}>{clientRangeDisplay}</Text>
              </Text>
            </View>
          </View>

          {/* Section Title: Compare matching packages. */}
          <Text style={styles.compareSectionTitle}>{tr('Compare matching packages.')}</Text>

          {/* PACKAGE 1: Essential */}
          {(() => {
            const active = draft.packageOption === 'WITHIN_BUDGET';
            return (
              <Pressable
                onPress={() => updateDraft('packageOption', 'WITHIN_BUDGET')}
                style={[styles.pkgRowCard, active && styles.pkgRowCardActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <View style={styles.pkgLeftCol}>
                  <View style={[styles.pkgRadioOuter, active && styles.pkgRadioOuterActive]}>
                    {active ? <View style={styles.pkgRadioInner} /> : null}
                  </View>
                  <View style={styles.pkgIconCircle}>
                    <Ionicons name="camera" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={[styles.pkgBadge, styles.pkgBadgeCyan]}>
                      <Text style={styles.pkgBadgeCyanText}>{tr('Within budget')}</Text>
                    </View>
                    <Text style={styles.pkgTitle}>{tr('Essential')}</Text>
                    <Text style={styles.pkgScopeDesc}>{summaryLines.completeDigitalLine}</Text>
                  </View>
                </View>

                <View style={styles.pkgRightCol}>
                  <Text style={styles.pkgPriceText}>
                    RWF {priceEstimate.low.toLocaleString('en-US')}
                  </Text>
                  <View style={styles.pkgMetaLine}>
                    <Ionicons name="images-outline" size={12} color={colors.textSoft} />
                    <Text style={styles.pkgMetaText}>{tr('Digital delivery: 14 days')}</Text>
                  </View>
                  <View style={styles.pkgMetaLine}>
                    <Ionicons name="book-outline" size={12} color={colors.textSoft} />
                    <Ionicons name="close" size={12} color={colors.error} />
                    <Text style={styles.pkgMetaText}>
                      {tr('Photo book & portraits not included')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })()}

          {/* PACKAGE 2: Complete (Recommended) */}
          {(() => {
            const active = draft.packageOption === 'RECOMMENDED';
            return (
              <Pressable
                onPress={() => updateDraft('packageOption', 'RECOMMENDED')}
                style={[styles.pkgRowCard, active && styles.pkgRowCardActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <View style={styles.pkgLeftCol}>
                  <View style={[styles.pkgRadioOuter, active && styles.pkgRadioOuterActive]}>
                    {active ? <View style={styles.pkgRadioInner} /> : null}
                  </View>
                  <View style={[styles.pkgIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.22)' }]}>
                    <Ionicons name="book" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={[styles.pkgBadge, styles.pkgBadgePurple]}>
                      <Text style={styles.pkgBadgePurpleText}>{tr('Recommended')}</Text>
                    </View>
                    <Text style={styles.pkgTitle}>{tr('Complete')}</Text>
                    <Text style={styles.pkgScopeDesc}>{summaryLines.completeDigitalLine}</Text>
                    <Text style={styles.pkgScopeDesc}>{summaryLines.completePrintLine}</Text>
                  </View>
                </View>

                <View style={styles.pkgRightCol}>
                  <Text style={styles.pkgPriceText}>
                    RWF {priceEstimate.recommended.toLocaleString('en-US')}
                  </Text>
                  <View style={styles.pkgMetaLine}>
                    <Ionicons name="images-outline" size={12} color={colors.textSoft} />
                    <Text style={styles.pkgMetaText}>{tr('Digital delivery: 7 days')}</Text>
                  </View>
                  <View style={styles.pkgMetaLine}>
                    <Ionicons name="book-outline" size={12} color={colors.textSoft} />
                    <Text style={styles.pkgMetaText}>
                      {tr('Print delivery confirmed separately')}
                    </Text>
                  </View>
                  {completeDelta > 0 ? (
                    <View style={styles.pkgMetaLine}>
                      <Ionicons name="arrow-up" size={12} color={colors.accent} />
                      <Text style={styles.pkgDeltaAboveText}>
                        RWF {completeDelta.toLocaleString('en-US')} {tr('above your budget')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.pkgMetaLine}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                      <Text style={[styles.pkgDeltaAboveText, { color: colors.success }]}>
                        {tr('Within your budget')}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })()}

          {/* PACKAGE 3: Priority (Faster delivery) */}
          {(() => {
            const active = draft.packageOption === 'PRIORITY';
            return (
              <Pressable
                onPress={() => updateDraft('packageOption', 'PRIORITY')}
                style={[styles.pkgRowCard, active && styles.pkgRowCardActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <View style={styles.pkgLeftCol}>
                  <View style={[styles.pkgRadioOuter, active && styles.pkgRadioOuterActive]}>
                    {active ? <View style={styles.pkgRadioInner} /> : null}
                  </View>
                  <View style={styles.pkgIconCircle}>
                    <Ionicons name="flash" size={18} color={colors.link} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={[styles.pkgBadge, styles.pkgBadgeCyan]}>
                      <Text style={styles.pkgBadgeCyanText}>{tr('Faster delivery')}</Text>
                    </View>
                    <Text style={styles.pkgTitle}>{tr('Priority')}</Text>
                    <Text style={styles.pkgScopeDesc}>{tr('Same deliverables as Complete.')}</Text>
                  </View>
                </View>

                <View style={styles.pkgRightCol}>
                  <Text style={styles.pkgPriceText}>
                    RWF {priceEstimate.priority.toLocaleString('en-US')}
                  </Text>
                  <View style={styles.pkgMetaLine}>
                    <Ionicons name="images-outline" size={12} color={colors.textSoft} />
                    <Text style={styles.pkgMetaText}>{tr('Digital delivery: 4 days')}</Text>
                  </View>
                  <View style={styles.pkgMetaLine}>
                    <Ionicons name="book-outline" size={12} color={colors.textSoft} />
                    <Text style={styles.pkgMetaText}>
                      {tr('Print delivery confirmed separately')}
                    </Text>
                  </View>
                  <View style={styles.pkgMetaLine}>
                    <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.pkgMetaText}>{tr('Subject to provider availability.')}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })()}

          {/* Two Choice Buttons in Vertical Stack */}
          <View style={{ gap: 8, marginTop: 2 }}>
            <Pressable
              onPress={handleUseRecommendedPricing}
              style={styles.useRecommendedBtn}
              accessibilityRole="button"
              accessibilityLabel={tr('Use recommended pricing')}
            >
              <View style={styles.useRecommendedCheckCircle}>
                <Ionicons name="checkmark" size={14} color={colors.primary} />
              </View>
              <Text style={styles.useRecommendedBtnText}>{tr('Use recommended pricing')}</Text>
            </Pressable>

            <Pressable
              onPress={handlePublishMyOfferAnyway}
              style={styles.publishAnywayBtn}
              accessibilityRole="button"
              accessibilityLabel={tr('Publish my offer anyway')}
            >
              <Ionicons name="arrow-forward" size={16} color={colors.link} />
              <Text style={styles.publishAnywayBtnText}>{tr('Publish my offer anyway')}</Text>
            </Pressable>

            <View style={styles.recFooterBottomRow}>
              <Text style={styles.publishAnywayNote}>
                {tr('Publishing anyway keeps your')} {clientRangeDisplay}{' '}
                {tr('budget and original requirements.')}
              </Text>
              <Pressable
                onPress={() => setPoliciesOpen((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.viewPoliciesLink}>{tr('View booking policies')}</Text>
              </Pressable>
            </View>

            {policiesOpen ? (
              <View style={styles.policiesBox}>
                <Text style={styles.policiesBoxTitle}>{tr('Booking & Matching Policies')}</Text>
                <Text style={styles.policiesBoxText}>
                  • {tr('Photographers review your full scope, delivery dates, and budget before accepting or countering.')}{'\n'}
                  • {tr('Print production begins after you select your favorite photos and approve the print proof.')}{'\n'}
                  • {tr('No payment is charged until you select a responding photographer and confirm final terms.')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  } else if (step === 4 && options) {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4 OF 4: CLEAN, EXECUTIVE REVIEW & PUBLISH
    // ═══════════════════════════════════════════════════════════════════════
    const resolvedEventType = eventTypeObj?.name || draft.eventTypeKey || 'Event';
    const coverageHoursStr = durationText(minutes) || '6 hours';
    const printHandoverStr = formatPrintHandoverSummary(draft);

    body = (
      <View style={{ gap: spacing.md }}>
        {/* 1. EXECUTIVE OFFER HERO CARD */}
        <View style={styles.reviewHeroCard}>
          <View style={styles.rowBetween}>
            <View style={styles.receiverModeBanner}>
              <Ionicons name="videocam-outline" size={14} color={colors.accent} />
              <Text style={styles.receiverModeBannerText}>
                {tr('Requested')}: {formatCoverageModeLabel(draft.coverageMode)}
              </Text>
            </View>
            <View style={styles.durationPill}>
              <Ionicons name="person-outline" size={12} color={colors.primary} />
              <Text style={styles.durationPillText}>
                {draft.clientType === 'ORGANIZATION' ? tr('Organization') : tr('Individual')}
              </Text>
            </View>
          </View>

          {/* Event Title + Date/Time + Venue */}
          <View style={styles.reviewEventIdentityBox}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.reviewHeroEventTitle}>
                {resolvedEventType} • {draft.venue || draft.city}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                  <Text style={styles.reviewHeroMetaText}>
                    {draft.date ? prettyDate(draft.date) : tr('Date TBD')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={13} color={colors.primary} />
                  <Text style={styles.reviewHeroMetaText}>
                    {draft.startTime}–{draft.endTime} ({coverageHoursStr})
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="location-outline" size={13} color={colors.primary} />
                  <Text style={styles.reviewHeroMetaText}>
                    {draft.venue ? `${draft.venue}, ${draft.city}` : draft.city}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable onPress={() => setStep(1)} style={styles.editChipBtn} hitSlop={8}>
              <Ionicons name="create-outline" size={13} color={colors.primary} />
              <Text style={styles.editChipText}>{tr('Edit')}</Text>
            </Pressable>
          </View>

          {/* Published Budget Banner */}
          <View style={styles.receiverClientOfferBox}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="wallet-outline" size={14} color={colors.accent} />
                <Text style={styles.receiverOfferEyebrow}>
                  {draft.pricingDecision === 'RECOMMENDED'
                    ? tr('RECOMMENDED PACKAGE OFFER')
                    : tr("CLIENT'S BUDGET RANGE")}
                </Text>
              </View>
              <Pressable onPress={() => setStep(3)} hitSlop={8}>
                <Text style={styles.editLink}>{tr('Change budget')}</Text>
              </Pressable>
            </View>
            <Text style={styles.receiverOfferAmount}>{effectiveBudgetDisplay}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.receiverOfferSub}>
                {draft.pricingDecision === 'RECOMMENDED'
                  ? tr('Matched to recommended package scope')
                  : tr('For the complete requested scope')}
              </Text>
              <View style={styles.matchPreviewBadge}>
                <Ionicons name="sparkles" size={11} color={colors.primary} />
                <Text style={styles.matchPreviewBadgeText}>
                  {previewLoading
                    ? tr('Checking matches...')
                    : preview?.matchCount != null
                      ? `${preview.matchCount} ${
                          preview.matchCount === 1
                            ? tr('photographer fits')
                            : tr('photographers fit')
                        }`
                      : tr('Ready to broadcast')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. SIDE-BY-SIDE DELIVERABLES & DELIVERY SCHEDULE (Matches Image 3 cleanly) */}
        <View style={styles.receiverGrid}>
          {/* Box A: Requested deliverables */}
          <View style={styles.receiverDetailBox}>
            <View style={styles.rowBetween}>
              <View style={styles.receiverBoxHeader}>
                <Ionicons name="list-outline" size={15} color={colors.primary} />
                <Text style={styles.receiverBoxTitle}>{tr('Requested deliverables')}</Text>
              </View>
              <Pressable onPress={() => setStep(2)} style={styles.editChipBtn} hitSlop={8}>
                <Ionicons name="create-outline" size={13} color={colors.primary} />
                <Text style={styles.editChipText}>{tr('Edit')}</Text>
              </Pressable>
            </View>

            {(
              [
                ['time-outline', tr('Coverage'), coverageHoursStr],
                [
                  'image-outline',
                  tr('Edited photos'),
                  String(draft.coverageMode === 'VIDEO' ? 0 : draft.editedPhotos),
                ],
                ['videocam-outline', tr('Short videos'), formatShortVideosSummary(draft)],
                ['film-outline', tr('Long videos'), formatLongVideosSummary(draft)],
                [
                  'flash-outline',
                  tr('Instant updates'),
                  draft.instantUpdates ? tr('Yes (same day)') : tr('Not requested'),
                ],
                ['radio-outline', tr('Live stream'), formatLiveStreamSummary(draft)],
                [
                  'sparkles-outline',
                  tr('Wishes & memories'),
                  formatInstantWishesSummary(draft),
                ],
                ['book-outline', tr('Photo book'), formatPhotoBookSummary(draft)],
                ['images-outline', tr('Photo album'), formatPhotoAlbumSummary(draft)],
                ['easel-outline', tr('Wall portraits'), formatWallPortraitSummary(draft)],
              ] as [keyof typeof Ionicons.glyphMap, string, string][]
            ).map(([ic, k, v]) => (
              <View key={k} style={styles.receiverItemRow}>
                <Ionicons name={ic} size={13} color={colors.textMuted} />
                <Text style={styles.receiverItemKey}>{k}</Text>
                <Text style={styles.receiverItemVal} numberOfLines={1}>
                  {v}
                </Text>
              </View>
            ))}
          </View>

          {/* Box B: Delivery & Style */}
          <View style={styles.receiverDetailBox}>
            <View style={styles.rowBetween}>
              <View style={styles.receiverBoxHeader}>
                <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                <Text style={styles.receiverBoxTitle}>{tr('Delivery & preferences')}</Text>
              </View>
              <Pressable onPress={() => setStep(3)} style={styles.editChipBtn} hitSlop={8}>
                <Ionicons name="create-outline" size={13} color={colors.primary} />
                <Text style={styles.editChipText}>{tr('Edit')}</Text>
              </Pressable>
            </View>

            <View style={styles.receiverItemRow}>
              <Ionicons name="cloud-outline" size={13} color={colors.textMuted} />
              <Text style={styles.receiverItemKey}>{tr('Digital')}</Text>
              <Text style={styles.receiverItemVal}>
                {tr('Within')} {draft.digitalDeadline} {tr('after the event')}
              </Text>
            </View>
            <View style={styles.receiverItemRow}>
              <Ionicons name="print-outline" size={13} color={colors.textMuted} />
              <Text style={styles.receiverItemKey}>{tr('Print products')}</Text>
              <Text style={styles.receiverItemVal}>{printHandoverStr}</Text>
            </View>
            <View style={styles.receiverItemRow}>
              <Ionicons name="color-palette-outline" size={13} color={colors.textMuted} />
              <Text style={styles.receiverItemKey}>{tr('Editing style')}</Text>
              <Text style={styles.receiverItemVal}>
                {draft.editingStyle} ({draft.usageRights})
              </Text>
            </View>
          </View>
        </View>

        {/* 3. COMPACT PROCESS TIMELINE WITH ⓘ */}
        <View style={styles.timelineCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardHeading}>{tr('What happens after you publish')}</Text>
            <InfoBadgeButton infoKey="reviewProcess" />
          </View>
          <InfoPopover
            infoKey="reviewProcess"
            text={tr(
              'Preliminary estimate only — final price, availability and terms are confirmed with the photographer. Print fulfilment (image selection, proof approval, production, and handover) happens after digital editing.',
            )}
          />
          <View style={styles.timelineRow}>
            {(
              [
                ['people-outline', '1. Photographers respond', 'Accept or counter your offer'],
                ['document-text-outline', '2. Confirm scope & pay', 'Agree final details'],
                ['checkmark-circle-outline', '3. Booking confirmed', 'Digital + print fulfilment'],
              ] as [keyof typeof Ionicons.glyphMap, string, string][]
            ).map(([ic, t1, t2]) => (
              <View key={t1} style={styles.timelineStep}>
                <View style={styles.timelineIconCircle}>
                  <Ionicons name={ic} size={14} color={colors.primary} />
                </View>
                <Text style={styles.timelineStepTitle}>{tr(t1)}</Text>
                <Text style={styles.timelineStepSub}>{tr(t2)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  } else if (step === 'done' && result) {
    const failed = !result.invited || result.status === 'MATCHING_FAILED';
    body = (
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl }}>
        <View
          style={[
            styles.doneIcon,
            { backgroundColor: failed ? colors.warningBg : MODE_META.HYBRID.soft },
          ]}
        >
          <Ionicons
            name={failed ? 'alert' : 'paper-plane-outline'}
            size={34}
            color={failed ? colors.pending : accent}
          />
        </View>
        <Text style={styles.doneTitle}>
          {failed
            ? tr('Saved, but nobody fits right now')
            : `${result.invited} photographer${result.invited === 1 ? ' was' : 's were'} alerted`}
        </Text>
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          {failed
            ? tr(
                'Your event offer is saved privately. Publish it again with a wider budget or schedule, or use Find a Photographer to book directly.',
              )
            : tr("We'll notify you each time a photographer accepts or counters your offer.")}
        </Text>
      </View>
    );
  }

  // ───────── Sheet Modal Options Resolver (with Custom Input support) ─────────
  const sheetConfig = useMemo((): {
    title: string;
    items: string[];
    selected: string;
    allowCustomInput?: boolean;
    numericOnly?: boolean;
    customPlaceholder?: string;
    onSelect: (val: string) => void;
    onCustomApply?: (raw: string) => void;
  } | null => {
    if (!activeSheet) return null;
    switch (activeSheet) {
      case 'start':
        return {
          title: tr('Start time'),
          items: slots,
          selected: draft.startTime,
          onSelect: (v) => updateDraft('startTime', v),
        };
      case 'end':
        return {
          title: tr('End time'),
          items: slots.filter((s) => s !== draft.startTime),
          selected: draft.endTime,
          onSelect: (v) => updateDraft('endTime', v),
        };
      case 'city':
        return {
          title: tr('Select City'),
          items: options?.cities.map((c) => c.name) ?? ['Kigali'],
          selected: draft.city,
          allowCustomInput: true,
          customPlaceholder: tr('Type another city or town...'),
          onSelect: (v) => updateDraft('city', v),
          onCustomApply: (v) => updateDraft('city', v),
        };
      case 'photosCustom':
        return {
          title: tr('Edited photos: Custom quantity'),
          items: PHOTO_CUSTOM_OPTIONS.map(String),
          selected: String(draft.editedPhotos),
          allowCustomInput: true,
          numericOnly: true,
          customPlaceholder: tr('Enter exact number of photos (e.g. 75)...'),
          onSelect: (v) => updateDraft('editedPhotos', Number(v)),
          onCustomApply: (v) => {
            const n = parseInt(v.replace(/\D/g, ''), 10);
            if (Number.isFinite(n) && n >= 0) updateDraft('editedPhotos', n);
          },
        };
      case 'shortVideosCustom':
        return {
          title: tr('Short videos: Custom quantity'),
          items: SHORT_VIDEO_CUSTOM_OPTIONS.map(String),
          selected: String(draft.shortVideosQty),
          allowCustomInput: true,
          numericOnly: true,
          customPlaceholder: tr('Enter exact number of short videos (e.g. 7)...'),
          onSelect: (v) => updateDraft('shortVideosQty', Number(v)),
          onCustomApply: (v) => {
            const n = parseInt(v.replace(/\D/g, ''), 10);
            if (Number.isFinite(n) && n >= 0) updateDraft('shortVideosQty', n);
          },
        };
      case 'shortVideoDurationCustom':
        return {
          title: tr('Short video: Custom duration'),
          items: ['15s', '30s', '45s', '60s', '90s', '2 min'],
          selected: draft.shortVideosDuration,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom duration (e.g. 45s or 90s)...'),
          onSelect: (v) => updateDraft('shortVideosDuration', v),
          onCustomApply: (v) => updateDraft('shortVideosDuration', v),
        };
      case 'longVideosCustom':
        return {
          title: tr('Long videos: Custom quantity'),
          items: LONG_VIDEO_CUSTOM_OPTIONS.map(String),
          selected: String(draft.longVideosQty),
          allowCustomInput: true,
          numericOnly: true,
          customPlaceholder: tr('Enter exact number of long videos (e.g. 4)...'),
          onSelect: (v) => updateDraft('longVideosQty', Number(v)),
          onCustomApply: (v) => {
            const n = parseInt(v.replace(/\D/g, ''), 10);
            if (Number.isFinite(n) && n >= 0) updateDraft('longVideosQty', n);
          },
        };
      case 'longVideoDurationCustom':
        return {
          title: tr('Long video: Custom duration'),
          items: ['5 min', '10 min', '15 min', '30 min', '45 min', '60 min', '90 min'],
          selected: draft.longVideosDuration,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom duration (e.g. 45 min or 2 hours)...'),
          onSelect: (v) => updateDraft('longVideosDuration', v),
          onCustomApply: (v) => updateDraft('longVideosDuration', v),
        };
      case 'photoBooksCustom':
        return {
          title: tr('Photo books: Custom quantity'),
          items: PRINT_QTY_CUSTOM_OPTIONS.map(String),
          selected: String(draft.photoBooksQty),
          allowCustomInput: true,
          numericOnly: true,
          customPlaceholder: tr('Enter exact number of photo books...'),
          onSelect: (v) => updateDraft('photoBooksQty', Number(v)),
          onCustomApply: (v) => {
            const n = parseInt(v.replace(/\D/g, ''), 10);
            if (Number.isFinite(n) && n >= 0) updateDraft('photoBooksQty', n);
          },
        };
      case 'photoBookSize':
        return {
          title: tr('Photo book size'),
          items: [...PHOTO_BOOK_SIZES],
          selected: draft.photoBookSize,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom book size (e.g. 25 × 35 cm)...'),
          onSelect: (v) => updateDraft('photoBookSize', v),
          onCustomApply: (v) => updateDraft('photoBookSize', v),
        };
      case 'photoBookPages':
        return {
          title: tr('Photo book page count'),
          items: [...PHOTO_BOOK_PAGES],
          selected: draft.photoBookPages,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom page count (e.g. 50 pages)...'),
          onSelect: (v) => updateDraft('photoBookPages', v),
          onCustomApply: (v) => {
            const clean = /^\d+$/.test(v.trim()) ? `${v.trim()} pages` : v.trim();
            updateDraft('photoBookPages', clean);
          },
        };
      case 'photoAlbumsCustom':
        return {
          title: tr('Photo albums: Custom quantity'),
          items: PRINT_QTY_CUSTOM_OPTIONS.map(String),
          selected: String(draft.photoAlbumsQty),
          allowCustomInput: true,
          numericOnly: true,
          customPlaceholder: tr('Enter exact number of photo albums...'),
          onSelect: (v) => updateDraft('photoAlbumsQty', Number(v)),
          onCustomApply: (v) => {
            const n = parseInt(v.replace(/\D/g, ''), 10);
            if (Number.isFinite(n) && n >= 0) updateDraft('photoAlbumsQty', n);
          },
        };
      case 'photoAlbumSize':
        return {
          title: tr('Photo album size'),
          items: [...PHOTO_ALBUM_SIZES],
          selected: draft.photoAlbumSize,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom album size (e.g. 35 × 35 cm)...'),
          onSelect: (v) => updateDraft('photoAlbumSize', v),
          onCustomApply: (v) => updateDraft('photoAlbumSize', v),
        };
      case 'photoAlbumPrints':
        return {
          title: tr('Photo album print count'),
          items: [...PHOTO_ALBUM_PRINTS],
          selected: draft.photoAlbumPrints,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom print count (e.g. 120 prints)...'),
          onSelect: (v) => updateDraft('photoAlbumPrints', v),
          onCustomApply: (v) => {
            const clean = /^\d+$/.test(v.trim()) ? `${v.trim()} prints` : v.trim();
            updateDraft('photoAlbumPrints', clean);
          },
        };
      case 'wallPortraitsCustom':
        return {
          title: tr('Wall portraits: Custom quantity'),
          items: PRINT_QTY_CUSTOM_OPTIONS.map(String),
          selected: String(draft.wallPortraitsQty),
          allowCustomInput: true,
          numericOnly: true,
          customPlaceholder: tr('Enter exact number of wall portraits...'),
          onSelect: (v) => updateDraft('wallPortraitsQty', Number(v)),
          onCustomApply: (v) => {
            const n = parseInt(v.replace(/\D/g, ''), 10);
            if (Number.isFinite(n) && n >= 0) updateDraft('wallPortraitsQty', n);
          },
        };
      case 'wallPortraitSize':
        return {
          title: tr('Wall portrait size'),
          items: [...WALL_PORTRAIT_SIZES],
          selected: draft.wallPortraitSize,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom portrait size (e.g. 50 × 70 cm)...'),
          onSelect: (v) => updateDraft('wallPortraitSize', v),
          onCustomApply: (v) => updateDraft('wallPortraitSize', v),
        };
      case 'wallPortraitFrame':
        return {
          title: tr('Wall portrait frame'),
          items: [...WALL_PORTRAIT_FRAMES],
          selected: draft.wallPortraitFrame,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom frame style (e.g. Gold wood frame)...'),
          onSelect: (v) => updateDraft('wallPortraitFrame', v),
          onCustomApply: (v) => updateDraft('wallPortraitFrame', v),
        };
      case 'digitalDeadlineCustom':
        return {
          title: tr('Preferred digital deadline'),
          items: [...DIGITAL_DEADLINE_CUSTOM_OPTIONS],
          selected: draft.digitalDeadline,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom deadline (e.g. 3 days, 5 days, 10 days)...'),
          onSelect: (v) => updateDraft('digitalDeadline', v),
          onCustomApply: (v) => {
            const clean = /^\d+$/.test(v.trim()) ? `${v.trim()} days` : v.trim();
            updateDraft('digitalDeadline', clean);
          },
        };
      case 'printProductionTime':
        return {
          title: tr('Print production time'),
          items: [...PRINT_PRODUCTION_TIMES],
          selected: draft.printProductionTime,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom production timeframe...'),
          onSelect: (v) => updateDraft('printProductionTime', v),
          onCustomApply: (v) => updateDraft('printProductionTime', v),
        };
      case 'printCollectionMethod':
        return {
          title: tr('Collection or shipping'),
          items: [...PRINT_COLLECTION_METHODS],
          selected: draft.printCollectionMethod,
          allowCustomInput: true,
          customPlaceholder: tr('Enter custom handover / shipping method...'),
          onSelect: (v) => updateDraft('printCollectionMethod', v),
          onCustomApply: (v) => updateDraft('printCollectionMethod', v),
        };
      default:
        return null;
    }
  }, [activeSheet, draft, options, slots, tr, updateDraft]);

  const activeStepMeta =
    typeof step === 'number' ? WIZARD_STEPS.find((s) => s.n === step) : undefined;
  const canPublish = !submitting && options?.enabled !== false;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={step === 'done' ? finish : close}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Sheet Handle */}
        <View style={styles.sheetHandleContainer}>
          <View style={styles.sheetHandle} />
        </View>

        {/* Top Header */}
        <View
          style={[
            styles.header,
            { paddingTop: Platform.OS === 'android' ? insets.top + spacing.xs : spacing.xs },
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            {step === 'select' ? (
              <Text style={[styles.eyebrow, { color: accent }]}>BOOKING OPTIONS</Text>
            ) : null}
            <Text style={styles.headerTitle} accessibilityRole="header">
              {step === 'select'
                ? tr('How would you like to book?')
                : step === 'done'
                  ? tr('Your offer is published')
                  : tr('CREATE YOUR EVENT OFFER')}
            </Text>
          </View>
          <Pressable
            onPress={step === 'done' ? finish : close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={18} color={colors.textSoft} />
          </Pressable>
        </View>

        {/* Step Banner + 4-Segment Progress Bar */}
        {typeof step === 'number' && activeStepMeta ? (
          <View style={styles.stepHeaderBand}>
            <View style={styles.stepTitleGroup}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumberText}>{step}</Text>
              </View>
              <Text style={styles.stepBannerTitle}>{tr(activeStepMeta.title)}</Text>
            </View>
            <View style={styles.stepProgressRight}>
              <View style={styles.segmentTrackRow}>
                {WIZARD_STEPS.map((s) => (
                  <Pressable
                    key={s.n}
                    onPress={() => {
                      if (s.n < step) {
                        setStep(s.n);
                        scrollToTop();
                      }
                    }}
                    style={[
                      styles.segmentBar,
                      s.n <= step ? { backgroundColor: colors.primary } : { backgroundColor: colors.borderSoft },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.stepCounterText}>{`${step} of 4`}</Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing['3xl'],
            gap: spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {body}
        </ScrollView>

        {/* Footer Navigation Bar */}
        {step !== 'select' ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {step === 'done' ? (
              <Pressable
                onPress={finish}
                style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.primary }]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>
                  {result?.invited ? tr('Follow the answers') : tr('Done')}
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={back}
                  style={styles.backBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text style={styles.backBtnText}>{tr('Back')}</Text>
                </Pressable>

                {step !== 4 ? (
                  <Pressable
                    onPress={next}
                    disabled={!options}
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryText}>
                      {step === 3 ? tr('Review offer') : tr('Continue')}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={onFill} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={publish}
                    disabled={!canPublish}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canPublish }}
                    style={[
                      styles.primaryBtn,
                      { flex: 1, backgroundColor: canPublish ? colors.primary : colors.surfaceMuted },
                    ]}
                  >
                    {submitting ? (
                      <ActivityIndicator color={onFill} />
                    ) : (
                      <>
                        <Ionicons name="paper-plane-outline" size={16} color={onFill} />
                        <Text style={[styles.primaryText, !canPublish && { color: colors.textMuted }]}>
                          {tr('PUBLISH EVENT OFFER')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : null}

        {Platform.OS !== 'web' ? (
          <>
            <DateTimePickerModal
              isVisible={datePickerOpen}
              mode="date"
              minimumDate={new Date()}
              date={draft.date ? new Date(`${draft.date}T12:00:00`) : new Date()}
              onConfirm={(d) => {
                setDatePickerOpen(false);
                updateDraft('date', isoDate(d));
              }}
              onCancel={() => setDatePickerOpen(false)}
            />
            <DateTimePickerModal
              isVisible={printDatePickerOpen}
              mode="date"
              minimumDate={draft.date ? new Date(`${draft.date}T12:00:00`) : new Date()}
              date={
                draft.printProposedDate
                  ? new Date(`${draft.printProposedDate}T12:00:00`)
                  : draft.date
                    ? new Date(`${draft.date}T12:00:00`)
                    : new Date()
              }
              onConfirm={(d) => {
                setPrintDatePickerOpen(false);
                updateDraft('printProposedDate', isoDate(d));
              }}
              onCancel={() => setPrintDatePickerOpen(false)}
            />
          </>
        ) : null}

        <Modal
          visible={sheetConfig !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveSheet(null)}
        >
          <GlassScrim style={styles.scrim} onPress={() => setActiveSheet(null)}>
            <GlassSheetHost style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
              <SheetCornerClose onPress={() => setActiveSheet(null)} />
              <Text style={[styles.sectionTitle, { marginBottom: spacing.sm }]}>
                {sheetConfig?.title}
              </Text>

              {/* Custom value input row in case desired option is not in the list */}
              {sheetConfig?.allowCustomInput ? (
                <View style={styles.customSheetInputRow}>
                  <TextInput
                    value={customSheetText}
                    onChangeText={(t) =>
                      setCustomSheetText(sheetConfig.numericOnly ? t.replace(/\D/g, '') : t)
                    }
                    keyboardType={sheetConfig.numericOnly ? 'number-pad' : 'default'}
                    placeholder={sheetConfig.customPlaceholder || tr('Type custom value...')}
                    placeholderTextColor={colors.textMuted}
                    style={styles.customSheetInput}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (customSheetText.trim() && sheetConfig.onCustomApply) {
                        sheetConfig.onCustomApply(customSheetText.trim());
                        setActiveSheet(null);
                      }
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      if (customSheetText.trim() && sheetConfig.onCustomApply) {
                        sheetConfig.onCustomApply(customSheetText.trim());
                        setActiveSheet(null);
                      }
                    }}
                    disabled={!customSheetText.trim()}
                    style={[
                      styles.customSheetApplyBtn,
                      !customSheetText.trim() && { opacity: 0.45 },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.customSheetApplyText}>{tr('Apply')}</Text>
                  </Pressable>
                </View>
              ) : null}

              <FlatList
                data={sheetConfig?.items ?? []}
                keyExtractor={(s) => s}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 340 }}
                renderItem={({ item }) => {
                  const on = item === sheetConfig?.selected;
                  const extra =
                    activeSheet === 'end'
                      ? ` · ${durationText(durationBetween(draft.startTime, item))}${
                          item <= draft.startTime ? tr(' (next day)') : ''
                        }`
                      : '';
                  return (
                    <Pressable
                      onPress={() => {
                        sheetConfig?.onSelect(item);
                        setActiveSheet(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.listRow, on && { backgroundColor: colors.tint }]}
                    >
                      <Text
                        style={[
                          styles.listText,
                          on && { color: colors.primary, fontWeight: fontWeight.bold },
                        ]}
                      >
                        {item}
                        {extra}
                      </Text>
                      {on ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                    </Pressable>
                  );
                }}
              />
            </GlassSheetHost>
          </GlassScrim>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  sheetHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: c.borderSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.display,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    ...glassTile(c),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepHeaderBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    gap: spacing.sm,
  },
  stepTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  stepNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: onFill,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
  },
  stepBannerTitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.display,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  stepProgressRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  segmentTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentBar: {
    width: 24,
    height: 6,
    borderRadius: 3,
  },
  stepCounterText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
  },
  pageCard: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.lg,
    backgroundColor: c.card,
    gap: spacing.lg,
    ...e(1),
  },
  pageCardCompact: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.md,
    backgroundColor: c.card,
    gap: spacing.md,
    ...e(1),
  },
  sectionBlock: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  infoIconBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  infoIconBtnActive: {
    backgroundColor: c.tint,
  },
  infoPopoverBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
    marginTop: 2,
  },
  infoPopoverText: {
    flex: 1,
    fontSize: 11.5,
    color: c.text,
    lineHeight: 16,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  segmentCardActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  segmentCardText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  segmentCardTextActive: {
    color: onFill,
  },
  eventTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    minWidth: '30%',
    flexGrow: 1,
  },
  eventTypeCardActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  eventTypeCardText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  eventTypeCardTextActive: {
    color: onFill,
  },
  dateAndTimeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    backgroundColor: c.surface,
  },
  selectBoxText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  venueInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    backgroundColor: c.surface,
  },
  venueInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: c.text,
    paddingVertical: 8,
  },
  homeAddressCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: radii.lg,
    padding: spacing.sm,
    backgroundColor: c.surface,
    gap: spacing.xs,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  durationPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHeaderIconBox: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  cardSubheading: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  deliverableRow: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  deliverableLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliverableTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  deliverableSubtitle: {
    fontWeight: fontWeight.medium,
    color: c.textMuted,
  },
  subDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 4,
  },
  subDurationLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.textMuted,
  },
  qtyPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  qtyPill: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPillCustom: {
    paddingHorizontal: 14,
  },
  qtyPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  qtyPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  qtyPillTextActive: {
    color: onFill,
  },
  printProductCard: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: c.surface,
    gap: spacing.sm,
  },
  printProductTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  printIconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printProductTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: 0.3,
  },
  printProductSub: {
    fontSize: 11,
    color: c.textMuted,
  },
  printDropdownsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dropdownPill: {
    flex: 1,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: c.card,
  },
  dropdownPillText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  moreOptionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: c.surface,
  },
  moreOptionsText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  warningBanner: {
    backgroundColor: c.warningBg,
    borderColor: c.pending,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 15,
  },

  // ───────── Polite Budget Range Input Styles ─────────
  budgetRangeActiveBadge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.link,
  },
  budgetRangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  politeBudgetField: {
    flex: 1,
    gap: 4,
  },
  politeBudgetLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  politeBudgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    minHeight: 42,
    backgroundColor: c.surface,
  },
  currencyBadge: {
    backgroundColor: c.tint,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  currencyTag: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
  },
  budgetInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: c.text,
    fontWeight: fontWeight.bold,
    paddingVertical: 6,
  },
  budgetRangeDashWrap: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetRangeDash: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
  },

  // ───────── Recommended Pricing & Package Comparison (Cool Vertical Display, Tightened Spacing) ─────────
  recPricingContainer: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.md,
    backgroundColor: c.card,
    gap: 8,
    ...e(1),
  },
  recHeaderCenter: {
    alignItems: 'center',
    gap: 1,
  },
  recMainTitle: {
    fontSize: 19,
    fontFamily: fonts.display,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  recSubtitle: {
    fontSize: fontSize.xs,
    color: c.textSoft,
    textAlign: 'center',
  },
  yourOfferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    backgroundColor: c.surface,
  },
  yourOfferIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourOfferTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  yourOfferScopeText: {
    fontSize: 11.5,
    color: c.textSoft,
    lineHeight: 15,
  },
  yourOfferBudgetRow: {
    fontSize: fontSize.xs,
    color: c.textSoft,
    marginTop: 1,
  },
  yourOfferBudgetHighlight: {
    fontWeight: fontWeight.extrabold,
    color: c.link,
  },
  compareSectionTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.display,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  pkgRowCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: c.surface,
  },
  pkgRowCardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  pkgLeftCol: {
    flex: 1.2,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pkgRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pkgRadioOuterActive: {
    borderColor: c.primary,
  },
  pkgRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: c.primary,
  },
  pkgIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pkgBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    borderRadius: radii.full,
  },
  pkgBadgeCyan: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  pkgBadgeCyanText: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: c.link,
  },
  pkgBadgePurple: {
    backgroundColor: c.primary,
  },
  pkgBadgePurpleText: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: onFill,
  },
  pkgTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  pkgScopeDesc: {
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 15,
  },
  pkgRightCol: {
    flex: 1,
    minWidth: 165,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.borderSoft,
    paddingLeft: spacing.sm,
    gap: 3,
  },
  pkgPriceText: {
    fontSize: fontSize.md,
    fontFamily: fonts.display,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  pkgMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pkgMetaText: {
    flex: 1,
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 14,
  },
  pkgDeltaAboveText: {
    flex: 1,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.accent,
  },
  useRecommendedBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  useRecommendedCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: onFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useRecommendedBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: onFill,
  },
  publishAnywayBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.link,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  publishAnywayBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  recFooterBottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  publishAnywayNote: {
    flex: 1,
    fontSize: 11,
    color: c.textSoft,
  },
  viewPoliciesLink: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.primary,
    textDecorationLine: 'underline',
  },
  policiesBox: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: c.surface,
    gap: 3,
  },
  policiesBoxTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  policiesBoxText: {
    fontSize: 11,
    color: c.textSoft,
    lineHeight: 16,
  },

  // ───────── Step 4: Clean Executive Review Styles ─────────
  reviewHeroCard: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.md,
    backgroundColor: c.card,
    gap: spacing.sm,
    ...e(1),
  },
  reviewEventIdentityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  reviewHeroEventTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.display,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  reviewHeroMetaText: {
    fontSize: 11.5,
    color: c.textSoft,
    fontWeight: fontWeight.semibold,
  },
  editChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  editChipText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  editLink: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    textDecorationLine: 'underline',
  },
  receiverModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  receiverModeBannerText: {
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  receiverClientOfferBox: {
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: c.tint,
    gap: 4,
  },
  receiverOfferEyebrow: {
    fontSize: 10.5,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 0.7,
    color: c.textSoft,
  },
  receiverOfferAmount: {
    fontSize: 20,
    fontFamily: fonts.display,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  receiverOfferSub: {
    fontSize: 11.5,
    color: c.textSoft,
  },
  matchPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: c.card,
  },
  matchPreviewBadgeText: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  receiverGrid: {
    gap: spacing.sm,
  },
  receiverDetailBox: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.md,
    backgroundColor: c.card,
    gap: 7,
    ...e(1),
  },
  receiverBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiverBoxTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  receiverItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  receiverItemKey: {
    fontSize: 11.5,
    color: c.textMuted,
    width: 115,
  },
  receiverItemVal: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  timelineCard: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.md,
    backgroundColor: c.card,
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  timelineStep: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  timelineIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineStepTitle: {
    fontSize: 10.5,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    textAlign: 'center',
  },
  timelineStepSub: {
    fontSize: 10,
    color: c.textMuted,
    textAlign: 'center',
  },
  hint: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 17,
  },
  error: {
    color: c.error,
    backgroundColor: c.errorBg,
    padding: spacing.md,
    borderRadius: radii.md,
    fontSize: fontSize.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeCard: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.card,
    ...e(1),
  },
  modeCardFeatured: {
    borderColor: 'rgba(242, 12, 143, 0.28)',
    backgroundColor: c.card,
    ...e(1),
  },
  modeCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modeIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeCardTitle: {
    fontSize: 16.5,
    fontWeight: fontWeight.bold,
    color: c.text,
    letterSpacing: -0.3,
  },
  modeTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  modeTypePillFeatured: {
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    borderColor: 'rgba(242, 12, 143, 0.22)',
  },
  modeTypePillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  modeCardDesc: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18.5,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    ...glassTile(c),
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    ...e(1),
  },
  primaryText: {
    color: c.textOnPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
  },
  backBtn: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...glassTile(c),
  },
  backBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: spacing.lg,
  },
  customSheetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  customSheetInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: c.text,
    backgroundColor: c.surface,
  },
  customSheetApplyBtn: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSheetApplyText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: onFill,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  listText: {
    fontSize: fontSize.md,
    color: c.text,
  },
}));

export { formatAmountWithCommas, parseAmountNumber } from '@/utils/amount';
