import { useState, useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  preventScreenCapture,
  allowScreenCapture,
  enableAppSwitcherProtection,
  disableAppSwitcherProtection,
  addScreenshotListener,
} from '@/utils/screenCapture';
import { ActivityIndicator, Alert, Animated, Easing, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, Modal, PixelRatio } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button } from '@/components/ui/Button';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard, GlassLayer, GlassSurface, glassClear, glassTile } from '@/components/ui/GlassCard';
import { AUTH_BACKDROP } from '@/features/auth/backdrop';
import { EmptyState } from '@/components/ui/EmptyState';
import { ensureFaceConsent } from '@/features/privacy/consent';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import {
  browsePhotosUrl,
} from '@/features/payments/webCheckout';
import { PhotoLanguagePill } from '@/features/auth/AuthGlassLayout';
import { LanguageButton } from '@/components/topbar/LanguageButton';
import { PhotoCheckoutSheet } from './PhotoCheckoutSheet';
import { savePhotoToGallery, saveBatchPhotosToGallery } from '@/utils/gallerySaver';
import {
  faceSearch,
  getViewerId,
  stampPreviewUrl,
  unlockAlbumPhotos,
  getAlbumByCode,
  requestFreeAlbumAccess,
  verifyFreeAlbumAccess,
  getFreeAlbum,
  logFreeAlbumDownload,
  getPhotoDownloadUrl,
  type FoundPhoto,
  type AlbumPhotoItem,
  type FreeAlbumPhoto,
  type MultiAlbumPurchaseItem,
} from '@/features/photos/api';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { pickFromLibrary, takeSelfie, type PickedImage } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme, onFill } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useLanguage } from '@/store/language';
import { tp } from '@/i18n/plural';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

// ─── Constants ──────────────────────────────────────────────────────────────
const WATERMARK_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const WATERMARK_COLS = [0, 1, 2, 3, 4];

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

async function downloadAndShare(url: string, filename: string) {
  await savePhotoToGallery(url, filename, {
    notifyOnSuccess: true,
    customSuccessMessage: useLanguage.getState().t('fmp_hiResSaved'),
  });
}

// ─── Photo cells ─────────────────────────────────────────────────────────────

