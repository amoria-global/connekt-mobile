import { useState, useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { downloadAsync, cacheDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
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
  identifyAlbumBuyer,
  initiateAlbumPurchase,
  initiateMultiAlbumPurchase,
  recordAlbumPurchase,
  getPublicPaymentStatus,
  getPhotoDownloadUrl,
  type FoundPhoto,
  type AlbumPhotoItem,
  type FreeAlbumPhoto,
  type MultiAlbumPurchaseItem,
} from '@/features/photos/api';
import { pickFromLibrary, takeSelfie, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { colors, spacing, radii } from '@/theme';
import { formatMoney } from '@/utils/format';

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

async function downloadAndShare(url: string, filename: string) {
  try {
    const localUri = (cacheDirectory ?? '') + filename;
    const { uri } = await downloadAsync(url, localUri);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Save photo' });
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  } catch {
    await WebBrowser.openBrowserAsync(url);
  }
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
}) {
  return (
    <Pressable
      style={[
        styles.cell,
        { width: size, height: size },
        selected && styles.cellSelected,
        owned && styles.cellOwned,
      ]}
      onPress={onPress}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      {owned && (
        <View style={[styles.lockOverlay, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
          <View style={[styles.lockBadge, { backgroundColor: 'rgba(16,185,129,0.85)' }]}>
            <Ionicons name="checkmark-circle" size={13} color="#FFF" />
            <Text style={styles.lockPrice}>OWNED</Text>
          </View>
        </View>
      )}
      {locked && !owned && (
        <View style={styles.lockOverlay}>
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={13} color="#FFF" />
            {price != null && price > 0 && (
              <Text style={styles.lockPrice}>{formatMoney(price, currency)}</Text>
            )}
          </View>
        </View>
      )}
      {selected && !owned && (
        <View style={styles.selectedOverlay}>
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={14} color="#FFF" />
          </View>
        </View>
      )}
      {eventTitle ? (
        <View style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={1}>{eventTitle}</Text>
        </View>
      ) : null}
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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // --- Viewer ID ---
  const [viewerId, setViewerId] = useState('anon');
  useEffect(() => { getViewerId().then(setViewerId); }, []);

  // --- Face search ---
  const [selfie, setSelfie] = useState<PickedImage | null>(null);
  const [activeOption, setActiveOption] = useState<'take' | 'upload' | null>(null);
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [faceResults, setFaceResults] = useState<FoundPhoto[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());

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
  }, [searching, scanLineAnim, pulseAnim]);

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
  const freeCapWarnShownRef = useRef(false);
  const freeExtrasInFlightRef = useRef<{ overflowIds: string[]; allSelectedIds: string[] } | null>(null);

  // --- Paid album face filter ---
  const [albumFilteredIds, setAlbumFilteredIds] = useState<Set<string> | null>(null);
  const [albumFaceScanning, setAlbumFaceScanning] = useState(false);

  // --- Buyer details + purchase ---
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [purchaseRefid, setPurchaseRefid] = useState<string | null>(null);
  const [buyerDetailsOpen, setBuyerDetailsOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerDetailsLoading, setBuyerDetailsLoading] = useState(false);
  const [buyerDetailsError, setBuyerDetailsError] = useState<string | null>(null);
  const pendingPhotosRef = useRef<(AlbumPhotoItem | FoundPhoto)[]>([]);
  const pendingAlbumIdRef = useRef('');
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [pollingRefid, setPollingRefid] = useState<string | null>(null);

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

  // ─── Face search ──────────────────────────────────────────────────────────

  const onPick = async (fn: () => Promise<PickedImage | null>, type: 'take' | 'upload') => {
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
    try {
      const res = await faceSearch(img, inviteCode);
      setFaceResults(res);
      setSelectedResultIds(new Set());
    } catch (err) {
      setSearchError(isApiError(err) ? err.message : 'Search failed. Please try again.');
    } finally {
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
      freeCapWarnShownRef.current = false;
      freeExtrasInFlightRef.current = null;
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
    for (const photo of toDownload) {
      await downloadAndShare(photo.url, `photo-${photo.id}.jpg`);
    }
    try { await logFreeAlbumDownload(freeAlbumId, toDownload.map((p) => p.id)); } catch { /* best-effort */ }
    setFreeAcquiredIds((prev) => {
      const next = new Set(prev);
      toDownload.forEach((p) => next.add(p.id));
      return next;
    });
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

    // Overflow but no price — polite block
    if (!(price > 0) || !freeAlbumCurrencyId) {
      setFreeStatusMsg(`You can download at most ${info.cap} new photo(s) for free from this album.`);
      return;
    }

    // First time crossing the cap — confirm before charging
    const extrasTotal = Math.round(price * info.overflow);
    if (!freeCapWarnShownRef.current) {
      freeCapWarnShownRef.current = true;
      Alert.alert(
        'Extra Photos',
        `${info.overflow} photo${info.overflow !== 1 ? 's' : ''} in your selection exceed your free quota.\n\nCost: ${freeAlbumCurrencyAbbr || ''} ${extrasTotal} for ${info.overflow} extra.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { freeCapWarnShownRef.current = false; } },
          { text: 'Continue to Payment', onPress: () => void handleFreeDownload() },
        ]
      );
      return;
    }

    // Proceed with overflow payment
    setFreeDownloading(true);
    setFreeStatusMsg('Identifying you for payment…');
    try {
      const ident = await identifyAlbumBuyer(freeAlbumId, {
        name: freeEmail,
        email: freeEmail,
        phone: '',
      });
      if (!ident.buyerId) throw new Error('Could not identify you. Please retry.');
      setBuyerId(ident.buyerId);

      const overflowIds = info.newPicks.slice(Number.isFinite(info.cap) ? info.cap as number : info.newPicks.length);
      const amount = Math.round(price * overflowIds.length);
      const allSelectedIds = Array.from(selectedFreeIds);
      freeExtrasInFlightRef.current = { overflowIds, allSelectedIds };

      setFreeStatusMsg(`Opening payment for ${overflowIds.length} extra photo${overflowIds.length !== 1 ? 's' : ''}…`);
      const result = await initiateAlbumPurchase({
        albumId: freeAlbumId,
        photoIds: overflowIds,
        buyerId: ident.buyerId,
        amount,
        currencyId: freeAlbumCurrencyId,
      });

      if (!result.paymentUrl) {
        setFreeStatusMsg('Could not get payment link. Please try again.');
        freeExtrasInFlightRef.current = null;
        return;
      }

      await WebBrowser.openBrowserAsync(result.paymentUrl);

      if (result.refid) {
        setPollingRefid(result.refid);
        setFreeStatusMsg('Checking payment status…');
        const delays = [0, 2000, 3000, 5000, 5000, 5000, 10000, 10000, 15000];
        let status: 'success' | 'pending' | 'failed' = 'pending';
        for (const delay of delays) {
          if (delay) await new Promise((r) => setTimeout(r, delay));
          try {
            status = await getPublicPaymentStatus(result.refid);
            if (status !== 'pending') break;
          } catch { /* keep polling */ }
        }
        setPollingRefid(null);

        if (status === 'failed') {
          setFreeStatusMsg('Payment failed or was cancelled.');
          freeExtrasInFlightRef.current = null;
          return;
        }
        if (status === 'pending') {
          setFreeStatusMsg("Payment pending — you'll receive an email when confirmed.");
          freeExtrasInFlightRef.current = null;
          return;
        }

        setFreeStatusMsg('Payment confirmed! Recording purchase…');
        try {
          await recordAlbumPurchase(result.refid, ident.buyerId);
          setPurchaseRefid(result.refid);
          const allIds = freeExtrasInFlightRef.current?.allSelectedIds ?? [];
          freeExtrasInFlightRef.current = null;
          setFreeStatusMsg(`Downloading ${allIds.length} photo${allIds.length !== 1 ? 's' : ''}…`);
          await downloadFreeSelected(allIds);
          setFreeStatusMsg('Done! All your photos are ready.');
          setSelectedFreeIds(new Set());
        } catch {
          setFreeStatusMsg('Purchase recorded but download failed. Please try again.');
        }
      }
    } catch (err) {
      setFreeStatusMsg(isApiError(err) ? err.message : 'Payment could not be started.');
      freeExtrasInFlightRef.current = null;
    } finally {
      setFreeDownloading(false);
    }
  };

  // ─── Purchase flow (paid albums + face-results) ────────────────────────────

  const openPurchaseFor = (photos: (AlbumPhotoItem | FoundPhoto)[], forAlbumId: string) => {
    const payable = photos.filter((p) => !p.isPurchased && (p.price ?? 0) > 0);
    if (!payable.length) {
      setPurchaseNotice('You already own all selected photos.');
      return;
    }
    pendingPhotosRef.current = payable;
    pendingAlbumIdRef.current = forAlbumId;
    setBuyerDetailsError(null);
    setBuyerDetailsOpen(true);
  };

  const handleBuyerDetailsSubmit = async () => {
    const name = buyerName.trim();
    const email = buyerEmail.trim();
    const phone = buyerPhone.trim();
    if (!name) { setBuyerDetailsError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setBuyerDetailsError('Please enter a valid email.'); return; }
    if (!phone || phone.length < 9) { setBuyerDetailsError('Please enter a valid phone number.'); return; }

    const photos = pendingPhotosRef.current;
    const aId = pendingAlbumIdRef.current;
    if (!aId) { setBuyerDetailsError('Missing album info. Please try again.'); return; }

    setBuyerDetailsLoading(true);
    setBuyerDetailsError(null);
    try {
      const res = await identifyAlbumBuyer(aId, { name, email, phone });
      setBuyerId(res.buyerId);
      // Mark any previously-purchased photos
      if (res.purchasedPhotoIds.length) {
        const owned = new Set(res.purchasedPhotoIds);
        setAlbumPhotos((prev) => prev?.map((p) => owned.has(p.id) ? { ...p, isPurchased: true } : p) ?? prev);
        setFaceResults((prev) => prev?.map((p) => owned.has(p.id) ? { ...p, isPurchased: true } : p) ?? prev);
      }
      setBuyerDetailsOpen(false);
      // Now initiate payment
      await proceedToPayment(photos, aId, res.buyerId);
    } catch (err) {
      setBuyerDetailsError(isApiError(err) ? err.message : 'Could not verify details. Try again.');
    } finally {
      setBuyerDetailsLoading(false);
    }
  };

  const proceedToPayment = async (
    photos: (AlbumPhotoItem | FoundPhoto)[],
    aId: string,
    bId: string
  ) => {
    const payable = photos.filter((p) => !p.isPurchased && (p.price ?? 0) > 0);
    if (!payable.length) return;

    // Group payable photos by albumId. A face-scan can match photos across
    // multiple paid albums (different photographers) — each album becomes
    // its own AlbumPurchase row server-side so revenue routes to the right
    // photographer at that gallery's price.
    const groups = new Map<string, MultiAlbumPurchaseItem>();
    const photoAlbumMap: Record<string, string> = {};
    for (const p of payable) {
      const pAlbumId = (p as AlbumPhotoItem).albumId ?? aId;
      const pCurId = (p as AlbumPhotoItem).currencyId ?? albumCurrencyId;
      if (!pCurId) continue;
      const slot = groups.get(pAlbumId) ?? { albumId: pAlbumId, photoIds: [], amount: 0, currencyId: pCurId };
      slot.photoIds.push(p.id as string);
      slot.amount += p.price ?? 0;
      groups.set(pAlbumId, slot);
      photoAlbumMap[p.id as string] = pAlbumId;
    }
    const items = Array.from(groups.values());
    if (!items.length) {
      setPurchaseNotice('Currency info missing. Please try again.');
      return;
    }

    try {
      setPurchaseNotice('Opening payment…');
      const result = items.length > 1
        ? await initiateMultiAlbumPurchase({ items, buyerId: bId })
        : await initiateAlbumPurchase({
            albumId: items[0].albumId,
            photoIds: items[0].photoIds,
            buyerId: bId,
            amount: items[0].amount,
            currencyId: items[0].currencyId,
          });

      if (!result.paymentUrl) {
        setPurchaseNotice('Could not get payment link. Please try again.');
        return;
      }

      await WebBrowser.openBrowserAsync(result.paymentUrl);

      // After browser closes, poll for payment status
      if (result.refid) {
        setPollingRefid(result.refid);
        await pollAndFinalize(result.refid, bId, payable, aId, photoAlbumMap);
      }
    } catch (err) {
      setPurchaseNotice(isApiError(err) ? err.message : 'Payment could not be started.');
    }
  };

  const pollAndFinalize = async (
    refid: string,
    bId: string,
    photos: (AlbumPhotoItem | FoundPhoto)[],
    aId: string,
    photoAlbumMap?: Record<string, string>
  ) => {
    setPurchaseNotice('Checking payment status…');
    // Poll up to ~60 seconds
    const delays = [0, 2000, 3000, 5000, 5000, 5000, 10000, 10000, 15000, 15000];
    let status: 'success' | 'pending' | 'failed' = 'pending';

    for (const delay of delays) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        status = await getPublicPaymentStatus(refid);
        if (status === 'success') break;
        if (status === 'failed') break;
      } catch { /* keep polling */ }
    }

    if (status === 'failed') {
      setPurchaseNotice('Payment failed or was cancelled.');
      setPollingRefid(null);
      return;
    }
    if (status === 'pending') {
      setPurchaseNotice("Payment pending — you'll receive an email when confirmed.");
      setPollingRefid(null);
      return;
    }

    // Payment succeeded
    setPurchaseNotice('Payment confirmed! Recording purchase…');
    try {
      const rec = await recordAlbumPurchase(refid, bId);
      setPurchaseRefid(refid);

      // Mark photos as purchased
      const boughtIds = new Set(photos.map((p) => p.id as string));
      setAlbumPhotos((prev) => prev?.map((p) => boughtIds.has(p.id) ? { ...p, isPurchased: true } : p) ?? prev);
      setFaceResults((prev) => prev?.map((p) => boughtIds.has(p.id) ? { ...p, isPurchased: true } : p) ?? prev);
      setSelectedAlbumIds(new Set());
      setSelectedResultIds(new Set());

      // Auto-download
      setPurchaseNotice('Downloading your photos…');
      for (const photo of photos) {
        const pid = photo.id as string;
        const photoAlbumId = photoAlbumMap?.[pid] ?? aId;
        const downloadUrl = getPhotoDownloadUrl(photoAlbumId, pid, { refid, buyerId: bId });
        await downloadAndShare(downloadUrl, `photo-${pid}.jpg`);
      }

      const msg = rec.unlockCode
        ? `Done! Save your unlock code: ${rec.unlockCode}`
        : 'Done! Your photos are downloading.';
      setPurchaseNotice(msg);
    } catch {
      setPurchaseNotice('Purchase recorded but download failed. Use your email to re-download.');
    } finally {
      setPollingRefid(null);
    }
  };

  const handleDownloadPurchased = async (photo: AlbumPhotoItem | FoundPhoto) => {
    const aId = (photo as AlbumPhotoItem).albumId ?? albumId;
    if (!aId) return;
    const url = getPhotoDownloadUrl(aId, photo.id as string, {
      refid: purchaseRefid ?? undefined,
      buyerId: buyerId ?? undefined,
    });
    await downloadAndShare(url, `photo-${photo.id}.jpg`);
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

  // ─── Album photo press ────────────────────────────────────────────────────

  const handleAlbumPhotoPress = (photo: AlbumPhotoItem) => {
    if (photo.isPurchased) {
      handleDownloadPurchased(photo);
      return;
    }
    if ((photo.price ?? 0) === 0) {
      downloadAndShare(photo.url, `photo-${photo.id}.jpg`);
      return;
    }
    // Toggle selection
    setSelectedAlbumIds((prev) => {
      const next = new Set(prev);
      next.has(photo.id) ? next.delete(photo.id) : next.add(photo.id);
      return next;
    });
  };

  const handleAlbumBulkBuy = () => {
    const chosen = (albumPhotos ?? []).filter((p) => selectedAlbumIds.has(p.id) && !p.isPurchased && (p.price ?? 0) > 0);
    if (!chosen.length) return;
    openPurchaseFor(chosen, albumId);
  };

  // ─── Face result press ────────────────────────────────────────────────────

  const handleResultPhotoPress = (photo: FoundPhoto) => {
    if (photo.isPurchased && photo.albumId) {
      handleDownloadPurchased(photo);
      return;
    }
    if ((photo.price ?? 0) === 0 && photo.url) {
      downloadAndShare(photo.url, `photo-${photo.id}.jpg`);
      return;
    }
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      next.has(photo.id as string) ? next.delete(photo.id as string) : next.add(photo.id as string);
      return next;
    });
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
    <LinearGradient
      colors={['rgba(5,32,71,0.98)', 'rgba(16,62,131,0.95)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.webContainer}
    >
      {/* Badge */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>FACE RECOGNITION</Text>
        </View>
        <Text style={styles.heroTitle}>
          Find <Text style={{ color: '#FF6B6B' }}>Your Photos</Text>
        </Text>
        <Text style={styles.lead}>
          Search for your photos across all events using facial recognition, or use an invite code to access a specific gallery.
        </Text>
      </View>

      {/* Sub-heading */}
      {!selfie && !searching && (
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.subHeading}>Facial Recognition Scan</Text>
          <Text style={styles.subLead}>
            {"Don't have an invite code? Take a selfie or upload your photo and we'll find every photo you appear in."}
          </Text>
        </View>
      )}

      {/* Scanning animation */}
      {searching && selfie ? (
        <View style={styles.scanningWrap}>
          <View style={styles.scanningCircleWrap}>
            <View style={styles.scanningCircle}>
              <Image source={{ uri: selfie.uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={4} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scanLineWrap,
                  { transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 177] }) }] },
                ]}
              >
                <LinearGradient
                  colors={['transparent', '#FF6B6B', '#FFFFFF', '#FF6B6B', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanPulseRing,
                {
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                  transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
                },
              ]}
            />
          </View>
          <Text style={styles.scanningTitle}>Scanning...</Text>
          <Text style={styles.scanningSubText}>Matching your face across event photos</Text>
        </View>

      /* Selfie ready state */
      ) : selfie && !searching ? (
        <View style={styles.selfieReadyWrap}>
          <View style={styles.selfiePreviewCircle}>
            <Image source={{ uri: selfie.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
          <Text style={styles.selfieReadyText}>Photo ready for scan</Text>
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
            style={styles.webPickCard}
            onPress={() => onPick(takeSelfie, 'take')}
          >
            <View style={[styles.webIconWrap, { backgroundColor: 'rgba(255,107,107,0.15)' }]}>
              <Ionicons name="camera-outline" size={26} color="#FF6B6B" />
            </View>
            <Text style={styles.webPickTitle}>Take Selfie</Text>
            <Text style={styles.webPickSub}>Use camera</Text>
          </Pressable>

          <Pressable
            style={styles.webPickCard}
            onPress={() => onPick(pickFromLibrary, 'upload')}
          >
            <View style={[styles.webIconWrap, { backgroundColor: 'rgba(131,180,255,0.15)' }]}>
              <Ionicons name="arrow-up-outline" size={26} color="#83B4FF" />
            </View>
            <Text style={styles.webPickTitle}>Upload Photo</Text>
            <Text style={styles.webPickSub}>From gallery</Text>
          </Pressable>

          <Pressable
            style={styles.webPickCard}
            onPress={() => router.push('/browse-photos')}
          >
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>i</Text>
            </View>
            <View style={[styles.webIconWrap, { backgroundColor: 'rgba(242,12,143,0.15)' }]}>
              <Ionicons name="grid-outline" size={26} color="#F20C8F" />
            </View>
            <Text style={styles.webPickTitle}>Browse Photos</Text>
            <Text style={styles.webPickSub}>Stock library</Text>
          </Pressable>
        </View>
      )}

      {!searching && (
        <Pressable
          style={[
            styles.webFindBtn,
            !selfie && { backgroundColor: 'rgba(255,255,255,0.08)' },
          ]}
          onPress={handleFindMyPhotos}
        >
          <Text style={[styles.webFindBtnText, !selfie && { color: 'rgba(255,255,255,0.35)' }]}>
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
          <Text style={styles.inviteHeading}>Enter Invite Code</Text>
          <Text style={styles.inviteSubText}>
            Received an invite code from your photographer? Enter it to go directly to that event gallery.
          </Text>

          <TextInput
            placeholder="Enter invite code"
            value={code}
            onChangeText={(t) => { setCode(t); setAlbumError(null); }}
            autoCapitalize="characters"
            style={styles.codeInput}
            placeholderTextColor="rgba(255,255,255,0.4)"
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
              ? <ActivityIndicator size="small" color="#052047" />
              : <Text style={styles.accessBtnText}>Access Gallery</Text>}
          </Pressable>

          <View style={styles.inviteFooterHint}>
            <View style={styles.dividerLine} />
            <Text style={styles.inviteFooterText}>
              Your photographer or event owner can share the invite code after the event
            </Text>
            <View style={styles.dividerLine} />
          </View>
        </>
      )}
    </LinearGradient>
  );

  // ─── Render: Paid album grid ──────────────────────────────────────────────

  const renderAlbumGrid = () => {
    const photos = albumPhotos ?? [];
    const displayedPhotos = albumFilteredIds !== null
      ? photos.filter((p) => albumFilteredIds!.has(p.id))
      : photos;
    const selectedUnpurchased = photos.filter(
      (p) => selectedAlbumIds.has(p.id) && !p.isPurchased && (p.price ?? 0) > 0
    );
    const selectedPurchased = photos.filter(
      (p) => selectedAlbumIds.has(p.id) && p.isPurchased
    );

    return (
      <View style={{ flex: 1 }}>
        {/* Album header */}
        <View style={styles.albumHeader}>
          <View style={styles.albumBadge}>
            <Ionicons name="camera" size={11} color="#F20C8F" />
            <Text style={styles.albumBadgeText}>PHOTO ALBUM</Text>
          </View>
          <Text style={styles.albumTitle}>{albumTitle || 'Event Album'}</Text>
          {albumPhotographerName ? (
            <Text style={styles.albumSub}>
              by <Text style={{ color: '#fff', fontWeight: '700' }}>{albumPhotographerName}</Text>
            </Text>
          ) : null}
          <Text style={styles.albumCount}>
            {albumFilteredIds !== null
              ? `${displayedPhotos.length} of ${photos.length} photo${photos.length !== 1 ? 's' : ''} matched`
              : `${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
          </Text>
          <Text style={styles.albumHint}>Tap photos to select · Tap a purchased photo to download</Text>

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
        </View>

        {purchaseNotice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>{purchaseNotice}</Text>
          </View>
        ) : null}

        {pollingRefid ? (
          <View style={styles.noticeBanner}>
            <ActivityIndicator size="small" color="#F20C8F" style={{ marginRight: 8 }} />
            <Text style={styles.noticeText}>Confirming payment…</Text>
          </View>
        ) : null}

        {/* Grid */}
        <FlatList
          data={displayedPhotos}
          keyExtractor={(p) => p.id}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ gap, paddingBottom: selectedAlbumIds.size > 0 ? 120 : 24 }}
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
              onPress={() => handleAlbumPhotoPress(item)}
            />
          )}
        />

        {/* Selection action bar */}
        {selectedAlbumIds.size > 0 && (
          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.actionBarCount}>{selectedAlbumIds.size} selected</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {selectedPurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => selectedPurchased.forEach((p) => handleDownloadPurchased(p))}
                >
                  <Ionicons name="cloud-download-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBarBtnText}>Download {selectedPurchased.length}</Text>
                </Pressable>
              )}
              {selectedUnpurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: '#F20C8F' }]}
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
            <Pressable onPress={() => setSelectedAlbumIds(new Set())}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>Clear</Text>
            </Pressable>
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
          by <Text style={{ color: '#fff', fontWeight: '700' }}>{freePhotographer}</Text>
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
        placeholderTextColor="rgba(255,255,255,0.4)"
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
          ? <ActivityIndicator size="small" color="#052047" />
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
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>{maskEmail(freeEmail)}</Text>
      </Text>

      <OtpInput value={freeOtp} onChange={(v) => { setFreeOtp(v); setFreeError(''); }} error={!!freeError} />

      {freeError ? <Text style={[styles.error, { marginTop: 8 }]}>{freeError}</Text> : null}

      <Pressable
        style={[styles.accessBtn, { marginTop: 20 }, (freeLoading || freeOtp.length < 6) && { opacity: 0.5 }]}
        onPress={handleFreeVerify}
        disabled={freeLoading || freeOtp.length < 6}
      >
        {freeLoading
          ? <ActivityIndicator size="small" color="#052047" />
          : <Text style={styles.accessBtnText}>Verify</Text>}
      </Pressable>

      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
        Didn't receive it?{' '}
        <Text
          style={{ color: '#60A5FA', textDecorationLine: 'underline' }}
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
    const showPurchase = info.overflow > 0 && freeAlbumPricePerExtra > 0;

    return (
      <View style={{ flex: 1 }}>
        {/* Album header */}
        <View style={styles.albumHeader}>
          <View style={styles.albumBadge}>
            <Ionicons name="camera" size={11} color="#F20C8F" />
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
                <> You already own <Text style={{ color: '#fff', fontWeight: '700' }}>{freeAcquiredIds.size}</Text> — free to re-download.</>
              )}
            </Text>
          )}

          {freeStatusMsg ? (
            <Text style={{ color: '#F20C8F', fontSize: 13, marginTop: 8, lineHeight: 18 }}>{freeStatusMsg}</Text>
          ) : null}
        </View>

        {/* Grid */}
        <FlatList
          data={freePhotos}
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
                onPress={() => toggleFreePhoto(item.id)}
              />
            );
          }}
        />

        {/* Bottom action bar */}
        {totalSelected > 0 && (
          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
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
                  ? `Purchase (${freeAlbumCurrencyAbbr || ''} ${extrasTotal} for ${info.overflow} extra)`
                  : `Download ${totalSelected}`}
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
          title="No Matches Found"
          message="We couldn't find you in any event photos. Make sure your face is clearly visible and try again."
          action={{ label: 'Try Again', onPress: () => { setFaceResults(null); setSelfie(null); setActiveOption(null); } }}
        />
      );
    }

    const selectedUnpurchased = results.filter(
      (p) => selectedResultIds.has(p.id as string) && !p.isPurchased && (p.price ?? 0) > 0
    );
    const selectedPurchased = results.filter(
      (p) => selectedResultIds.has(p.id as string) && p.isPurchased
    );

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.albumHeader}>
          <Text style={styles.albumTitle}>{results.length} Match{results.length !== 1 ? 'es' : ''} Found</Text>
          <Text style={styles.albumHint}>Tap photos to select · Purchased photos can be downloaded</Text>
        </View>

        {purchaseNotice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>{purchaseNotice}</Text>
          </View>
        ) : null}

        {pollingRefid ? (
          <View style={styles.noticeBanner}>
            <ActivityIndicator size="small" color="#F20C8F" style={{ marginRight: 8 }} />
            <Text style={styles.noticeText}>Confirming payment…</Text>
          </View>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(p) => p.id as string}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ gap, paddingBottom: selectedResultIds.size > 0 ? 120 : 24 }}
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
              onPress={() => handleResultPhotoPress(item)}
            />
          )}
        />

        {/* Selection bar */}
        {selectedResultIds.size > 0 && (
          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.actionBarCount}>{selectedResultIds.size} selected</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {selectedPurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => selectedPurchased.forEach((p) => handleDownloadPurchased(p))}
                >
                  <Ionicons name="cloud-download-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBarBtnText}>Download {selectedPurchased.length}</Text>
                </Pressable>
              )}
              {selectedUnpurchased.length > 0 && (
                <Pressable
                  style={[styles.actionBarBtn, { backgroundColor: '#F20C8F' }]}
                  onPress={handleResultBulkBuy}
                >
                  <Ionicons name="card-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBarBtnText}>Buy {selectedUnpurchased.length}</Text>
                </Pressable>
              )}
            </View>
            <Pressable onPress={() => setSelectedResultIds(new Set())}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>Clear</Text>
            </Pressable>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
          <Pressable onPress={() => { setFaceResults(null); setSelfie(null); setActiveOption(null); }}>
            <Text style={styles.ghostLink}>Search Again</Text>
          </Pressable>
          {results[0]?.albumId && (
            <Pressable onPress={() => openUnlock(results[0].albumId)}>
              <Text style={styles.ghostLink}>Got an unlock code?</Text>
            </Pressable>
          )}
        </View>
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
    <View style={{ flex: 1, backgroundColor: '#052047' }}>
      <Stack.Screen
        options={{
          title: 'Find My Photos',
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (showFaceResults) { setFaceResults(null); setSelfie(null); }
                else if (showAlbum) { setAlbumPhotos(null); }
                else if (showFreeFlow) { setFreeFlow('idle'); }
                else if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              style={{ marginLeft: 8, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={28} color="#FFF" />
            </Pressable>
          ),
        }}
      />

      <LinearGradient
        colors={['#052047', '#052047', '#103E83']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + spacing.xl,
              paddingBottom: Math.max(insets.bottom + spacing.xl, 100),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {showFreeFlow && freeFlow === 'email' && renderFreeEmail()}
          {showFreeFlow && freeFlow === 'otp' && renderFreeOtp()}
          {showFreeFlow && freeFlow === 'verified' && renderFreeGrid()}
          {showAlbum && renderAlbumGrid()}
          {showFaceResults && renderFaceResults()}
          {showConnect && renderConnect()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Buyer Details Modal ── */}
      <Modal visible={buyerDetailsOpen} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', marginTop: 'auto' }}
          >
            <View style={[styles.modalContent, { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderRadius: 0 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Your Details</Text>
                <Pressable onPress={() => setBuyerDetailsOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <Text style={styles.modalSub}>
                We need your details to link this purchase to you, so you can re-download photos anytime.
              </Text>
              <TextInput
                placeholder="Full name"
                value={buyerName}
                onChangeText={setBuyerName}
                style={styles.modalInput}
                placeholderTextColor="#94A3B8"
              />
              <TextInput
                placeholder="Email address"
                value={buyerEmail}
                onChangeText={setBuyerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.modalInput}
                placeholderTextColor="#94A3B8"
              />
              <TextInput
                placeholder="Phone number"
                value={buyerPhone}
                onChangeText={setBuyerPhone}
                keyboardType="phone-pad"
                style={styles.modalInput}
                placeholderTextColor="#94A3B8"
              />
              {buyerDetailsError ? <Text style={styles.errorText}>{buyerDetailsError}</Text> : null}
              <Button
                title="Continue to Payment"
                onPress={handleBuyerDetailsSubmit}
                loading={buyerDetailsLoading}
                style={{ marginTop: spacing.md }}
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setBuyerDetailsOpen(false)}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          </KeyboardAvoidingView>
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg },

  // Connect screen
  webContainer: {
    borderRadius: 28,
    padding: spacing.xl + 4,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  badgeWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeText: { color: '#FF6B6B', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  heroTitle: { fontFamily: 'PragatiNarrow_700Bold', fontSize: 32, color: '#FFF', marginBottom: spacing.sm, textAlign: 'center', lineHeight: 38 },
  lead: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, textAlign: 'center', marginBottom: spacing.xl },
  subHeading: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 6, marginTop: spacing.sm, textAlign: 'center' },
  subLead: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },

  // Scanning state
  scanningWrap: { alignItems: 'center', marginVertical: spacing.xl },
  scanningCircleWrap: { width: 180, height: 180 },
  scanningCircle: {
    width: 180, height: 180, borderRadius: 90,
    overflow: 'hidden',
    borderWidth: 4, borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  scanLineWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  scanPulseRing: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 94, borderWidth: 3, borderColor: 'rgba(255,107,107,0.5)',
  },
  scanningTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginTop: 12 },
  scanningSubText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 },

  // Selfie ready state
  selfieReadyWrap: { alignItems: 'center', marginBottom: spacing.xl },
  selfiePreviewCircle: {
    width: 120, height: 120, borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3, borderColor: '#FF6B6B',
    marginBottom: 12,
    shadowColor: '#FF6B6B', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  selfieReadyText: { color: '#10B981', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  changeSelfieBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  changeSelfieBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },

  // Pick options
  webPickOptions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  webPickCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
  },
  webIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  webPickTitle: { fontSize: 13, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 2 },
  webPickSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  infoBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(242,12,143,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoBadgeText: { color: '#F20C8F', fontSize: 11, fontWeight: '800', fontStyle: 'italic' },

  webFindBtn: {
    width: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  webFindBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Invite footer hint
  inviteFooterHint: { marginTop: spacing.xl, alignItems: 'center', gap: 10 },
  inviteFooterText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  error: { color: '#EF4444', textAlign: 'center', marginTop: spacing.sm, fontSize: 13 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.4)', paddingHorizontal: spacing.md, fontSize: 13, fontWeight: '600' },

  inviteHeading: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6, textAlign: 'center' },
  inviteSubText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, textAlign: 'center', marginBottom: 16 },

  codeInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  accessBtn: {
    width: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  accessBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

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
    backgroundColor: 'rgba(242,12,143,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.36)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  albumBadgeText: { color: '#F20C8F', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  albumTitle: { fontFamily: 'PragatiNarrow_700Bold', fontSize: 30, color: '#fff', textAlign: 'center', marginBottom: 6, lineHeight: 36 },
  albumSub: { color: 'rgba(255,255,255,0.65)', fontSize: 15, marginBottom: 4, textAlign: 'center' },
  albumCount: { color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 6, fontWeight: '500' },
  albumHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },

  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242,12,143,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.3)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  noticeText: { color: '#F9A8D4', fontSize: 13, flex: 1 },

  // Photo cells
  cell: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: '#F20C8F',
  },
  cellOwned: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(242,12,143,0.15)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: spacing.sm,
  },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#F20C8F',
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
    backgroundColor: 'rgba(5,32,71,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBarCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  actionBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBarBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  ghostLink: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '500' },

  // Album scan + filter buttons
  albumActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  scanInAlbumBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50, backgroundColor: '#FF6B6B',
  },
  scanInAlbumBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  showAllBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
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
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  selectAllBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

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
  webPickCardActive: {},

  // Free album card (email / otp screens)
  freeCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: spacing.xl,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },

  // OTP
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: spacing.sm },
  otpBox: {
    width: 44, height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
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
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: spacing.xl,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  modalSub: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: spacing.lg },
  modalInput: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: spacing.sm },
});
