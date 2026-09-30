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
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ensureFaceConsent } from '@/features/privacy/consent';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import {
  browsePhotosUrl,
} from '@/features/payments/webCheckout';
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
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';

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
    customSuccessMessage: 'High-resolution photo saved directly to your Photos gallery.',
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
          <Ionicons name="checkmark-circle" size={12} color="#FFF" />
          <Text style={styles.cellOwnedText}>OWNED</Text>
        </View>
      )}
      {locked && !owned && (
        <View style={styles.cellPriceBadge}>
          <Ionicons name="lock-closed" size={11} color="#FFF" />
          {price != null && price > 0 && (
            <Text style={styles.cellPriceText}>{formatPrice(price, currency)}</Text>
          )}
        </View>
      )}
      {!locked && !owned && (price == null || price === 0) && (
        <View style={styles.cellFreeBadge}>
          <Text style={styles.cellFreeText}>FREE</Text>
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
          accessibilityLabel={selected ? 'Deselect photo' : 'Select photo'}
        >
          {selected ? (
            <Ionicons name="checkmark" size={14} color="#FFF" />
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
          accessibilityLabel="Preview photo full screen"
        >
          <Ionicons name="expand-outline" size={13} color="#FFF" />
        </Pressable>
      )}

      {/* Caption if present */}
      {eventTitle ? (
        <View style={styles.caption} pointerEvents="none">
          <Text style={styles.captionText} numberOfLines={1}>{eventTitle}</Text>
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
  const { colors } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
        'Screenshot Restricted',
        'Screenshots of preview photos are restricted to protect photographer copyright. Please purchase or unlock photos to download original high-resolution copies.',
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
        : err?.message || (typeof err === 'string' ? err : 'Search failed. Please try again.');
      if (msg.toLowerCase().includes('network connection was lost') || msg.toLowerCase().includes('-1005')) {
        msg = 'The network connection was lost. Please check your internet connection and try again.';
      } else {
        msg = msg
          .replace(/\s*\(at [^)]+\)/g, '')
          .replace(/^fetch failed:\s*/i, '')
          .replace(/^UnexpectedException:\s*/i, '')
          .trim() || 'Search failed. Please try again.';
      }
      setSearchError(msg);
    } finally {
      clearInterval(progressTimer);
      setSearching(false);
    }
  };

  const handleFindMyPhotos = () => {
    if (!selfie) {
      setSearchError('Please take a selfie or upload a photo first.');
      return;
    }
    performSearch(selfie, code);
  };

  // ─── Invite code → album ──────────────────────────────────────────────────

  const handleAccessGallery = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setAlbumError('Please enter an invite code.');
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
      setAlbumError('Invalid invite code or album not found. Please check and try again.');
    } finally {
      setAlbumLoading(false);
    }
  };

  // ─── Free album flow ──────────────────────────────────────────────────────

  const handleFreeRequestAccess = async () => {
    if (!freeEmail.trim()) {
      setFreeError('Please enter your email address.');
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
        setFreeError('This email was not invited to this album.');
      } else {
        setFreeError(msg || 'Failed to send code. Please try again.');
      }
    } finally {
      setFreeLoading(false);
    }
  };

  const handleFreeVerify = async () => {
    if (freeOtp.length < 6) {
      setFreeError('Please enter the 6-digit code.');
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
        setFreeError('Invalid code. Please try again.');
      } else if (msg.toLowerCase().includes('expired')) {
        setFreeError('Code expired. Tap Resend to get a new one.');
      } else {
        setFreeError(msg || 'Verification failed. Please try again.');
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
    setBatchProgress(`Saving 1 of ${toDownload.length} to Photos…`);
    try {
      const items = toDownload.map((photo) => ({ url: photo.url, filename: `photo-${photo.id}.jpg` }));
      const res = await saveBatchPhotosToGallery(items, (curr, total) => {
        setBatchProgress(`Saving ${curr} of ${total} to Photos…`);
      });
      if (res.saved > 0) {
        Alert.alert(
          'Saved to Photos',
          `Successfully saved ${res.saved} photo${res.saved !== 1 ? 's' : ''} directly to your Photos gallery.`,
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
      Alert.alert('Download Error', 'Some photos could not be saved to Photos. Please check permissions.');
    } finally {
      setDownloadingBatch(false);
      setBatchProgress(null);
    }
  };

  const handleFreeDownload = async () => {
    const info = getCappedSelectionInfo();
    if (info.total === 0) {
      setFreeStatusMsg('Select at least one photo to download.');
      return;
    }
    const price = freeAlbumPricePerExtra || 0;

    // No overflow — pure free download
    if (info.overflow === 0) {
      setFreeDownloading(true);
      setFreeStatusMsg(`Downloading ${info.total} photo${info.total !== 1 ? 's' : ''}…`);
      try {
        await downloadFreeSelected();
        setFreeStatusMsg('Done! Your photos are ready.');
      } catch {
        setFreeStatusMsg('Some photos could not be downloaded. Please try again.');
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
        setFreeStatusMsg(`You've already used your ${cap} free download(s) from this album.`);
        return;
      }
      setFreeDownloading(true);
      setFreeStatusMsg(`Downloading ${allowed.length} photo${allowed.length !== 1 ? 's' : ''}…`);
      try {
        await downloadFreeSelected(allowed);
        setFreeStatusMsg(
          `Done! ${allowed.length} photo${allowed.length !== 1 ? 's' : ''} ready. ` +
            `${info.overflow} more exceed${info.overflow === 1 ? 's' : ''} your free quota of ${cap}.`,
        );
      } catch {
        setFreeStatusMsg('Some photos could not be downloaded. Please try again.');
      } finally {
        setFreeDownloading(false);
      }
      return;
    }

    // Overflow but no price — polite block
    if (!(price > 0)) {
      setFreeStatusMsg(`You can download at most ${info.cap} new photo(s) for free from this album.`);
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
        setFreeStatusMsg('These extra photos cannot be purchased right now. Please try again.');
        return;
      }
      extrasInFlight.current = { allSelectedIds: Array.from(selectedFreeIds) };
      setCheckoutItems([
        {
          albumId: freeAlbumId,
          photoIds: overflowIds,
          amount: Math.round(price * overflowIds.length),
          currencyId: freeAlbumCurrencyId,
        },
      ]);
      setCheckoutPhotoCount(overflowIds.length);
      setCheckoutPhotographerCount(1);
      setCheckoutCurrencySym(freeAlbumCurrencyAbbr ? `${freeAlbumCurrencyAbbr} ` : '$');
      setCheckoutTotal(Math.round(price * overflowIds.length));
      setCheckoutPendingPhotoIds(overflowIds);
      setCheckoutVisible(true);
    };
    Alert.alert(
      'Extra Photos',
      `${info.overflow} photo${info.overflow !== 1 ? 's' : ''} in your selection exceed your free quota.\n\nExtras cost ${formatPrice(extrasTotal, freeAlbumCurrencyAbbr || undefined)} and are paid for here in the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(allowed.length
          ? [
              {
                text: `Download ${allowed.length} free`,
                onPress: () => {
                  void (async () => {
                    setFreeDownloading(true);
                    setFreeStatusMsg(`Downloading ${allowed.length} photo${allowed.length !== 1 ? 's' : ''}…`);
                    try {
                      await downloadFreeSelected(allowed);
                      setFreeStatusMsg(
                        `Done! You can pay for the ${info.overflow} extra photo${info.overflow === 1 ? '' : 's'} any time.`,
                      );
                    } catch {
                      setFreeStatusMsg('Some photos could not be downloaded. Please try again.');
                    } finally {
                      setFreeDownloading(false);
                    }
                  })();
                },
              },
            ]
          : []),
        { text: 'Pay for extras', onPress: buyExtras },
      ],
    );
  };

  // ─── In-App Purchase Flow (paid albums + face-results) ───────────────────
  const openPurchaseFor = (photos: (AlbumPhotoItem | FoundPhoto)[], defaultAlbumId?: string) => {
    const payable = photos.filter((p) => !p.isPurchased && (p.price ?? 0) > 0);
    if (!payable.length) {
      setPurchaseNotice('You already own all selected photos.');
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
      setPurchaseNotice('Payment confirmed. Your extra photos are unlocked and downloading.');
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
      `Purchase successful! Unlocked ${ids.length} photo${ids.length !== 1 ? 's' : ''}. Tap to download.`,
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
        setBatchProgress(`Saving ${curr} of ${total} to Photos…`);
      });

      if (res.saved > 0) {
        Alert.alert(
          'Saved to Photos',
          `Successfully saved ${res.saved} high-resolution photo${res.saved > 1 ? 's' : ''} directly to your device gallery.`,
          [{ text: 'OK' }]
        );
        setPurchaseNotice(`Saved ${res.saved} photo${res.saved !== 1 ? 's' : ''} to Photos.`);
      } else {
        setPurchaseNotice('Could not save photos. Please verify your photo permissions.');
      }
    } catch {
      setPurchaseNotice('Some photos could not be saved. Please try again.');
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
    if (!id) { setUnlockError('Enter your email or unlock code.'); return; }
    const aId = unlockForAlbumId ?? albumId ?? faceResults?.[0]?.albumId ?? null;
    if (!aId) { setUnlockError('No album in scope. Load an album first.'); return; }

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
        setPurchaseNotice(`Unlocked ${res.purchasedPhotoIds.length} photo(s). Tap to download.`);
      }
      setUnlockOpen(false);
    } catch (err) {
      setUnlockError(isApiError(err) ? err.message : 'Could not unlock. Check your code or email.');
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
        Alert.alert('No Matches', 'No photos matching your face were found in this album.');
        return;
      }
      setAlbumFilteredIds(new Set(results.map((p) => p.id as string)));
    } catch {
      Alert.alert('Scan Failed', 'Could not complete face scan. Please try again.');
    } finally {
      setAlbumFaceScanning(false);
    }
  };

  const handleAlbumFaceScan = () => {
    Alert.alert(
      'Find My Photos',
      'Use facial recognition to show only photos matching your face in this album.',
      [
        { text: 'Take Selfie', onPress: () => void doAlbumScan(takeSelfie) },
        { text: 'Upload from Library', onPress: () => void doAlbumScan(pickFromLibrary) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ─── Report a photo ───────────────────────────────────────────────────────

  const onLongPressPhoto = (photoId: string, subject?: string) => {
    Alert.alert('Photo actions', undefined, [
      {
        text: 'Report photo',
        style: 'destructive',
        onPress: () => setReportPhoto({ id: photoId, subject }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitPhotoReport = async (reason: string, description: string) => {
    if (!reportPhoto) throw { status: 400, message: 'Nothing to report.' };
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
      {/* Badge + hero */}
      <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>FACE RECOGNITION</Text>
        </View>
        <Text style={styles.heroTitle}>Find Your Photos</Text>
        <Text style={styles.lead}>
          Take a selfie or upload a photo to instantly find every photo you appear in.
        </Text>
      </View>

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
              ? 'Uploading photo...'
              : scanProgress < 65
                ? 'Analyzing facial features...'
                : scanProgress < 95
                  ? (code.trim() ? `Scanning album ${code.trim()}...` : 'Scanning event galleries...')
                  : 'Matching your photos...'}
          </Text>
          <Text style={styles.scanningSubText}>
            {scanProgress < 25
              ? 'Preparing your photo for secure AI lookup'
              : scanProgress < 65
                ? 'Detecting landmarks and facial geometry'
                : scanProgress < 95
                  ? (code.trim() ? 'Searching photos in this event' : 'Comparing face embeddings across galleries')
                  : 'Almost done, ranking your best matches'}
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
            <Text style={styles.selfieReadyText}>Photo ready to scan</Text>
          </View>
          <Pressable
            onPress={() => { setSelfie(null); setActiveOption(null); setFaceResults(null); setSearchError(null); }}
            style={styles.changeSelfieBtn}
          >
            <Text style={styles.changeSelfieBtnText}>Change photo</Text>
          </Pressable>
        </View>

      /* Pick options */
      ) : (
        <View style={styles.webPickOptions}>
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
            <Text style={styles.webPickTitle}>Take Selfie</Text>
            <Text style={styles.webPickSub}>Use camera</Text>
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
            <Text style={styles.webPickTitle}>Upload Photo</Text>
            <Text style={styles.webPickSub}>From gallery</Text>
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
              <Text style={styles.webPickTitle}>Browse Photos</Text>
              <Text style={styles.webPickSub}>Stock library</Text>
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
          accessibilityLabel="Find My Photos"
        >
          <Ionicons
            name="search"
            size={18}
            color={!selfie ? colors.textMuted : colors.textOnPrimary}
          />
          <Text style={[styles.webFindBtnText, !selfie && styles.webFindBtnTextDisabled]}>
            Find My Photos
          </Text>
        </Pressable>
      )}

      {searchError ? <Text style={styles.error}>{searchError}</Text> : null}

      {/* OR divider */}
      {!searching && (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>
      )}

      {/* Invite code */}
      {!searching && (
        <>
          <Text style={styles.inviteHeading}>Have an invite code?</Text>
          <Text style={styles.inviteSubText}>
            Enter it to jump straight into that event&apos;s gallery.
          </Text>

          <TextInput
            placeholder="Enter invite code"
            value={code}
            onChangeText={(t) => { setCode(t); setAlbumError(null); }}
            autoCapitalize="characters"
            style={styles.codeInput}
            placeholderTextColor={colors.textMuted}
            returnKeyType="go"
            onSubmitEditing={handleAccessGallery}
          />

          {albumError ? <Text style={styles.error}>{albumError}</Text> : null}

          <Pressable
            style={[styles.accessBtn, albumLoading && { opacity: 0.6 }]}
            onPress={handleAccessGallery}
            disabled={albumLoading}
          >
            {albumLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.accessBtnText}>Access Gallery</Text>}
          </Pressable>
        </>
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
            <Text style={styles.albumBadgeText}>PHOTO ALBUM</Text>
          </View>
          <Text style={styles.albumTitle}>{albumTitle || 'Event Album'}</Text>
          {albumPhotographerName ? (
            <Text style={styles.albumSub}>
              by <Text style={{ color: colors.text, fontWeight: '700' }}>{albumPhotographerName}</Text>
            </Text>
          ) : null}
          <Text style={styles.albumCount}>
            {albumFilteredIds !== null
              ? `${displayedPhotos.length} of ${photos.length} photo${photos.length !== 1 ? 's' : ''} matched`
              : `${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
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
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="person-circle-outline" size={15} color="#fff" />}
              <Text style={styles.scanInAlbumBtnText}>Find My Photos (Face Scan)</Text>
            </Pressable>
            {albumFilteredIds !== null && (
              <Pressable
                style={styles.showAllBtn}
                onPress={() => setAlbumFilteredIds(null)}
              >
                <Ionicons name="grid-outline" size={15} color="rgba(255,255,255,0.8)" />
                <Text style={styles.showAllBtnText}>Show All ({photos.length})</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.unlockPillBtn}
              onPress={() => openUnlock(albumId)}
            >
              <Ionicons name="lock-open-outline" size={15} color="#7be0e5" />
              <Text style={styles.unlockPillBtnText}>Already paid? Unlock</Text>
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
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="cloud-download-outline" size={14} color="#FFF" />
                )}
                <Text style={styles.batchDownloadBtnText}>
                  {downloadingBatch
                    ? (batchProgress || 'Downloading…')
                    : `Download All Owned (${allPurchased.length})`}
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
                    ? 'Deselect All'
                    : `Select All (${unpurchasedInAlbum.length})`}
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
              accessibilityLabel="Load more album photos"
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.loadMoreBtnText}>
                Load More Photos ({displayedPhotos.length} of {allFiltered.length})
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
                accessibilityLabel="Show all album photos"
              >
                <Text style={styles.showAllPillBtnText}>Show All ({allFiltered.length})</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Selection action bar */}
        {selectedAlbumIds.size > 0 && (
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing.sm }]}>
            <View style={styles.actionBarTopRow}>
              <Text style={styles.actionBarCount}>{selectedAlbumIds.size} photo{selectedAlbumIds.size !== 1 ? 's' : ''} selected</Text>
              <Pressable onPress={() => setSelectedAlbumIds(new Set())} hitSlop={8}>
                <Text style={styles.actionBarClearText}>Clear</Text>
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
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={16} color="#FFF" />
                  )}
                  <Text style={styles.actionBarBtnText}>
                    {downloadingBatch ? (batchProgress || 'Saving…') : `Download ${selectedPurchased.length}`}
                  </Text>
                </Pressable>
              )}
              {selectedUnpurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAlbumBulkBuy}
                >
                  <Ionicons name="card-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBarBtnText}>
                    Buy {selectedUnpurchased.length} · {albumCurrencyAbbr}{' '}
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
        <Text style={styles.albumBadgeText}>FREE ALBUM</Text>
      </View>
      {freeTitle ? <Text style={styles.albumTitle}>{freeTitle}</Text> : null}
      {freePhotographer ? (
        <Text style={styles.albumSub}>
          by <Text style={{ color: colors.text, fontWeight: '700' }}>{freePhotographer}</Text>
        </Text>
      ) : null}
      <Text style={[styles.subLead, { marginTop: 16, marginBottom: 24 }]}>
        This album requires email verification to view your photos.
      </Text>

      <TextInput
        placeholder="Enter your email address"
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
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.accessBtnText}>Request Access</Text>}
      </Pressable>

      <Pressable
        style={{ marginTop: 16 }}
        onPress={() => { setFreeFlow('idle'); setFreeError(''); }}
      >
        <Text style={styles.ghostLink}>← Back to invite code</Text>
      </Pressable>
    </View>
  );

  // ─── Render: Free album OTP screen ───────────────────────────────────────

  const renderFreeOtp = () => (
    <View style={styles.freeCard}>
      <Text style={styles.albumTitle}>Enter Verification Code</Text>
      <Text style={[styles.subLead, { marginVertical: 12 }]}>
        We sent a 6-digit code to{'\n'}
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
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.accessBtnText}>Verify</Text>}
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 16 }}>
        Didn't receive it?{' '}
        <Text
          style={{ color: colors.primary, textDecorationLine: 'underline' }}
          onPress={handleFreeResend}
        >
          Resend
        </Text>
      </Text>

      <Pressable
        style={{ marginTop: 12 }}
        onPress={() => { setFreeFlow('email'); setFreeOtp(''); setFreeError(''); }}
      >
        <Text style={styles.ghostLink}>← Change email</Text>
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
            <Text style={styles.albumBadgeText}>FREE ALBUM</Text>
          </View>
          <Text style={styles.albumTitle}>{freeTitle}</Text>
          {freePhotographer ? (
            <Text style={styles.albumSub}>
              by <Text style={{ color: '#fff', fontWeight: '700' }}>{freePhotographer}</Text>
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

          <Text style={styles.albumCount}>{freePhotos.length} photo{freePhotos.length !== 1 ? 's' : ''}</Text>
          <Text style={styles.albumHint}>Tap photos to select · Long-press to report</Text>

          {!isCapped && freePhotos.length > 1 && selectedFreeIds.size < freePhotos.length && (
            <Pressable
              style={styles.selectAllBtn}
              onPress={() => setSelectedFreeIds(new Set(freePhotos.map((p) => p.id)))}
            >
              <Ionicons name="checkmark-done-outline" size={14} color="#fff" />
              <Text style={styles.selectAllBtnText}>Select all</Text>
            </Pressable>
          )}

          {isCapped && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6, lineHeight: 18 }}>
              {freeMaxDownloads !== null && (
                <>Free up to <Text style={{ color: '#fff', fontWeight: '700' }}>{freeMaxDownloads}</Text> new photo{freeMaxDownloads !== 1 ? 's' : ''}.</>
              )}
              {freeAlbumPricePerExtra > 0 && (
                <> Extras cost <Text style={{ color: '#fff', fontWeight: '700' }}>{freeAlbumCurrencyAbbr || ''} {freeAlbumPricePerExtra}</Text> each.</>
              )}
              {freeAcquiredIds.size > 0 && (
                <> You already own <Text style={{ color: '#fff', fontWeight: '700' }}>{freeAcquiredIds.size}</Text>, free to re-download.</>
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
                  watermarkText={isCapped && !owned ? `PREVIEW · ${freePhotographer || 'PHOTOGRAPHER'}` : undefined}
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
              accessibilityLabel="Load more free photos"
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.loadMoreBtnText}>
                Load More Photos ({displayedFreePhotos.length} of {freePhotos.length})
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
                accessibilityLabel="Show all free photos"
              >
                <Text style={styles.showAllPillBtnText}>Show All ({freePhotos.length})</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Bottom action bar */}
        {totalSelected > 0 && (
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing.sm }]}>
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
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name={showPurchase ? 'card-outline' : 'cloud-download-outline'} size={16} color="#FFF" />}
              <Text style={styles.actionBarBtnText}>
                {showPurchase
                  ? `Purchase (${formatPrice(extrasTotal, freeAlbumCurrencyAbbr || undefined)} for ${info.overflow} extra)`
                  : `Download ${downloadableNow}`}
              </Text>
            </Pressable>
            <Pressable onPress={() => setSelectedFreeIds(new Set())}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>Clear</Text>
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
          title="No Matching Photos Found"
          message={
            code.trim()
              ? `We couldn't find your face in album "${code.trim()}". Make sure your face is clearly visible, well-lit, and try again.`
              : "We couldn't find your face in any published galleries. Make sure your face is clearly visible, well-lit, and try again."
          }
          action={{
            label: 'Try Again',
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
        <View style={styles.albumHeader}>
          <View style={styles.albumBadge}>
            <Text style={styles.albumBadgeText}>MATCHES FOUND</Text>
          </View>
          <Text style={styles.albumTitle}>
            {results.length} Photo{results.length !== 1 ? 's' : ''} Found
          </Text>
          <Text style={styles.albumHint}>
            {isSelectionMode
              ? `${selectedResultIds.size} of ${results.length} selected`
              : hasMoreResults
              ? `Showing ${displayedResults.length} of ${results.length} photos · Tap to preview or select`
              : 'Tap a photo to preview, or tap the checkbox to select'}
          </Text>

          {/* Top Actions: Search with another photo & Unlock with code */}
          <View style={styles.resultsActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.resultsActionBtn,
                pressed && styles.resultsActionBtnPressed,
              ]}
              onPress={() => {
                setFaceResults(null);
                setSelfie(null);
                setActiveOption(null);
                setSearchError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Search with Another Photo"
            >
              <Ionicons name="camera-reverse-outline" size={15} color={colors.primary} />
              <Text style={styles.resultsActionBtnText}>Search with Another Photo</Text>
            </Pressable>

            {targetAlbumId ? (
              <Pressable
                style={({ pressed }) => [
                  styles.resultsActionBtn,
                  pressed && styles.resultsActionBtnPressed,
                ]}
                onPress={() => openUnlock(targetAlbumId)}
                accessibilityRole="button"
                accessibilityLabel="Unlock with Code"
              >
                <Ionicons name="key-outline" size={15} color={colors.primary} />
                <Text style={styles.resultsActionBtnText}>Unlock with Code</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Quick Shortcuts: Download All Owned / Select All Unpurchased */}
          {(allPurchased.length > 0 || unpurchasedInResults.length > 0) && (
            <View style={styles.quickShortcutsRow}>
              {allPurchased.length > 0 && (
                <Pressable
                  style={styles.batchDownloadBtn}
                  onPress={() => handleBatchDownload(allPurchased)}
                  disabled={downloadingBatch}
                >
                  {downloadingBatch ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={15} color="#FFF" />
                  )}
                  <Text style={styles.batchDownloadBtnText}>
                    {downloadingBatch
                      ? (batchProgress || 'Downloading…')
                      : `Download All Owned (${allPurchased.length})`}
                  </Text>
                </Pressable>
              )}

              {unpurchasedInResults.length > 0 && (
                <Pressable
                  style={styles.shortcutBtn}
                  onPress={() => {
                    if (selectedResultIds.size === unpurchasedInResults.length) {
                      setSelectedResultIds(new Set());
                    } else {
                      setSelectedResultIds(new Set(unpurchasedInResults.map((p) => p.id as string)));
                    }
                  }}
                >
                  <Ionicons
                    name={
                      selectedResultIds.size === unpurchasedInResults.length
                        ? 'close-circle-outline'
                        : 'checkbox-outline'
                    }
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={styles.shortcutBtnText}>
                    {selectedResultIds.size === unpurchasedInResults.length
                      ? 'Deselect All'
                      : `Select All (${unpurchasedInResults.length})`}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

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
              accessibilityLabel="Load more photos"
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.loadMoreBtnText}>
                Load More Photos ({displayedResults.length} of {results.length})
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
                accessibilityLabel="Show all photos"
              >
                <Text style={styles.showAllPillBtnText}>Show All ({results.length})</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Selection bar */}
        {isSelectionMode && (
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing.sm }]}>
            <View style={styles.actionBarTopRow}>
              <Text style={styles.actionBarCount}>
                {selectedResultIds.size} photo{selectedResultIds.size !== 1 ? 's' : ''} selected
              </Text>
              <Pressable onPress={() => setSelectedResultIds(new Set())} hitSlop={8}>
                <Text style={styles.actionBarClearText}>Clear</Text>
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
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={16} color="#FFF" />
                  )}
                  <Text style={styles.actionBarBtnText}>
                    {downloadingBatch ? (batchProgress || 'Saving…') : `Download ${selectedPurchased.length}`}
                  </Text>
                </Pressable>
              )}
              {selectedUnpurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: colors.primary }]}
                  onPress={handleResultBulkBuy}
                >
                  <Ionicons name="card-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBarBtnText}>
                    Buy {selectedUnpurchased.length}
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

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
            accessibilityLabel={showFaceResults || showAlbum || showFreeFlow ? 'Back' : 'Go back'}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.topBarPillCenter}>
            <Text style={styles.topBarPillText}>Find My Photos</Text>
          </View>

          <View style={styles.topBarSpacer} />
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
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
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
          {showConnect && renderConnect()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Clean Customized No Matches Modal ── */}
      <Modal
        visible={noMatchesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNoMatchesOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setNoMatchesOpen(false)}
        >
          <Pressable
            style={[styles.modalContent, styles.customModalCard]}
            onPress={(e) => e.stopPropagation()}
          >
            <Pressable
              onPress={() => setNoMatchesOpen(false)}
              style={({ pressed }) => [styles.customModalClose, pressed && styles.customModalClosePressed]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.customModalIconWrap}>
              <Ionicons name="search-outline" size={28} color={colors.primary} />
            </View>

            <Text style={styles.customModalTitle}>No Photos Found</Text>

            <Text style={styles.customModalMessage}>
              We couldn&apos;t find any photos matching your selfie. Please try again with another photo or different lighting.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.customModalBtn,
                pressed && styles.customModalBtnPressed,
              ]}
              onPress={() => setNoMatchesOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Try Again"
            >
              <Text style={styles.customModalBtnText}>Try Again</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Unlock Modal ── */}
      <Modal visible={unlockOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { marginTop: 'auto', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderRadius: 0 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Unlock Photos</Text>
              <Pressable onPress={() => setUnlockOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Enter the email address you purchased with, or the unlock code from your receipt email.
            </Text>
            <TextInput
              placeholder="Email or Unlock Code"
              value={unlockIdentifier}
              onChangeText={setUnlockIdentifier}
              autoCapitalize="none"
              style={styles.modalInput}
              placeholderTextColor="#94A3B8"
            />
            {unlockError ? <Text style={styles.errorText}>{unlockError}</Text> : null}
            <Button
              title="Unlock & Download"
              onPress={handleUnlock}
              loading={unlocking}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setUnlockOpen(false)}
              style={{ marginTop: spacing.xs }}
            />
          </View>
        </View>
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
                accessibilityLabel="Report photo"
                hitSlop={8}
              >
                <Ionicons name="flag-outline" size={20} color="#FFF" />
              </Pressable>
              <Pressable
                onPress={() => setPreviewPhoto(null)}
                style={styles.lightboxIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Close preview"
                hitSlop={8}
              >
                <Ionicons name="close" size={26} color="#FFF" />
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
                    <Text style={styles.lightboxOwnedText}>OWNED · FULL RESOLUTION</Text>
                  </View>
                )}
              </View>
            )}

            {/* Lightbox Footer with Title, Photographer & Actions */}
            {previewPhoto && (
              <View style={styles.lightboxFooter}>
                <View style={{ gap: 2 }}>
                  <Text style={styles.lightboxTitle} numberOfLines={1}>
                    {(previewPhoto as FoundPhoto).eventTitle || albumTitle || 'Photo Preview'}
                  </Text>
                  <Text style={styles.lightboxPhotographer}>
                    by{' '}
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {(previewPhoto as FoundPhoto).photographerName ||
                        albumPhotographerName ||
                        'Photographer'}
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
                      <Ionicons name="cloud-download-outline" size={18} color="#FFF" />
                      <Text style={styles.lbBtnText}>Download High-Res</Text>
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
                      <Ionicons name="cloud-download-outline" size={18} color="#FFF" />
                      <Text style={styles.lbBtnText}>Download Free</Text>
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
                          color="#FFF"
                        />
                        <Text style={styles.lbBtnText}>
                          {selectedAlbumIds.has(previewPhoto.id as string) ||
                          selectedResultIds.has(previewPhoto.id as string)
                            ? 'Selected'
                            : 'Select'}
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
                          <Ionicons name="card-outline" size={18} color="#FFF" />
                          <Text style={styles.lbBtnText}>
                            Buy ·{' '}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles((c, e) => ({
  // Top bar in head — full-width rounded bar
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: c.background,
  },
  topBarPill: {
    width: '100%',
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    ...e(2),
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
    color: c.primary,
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
  badgeText: { color: c.primary, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontWeight: fontWeight.extrabold, color: c.primary, marginBottom: 6, textAlign: 'center', lineHeight: 32 },
  lead: { fontSize: 14, color: c.textMuted, lineHeight: 20, textAlign: 'center', paddingHorizontal: spacing.sm },
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
  selfieReadyText: { color: '#10B981', fontSize: 12.5, fontWeight: fontWeight.bold },
  changeSelfieBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radii.full, borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  changeSelfieBtnText: { color: c.text, fontSize: 13, fontWeight: fontWeight.semibold },

  // Pick options
  webPickOptions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  webPickCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    ...e(1),
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

  error: { color: '#EF4444', textAlign: 'center', marginTop: spacing.xs, fontSize: 12 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg, gap: spacing.md },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: c.border, borderRadius: radii.full },
  dividerText: { color: c.textSoft, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1.2, textTransform: 'uppercase' },

  inviteHeading: { fontSize: 16, fontWeight: fontWeight.bold, color: c.text, marginBottom: 4, textAlign: 'center' },
  inviteSubText: { fontSize: 13, color: c.textMuted, lineHeight: 18, textAlign: 'center', marginBottom: 12 },

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
    borderColor: '#FFF',
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
    color: '#FFF',
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
    color: '#FFF',
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
    color: '#FFF',
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
  lockPrice: { color: '#FFF', fontSize: 11, fontWeight: '700' },
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
  captionText: { color: '#FFF', fontSize: 11, fontWeight: '500' },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    ...e(4),
  },
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
  actionBarBtnText: { color: '#FFF', fontSize: 14, fontWeight: fontWeight.bold },

  ghostLink: { color: c.textMuted, fontSize: 14, fontWeight: '500' },

  // Album scan + filter buttons
  albumActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  scanInAlbumBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.full, backgroundColor: c.primary,
  },
  scanInAlbumBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50, backgroundColor: c.surfaceMuted,
    borderWidth: 1, borderColor: c.border,
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
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
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
    backgroundColor: c.card,
    borderRadius: 24,
    padding: spacing.xl,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    ...e(2),
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
  otpBoxError: { borderColor: '#EF4444' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: c.elevated,
    borderRadius: 24,
    padding: spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: c.border,
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
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
    color: c.text,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: spacing.sm },

  // Clean customized modal
  customModalCard: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg + 4,
    paddingHorizontal: spacing.xl,
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.elevated,
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
    backgroundColor: c.surfaceMuted,
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
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    ...e(1),
  },
  batchDownloadBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    ...e(1),
  },
  shortcutBtnText: {
    color: c.text,
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },

  resultsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  resultsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.tint,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  resultsActionBtnPressed: {
    opacity: 0.7,
  },
  resultsActionBtnText: {
    color: c.primary,
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
    color: '#FFF',
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
    color: '#FFF',
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
    backgroundColor: '#10B981',
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
    color: '#FFF',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingProgressText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
}));