function PhotoCell({
  uri,
  size,
  locked,
  price,
  currency,
  eventTitle,
  selected,
  owned,
  watermarkText,
  onPress,
  onLongPress,
  onPreview,
  onToggleSelect,
  selectionMode = false,
}: {
  uri?: string;
  size: number;
  locked?: boolean;
  price?: number;
  currency?: string;
  eventTitle?: string;
  selected?: boolean;
  owned?: boolean;
  watermarkText?: string;
  onPress: () => void;
  onLongPress?: () => void;
  onPreview?: () => void;
  onToggleSelect?: () => void;
  selectionMode?: boolean;
}) {
  const styles = useStyles();
  const { t } = useLanguage();
  return (
    <Pressable
      style={[
        styles.cell,
        { width: size, height: size },
        selected && styles.cellSelected,
        owned && styles.cellOwned,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />

      {/* Selected highlight overlay */}
      {selected && (
        <View style={styles.selectedOverlay} pointerEvents="none" />
      )}

      {/* Top-Left: Status / Price badge */}
      {owned && (
        <View style={styles.cellOwnedBadge}>
          <Ionicons name="checkmark-circle" size={12} color={onFill} />
          <Text style={styles.cellOwnedText}>{t('fmp_owned')}</Text>
        </View>
      )}
      {locked && !owned && (
        <View style={styles.cellPriceBadge}>
          <Ionicons name="lock-closed" size={11} color={onFill} />
          {price != null && price > 0 && (
            <Text style={styles.cellPriceText}>{formatPrice(price, currency)}</Text>
          )}
        </View>
      )}
      {!locked && !owned && (price == null || price === 0) && (
        <View style={styles.cellFreeBadge}>
          <Text style={styles.cellFreeText}>{t('fmp_free')}</Text>
        </View>
      )}

      {/* Top-Right: Selection checkbox (easy 1-tap select/deselect) */}
      {(onToggleSelect || selected !== undefined) && (
        <Pressable
          style={[styles.selectCheckbox, selected && styles.selectCheckboxActive]}
          onPress={(e) => {
            e.stopPropagation?.();
            if (onToggleSelect) {
              onToggleSelect();
            } else {
              onPress();
            }
          }}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!selected }}
          accessibilityLabel={selected ? t('fmp_deselectPhoto') : t('fmp_selectPhoto')}
        >
          {selected ? (
            <Ionicons name="checkmark" size={14} color={onFill} />
          ) : null}
        </Pressable>
      )}

      {/* When in selection mode, show preview expand button */}
      {selectionMode && onPreview && (
        <Pressable
          style={styles.expandBadge}
          onPress={(e) => {
            e.stopPropagation?.();
            onPreview();
          }}
          hitSlop={8}
          accessibilityLabel={t('fmp_previewFullScreen')}
        >
          <Ionicons name="expand-outline" size={13} color={onFill} />
        </Pressable>
      )}

      {/* Caption if present */}
      {eventTitle ? (
        <View style={styles.caption} pointerEvents="none">
          <Text style={styles.captionText} numberOfLines={2}>{eventTitle}</Text>
        </View>
      ) : null}

      {/* Watermark overlay */}
      {watermarkText && !owned && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-22deg' }] }}>
            <Text style={styles.watermarkOverlayText}>{watermarkText}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ─── 6-box OTP input ─────────────────────────────────────────────────────────

function OtpInput({ value, onChange, error }: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const styles = useStyles();
  const refs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];
  const digits = value.split('').slice(0, 6);
  while (digits.length < 6) digits.push('');

  const handleChange = (i: number, char: string) => {
    const clean = char.replace(/\D/g, '').slice(-1);
    const arr = [...digits];
    arr[i] = clean;
    onChange(arr.join(''));
    if (clean && i < 5) refs[i + 1].current?.focus();
  };

  const handleKey = (i: number, key: string) => {
    if (key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
  };

  return (
    <View style={styles.otpRow}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={[styles.otpBox, error && styles.otpBoxError]}
          value={d}
          onChangeText={(t) => handleChange(i, t)}
          onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          returnKeyType={i < 5 ? 'next' : 'done'}
          placeholderTextColor="rgba(255,255,255,0.3)"
          placeholder="·"
        />
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FindMyPhotos() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Entry screen: the video the glass cards blur (Android needs the ref).
  const connectBg = useRef<View>(null);
  // Results, album and free pages: the blurred photo their glass blurs.
  const resultsBg = useRef<View>(null);
  const router = useRouter();

  const user = useAuth((s) => s.user);

  // --- Viewer ID (bound to authenticated user for dynamic watermarking) ---
  const [viewerId, setViewerId] = useState('anon');
  useEffect(() => {
    getViewerId(user?.customerId ? String(user.customerId) : undefined).then(setViewerId);
  }, [user?.customerId]);

  // --- Face search ---
  const [selfie, setSelfie] = useState<PickedImage | null>(null);
  const [activeOption, setActiveOption] = useState<'take' | 'upload' | null>(null);
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [faceResults, setFaceResults] = useState<FoundPhoto[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [scanProgress, setScanProgress] = useState(0);
  const [noMatchesOpen, setNoMatchesOpen] = useState(false);
  const [visibleResultsCount, setVisibleResultsCount] = useState(16);
  const [visibleAlbumCount, setVisibleAlbumCount] = useState(24);
  const [visibleFreeCount, setVisibleFreeCount] = useState(24);

  // Scan-line + pulse-ring loop on the face-scanning circle (mirrors web's
  // scanLineMove / scanPulse keyframes).
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!searching) return;
    const lineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    lineLoop.start();
    pulseLoop.start();
    return () => { lineLoop.stop(); pulseLoop.stop(); };
  }, [searching]);

  // Dynamic progress indicators to keep the user informed during facial recognition
  const [scanStep, setScanStep] = useState(0);
  useEffect(() => {
    if (!searching) {
      setScanStep(0);
      return;
    }
    const t1 = setTimeout(() => setScanStep(1), 2500);
    const t2 = setTimeout(() => setScanStep(2), 6500);
    const t3 = setTimeout(() => setScanStep(3), 13000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [searching]);

  // --- Invite code → album ---
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhotoItem[] | null>(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumPhotographerName, setAlbumPhotographerName] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [albumCurrencyId, setAlbumCurrencyId] = useState('');
  const [albumCurrencyAbbr, setAlbumCurrencyAbbr] = useState('');
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());

  // --- Free album flow ---
  const [freeFlow, setFreeFlow] = useState<'idle' | 'email' | 'otp' | 'verified'>('idle');
  const [freeAlbumId, setFreeAlbumId] = useState('');
  const [freeTitle, setFreeTitle] = useState('');
  const [freePhotographer, setFreePhotographer] = useState('');
  const [freeEmail, setFreeEmail] = useState('');
  const [freeOtp, setFreeOtp] = useState('');
  const [freePhotos, setFreePhotos] = useState<FreeAlbumPhoto[]>([]);
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeError, setFreeError] = useState('');
  const [freeExpiresAt, setFreeExpiresAt] = useState('');
  const [selectedFreeIds, setSelectedFreeIds] = useState<Set<string>>(new Set());
  const [freeAcquiredIds, setFreeAcquiredIds] = useState<Set<string>>(new Set());
  const [freeMaxDownloads, setFreeMaxDownloads] = useState<number | null>(null);
  const [freeDownloading, setFreeDownloading] = useState(false);
  const [freeStatusMsg, setFreeStatusMsg] = useState('');
  const [freeAlbumPricePerExtra, setFreeAlbumPricePerExtra] = useState(0);
  const [freeAlbumCurrencyId, setFreeAlbumCurrencyId] = useState('');
  const [freeAlbumCurrencyAbbr, setFreeAlbumCurrencyAbbr] = useState('');

  // --- Report a photo ---
  const [reportPhoto, setReportPhoto] = useState<{ id: string; subject?: string } | null>(null);

  // --- Paid album face filter ---
  const [albumFilteredIds, setAlbumFilteredIds] = useState<Set<string> | null>(null);
  const [albumFaceScanning, setAlbumFaceScanning] = useState(false);

  // --- Purchase state ---
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [purchaseRefid, setPurchaseRefid] = useState<string | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);

  // --- In-App Checkout & Lightbox & Batch Downloader ---
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  // Set while the checkout is paying for a free album's extras, so success ships
  // every selected photo through the free-album download path.
  const extrasInFlight = useRef<{ allSelectedIds: string[] } | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<MultiAlbumPurchaseItem[]>([]);
  const [checkoutPhotoCount, setCheckoutPhotoCount] = useState(0);
  const [checkoutPhotographerCount, setCheckoutPhotographerCount] = useState(0);
  const [checkoutCurrencySym, setCheckoutCurrencySym] = useState('$');
  const [checkoutTotal, setCheckoutTotal] = useState(0);
  const [checkoutPendingPhotoIds, setCheckoutPendingPhotoIds] = useState<string[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<AlbumPhotoItem | FoundPhoto | null>(null);
  const [downloadingBatch, setDownloadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  // --- Unlock ---
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockForAlbumId, setUnlockForAlbumId] = useState<string | null>(null);
  const [unlockIdentifier, setUnlockIdentifier] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // ─── Grid sizing ───────────────────────────────────────────────────────────
  const gap = spacing.md;
  const cell = (width - spacing.xl * 2 - gap) / 2;

  // ─── Notice auto-clear ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!purchaseNotice) return;
    const t = setTimeout(() => setPurchaseNotice(null), 7000);
    return () => clearTimeout(t);
  }, [purchaseNotice]);

  // ─── Screenshot Protection for Copyrighted Photos ──────────────────────────
  // Prevents taking screenshots/recordings once scanned/album photos are displayed.
  useEffect(() => {
    const hasPhotos = Boolean(
      (faceResults && faceResults.length > 0) ||
      (albumPhotos && albumPhotos.length > 0) ||
      (freePhotos && freePhotos.length > 0) ||
      previewPhoto
    );

    if (hasPhotos) {
      preventScreenCapture('find-my-photos');
      if (Platform.OS === 'ios') {
        enableAppSwitcherProtection(0.8);
      }
    } else {
      allowScreenCapture('find-my-photos');
      if (Platform.OS === 'ios') {
        disableAppSwitcherProtection();
      }
    }

    return () => {
      allowScreenCapture('find-my-photos');
      if (Platform.OS === 'ios') {
        disableAppSwitcherProtection();
      }
    };
  }, [faceResults, albumPhotos, freePhotos, previewPhoto]);

  // Listen for screenshot attempts to notify user that preview photos are protected
  useEffect(() => {
    const hasPhotos = Boolean(
      (faceResults && faceResults.length > 0) ||
      (albumPhotos && albumPhotos.length > 0) ||
      (freePhotos && freePhotos.length > 0) ||
      previewPhoto
    );
    if (!hasPhotos) return;

    const sub = addScreenshotListener(() => {
      Alert.alert(
        t('fmp_screenshotTitle'),
        t('fmp_screenshotBody'),
        [{ text: 'OK' }]
      );
    });

    return () => {
      sub.remove();
    };
  }, [faceResults, albumPhotos, freePhotos, previewPhoto]);

  // ─── Face search ──────────────────────────────────────────────────────────

  const onPick = async (fn: () => Promise<PickedImage | null>, type: 'take' | 'upload') => {
    // Sensitive-data gate: get consent before capturing a face for recognition.
    if (!(await ensureFaceConsent())) return;
    const img = await fn();
    if (img) {
      setSelfie(img);
      setActiveOption(type);
      setFaceResults(null);
      setSearchError(null);
    }
  };

  const performSearch = async (img: PickedImage, inviteCode: string) => {
    setSearching(true);
    setSearchError(null);
    setScanProgress(0);

    // Smooth progress counter counting towards 100%
    const progressTimer = setInterval(() => {
      setScanProgress((prev) => {
        let step = 1.0;
        if (prev < 25) step = 1.2;
        else if (prev < 65) step = 0.65;
        else if (prev < 88) step = 0.35;
        else if (prev < 94) step = 0.08;
        else step = 0;

        return Math.min(94, prev + step);
      });
    }, 50);

    try {
      const res = await faceSearch(img, inviteCode);
      clearInterval(progressTimer);

      // Finish counting to 100%
      setScanProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (res && res.length > 0) {
        setFaceResults(res);
        setVisibleResultsCount(16);
        setSelectedResultIds(new Set());
      } else {
        // No matches found: stay on current page and display centered modal
        setNoMatchesOpen(true);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      console.warn('[performSearch] Face search error:', err);
      let msg = isApiError(err)
        ? err.message
        : err?.message || (typeof err === 'string' ? err : t('fmp_errSearch'));
      if (msg.toLowerCase().includes('network connection was lost') || msg.toLowerCase().includes('-1005')) {
        msg = t('fmp_errNetwork');
      } else {
        msg = msg
          .replace(/\s*\(at [^)]+\)/g, '')
          .replace(/^fetch failed:\s*/i, '')
          .replace(/^UnexpectedException:\s*/i, '')
          .trim() || t('fmp_errSearch');
      }
      setSearchError(msg);
    } finally {
      clearInterval(progressTimer);
      setSearching(false);
    }
  };

  const handleFindMyPhotos = () => {
    if (!selfie) {
      setSearchError(t('fmp_errNeedPhoto'));
      return;
    }
    performSearch(selfie, code);
  };

  // ─── Invite code → album ──────────────────────────────────────────────────

  const handleAccessGallery = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setAlbumError(t('fmp_errNeedCode'));
      return;
    }
    Keyboard.dismiss();
    setAlbumLoading(true);
    setAlbumError(null);
    try {
      const data = await getAlbumByCode(trimmed);
      if (data.albumType === 'free') {
        setFreeAlbumId(data.albumId);
        setFreeTitle(data.title ?? '');
        setFreePhotographer(data.photographerName ?? '');
        setFreeFlow('email');
      } else {
        setAlbumPhotos(data.photos);
        setAlbumId(data.albumId);
        setAlbumTitle(data.title ?? '');
        setAlbumPhotographerName(data.photographerName ?? '');
        setAlbumCurrencyId(data.pricing?.currencyId ?? '');
        setAlbumCurrencyAbbr(data.pricing?.currencyAbbreviation ?? '');
        setSelectedAlbumIds(new Set());
        setAlbumFilteredIds(null);
      }
    } catch {
      setAlbumError(t('fmp_errBadCode'));
    } finally {
      setAlbumLoading(false);
    }
  };

  // ─── Free album flow ──────────────────────────────────────────────────────

  const handleFreeRequestAccess = async () => {
    if (!freeEmail.trim()) {
      setFreeError(t('fmp_errNeedEmail'));
      return;
    }
    Keyboard.dismiss();
    setFreeLoading(true);
    setFreeError('');
    try {
      await requestFreeAlbumAccess(code.trim(), freeEmail.trim());
      setFreeFlow('otp');
    } catch (err) {
      const msg = isApiError(err) ? err.message : String(err);
      if (msg.toLowerCase().includes('not authorized') || (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('match'))) {
        setFreeError(t('fmp_errNotInvited'));
      } else {
        setFreeError(msg || t('fmp_errSendCode'));
      }
    } finally {
      setFreeLoading(false);
    }
  };

  const handleFreeVerify = async () => {
    if (freeOtp.length < 6) {
      setFreeError(t('fmp_errNeedOtp'));
      return;
    }
    Keyboard.dismiss();
    setFreeLoading(true);
    setFreeError('');
    try {
      const data = await verifyFreeAlbumAccess(code.trim(), freeEmail.trim(), freeOtp);
      if (data.expiresAt) setFreeExpiresAt(data.expiresAt);
      if (data.maxFreeDownloads != null) setFreeMaxDownloads(data.maxFreeDownloads);
      if (data.title) setFreeTitle(data.title);
      if (data.photographerName) setFreePhotographer(data.photographerName);
      setFreePhotos(data.photos);
      setFreeAcquiredIds(new Set(data.alreadyAcquiredPhotoIds ?? []));
      setFreeAlbumId(data.albumId || freeAlbumId);
      if (data.pricePerExtraImage != null) setFreeAlbumPricePerExtra(data.pricePerExtraImage ?? 0);
      if (data.currencyId) setFreeAlbumCurrencyId(data.currencyId);
      if (data.currencyAbbreviation) setFreeAlbumCurrencyAbbr(data.currencyAbbreviation);
      setFreeFlow('verified');
    } catch (err) {
      const msg = isApiError(err) ? err.message : String(err);
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('otp')) {
        setFreeError(t('fmp_errBadOtp'));
      } else if (msg.toLowerCase().includes('expired')) {
        setFreeError(t('fmp_errOtpExpired'));
      } else {
        setFreeError(msg || t('fmp_errVerify'));
      }
    } finally {
      setFreeLoading(false);
    }
  };

  const handleFreeResend = async () => {
    setFreeOtp('');
    setFreeError('');
    await handleFreeRequestAccess();
  };

  const toggleFreePhoto = (id: string) => {
    setSelectedFreeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getCappedSelectionInfo = () => {
    const owned: string[] = [];
    const newPicks: string[] = [];
    for (const id of selectedFreeIds) {
      freeAcquiredIds.has(id) ? owned.push(id) : newPicks.push(id);
    }
    const cap = freeMaxDownloads ?? Infinity;
    const overflow = Number.isFinite(cap) ? Math.max(0, newPicks.length - (cap as number)) : 0;
    return { owned, newPicks, cap, overflow, total: owned.length + newPicks.length };
  };

  const downloadFreeSelected = async (photoIds?: string[]) => {
    const toDownload = photoIds
      ? freePhotos.filter((p) => photoIds.includes(p.id))
      : freePhotos.filter((p) => selectedFreeIds.has(p.id));
    if (!toDownload.length) return;
    setDownloadingBatch(true);
    setBatchProgress(t('fmp_savingProgress', { current: 1, total: toDownload.length }));
    try {
      const items = toDownload.map((photo) => ({ url: photo.url, filename: `photo-${photo.id}.jpg` }));
      const res = await saveBatchPhotosToGallery(items, (curr, total) => {
        setBatchProgress(t('fmp_savingProgress', { current: curr, total }));
      });
      if (res.saved > 0) {
        Alert.alert(
          t('fmp_savedToPhotos'),
          tp(t, 'fmp_savedBody', res.saved),
          [{ text: 'OK' }]
        );
      }
      try { await logFreeAlbumDownload(freeAlbumId, toDownload.map((p) => p.id)); } catch { /* best-effort */ }
      setFreeAcquiredIds((prev) => {
        const next = new Set(prev);
        toDownload.forEach((p) => next.add(p.id));
        return next;
      });
    } catch {
      Alert.alert(t('fmp_errDownloadTitle'), t('fmp_errDownloadPerm'));
    } finally {
      setDownloadingBatch(false);
      setBatchProgress(null);
    }
  };

  const handleFreeDownload = async () => {
    const info = getCappedSelectionInfo();
    if (info.total === 0) {
      setFreeStatusMsg(t('fmp_errSelectOne'));
      return;
    }
    const price = freeAlbumPricePerExtra || 0;

    // No overflow — pure free download
    if (info.overflow === 0) {
      setFreeDownloading(true);
      setFreeStatusMsg(tp(t, 'fmp_downloadingN', info.total));
      try {
        await downloadFreeSelected();
        setFreeStatusMsg(t('fmp_doneReady'));
      } catch {
        setFreeStatusMsg(t('fmp_errSomeFailed'));
      } finally {
        setFreeDownloading(false);
      }
      return;
    }

    // The extras aren't for sale on Android, so take everything inside the free
    // quota and say what was left out. Refusing the whole selection would strip
    // the user of photos they're entitled to.
    if (!digitalPurchasesEnabled) {
      const cap = info.cap as number;
      const allowed = [...info.owned, ...info.newPicks.slice(0, cap)];
      if (!allowed.length) {
        setFreeStatusMsg(t('fmp_freeUsed', { cap }));
        return;
      }
      setFreeDownloading(true);
      setFreeStatusMsg(tp(t, 'fmp_downloadingN', allowed.length));
      try {
        await downloadFreeSelected(allowed);
        setFreeStatusMsg(
          `${tp(t, 'fmp_doneN', allowed.length)} ` +
            tp(t, 'fmp_overQuota', info.overflow, { cap }),
        );
      } catch {
        setFreeStatusMsg(t('fmp_errSomeFailed'));
      } finally {
        setFreeDownloading(false);
      }
      return;
    }

    // Overflow but no price — polite block
    if (!(price > 0)) {
      setFreeStatusMsg(t('fmp_freeAtMost', { cap: info.cap }));
      return;
    }

    // Extras are paid in the app through the same checkout as paid albums, for
    // the OVERFLOW photos only (owned photos and the free quota are never
    // charged). Offer to download the free allowance now or pay for the rest
    // (this branch is only reachable when digitalPurchasesEnabled — the Android
    // path returned above).
    const capNum = Number.isFinite(info.cap) ? (info.cap as number) : info.newPicks.length;
    const allowed = [...info.owned, ...info.newPicks.slice(0, capNum)];
    const extrasTotal = Math.round(price * info.overflow);
    const buyExtras = () => {
      const overflowIds = info.newPicks.slice(capNum);
      if (!overflowIds.length || !freeAlbumId || !freeAlbumCurrencyId) {
        setFreeStatusMsg(t('fmp_errExtrasUnavailable'));
        return;
      }
      extrasInFlight.current = { allSelectedIds: Array.from(selectedFreeIds) };
      setCheckoutItems([
        {
          albumId: freeAlbumId,
          photoIds: overflowIds,
          amount: Math.round(price * overflowIds.length * 100) / 100,
          currencyId: freeAlbumCurrencyId,
        },
      ]);
      setCheckoutPhotoCount(overflowIds.length);
      setCheckoutPhotographerCount(1);
      setCheckoutCurrencySym(freeAlbumCurrencyAbbr ? `${freeAlbumCurrencyAbbr} ` : '$');
      setCheckoutTotal(Math.round(price * overflowIds.length * 100) / 100);
      setCheckoutPendingPhotoIds(overflowIds);
      setCheckoutVisible(true);
    };
    Alert.alert(
      t('fmp_extrasTitle'),
      tp(t, 'fmp_extrasBody', info.overflow, { price: formatPrice(extrasTotal, freeAlbumCurrencyAbbr || undefined) }),
      [
        { text: t('fmp_cancel'), style: 'cancel' },
        ...(allowed.length
          ? [
              {
                text: t('fmp_downloadNFree', { count: allowed.length }),
                onPress: () => {
                  void (async () => {
                    setFreeDownloading(true);
                    setFreeStatusMsg(tp(t, 'fmp_downloadingN', allowed.length));
                    try {
                      await downloadFreeSelected(allowed);
                      setFreeStatusMsg(
                        tp(t, 'fmp_payLater', info.overflow),
                      );
                    } catch {
                      setFreeStatusMsg(t('fmp_errSomeFailed'));
                    } finally {
                      setFreeDownloading(false);
                    }
                  })();
                },
              },
            ]
          : []),
        { text: t('fmp_payForExtras'), onPress: buyExtras },
      ],
    );
  };

  // ─── In-App Purchase Flow (paid albums + face-results) ───────────────────
  const openPurchaseFor = (photos: (AlbumPhotoItem | FoundPhoto)[], defaultAlbumId?: string) => {
    const payable = photos.filter((p) => !p.isPurchased && (p.price ?? 0) > 0);
    if (!payable.length) {
      setPurchaseNotice(t('fmp_alreadyOwnAll'));
      return;
    }

    const groups = new Map<string, { ids: string[]; total: number; currency: string }>();
    for (const p of payable) {
      const aId =
        (p as AlbumPhotoItem).albumId ??
        (p as FoundPhoto).albumId ??
        defaultAlbumId ??
        albumId ??
        'album';
      const cur =
        (p as AlbumPhotoItem).currencyAbbreviation ??
        (p as FoundPhoto).currency ??
        albumCurrencyAbbr ??
        'RWF';
      const g = groups.get(aId) || { ids: [], total: 0, currency: cur };
      g.ids.push(p.id as string);
      g.total += Number(p.price || 0);
      groups.set(aId, g);
    }

    const items: MultiAlbumPurchaseItem[] = Array.from(groups.entries()).map(([aId, g]) => ({
      albumId: aId,
      photoIds: g.ids,
      amount: g.total,
      currencyId: g.currency,
    }));

    const totalAmount = payable.reduce((s, p) => s + (p.price ?? 0), 0);
    const sym =
      (payable[0] as AlbumPhotoItem).currencyAbbreviation ??
      (payable[0] as FoundPhoto).currency ??
      albumCurrencyAbbr ??
      '';

    setCheckoutItems(items);
    setCheckoutPhotoCount(payable.length);
    setCheckoutPhotographerCount(items.length);
    setCheckoutCurrencySym(sym ? `${sym} ` : '$');
    setCheckoutTotal(totalAmount);
    setCheckoutPendingPhotoIds(payable.map((p) => p.id as string));
    setCheckoutVisible(true);
  };

  const handleInAppPurchaseSuccess = (
    refid: string,
    unlockCodeResult: string | null,
    purchasedPhotoIds: string[],
  ) => {
    if (extrasInFlight.current) {
      const { allSelectedIds } = extrasInFlight.current;
      extrasInFlight.current = null;
      setCheckoutVisible(false);
      // Mark everything just paid for as owned so a refresh never re-charges,
      // then ship the whole selection (free quota + extras).
      setFreeAcquiredIds((prev) => {
        const next = new Set(prev);
        allSelectedIds.forEach((id) => next.add(id));
        return next;
      });
      setPurchaseNotice(t('fmp_extrasPaid'));
      void downloadFreeSelected();
      return;
    }

    const ids = purchasedPhotoIds.length ? purchasedPhotoIds : checkoutPendingPhotoIds;
    const owned = new Set(ids);

    setAlbumPhotos((prev) =>
      prev?.map((p) => (owned.has(p.id) ? { ...p, isPurchased: true } : p)) ?? prev,
    );
    setFaceResults((prev) =>
      prev?.map((p) => (owned.has(p.id as string) ? { ...p, isPurchased: true } : p)) ?? prev,
    );

    setPurchaseRefid(refid);
    if (unlockCodeResult) {
      setUnlockIdentifier(unlockCodeResult);
    }

    setPurchaseNotice(
      tp(t, 'fmp_purchaseOk', ids.length),
    );

    setSelectedAlbumIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    setCheckoutVisible(false);
  };

  const handleDownloadPurchased = async (photo: AlbumPhotoItem | FoundPhoto) => {
    const aId = (photo as AlbumPhotoItem).albumId ?? (photo as FoundPhoto).albumId ?? albumId;
    if (!aId) return;
    const url = getPhotoDownloadUrl(aId, photo.id as string, {
      refid: purchaseRefid ?? undefined,
      buyerId: buyerId ?? undefined,
    });
    await downloadAndShare(url, `photo-${photo.id}.jpg`);
  };

  const handleBatchDownload = async (photos: (AlbumPhotoItem | FoundPhoto)[]) => {
    const toDownload = photos.filter((p) => p.isPurchased);
    if (!toDownload.length) return;

    setDownloadingBatch(true);
    try {
      const items = toDownload
        .map((photo) => {
          const aId =
            (photo as AlbumPhotoItem).albumId ??
            (photo as FoundPhoto).albumId ??
            albumId;
          if (!aId) return null;
          const url = getPhotoDownloadUrl(aId, photo.id as string, {
            refid: purchaseRefid ?? undefined,
            buyerId: buyerId ?? undefined,
          });
          return { url, filename: `photo-${photo.id}.jpg` };
        })
        .filter((i): i is { url: string; filename: string } => i !== null);

      const res = await saveBatchPhotosToGallery(items, (curr, total) => {
        setBatchProgress(t('fmp_savingProgress', { current: curr, total }));
      });

      if (res.saved > 0) {
        Alert.alert(
          t('fmp_savedToPhotos'),
          tp(t, 'fmp_savedHiRes', res.saved),
          [{ text: 'OK' }]
        );
        setPurchaseNotice(tp(t, 'fmp_savedShort', res.saved));
      } else {
        setPurchaseNotice(t('fmp_errSaveFailed'));
      }
    } catch {
      setPurchaseNotice(t('fmp_errSomeNotSaved'));
    } finally {
      setDownloadingBatch(false);
      setBatchProgress(null);
    }
  };

  // ─── Unlock ───────────────────────────────────────────────────────────────

  const openUnlock = (aId?: string | null) => {
    setUnlockForAlbumId(aId ?? null);
    setUnlockIdentifier('');
    setUnlockError(null);
    setUnlockOpen(true);
  };

  const handleUnlock = async () => {
    const id = unlockIdentifier.trim();
    if (!id) { setUnlockError(t('fmp_errUnlockNeedId')); return; }
    const aId = unlockForAlbumId ?? albumId ?? faceResults?.[0]?.albumId ?? null;
    if (!aId) { setUnlockError(t('fmp_errUnlockNoAlbum')); return; }

    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await unlockAlbumPhotos(aId, id);
      if (res.buyerId) {
        setBuyerId(res.buyerId);
        if (res.refid) setPurchaseRefid(res.refid);
      }
      if (res.purchasedPhotoIds?.length) {
        const owned = new Set(res.purchasedPhotoIds);
        setAlbumPhotos((prev) => prev?.map((p) => owned.has(p.id) ? { ...p, isPurchased: true } : p) ?? prev);
        setFaceResults((prev) => prev?.map((p) => owned.has(p.id) ? { ...p, isPurchased: true } : p) ?? prev);
        setPurchaseNotice(t('fmp_unlockedN', { count: res.purchasedPhotoIds.length }));
      }
      setUnlockOpen(false);
    } catch (err) {
      setUnlockError(isApiError(err) ? err.message : t('fmp_errUnlock'));
    } finally {
      setUnlocking(false);
    }
  };

  // ─── Album face scan (filter grid to matched photos) ─────────────────────

  const doAlbumScan = async (fn: () => Promise<PickedImage | null>) => {
    if (!(await ensureFaceConsent())) return;
    const img = await fn();
    if (!img) return;
    setAlbumFaceScanning(true);
    try {
      const results = await faceSearch(img, code.trim());
      if (!results.length) {
        Alert.alert(t('fmp_noMatchesTitle'), t('fmp_noMatchesAlbum'));
        return;
      }
      setAlbumFilteredIds(new Set(results.map((p) => p.id as string)));
    } catch {
      Alert.alert(t('fmp_scanFailedTitle'), t('fmp_scanFailedBody'));
    } finally {
      setAlbumFaceScanning(false);
    }
  };

  const handleAlbumFaceScan = () => {
    Alert.alert(
      t('fmp_title'),
      t('fmp_albumScanBody'),
      [
        { text: t('fmp_takeSelfie'), onPress: () => void doAlbumScan(takeSelfie) },
        { text: t('fmp_uploadFromLibrary'), onPress: () => void doAlbumScan(pickFromLibrary) },
        { text: t('fmp_cancel'), style: 'cancel' },
      ]
    );
  };

  // ─── Report a photo ───────────────────────────────────────────────────────

  const onLongPressPhoto = (photoId: string, subject?: string) => {
    Alert.alert(t('fmp_photoActions'), undefined, [
      {
        text: t('fmp_reportPhoto'),
        style: 'destructive',
        onPress: () => setReportPhoto({ id: photoId, subject }),
      },
      { text: t('fmp_cancel'), style: 'cancel' },
    ]);
  };

  const submitPhotoReport = async (reason: string, description: string) => {
    if (!reportPhoto) throw { status: 400, message: t('fmp_nothingToReport') };
    return reportContent('PHOTO', reportPhoto.id, reason, description);
  };

  // ─── Album photo press & selection ────────────────────────────────────────

  const toggleAlbumSelect = (id: string) => {
    setSelectedAlbumIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAlbumPhotoPress = (photo: AlbumPhotoItem) => {
    if (selectedAlbumIds.size > 0) {
      toggleAlbumSelect(photo.id);
    } else {
      setPreviewPhoto(photo);
    }
  };

  const handleAlbumBulkBuy = () => {
    const chosen = (albumPhotos ?? []).filter((p) => selectedAlbumIds.has(p.id) && !p.isPurchased && (p.price ?? 0) > 0);
    if (!chosen.length) return;
    openPurchaseFor(chosen, albumId);
  };

  // ─── Face result press & selection ────────────────────────────────────────

  const toggleResultSelect = (id: string) => {
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleResultPhotoPress = (photo: FoundPhoto) => {
    if (selectedResultIds.size > 0) {
      toggleResultSelect(photo.id as string);
    } else {
      setPreviewPhoto(photo);
    }
  };

  const handleResultBulkBuy = () => {
    const chosen = (faceResults ?? []).filter(
      (p) => selectedResultIds.has(p.id as string) && !p.isPurchased && (p.price ?? 0) > 0
    );
    if (!chosen.length) return;
    const aId = chosen[0].albumId ?? '';
    openPurchaseFor(chosen, aId);
  };

  // ─── Render: Connect screen ───────────────────────────────────────────────

  const renderConnect = () => (
    <View style={styles.flatContainer}>
      {/* Heading, straight on the video */}
      <View style={styles.connectHeading}>
        <Text style={styles.badgeText}>{t('fmp_eyebrow')}</Text>
        <Text style={styles.heroTitle} accessibilityRole="header">{t('fmp_heading')}</Text>
        <Text style={styles.lead}>{t('fmp_lead')}</Text>
      </View>

      {/* Card 1: scan your face */}
      <GlassCard strength="regular" blurTarget={connectBg} elevated style={styles.connectCard}>
      {/* Scanning animation - clean solid bar, NO gradients */}
      {searching && selfie ? (
        <View style={styles.scanningWrap}>
          <View style={styles.scanningCircleWrap}>
            <View style={styles.scanningCircle}>
              <Image source={{ uri: selfie.uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={4} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scanLineWrap,
                  // 137 = scanningCircle height (140) − scanLineWrap height (3)
                  { transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 137] }) }] },
                ]}
              >
                <View style={[styles.scanLineBar, { backgroundColor: colors.accent }]} />
              </Animated.View>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanPulseRing,
                {
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] }),
                  transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
                },
              ]}
            />
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, scanProgress))}%` }]} />
          </View>

          <Text style={styles.scanningTitle}>
            {scanProgress < 25
              ? t('fmp_scanUploading')
              : scanProgress < 65
                ? t('fmp_scanAnalyzing')
                : scanProgress < 95
                  ? (code.trim() ? t('fmp_scanAlbum', { code: code.trim() }) : t('fmp_scanGalleries'))
                  : t('fmp_scanMatching')}
          </Text>
          <Text style={styles.scanningSubText}>
            {scanProgress < 25
              ? t('fmp_scanSubUploading')
              : scanProgress < 65
                ? t('fmp_scanSubAnalyzing')
                : scanProgress < 95
                  ? (code.trim() ? t('fmp_scanSubEvent') : t('fmp_scanSubGalleries'))
                  : t('fmp_scanSubMatching')}
          </Text>
        </View>

      /* Selfie ready state */
      ) : selfie && !searching ? (
        <View style={styles.selfieReadyWrap}>
          <View style={styles.selfiePreviewCircle}>
            <Image source={{ uri: selfie.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
          <View style={styles.selfieReadyPill}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.selfieReadyText}>{t('fmp_photoReady')}</Text>
          </View>
          <Pressable
            onPress={() => { setSelfie(null); setActiveOption(null); setFaceResults(null); setSearchError(null); }}
            style={styles.changeSelfieBtn}
          >
            <Text style={styles.changeSelfieBtnText}>{t('fmp_changePhoto')}</Text>
          </Pressable>
        </View>

      /* Pick options */
      ) : (
        // Three tiles side by side are about 90dp wide each; at large text their words break mid-word, so they stack.
        <View style={[styles.webPickOptions, PixelRatio.getFontScale() > 1.3 && styles.webPickOptionsStacked]}>
          <Pressable
            style={({ pressed }) => [
              styles.webPickCard,
              activeOption === 'take' && styles.webPickCardActive,
              pressed && styles.webPickCardPressed,
            ]}
            onPress={() => onPick(takeSelfie, 'take')}
          >
            <View style={[styles.webIconWrap, { backgroundColor: colors.tint }]}>
              <Ionicons name="camera-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.webPickTitle}>{t('fmp_takeSelfie')}</Text>
            <Text style={styles.webPickSub}>{t('fmp_useCamera')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.webPickCard,
              activeOption === 'upload' && styles.webPickCardActive,
              pressed && styles.webPickCardPressed,
            ]}
            onPress={() => onPick(pickFromLibrary, 'upload')}
          >
            <View style={[styles.webIconWrap, { backgroundColor: colors.tintAccent }]}>
              <Ionicons name="arrow-up-outline" size={26} color={colors.accent} />
            </View>
            <Text style={styles.webPickTitle}>{t('fmp_uploadPhoto')}</Text>
            <Text style={styles.webPickSub}>{t('fmp_fromGallery')}</Text>
          </Pressable>

          {Boolean(user) && (
            <Pressable
              style={({ pressed }) => [
                styles.webPickCard,
                pressed && styles.webPickCardPressed,
              ]}
              onPress={() => router.push('/browse-photos')}
            >
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeText}>i</Text>
              </View>
              <View style={[styles.webIconWrap, { backgroundColor: colors.tint }]}>
                <Ionicons name="grid-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.webPickTitle}>{t('fmp_browsePhotos')}</Text>
              <Text style={styles.webPickSub}>{t('fmp_stockLibrary')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {!searching && (
        <Pressable
          style={({ pressed }) => [
            styles.webFindBtn,
            !selfie && styles.webFindBtnDisabled,
            pressed && Boolean(selfie) && styles.webFindBtnPressed,
          ]}
          onPress={handleFindMyPhotos}
          accessibilityRole="button"
          accessibilityLabel={t('fmp_title')}
        >
          <Ionicons
            name="search"
            size={18}
            color={!selfie ? colors.textMuted : colors.textOnPrimary}
          />
          <Text style={[styles.webFindBtnText, !selfie && styles.webFindBtnTextDisabled]}>
            {t('fmp_title')}
          </Text>
        </Pressable>
      )}

      {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
      </GlassCard>

      {/* "or", between the two cards */}
      {!searching && <Text style={styles.connectOr}>{t('fmp_or')}</Text>}

      {/* Card 2: invite code */}
      {!searching && (
        <GlassCard strength="regular" blurTarget={connectBg} elevated style={styles.connectCard}>
          <Text style={styles.inviteHeading}>{t('fmp_inviteHeading')}</Text>
          <Text style={styles.inviteSubText}>{t('fmp_inviteSub')}</Text>

          <TextInput
            placeholder={t('fmp_invitePlaceholder')}
            value={code}
            onChangeText={(t) => { setCode(t); setAlbumError(null); }}
            autoCapitalize="characters"
            style={styles.inviteInput}
            placeholderTextColor={colors.textMuted}
            returnKeyType="go"
            onSubmitEditing={handleAccessGallery}
          />

          {albumError ? <Text style={styles.error}>{albumError}</Text> : null}

          {/* Secondary to "Find My Photos": one filled button per screen. */}
          <Pressable
            style={({ pressed }) => [styles.accessBtnOutline, (albumLoading || pressed) && { opacity: 0.6 }]}
            onPress={handleAccessGallery}
            disabled={albumLoading}
            accessibilityRole="button"
          >
            {albumLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.accessBtnOutlineText}>{t('fmp_accessGallery')}</Text>}
          </Pressable>
        </GlassCard>
      )}
    </View>
  );

  // ─── Render: Paid album grid ──────────────────────────────────────────────

  const renderAlbumGrid = () => {
    const photos = albumPhotos ?? [];
    const allFiltered = albumFilteredIds !== null
      ? photos.filter((p) => albumFilteredIds!.has(p.id))
      : photos;
    const displayedPhotos = allFiltered.slice(0, visibleAlbumCount);
    const hasMoreAlbumPhotos = allFiltered.length > visibleAlbumCount;
    const selectedUnpurchased = photos.filter(
      (p) => selectedAlbumIds.has(p.id) && !p.isPurchased && (p.price ?? 0) > 0
    );
    const selectedPurchased = photos.filter(
      (p) => selectedAlbumIds.has(p.id) && p.isPurchased
    );
    const allPurchased = photos.filter((p) => p.isPurchased);
    const unpurchasedInAlbum = photos.filter((p) => !p.isPurchased && (p.price ?? 0) > 0);

    return (
      <View style={{ flex: 1 }}>
        {/* Album header */}
        <View style={styles.albumHeader}>
          <View style={styles.albumBadge}>
            <Ionicons name="camera" size={11} color={colors.primary} />
            <Text style={styles.albumBadgeText}>{t('fmp_photoAlbum')}</Text>
          </View>
          <Text style={styles.albumTitle}>{albumTitle || t('fmp_eventAlbum')}</Text>
          {albumPhotographerName ? (
            <Text style={styles.albumSub}>
              {t('fmp_by')} <Text style={{ color: colors.text, fontWeight: '700' }}>{albumPhotographerName}</Text>
            </Text>
          ) : null}
          <Text style={styles.albumCount}>
            {albumFilteredIds !== null
              ? tp(t, 'fmp_matchedOf', photos.length, { shown: displayedPhotos.length })
              : tp(t, 'fmp_photosN', photos.length)}
          </Text>
          <Text style={styles.albumHint}>
            Tap photos to select · Tap ⤢ to preview full-screen · Long-press to report
          </Text>

          <View style={styles.albumActionRow}>
            <Pressable
              style={styles.scanInAlbumBtn}
              onPress={handleAlbumFaceScan}
              disabled={albumFaceScanning}
            >
              {albumFaceScanning
                ? <ActivityIndicator size="small" color={onFill} />
                : <Ionicons name="person-circle-outline" size={15} color={onFill} />}
              <Text style={styles.scanInAlbumBtnText}>{t('fmp_albumFaceScan')}</Text>
            </Pressable>
            {albumFilteredIds !== null && (
              <Pressable
                style={styles.showAllBtn}
                onPress={() => setAlbumFilteredIds(null)}
              >
                <Ionicons name="grid-outline" size={15} color="rgba(255,255,255,0.8)" />
                <Text style={styles.showAllBtnText}>{t('fmp_showAllN', { count: photos.length })}</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.unlockPillBtn}
              onPress={() => openUnlock(albumId)}
            >
              <Ionicons name="lock-open-outline" size={15} color="#7be0e5" />
              <Text style={styles.unlockPillBtnText}>{t('fmp_alreadyPaidUnlock')}</Text>
            </Pressable>
          </View>

          {/* Quick Shortcuts: Download All Owned / Select All Unpurchased */}
          <View style={styles.quickShortcutsRow}>
            {allPurchased.length > 0 && (
              <Pressable
                style={styles.batchDownloadBtn}
                onPress={() => handleBatchDownload(allPurchased)}
                disabled={downloadingBatch}
              >
                {downloadingBatch ? (
                  <ActivityIndicator size="small" color={onFill} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={14} color={onFill} />
                )}
                <Text style={styles.batchDownloadBtnText}>
                  {downloadingBatch
                    ? (batchProgress || t('fmp_downloading'))
                    : t('fmp_downloadAllOwned', { count: allPurchased.length })}
                </Text>
              </Pressable>
            )}

            {unpurchasedInAlbum.length > 0 && (
              <Pressable
                style={styles.shortcutBtn}
                onPress={() => {
                  if (selectedAlbumIds.size === unpurchasedInAlbum.length) {
                    setSelectedAlbumIds(new Set());
                  } else {
                    setSelectedAlbumIds(new Set(unpurchasedInAlbum.map((p) => p.id)));
                  }
                }}
              >
                <Ionicons
                  name={
                    selectedAlbumIds.size === unpurchasedInAlbum.length
                      ? 'close-circle-outline'
                      : 'checkbox-outline'
                  }
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.shortcutBtnText}>
                  {selectedAlbumIds.size === unpurchasedInAlbum.length
                    ? t('fmp_deselectAll')
                    : t('fmp_selectAllN', { count: unpurchasedInAlbum.length })}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {purchaseNotice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>{purchaseNotice}</Text>
          </View>
        ) : null}

        {/* Grid */}
        <FlatList
          data={displayedPhotos}
          keyExtractor={(p) => p.id}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ gap, paddingBottom: selectedAlbumIds.size > 0 ? 140 : 32 }}
          renderItem={({ item }) => (
            <PhotoCell
              uri={item.isPurchased
                ? (item.thumbnailUrl ?? item.url)
                : stampPreviewUrl(item.thumbnailUrl ?? item.url, viewerId)}
              size={cell}
              locked={!item.isPurchased && (item.price ?? 0) > 0}
              price={item.price}
              currency={item.currencyAbbreviation}
              selected={selectedAlbumIds.has(item.id)}
              owned={item.isPurchased}
              selectionMode={selectedAlbumIds.size > 0}
              onPress={() => handleAlbumPhotoPress(item)}
              onToggleSelect={() => toggleAlbumSelect(item.id)}
              onPreview={() => setPreviewPhoto(item)}
              onLongPress={() => onLongPressPhoto(item.id, albumPhotographerName || albumTitle)}
            />
          )}
        />

        {hasMoreAlbumPhotos && (
          <View style={styles.loadMoreContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && styles.loadMoreBtnPressed,
              ]}
              onPress={() => setVisibleAlbumCount((prev) => prev + 24)}
              accessibilityRole="button"
              accessibilityLabel={t('fmp_loadMoreAlbum')}
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.loadMoreBtnText}>
                {t('fmp_loadMoreN', { shown: displayedPhotos.length, count: allFiltered.length })}
              </Text>
            </Pressable>

            {allFiltered.length > visibleAlbumCount + 24 && (
              <Pressable
                style={({ pressed }) => [
                  styles.showAllPillBtn,
                  pressed && styles.loadMoreBtnPressed,
                ]}
                onPress={() => setVisibleAlbumCount(allFiltered.length)}
                accessibilityRole="button"
                accessibilityLabel={t('fmp_showAllAlbum')}
              >
                <Text style={styles.showAllPillBtnText}>{t('fmp_showAllN', { count: allFiltered.length })}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Selection action bar */}
        {selectedAlbumIds.size > 0 && (
          <View style={[styles.actionBar, { paddingBottom: spacing.md }]}>
            <GlassSurface strength="thick" blurTarget={resultsBg} style={styles.actionBarGlass} />
            <View style={styles.actionBarTopRow}>
              <Text style={styles.actionBarCount}>{tp(t, 'fmp_selectedN', selectedAlbumIds.size)}</Text>
              <Pressable onPress={() => setSelectedAlbumIds(new Set())} hitSlop={8}>
                <Text style={styles.actionBarClearText}>{t('fmp_clear')}</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, width: '100%' }}>
              {selectedPurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => handleBatchDownload(selectedPurchased)}
                  disabled={downloadingBatch}
                >
                  {downloadingBatch ? (
                    <ActivityIndicator size="small" color={onFill} />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={16} color={onFill} />
                  )}
                  <Text style={styles.actionBarBtnText}>
                    {downloadingBatch ? (batchProgress || t('fmp_saving')) : t('fmp_downloadN', { count: selectedPurchased.length })}
                  </Text>
                </Pressable>
              )}
              {selectedUnpurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAlbumBulkBuy}
                >
                  <Ionicons name="card-outline" size={16} color={onFill} />
                  <Text style={styles.actionBarBtnText}>
                    {t('fmp_buyN', { count: selectedUnpurchased.length })} · {albumCurrencyAbbr}{' '}
                    {selectedUnpurchased.reduce((s, p) => s + (p.price ?? 0), 0)}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Back */}
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
          <Pressable onPress={() => { setAlbumPhotos(null); setSelectedAlbumIds(new Set()); setAlbumFilteredIds(null); }}>
            <Text style={styles.ghostLink}>← Back</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // ─── Render: Free album email screen ─────────────────────────────────────

  const renderFreeEmail = () => (
    <View style={styles.freeCard}>
      <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>📸</Text>
      <View style={styles.albumBadge}>
        <Text style={styles.albumBadgeText}>{t('fmp_freeAlbum')}</Text>
      </View>
      {freeTitle ? <Text style={styles.albumTitle}>{freeTitle}</Text> : null}
      {freePhotographer ? (
        <Text style={styles.albumSub}>
          {t('fmp_by')} <Text style={{ color: colors.text, fontWeight: '700' }}>{freePhotographer}</Text>
        </Text>
      ) : null}
      <Text style={[styles.subLead, { marginTop: 16, marginBottom: 24 }]}>
        {t('fmp_needsEmail')}
      </Text>

      <TextInput
        placeholder={t('fmp_emailPlaceholder')}
        value={freeEmail}
        onChangeText={(t) => { setFreeEmail(t); setFreeError(''); }}
        keyboardType="email-address"
        autoCapitalize="none"
        style={[styles.codeInput, freeError ? { borderColor: '#EF4444' } : {}]}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={handleFreeRequestAccess}
      />

      {freeError ? <Text style={styles.error}>{freeError}</Text> : null}

      <Pressable
        style={[styles.accessBtn, (freeLoading || !freeEmail.trim()) && { opacity: 0.5 }]}
        onPress={handleFreeRequestAccess}
        disabled={freeLoading || !freeEmail.trim()}
      >
        {freeLoading
          ? <ActivityIndicator size="small" color={onFill} />
          : <Text style={styles.accessBtnText}>{t('fmp_requestAccess')}</Text>}
      </Pressable>

      <Pressable
        style={{ marginTop: 16 }}
        onPress={() => { setFreeFlow('idle'); setFreeError(''); }}
      >
        <Text style={styles.ghostLink}>{t('fmp_backToCode')}</Text>
      </Pressable>
    </View>
  );

  // ─── Render: Free album OTP screen ───────────────────────────────────────

  const renderFreeOtp = () => (
    <View style={styles.freeCard}>
      <Text style={styles.albumTitle}>{t('fmp_enterOtpTitle')}</Text>
      <Text style={[styles.subLead, { marginVertical: 12 }]}>
        {t('fmp_otpSent')}{'\n'}
        <Text style={{ color: colors.text, fontWeight: '600' }}>{maskEmail(freeEmail)}</Text>
      </Text>

      <OtpInput value={freeOtp} onChange={(v) => { setFreeOtp(v); setFreeError(''); }} error={!!freeError} />

      {freeError ? <Text style={[styles.error, { marginTop: 8 }]}>{freeError}</Text> : null}

      <Pressable
        style={[styles.accessBtn, { marginTop: 20 }, (freeLoading || freeOtp.length < 6) && { opacity: 0.5 }]}
        onPress={handleFreeVerify}
        disabled={freeLoading || freeOtp.length < 6}
      >
        {freeLoading
          ? <ActivityIndicator size="small" color={onFill} />
          : <Text style={styles.accessBtnText}>{t('fmp_verify')}</Text>}
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 16 }}>
        {t('fmp_noCode')}{' '}
        <Text
          style={{ color: colors.primary, textDecorationLine: 'underline' }}
          onPress={handleFreeResend}
        >
          {t('fmp_resend')}
        </Text>
      </Text>

      <Pressable
        style={{ marginTop: 12 }}
        onPress={() => { setFreeFlow('email'); setFreeOtp(''); setFreeError(''); }}
      >
        <Text style={styles.ghostLink}>{t('fmp_changeEmail')}</Text>
      </Pressable>
    </View>
  );

  // ─── Render: Free album photo grid ───────────────────────────────────────

  const renderFreeGrid = () => {
    const isCapped = freeMaxDownloads !== null || freeAlbumPricePerExtra > 0;
    const expiresDays = freeExpiresAt
      ? Math.ceil((new Date(freeExpiresAt).getTime() - Date.now()) / 86_400_000)
      : null;
    const info = getCappedSelectionInfo();
    const totalSelected = info.total;
    const extrasTotal = info.overflow > 0 ? Math.round(freeAlbumPricePerExtra * info.overflow) : 0;
    const showPurchase = info.overflow > 0 && freeAlbumPricePerExtra > 0 && digitalPurchasesEnabled;
    // Android caps the download at the free quota, so the count on the button
    // has to be what will actually arrive — not what's selected.
    const downloadableNow = digitalPurchasesEnabled ? totalSelected : totalSelected - info.overflow;
    const displayedFreePhotos = freePhotos.slice(0, visibleFreeCount);
    const hasMoreFreePhotos = freePhotos.length > visibleFreeCount;

    return (
      <View style={{ flex: 1 }}>
        {/* Album header */}
        <View style={styles.albumHeader}>
          <View style={styles.albumBadge}>
            <Ionicons name="camera" size={11} color={colors.primary} />
            <Text style={styles.albumBadgeText}>{t('fmp_freeAlbum')}</Text>
          </View>
          <Text style={styles.albumTitle}>{freeTitle}</Text>
          {freePhotographer ? (
            <Text style={styles.albumSub}>
              {t('fmp_by')} <Text style={{ color: onFill, fontWeight: '700' }}>{freePhotographer}</Text>
            </Text>
          ) : null}

          {expiresDays !== null && expiresDays <= 0 && (
            <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 6 }}>
              ✕ This album has expired
            </Text>
          )}
          {expiresDays !== null && expiresDays > 0 && expiresDays <= 7 && (
            <Text style={{ color: '#F59E0B', fontSize: 13, marginTop: 6 }}>
              ⏱ Expires in {expiresDays} day{expiresDays !== 1 ? 's' : ''}
            </Text>
          )}

          <Text style={styles.albumCount}>{tp(t, 'fmp_photosN', freePhotos.length)}</Text>
          <Text style={styles.albumHint}>{t('fmp_freeHint')}</Text>

          {!isCapped && freePhotos.length > 1 && selectedFreeIds.size < freePhotos.length && (
            <Pressable
              style={styles.selectAllBtn}
              onPress={() => setSelectedFreeIds(new Set(freePhotos.map((p) => p.id)))}
            >
              <Ionicons name="checkmark-done-outline" size={14} color={onFill} />
              <Text style={styles.selectAllBtnText}>{t('fmp_selectAll')}</Text>
            </Pressable>
          )}

          {isCapped && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6, lineHeight: 18 }}>
              {freeMaxDownloads !== null && (
                <>{tp(t, 'fmp_freeUpTo', freeMaxDownloads)}</>
              )}
              {freeAlbumPricePerExtra > 0 && (
                <> {t('fmp_extrasEach', { price: `${freeAlbumCurrencyAbbr || ''} ${freeAlbumPricePerExtra}`.trim() })}</>
              )}
              {freeAcquiredIds.size > 0 && (
                <> {t('fmp_alreadyOwnN', { count: freeAcquiredIds.size })}</>
              )}
            </Text>
          )}

          {freeStatusMsg ? (
            <Text style={{ color: colors.primary, fontSize: 13, marginTop: 8, lineHeight: 18 }}>{freeStatusMsg}</Text>
          ) : null}
        </View>

        {/* Grid */}
        <FlatList
          data={displayedFreePhotos}
          keyExtractor={(p) => p.id}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ gap, paddingBottom: totalSelected > 0 ? 120 : 24 }}
          renderItem={({ item }) => {
            const owned = freeAcquiredIds.has(item.id);
            const selected = selectedFreeIds.has(item.id);
              return (
                <PhotoCell
                  uri={owned
                    ? item.thumbnailUrl
                    : stampPreviewUrl(item.thumbnailUrl, viewerId)}
                  size={cell}
                  owned={owned}
                  selected={selected && !owned}
                  watermarkText={isCapped && !owned ? t('fmp_previewWatermark', { name: freePhotographer || t('fmp_photographerUpper') }) : undefined}
                  selectionMode={totalSelected > 0}
                  onPress={() => {
                    if (totalSelected > 0) {
                      toggleFreePhoto(item.id);
                    } else {
                      setPreviewPhoto({
                        ...item,
                        isPurchased: owned,
                        price: 0,
                        photographerName: freePhotographer,
                        eventTitle: freeTitle,
                      });
                    }
                  }}
                  onToggleSelect={() => toggleFreePhoto(item.id)}
                  onPreview={() =>
                    setPreviewPhoto({
                      ...item,
                      isPurchased: owned,
                      price: 0,
                      photographerName: freePhotographer,
                      eventTitle: freeTitle,
                    })
                  }
                  onLongPress={() => onLongPressPhoto(item.id, freePhotographer || freeTitle)}
                />
              );
            }}
          />

        {hasMoreFreePhotos && (
          <View style={styles.loadMoreContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && styles.loadMoreBtnPressed,
              ]}
              onPress={() => setVisibleFreeCount((prev) => prev + 24)}
              accessibilityRole="button"
              accessibilityLabel={t('fmp_loadMoreFree')}
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.loadMoreBtnText}>
                {t('fmp_loadMoreN', { shown: displayedFreePhotos.length, count: freePhotos.length })}
              </Text>
            </Pressable>

            {freePhotos.length > visibleFreeCount + 24 && (
              <Pressable
                style={({ pressed }) => [
                  styles.showAllPillBtn,
                  pressed && styles.loadMoreBtnPressed,
                ]}
                onPress={() => setVisibleFreeCount(freePhotos.length)}
                accessibilityRole="button"
                accessibilityLabel={t('fmp_showAllFree')}
              >
                <Text style={styles.showAllPillBtnText}>{t('fmp_showAllN', { count: freePhotos.length })}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Bottom action bar */}
        {totalSelected > 0 && (
          <View style={[styles.actionBar, { paddingBottom: spacing.md }]}>
            <GlassSurface strength="thick" blurTarget={resultsBg} style={styles.actionBarGlass} />
            <Text style={styles.actionBarCount}>{totalSelected} selected</Text>
            <Pressable
              style={[
                styles.actionBarBtn,
                { backgroundColor: showPurchase ? '#F59E0B' : '#10B981' },
                freeDownloading && { opacity: 0.6 },
              ]}
              onPress={handleFreeDownload}
              disabled={freeDownloading}
            >
              {freeDownloading
                ? <ActivityIndicator size="small" color={onFill} />
                : <Ionicons name={showPurchase ? 'card-outline' : 'cloud-download-outline'} size={16} color={onFill} />}
              <Text style={styles.actionBarBtnText}>
                {showPurchase
                  ? t('fmp_purchaseExtras', { price: formatPrice(extrasTotal, freeAlbumCurrencyAbbr || undefined), count: info.overflow })
                  : t('fmp_downloadN', { count: downloadableNow })}
              </Text>
            </Pressable>
            <Pressable onPress={() => setSelectedFreeIds(new Set())}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>{t('fmp_clear')}</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
          onPress={() => { setFreeFlow('idle'); setFreePhotos([]); setSelectedFreeIds(new Set()); setFreeStatusMsg(''); }}
        >
          <Text style={styles.ghostLink}>← Back</Text>
        </Pressable>
      </View>
    );
  };

  // ─── Render: Face results ─────────────────────────────────────────────────

  const renderFaceResults = () => {
    const results = faceResults ?? [];
    if (!results.length) {
      return (
        <EmptyState
          icon="images-outline"
          title={t('fmp_noMatchTitle')}
          message={
            code.trim()
              ? t('fmp_noMatchAlbum', { code: code.trim() })
              : t('fmp_noMatchAny')
          }
          action={{
            label: t('fmp_tryAgain'),
            onPress: () => {
              setFaceResults(null);
              setSelfie(null);
              setActiveOption(null);
              setSearchError(null);
            },
          }}
        />
      );
    }

    const selectedUnpurchased = results.filter(
      (p) => selectedResultIds.has(p.id as string) && !p.isPurchased && (p.price ?? 0) > 0
    );
    const selectedPurchased = results.filter(
      (p) => selectedResultIds.has(p.id as string) && p.isPurchased
    );
    const allPurchased = results.filter((p) => p.isPurchased);
    const unpurchasedInResults = results.filter((p) => !p.isPurchased && (p.price ?? 0) > 0);
    const isSelectionMode = selectedResultIds.size > 0;
    const selectedUnpurchasedTotal = selectedUnpurchased.reduce((sum, p) => sum + (p.price ?? 0), 0);
    const resultCurrency = selectedUnpurchased[0]?.currency;
    const targetAlbumId = results.find((p) => p.albumId)?.albumId || albumId || null;
    const displayedResults = results.slice(0, visibleResultsCount);
    const hasMoreResults = results.length > visibleResultsCount;

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsEyebrow}>{t('fmp_matchesFound')}</Text>
          <Text style={styles.resultsTitle} accessibilityRole="header">
            {tp(t, 'fmp_photosOfYou', results.length)}
          </Text>
          <Text style={styles.resultsHint}>
            {isSelectionMode
              ? t('fmp_selectedOf', { selected: selectedResultIds.size, count: results.length })
              : hasMoreResults
              ? t('fmp_showingOf', { shown: displayedResults.length, count: results.length })
              : t('fmp_resultsHint')}
          </Text>
        </View>

        {/* One row of glass chips instead of a stack of buttons. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {allPurchased.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.chip, styles.chipOwned, pressed && styles.chipPressed]}
              onPress={() => handleBatchDownload(allPurchased)}
              disabled={downloadingBatch}
              accessibilityRole="button"
            >
              {downloadingBatch ? (
                <ActivityIndicator size="small" color={onFill} />
              ) : (
                <Ionicons name="cloud-download-outline" size={15} color={onFill} />
              )}
              <Text style={[styles.chipText, styles.chipOwnedText]}>
                {downloadingBatch ? (batchProgress || t('fmp_downloading')) : t('fmp_downloadOwnedN', { count: allPurchased.length })}
              </Text>
            </Pressable>
          )}

          {unpurchasedInResults.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => {
                if (selectedResultIds.size === unpurchasedInResults.length) {
                  setSelectedResultIds(new Set());
                } else {
                  setSelectedResultIds(new Set(unpurchasedInResults.map((p) => p.id as string)));
                }
              }}
              accessibilityRole="button"
            >
              <Ionicons
                name={selectedResultIds.size === unpurchasedInResults.length ? 'close-circle-outline' : 'checkbox-outline'}
                size={15}
                color={colors.primary}
              />
              <Text style={styles.chipText}>
                {selectedResultIds.size === unpurchasedInResults.length
                  ? t('fmp_deselectAllLower')
                  : t('fmp_selectAllLowerN', { count: unpurchasedInResults.length })}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => {
              setFaceResults(null);
              setSelfie(null);
              setActiveOption(null);
              setSearchError(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('fmp_searchAnother')}
          >
            <Ionicons name="camera-reverse-outline" size={15} color={colors.primary} />
            <Text style={styles.chipText}>{t('fmp_newSearch')}</Text>
          </Pressable>

          {targetAlbumId ? (
            <Pressable
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => openUnlock(targetAlbumId)}
              accessibilityRole="button"
              accessibilityLabel={t('fmp_unlockWithCode')}
            >
              <Ionicons name="key-outline" size={15} color={colors.primary} />
              <Text style={styles.chipText}>{t('fmp_unlockWithCode')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {purchaseNotice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>{purchaseNotice}</Text>
          </View>
        ) : null}

        <FlatList
          data={displayedResults}
          keyExtractor={(p) => p.id as string}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ gap, paddingBottom: hasMoreResults ? 12 : (isSelectionMode ? 140 : 32) }}
          renderItem={({ item }) => (
            <PhotoCell
              uri={item.isPurchased
                ? (item.thumbnailUrl ?? item.url)
                : stampPreviewUrl(item.thumbnailUrl, viewerId)}
              size={cell}
              locked={!item.isPurchased && (item.price ?? 0) > 0}
              price={item.price}
              currency={item.currency}
              eventTitle={item.eventTitle}
              selected={selectedResultIds.has(item.id as string)}
              owned={item.isPurchased}
              selectionMode={isSelectionMode}
              onPress={() => handleResultPhotoPress(item)}
              onToggleSelect={() => toggleResultSelect(item.id as string)}
              onPreview={() => setPreviewPhoto(item)}
              onLongPress={() => onLongPressPhoto(item.id as string, item.photographerName || item.eventTitle)}
            />
          )}
        />

        {/* Progressive Load More Pagination */}
        {hasMoreResults && (
          <View
            style={[
              styles.loadMoreContainer,
              { paddingBottom: isSelectionMode ? 120 : spacing.xl },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && styles.loadMoreBtnPressed,
              ]}
              onPress={() =>
                setVisibleResultsCount((prev) => Math.min(results.length, prev + 16))
              }
              accessibilityRole="button"
              accessibilityLabel={t('fmp_loadMore')}
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.loadMoreBtnText}>
                {t('fmp_loadMoreN', { shown: displayedResults.length, count: results.length })}
              </Text>
            </Pressable>

            {results.length > visibleResultsCount + 16 && (
              <Pressable
                style={({ pressed }) => [
                  styles.showAllPillBtn,
                  pressed && styles.loadMoreBtnPressed,
                ]}
                onPress={() => setVisibleResultsCount(results.length)}
                accessibilityRole="button"
                accessibilityLabel={t('fmp_showAll')}
              >
                <Text style={styles.showAllPillBtnText}>{t('fmp_showAllN', { count: results.length })}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Selection bar */}
        {isSelectionMode && (
          <View style={[styles.actionBar, { paddingBottom: spacing.md }]}>
            <GlassSurface strength="thick" blurTarget={resultsBg} style={styles.actionBarGlass} />
            <View style={styles.actionBarTopRow}>
              <Text style={styles.actionBarCount}>
                {tp(t, 'fmp_selectedN', selectedResultIds.size)}
              </Text>
              <Pressable onPress={() => setSelectedResultIds(new Set())} hitSlop={8}>
                <Text style={styles.actionBarClearText}>{t('fmp_clear')}</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, width: '100%' }}>
              {selectedPurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => handleBatchDownload(selectedPurchased)}
                  disabled={downloadingBatch}
                >
                  {downloadingBatch ? (
                    <ActivityIndicator size="small" color={onFill} />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={16} color={onFill} />
                  )}
                  <Text style={styles.actionBarBtnText}>
                    {downloadingBatch ? (batchProgress || t('fmp_saving')) : t('fmp_downloadN', { count: selectedPurchased.length })}
                  </Text>
                </Pressable>
              )}
              {selectedUnpurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: colors.primary }]}
                  onPress={handleResultBulkBuy}
                >
                  <Ionicons name="card-outline" size={16} color={onFill} />
                  <Text style={styles.actionBarBtnText}>
                    {t('fmp_buyN', { count: selectedUnpurchased.length })}
                    {selectedUnpurchasedTotal > 0
                      ? ` · ${formatPrice(selectedUnpurchasedTotal, resultCurrency)}`
                      : ''}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  // Determine which phase to show
  const showFreeFlow = freeFlow !== 'idle';
  const showAlbum = !showFreeFlow && albumPhotos !== null;
  const showFaceResults = !showFreeFlow && !showAlbum && faceResults !== null;
  const showConnect = !showFreeFlow && !showAlbum && !showFaceResults;

  // Same preview rules as the grid: an unpaid photo only ever appears stamped.
  const ambientPhoto = showFaceResults
    ? faceResults?.[0]
    : showAlbum
      ? albumPhotos?.[0]
      : freePhotos[0];
  const ambientUri = ambientPhoto?.thumbnailUrl
    ? (ambientPhoto as { isPurchased?: boolean }).isPurchased
      ? ambientPhoto.thumbnailUrl
      : stampPreviewUrl(ambientPhoto.thumbnailUrl, viewerId)
    : undefined;
  const ambientSource = ambientUri ? { uri: ambientUri } : AUTH_BACKDROP;

  return (
    <View style={{ flex: 1, backgroundColor: showConnect ? '#000000' : colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {showConnect ? (
        // Entry: a full page over the sleek modern backdrop, its actions on glass cards.
        <>
          <StatusBar style="light" />
          <BlurTargetView ref={connectBg} style={StyleSheet.absoluteFill} pointerEvents="none">
            <ScanBackdrop />
          </BlurTargetView>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <ScrollView
              contentContainerStyle={[
                styles.connectScroll,
                { paddingTop: insets.top + 64, paddingBottom: insets.bottom + spacing.xl },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
            >
              {renderConnect()}
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={[styles.connectTopBar, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              hitSlop={8}
              style={({ pressed }) => [styles.connectBack, glassClear, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={t('fmp_goBack')}
            >
              <GlassLayer fill="rgba(0,0,0,0.22)" />
              <Ionicons name="chevron-back" size={22} color={onFill} />
            </Pressable>
            <PhotoLanguagePill />
          </View>
        </>
      ) : (
      <>
      {/* Ambient backdrop: the first photo on the page, blurred to colour and
          washed toward the theme, so the glass above it has something to frost. */}
      <BlurTargetView ref={resultsBg} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={ambientSource}
          style={{ ...StyleSheet.absoluteFill, width: '100%', height: '100%' }}
          contentFit="cover"
          blurRadius={48}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(14,17,23,0.74)' : 'rgba(244,246,251,0.7)' },
          ]}
        />
      </BlurTargetView>
      {/* Top Bar in head — full-width rounded bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.topBarPill}>
          <Pressable
            onPress={() => {
              if (showFaceResults) { setFaceResults(null); setSelfie(null); }
              else if (showAlbum) { setAlbumPhotos(null); }
              else if (showFreeFlow) { setFreeFlow('idle'); }
              else if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            hitSlop={12}
            style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={showFaceResults || showAlbum || showFreeFlow ? t('fmp_back') : t('fmp_goBack')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.topBarPillCenter}>
            <Text style={styles.topBarPillText}>{t('fmp_title')}</Text>
          </View>

          <LanguageButton compact />
        </View>
      </View>

      {/* Floating Batch Download Progress Pill */}
      {downloadingBatch && batchProgress ? (
        <View
          style={[
            styles.floatingProgressBanner,
            { top: Math.max(insets.top + 60, 68) },
          ]}
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="small" color={onFill} style={{ marginRight: 8 }} />
          <Text style={styles.floatingProgressText}>{batchProgress}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: spacing.md,
              paddingBottom: Math.max(insets.bottom + spacing.lg, 60),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          {showFreeFlow && freeFlow === 'email' && renderFreeEmail()}
          {showFreeFlow && freeFlow === 'otp' && renderFreeOtp()}
          {showFreeFlow && freeFlow === 'verified' && renderFreeGrid()}
          {showAlbum && renderAlbumGrid()}
          {showFaceResults && renderFaceResults()}
        </ScrollView>
      </KeyboardAvoidingView>
      </>
      )}

      {/* ── Clean Customized No Matches Modal ── */}
      <Modal
        visible={noMatchesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNoMatchesOpen(false)}
      >
        <GlassScrim
          style={styles.modalOverlay}
          onPress={() => setNoMatchesOpen(false)}
        >
          <GlassSheetHost variant="dialog"
            style={[styles.modalContent, styles.customModalCard]}
          >
            <Pressable
              onPress={() => setNoMatchesOpen(false)}
              style={({ pressed }) => [styles.customModalClose, pressed && styles.customModalClosePressed]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('fmp_close')}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.customModalIconWrap}>
              <Ionicons name="search-outline" size={28} color={colors.primary} />
            </View>

            <Text style={styles.customModalTitle}>{t('fmp_noPhotosTitle')}</Text>

            <Text style={styles.customModalMessage}>
              {t('fmp_noPhotosBody')}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.customModalBtn,
                pressed && styles.customModalBtnPressed,
              ]}
              onPress={() => setNoMatchesOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('fmp_tryAgain')}
            >
              <Text style={styles.customModalBtnText}>{t('fmp_tryAgain')}</Text>
            </Pressable>
          </GlassSheetHost>
        </GlassScrim>
      </Modal>

      {/* ── Unlock Modal ── */}
      <Modal visible={unlockOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <GlassScrim style={styles.modalOverlay}>
          <GlassSheetHost style={[styles.modalContent, { marginTop: 'auto' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('fmp_unlockTitle')}</Text>
              <Pressable onPress={() => setUnlockOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              {t('fmp_unlockBody')}
            </Text>
            <TextInput
              placeholder={t('fmp_unlockPlaceholder')}
              value={unlockIdentifier}
              onChangeText={setUnlockIdentifier}
              autoCapitalize="none"
              style={styles.modalInput}
              placeholderTextColor="#94A3B8"
            />
            {unlockError ? <Text style={styles.errorText}>{unlockError}</Text> : null}
            <Button
              title={t('fmp_unlockAndDownload')}
              onPress={handleUnlock}
              loading={unlocking}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title={t('fmp_cancel')}
              variant="ghost"
              onPress={() => setUnlockOpen(false)}
              style={{ marginTop: spacing.xs }}
            />
          </GlassSheetHost>
        </GlassScrim>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report a photo (long-press a tile to open). */}
      <ReportSheet
        visible={!!reportPhoto}
        onClose={() => setReportPhoto(null)}
        targetType="PHOTO"
        subject={reportPhoto?.subject}
        submit={submitPhotoReport}
      />

      {/* ── In-App Photo Checkout Sheet ── */}
      <PhotoCheckoutSheet
        visible={checkoutVisible}
        onClose={() => {
          extrasInFlight.current = null;
          setCheckoutVisible(false);
        }}
        items={checkoutItems}
        photoCount={checkoutPhotoCount}
        photographerCount={checkoutPhotographerCount}
        currencySym={checkoutCurrencySym}
        total={checkoutTotal}
        onSuccess={handleInAppPurchaseSuccess}
      />

      {/* ── Full-Screen Watermarked Lightbox Modal ── */}
      <Modal
        visible={!!previewPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <View style={styles.lightboxContainer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewPhoto(null)} />
          <View
            style={[
              styles.lightboxContent,
              { marginTop: Math.max(insets.top, 16), marginBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Lightbox Header: Report and Close buttons */}
            <View style={styles.lightboxHeader}>
              <Pressable
                onPress={() => {
                  const target = previewPhoto;
                  setPreviewPhoto(null);
                  if (target) {
                    onLongPressPhoto(
                      target.id as string,
                      (target as FoundPhoto).photographerName || albumPhotographerName || albumTitle,
                    );
                  }
                }}
                style={styles.lightboxIconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('fmp_reportPhoto')}
                hitSlop={8}
              >
                <Ionicons name="flag-outline" size={20} color={onFill} />
              </Pressable>
              <Pressable
                onPress={() => setPreviewPhoto(null)}
                style={styles.lightboxIconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('fmp_closePreview')}
                hitSlop={8}
              >
                <Ionicons name="close" size={26} color={onFill} />
              </Pressable>
            </View>

            {/* Lightbox Image Preview with Watermark or Owned badge */}
            {previewPhoto && (
              <View style={styles.lightboxImageContainer}>
                <Image
                  source={{
                    uri: previewPhoto.isPurchased
                      ? (previewPhoto.thumbnailUrl || (previewPhoto as any).url)
                      : stampPreviewUrl(previewPhoto.thumbnailUrl || (previewPhoto as any).url, viewerId),
                  }}
                  style={styles.lightboxImage}
                  contentFit="contain"
                  transition={200}
                />

                {!previewPhoto.isPurchased && (
                  <View style={styles.lightboxWatermarkOverlay} pointerEvents="none">
                    <View style={styles.watermarkPatternGrid}>
                      {WATERMARK_ROWS.map((rowIndex) => (
                        <View
                          key={rowIndex}
                          style={[
                            styles.watermarkPatternRow,
                            { marginLeft: rowIndex % 2 === 0 ? -30 : -110 },
                          ]}
                        >
                          {WATERMARK_COLS.map((colIndex) => (
                            <Text key={colIndex} style={styles.watermarkPatternText}>
                              CONNEKYT PREVIEW
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {previewPhoto.isPurchased && (
                  <View style={styles.lightboxOwnedPill}>
                    <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                    <Text style={styles.lightboxOwnedText}>{t('fmp_ownedFullRes')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Lightbox Footer with Title, Photographer & Actions */}
            {previewPhoto && (
              <View style={styles.lightboxFooter}>
                <View style={{ gap: 2 }}>
                  <Text style={styles.lightboxTitle} numberOfLines={1}>
                    {(previewPhoto as FoundPhoto).eventTitle || albumTitle || t('fmp_photoPreview')}
                  </Text>
                  <Text style={styles.lightboxPhotographer}>
                    {t('fmp_by')}{' '}
                    <Text style={{ color: onFill, fontWeight: '700' }}>
                      {(previewPhoto as FoundPhoto).photographerName ||
                        albumPhotographerName ||
                        t('fmp_photographer')}
                    </Text>
                  </Text>
                </View>

                <View style={styles.lightboxActions}>
                  {previewPhoto.isPurchased ? (
                    <Pressable
                      style={[styles.lbBtn, styles.lbBtnOwned]}
                      onPress={() => {
                        const target = previewPhoto;
                        setPreviewPhoto(null);
                        handleDownloadPurchased(target);
                      }}
                    >
                      <Ionicons name="cloud-download-outline" size={18} color={onFill} />
                      <Text style={styles.lbBtnText}>{t('fmp_downloadHiRes')}</Text>
                    </Pressable>
                  ) : (previewPhoto.price ?? 0) === 0 ? (
                    <Pressable
                      style={[styles.lbBtn, styles.lbBtnOwned]}
                      onPress={() => {
                        const target = previewPhoto;
                        setPreviewPhoto(null);
                        downloadAndShare(
                          (target as any).url || target.thumbnailUrl,
                          `photo-${target.id}.jpg`,
                        );
                      }}
                    >
                      <Ionicons name="cloud-download-outline" size={18} color={onFill} />
                      <Text style={styles.lbBtnText}>{t('fmp_downloadFree')}</Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        style={[
                          styles.lbBtn,
                          styles.lbBtnGhost,
                          (selectedAlbumIds.has(previewPhoto.id as string) ||
                            selectedResultIds.has(previewPhoto.id as string)) &&
                            styles.lbBtnGhostActive,
                        ]}
                        onPress={() => {
                          const id = previewPhoto.id as string;
                          if (albumPhotos) {
                            toggleAlbumSelect(id);
                          } else {
                            toggleResultSelect(id);
                          }
                        }}
                      >
                        <Ionicons
                          name={
                            selectedAlbumIds.has(previewPhoto.id as string) ||
                            selectedResultIds.has(previewPhoto.id as string)
                              ? 'checkmark-circle'
                              : 'add-circle-outline'
                          }
                          size={18}
                          color={onFill}
                        />
                        <Text style={styles.lbBtnText}>
                          {selectedAlbumIds.has(previewPhoto.id as string) ||
                          selectedResultIds.has(previewPhoto.id as string)
                            ? t('fmp_selected')
                            : t('fmp_select')}
                        </Text>
                      </Pressable>

                      {(previewPhoto.price ?? 0) > 0 && (
                        <Pressable
                          style={[styles.lbBtn, styles.lbBtnPrimary]}
                          onPress={() => {
                            const target = previewPhoto;
                            setPreviewPhoto(null);
                            openPurchaseFor(
                              [target],
                              (target as AlbumPhotoItem).albumId ?? (target as FoundPhoto).albumId,
                            );
                          }}
                        >
                          <Ionicons name="card-outline" size={18} color={onFill} />
                          <Text style={styles.lbBtnText}>
                            {t('fmp_buy')} ·{' '}
                            {formatPrice(
                              previewPhoto.price,
                              (previewPhoto as any).currencyAbbreviation ||
                                (previewPhoto as any).currency ||
                                albumCurrencyAbbr,
                            )}
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Ambient modern gradient backdrop behind the entry screen; sleek, crisp, and high-performance. */
function ScanBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#040B18', '#0A1832', '#071224']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle radial glow accents for depth */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -80,
          right: -60,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: 'rgba(2, 132, 199, 0.14)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 220,
          left: -80,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: 'rgba(242, 12, 143, 0.09)',
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles((c, e) => ({
  // Top bar in head — full-width rounded bar
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  topBarPill: {
    width: '100%',
    height: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  topBarBackBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarBackBtnPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  topBarPillCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  topBarPillText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },

  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },

  // Flat page container (replaces centered modal card)
  flatContainer: {
    width: '100%',
  },
  webContainer: {
    width: '100%',
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  badgeText: { color: c.accent, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.2 },
  // On the video, so light in both schemes.
  heroTitle: { fontSize: 32, lineHeight: 38, fontWeight: fontWeight.extrabold, color: c.textOnPrimary, letterSpacing: -0.6 },
  lead: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },

  // ── Entry screen: video band + glass sheet ────────────────────────────
  connectScroll: { paddingHorizontal: spacing.xl, gap: spacing.md },
  connectTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  connectBack: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Android fallback: no blur there, so a plain smoked chip.
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  connectCard: { padding: spacing.lg, borderRadius: 24 },
  connectOr: {
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  connectHeading: { gap: 6, marginTop: spacing.xl, marginBottom: spacing.sm },
  inviteInput: {
    // Its own layer: Chrome otherwise smears a native <input> into the
    // glass card's backdrop blur (web only; native blur is unaffected).
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    ...glassTile(c),
    color: c.text,
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  accessBtnOutline: {
    width: '100%',
    height: 52,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessBtnOutlineText: { color: c.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  subHeading: { fontSize: 14, fontWeight: fontWeight.bold, color: c.text, marginBottom: 4, marginTop: 0, textAlign: 'center' },
  subLead: { fontSize: 12, color: c.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: spacing.md },

  // Scanning state — solid accent bar, NO gradients
  scanningWrap: { alignItems: 'center', marginVertical: spacing.lg },
  scanningCircleWrap: { width: 140, height: 140 },
  scanningCircle: {
    width: 140, height: 140, borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 3, borderColor: c.primary,
  },
  scanLineWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  scanLineBar: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
  },
  scanPulseRing: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 74, borderWidth: 2, borderColor: c.primary,
  },
  progressBarTrack: {
    width: 220,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  progressPercentText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  scanningTitle: { color: c.text, fontSize: 16, fontWeight: fontWeight.bold, marginTop: 14, textAlign: 'center' },
  scanningSubText: { color: c.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Selfie ready state
  selfieReadyWrap: { alignItems: 'center', marginVertical: spacing.md },
  selfiePreviewCircle: {
    width: 96, height: 96, borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 3, borderColor: c.primary,
    marginBottom: 10,
    backgroundColor: c.surfaceMuted,
  },
  selfieReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    marginBottom: 10,
  },
  selfieReadyText: { color: c.success, fontSize: 12.5, fontWeight: fontWeight.bold },
  changeSelfieBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radii.full, borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  changeSelfieBtnText: { color: c.text, fontSize: 13, fontWeight: fontWeight.semibold },

  // Pick options
  webPickOptions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  webPickOptionsStacked: { flexDirection: 'column' },
  // Tiles on the glass sheet: frosted, not solid cards.
  webPickCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    borderWidth: 1.5,
    ...glassTile(c),
  },
  webPickCardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  webPickCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  webIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  webPickTitle: { fontSize: 14, fontWeight: fontWeight.bold, color: c.text, textAlign: 'center', marginBottom: 2 },
  webPickSub: { fontSize: 12, color: c.textMuted, textAlign: 'center' },
  infoBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  infoBadgeText: { color: c.primary, fontSize: 11, fontWeight: '800', fontStyle: 'italic' },

  webFindBtn: {
    width: '100%',
    height: 52,
    backgroundColor: c.primary,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.xs,
    ...e(1),
  },
  webFindBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  webFindBtnDisabled: {
    backgroundColor: c.surfaceMuted,
    opacity: 0.6,
  },
  webFindBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.textOnPrimary },
  webFindBtnTextDisabled: { color: c.textMuted },

  // Invite footer hint (kept in stylesheet for legacy callers; no
  // longer rendered on the connect screen).
  inviteFooterHint: { marginTop: spacing.md, alignItems: 'center', gap: 8 },
  inviteFooterText: { color: c.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },

  error: { color: c.error, textAlign: 'center', marginTop: spacing.xs, fontSize: 12 },


  inviteHeading: { fontSize: 16, fontWeight: fontWeight.bold, color: c.text, marginBottom: 4 },
  inviteSubText: { fontSize: 13, color: c.textMuted, lineHeight: 18, marginBottom: 12 },

  codeInput: {
    width: '100%',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.text,
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: 10,
  },
  accessBtn: {
    width: '100%',
    height: 52,
    backgroundColor: c.primary,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(1),
  },
  accessBtnText: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Album / results
  albumHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
  },
  albumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  albumBadgeText: { color: c.primary, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 0.8 },
  albumTitle: { fontFamily: 'PragatiNarrow_700Bold', fontSize: 30, color: c.text, textAlign: 'center', marginBottom: 6, lineHeight: 36 },
  albumSub: { color: c.textMuted, fontSize: 15, marginBottom: 4, textAlign: 'center' },
  albumCount: { color: c.textSoft, fontSize: 14, marginTop: 6, fontWeight: '500' },
  albumHint: { color: c.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },

  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  noticeText: { color: c.primary, fontSize: 13, flex: 1 },

  // Photo cells
  cell: {
    backgroundColor: c.surfaceMuted,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderSoft,
    ...e(1),
  },
  cellSelected: {
    borderWidth: 2.5,
    borderColor: c.primary,
  },
  cellOwned: {
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.5)',
  },
  selectCheckbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  selectCheckboxActive: {
    backgroundColor: c.primary,
    borderColor: c.textOnPrimary,
  },
  cellOwnedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(16,185,129,0.92)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    zIndex: 5,
  },
  cellOwnedText: {
    color: c.textOnPrimary,
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  cellPriceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    zIndex: 5,
  },
  cellPriceText: {
    color: c.textOnPrimary,
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  cellFreeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(3,150,156,0.9)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    zIndex: 5,
  },
  cellFreeText: {
    color: c.textOnPrimary,
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  lockPrice: { color: c.textOnPrimary, fontSize: 11, fontWeight: '700' },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.tint,
  },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  caption: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: spacing.sm,
  },
  captionText: { color: c.textOnPrimary, fontSize: 11, fontWeight: '500' },

  // Action bar
  // ── Face results header ────────────────────────────────────────────
  resultsHeader: { gap: 4, paddingTop: spacing.md, marginBottom: spacing.md },
  resultsEyebrow: { color: c.accent, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.2 },
  resultsTitle: { fontSize: 30, lineHeight: 36, fontWeight: fontWeight.extrabold, color: c.text, letterSpacing: -0.6 },
  resultsHint: { fontSize: fontSize.sm, color: c.textSoft, lineHeight: 19 },
  // Bleeds to the screen edges so chips scroll under the gutter, not into it.
  chipScroll: { marginHorizontal: -spacing.xl, marginBottom: spacing.md, flexGrow: 0 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
  },
  chipPressed: { opacity: 0.75 },
  chipText: { color: c.text, fontSize: 13, fontWeight: fontWeight.semibold },
  chipOwned: { backgroundColor: c.success, borderColor: c.success },
  chipOwnedText: { color: c.textOnPrimary },

  // A floating frosted card; the GlassSurface inside carries the material.
  actionBar: {
    position: 'absolute',
    bottom: spacing.md, left: 0, right: 0,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  actionBarGlass: { borderRadius: 24 },
  actionBarCount: { color: c.text, fontSize: 14, fontWeight: fontWeight.bold },
  actionBarBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    ...e(1),
  },
  actionBarBtnText: { color: c.textOnPrimary, fontSize: 14, fontWeight: fontWeight.bold },

  ghostLink: { color: c.textMuted, fontSize: 14, fontWeight: '500' },

  // Album scan + filter buttons
  albumActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  scanInAlbumBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.full, backgroundColor: c.primary,
  },
  scanInAlbumBtnText: { color: c.textOnPrimary, fontSize: 13, fontWeight: '700' },
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1, ...glassTile(c),
  },
  showAllBtnText: { color: c.text, fontSize: 13, fontWeight: '600' },
  unlockPillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50, backgroundColor: 'rgba(3,150,156,0.15)',
    borderWidth: 1, borderColor: 'rgba(3,150,156,0.45)',
  },
  unlockPillBtnText: { color: '#7be0e5', fontSize: 13, fontWeight: '600' },

  // Select all (uncapped free albums)
  selectAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, marginTop: 10,
    borderRadius: 10, borderWidth: 1.5,
    ...glassTile(c),
  },
  selectAllBtnText: { color: c.text, fontSize: 13, fontWeight: '700' },

  // Watermark overlay text on capped free photos
  watermarkOverlayText: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Legacy — kept to avoid unused-variable errors from remaining references
  selfie: { width: 0, height: 0 },
  scanningSelfie: {},
  scanSpinner: {},
  scanningText: { fontSize: 0 },

  // Free album card (email / otp screens)
  freeCard: {
    borderRadius: 24,
    padding: spacing.xl,
    marginTop: spacing.xl,
    borderWidth: 1,
    ...glassTile(c),
    alignItems: 'center',
  },

  // OTP
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: spacing.sm },
  otpBox: {
    width: 44, height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
    color: c.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpBoxError: { borderColor: c.error },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    padding: spacing.xl,
    width: '100%',
    ...e(3),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.text },
  modalSub: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: spacing.lg },
  modalInput: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    ...glassTile(c),
    color: c.text,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  errorText: { color: c.error, fontSize: 13, marginBottom: spacing.sm },

  // Clean customized modal
  customModalCard: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg + 4,
    paddingHorizontal: spacing.xl,
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    ...glassTile(c),
    position: 'relative',
    ...e(3),
  },
  customModalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    ...glassTile(c),
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalClosePressed: { opacity: 0.6 },
  customModalIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  customModalTitle: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: c.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  customModalMessage: {
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.xl,
  },
  customModalBtn: {
    width: '100%',
    height: 48,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(1),
  },
  customModalBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  customModalBtnText: {
    color: c.textOnPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },

  // Action bar top row & clear
  actionBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  actionBarClearText: {
    color: c.primary,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },

  // Quick shortcuts in album / face results
  quickShortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  batchDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.success,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    ...e(1),
  },
  batchDownloadBtnText: {
    color: c.textOnPrimary,
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
  },
  shortcutBtnText: {
    color: c.text,
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },


  // Load More Pagination
  loadMoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    width: '100%',
    maxWidth: 340,
    ...e(1),
  },
  loadMoreBtnPressed: {
    opacity: 0.75,
  },
  loadMoreBtnText: {
    color: c.primary,
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  showAllPillBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  showAllPillBtnText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },

  // Expand badge on PhotoCell
  expandBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 5,
  },

  // Lightbox modal styles
  lightboxContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxContent: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    zIndex: 10,
  },
  lightboxIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10,
    overflow: 'hidden',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  lightboxWatermarkOverlay: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkPatternGrid: {
    width: 900,
    height: 1100,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-25deg' }],
  },
  watermarkPatternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 18,
  },
  watermarkPatternText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginHorizontal: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  lightboxOwnedPill: {
    position: 'absolute',
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  lightboxOwnedText: {
    color: c.textOnPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  lightboxFooter: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  lightboxTitle: {
    color: c.textOnPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  lightboxPhotographer: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  lightboxActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lbBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.full,
  },
  lbBtnOwned: {
    backgroundColor: c.success,
  },
  lbBtnPrimary: {
    backgroundColor: c.primary,
  },
  lbBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  lbBtnGhostActive: {
    backgroundColor: c.tint,
    borderColor: c.primary,
  },
  lbBtnText: {
    color: c.textOnPrimary,
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  floatingProgressBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingProgressText: {
    color: c.textOnPrimary,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
}));
