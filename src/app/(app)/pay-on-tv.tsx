/**
 * Pay-on-TV — start paying for a paid stream a Smart TV is trying to open,
 * from the phone, by scanning the TV's QR.
 *
 * The TV shows a QR encoding knockout's pay-to-watch page:
 *   https://connekyt.com/pay-to-watch?eventId=<id>&device=<TV deviceId>
 *
 * The app no longer collects payment details itself — digital purchases run on
 * the web (see features/payments/webCheckout.ts + policy.ts). So this screen:
 *
 *   1. Scans the TV's QR → pulls out `eventId` + `device` (the *TV's*
 *      persisted anonymous-viewer id — NOT this phone's).
 *   2. Shows what's being paid for (title + fee).
 *   3. Opens the web pay-to-watch page for that eventId + TV device, where the
 *      buyer completes identity + payment. Access binds to whichever device
 *      the QR names (the TV), so the TV unlocks itself by polling — the phone
 *      just guides the user back.
 *
 * The one rule that makes this work: the web checkout carries the TV's device
 * id from the QR, never getDeviceId() (this phone). On Android, digital
 * purchases are policy-gated off entirely (digitalPurchasesEnabled).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { getPublicEventDetailed } from '@/features/events/api';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { openWebCheckout, payToWatchUrl } from '@/features/payments/webCheckout';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

/**
 * The TV encodes a full pay-to-watch URL. Pull eventId + device out of it,
 * tolerating either a bare URL or (defensively) a raw JSON payload.
 */
function extractTarget(scanned: string): { eventId: string; device: string } | null {
  const raw = scanned.trim();
  try {
    const url = new URL(raw);
    const eventId = url.searchParams.get('eventId');
    const device = url.searchParams.get('device');
    if (eventId && device) return { eventId, device };
  } catch {
    // Not a URL — fall through to a regex sweep.
  }
  const eventId = /[?&]eventId=([^&\s]+)/.exec(raw)?.[1];
  const device = /[?&]device=([^&\s]+)/.exec(raw)?.[1];
  if (eventId && device) {
    return { eventId: decodeURIComponent(eventId), device: decodeURIComponent(device) };
  }
  return null;
}

function feeLabel(fee: number, code?: string | null, symbol?: string | null): string {
  if (!fee || fee <= 0) return 'Free';
  return `${fee.toLocaleString()} ${symbol || code || 'RWF'}`;
}

export default function PayOnTvScreen() {
  const styles = useStyles();
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [target, setTarget] = useState<{ eventId: string; device: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const handledRef = useRef(false);

  const onScanned = useCallback((result: BarcodeScanningResult) => {
    if (handledRef.current) return;
    const parsed = extractTarget(result.data);
    if (!parsed) {
      setScanError("That QR isn't a Connekyt pay-to-watch code. Point at the code your TV shows.");
      return;
    }
    handledRef.current = true;
    setScanError(null);
    setTarget(parsed);
  }, []);

  const rescan = () => {
    handledRef.current = false;
    setScanError(null);
    setTarget(null);
  };

  if (target) {
    return <PayPanel eventId={target.eventId} device={target.device} onBack={rescan} onDone={() => router.back()} />;
  }

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title="Pay on TV" subtitle="Scan the payment QR shown on your TV" />
      {!permission ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Text style={styles.body}>Connekyt needs camera access to scan the QR on your TV.</Text>
          <Button title="Allow camera access" onPress={requestPermission} />
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.frame} pointerEvents="none" />
          {scanError ? (
            <View style={styles.scanErrorBar}>
              <Text style={styles.scanErrorText}>{scanError}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function PayPanel({
  eventId,
  device,
  onBack,
  onDone,
}: {
  eventId: string;
  device: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const styles = useStyles();
  const { colors, gradients } = useTheme();
  const [title, setTitle] = useState<string>('This stream');
  const [fee, setFee] = useState<number>(0);
  const [feeCode, setFeeCode] = useState<string | undefined>();
  const [feeSymbol, setFeeSymbol] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);

  // Load the event summary so the buyer sees what they're paying for.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ev = await getPublicEventDetailed(eventId);
        if (cancelled) return;
        setTitle(ev.title || 'This stream');
        setFee(ev.streamFee ?? 0);
        setFeeCode(ev.streamFeeCurrencyAbbreviation ?? undefined);
        setFeeSymbol(ev.streamFeeCurrencySymbol ?? undefined);
      } catch (e) {
        if (!cancelled) setLoadError(isApiError(e) ? e.message : 'Could not load this stream.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const totalLabel = feeLabel(fee, feeCode, feeSymbol);

  // Payment happens on the web, keyed to the TV's device id (from the QR) so
  // access lands on the TV. The TV polls access-status and unlocks itself.
  const onPayOnWeb = () => {
    if (!digitalPurchasesEnabled) return;
    void openWebCheckout(payToWatchUrl(eventId, device));
    setHandedOff(true);
  };

  if (loading) {
    return (
      <Screen padded={false} edges={['top']} style={styles.wide}>
        <ScreenHeader title="Pay on TV" subtitle="Loading stream…" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (loadError) {
    return (
      <Screen padded={false} edges={['top']} style={styles.wide}>
        <ScreenHeader title="Pay on TV" />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.body}>{loadError}</Text>
          <Button title="Scan again" onPress={onBack} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']} style={styles.wide}>
      <ScreenHeader title="Pay on TV" subtitle="Unlock this stream on your Smart TV" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — brand gradient with the amount as the anchor */}
        <LinearGradient
          colors={[...gradients.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.tvBadge}>
            <Ionicons name="tv" size={13} color="#fff" />
            <Text style={styles.tvBadgeText}>PAYING FOR YOUR TV</Text>
          </View>
          <Text style={styles.heroEvent} numberOfLines={2}>{title}</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmountLabel}>Amount</Text>
            <Text style={styles.heroAmount}>{totalLabel}</Text>
          </View>
        </LinearGradient>

        {handedOff ? (
          <View style={[styles.statusBox, styles.statusOk]}>
            <Ionicons name="tv-outline" size={22} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>
              Finish the payment in the page that opened. Once it&apos;s confirmed, your TV
              unlocks on its own — this can take a few seconds. You can close this screen.
            </Text>
          </View>
        ) : digitalPurchasesEnabled ? (
          <>
            <View style={styles.steps}>
              <Step icon="qr-code-outline" text="Scanned the code your TV is showing." done />
              <Step icon="card-outline" text="Complete payment securely on connekyt.com." />
              <Step icon="tv-outline" text="Your TV unlocks automatically once paid." />
            </View>
          </>
        ) : (
          // Digital purchases are policy-gated off in the app on both stores.
          // Say what isn't possible here and stop. Naming where else to buy is
          // the steering both stores prohibit, so this copy must not do it.
          <View style={styles.statusBox}>
            <Ionicons name="information-circle" size={22} color={colors.textMuted} />
            <Text style={styles.statusText}>
              Paid streams can&apos;t be purchased in the app. If you already have an
              invite code, you can enter it on your TV.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky action bar */}
      <View style={styles.footer}>
        {handedOff ? (
          <Button title="Done" onPress={onDone} />
        ) : digitalPurchasesEnabled ? (
          <Button title={`Pay ${totalLabel} on connekyt.com`} onPress={onPayOnWeb} />
        ) : (
          <Button title="Close" onPress={onDone} />
        )}
        <Pressable onPress={onBack} style={styles.rescanLink} hitSlop={8}>
          <Ionicons name="qr-code-outline" size={15} color={colors.textMuted} />
          <Text style={styles.rescanText}>Scan a different TV</Text>
        </Pressable>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
          <Text style={styles.note}>Payment is completed securely on connekyt.com</Text>
        </View>
      </View>
    </Screen>
  );
}

function Step({ icon, text, done }: { icon: keyof typeof Ionicons.glyphMap; text: string; done?: boolean }) {
  const styles = useStyles();
  const { colors, gradients } = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepIcon, done && styles.stepIconDone]}>
        <Ionicons name={done ? 'checkmark' : icon} size={16} color={done ? '#fff' : colors.primary} />
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: '#0F1217',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 3,
} as const;

const useStyles = makeStyles((c) => ({
  // Widen this screen past the app-wide 520px phone clamp so it reads as a
  // proper modal on web / tablet. On phones it's a no-op.
  wide: { width: '100%', maxWidth: 640, alignSelf: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  body: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center', lineHeight: 20 },

  // ── Scanner ──
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  frame: {
    position: 'absolute',
    top: '24%',
    left: '14%',
    right: '14%',
    bottom: '34%',
    borderWidth: 3,
    borderColor: c.accent,
    borderRadius: radii['2xl'],
  },
  scanErrorBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  scanErrorText: { fontFamily: fonts.regular, color: '#fff', fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },

  // ── Pay panel ──
  scroll: { padding: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },

  hero: { borderRadius: radii['2xl'], padding: spacing.xl, gap: spacing.sm, ...CARD_SHADOW },
  tvBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tvBadgeText: { fontFamily: fonts.bold, color: '#fff', fontSize: 10.5, letterSpacing: 1 },
  heroEvent: { fontFamily: fonts.bold, color: '#fff', fontSize: fontSize.xl, letterSpacing: -0.4, marginTop: 2 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.sm },
  heroAmountLabel: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, marginBottom: 5 },
  heroAmount: { fontFamily: fonts.bold, color: '#fff', fontSize: 34, letterSpacing: -1 },

  // ── Steps ──
  steps: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconDone: { backgroundColor: c.success },
  stepText: { flex: 1, fontFamily: fonts.regular, color: c.textSoft, fontSize: fontSize.sm, lineHeight: 20 },

  statusBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: c.infoBg, borderRadius: radii.lg },
  statusOk: { backgroundColor: c.successBg },
  statusText: { flex: 1, fontFamily: fonts.regular, color: c.textSoft, fontSize: fontSize.sm, lineHeight: 19 },

  // ── Sticky footer ──
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  rescanLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 2 },
  rescanText: { fontFamily: fonts.bold, color: c.textMuted, fontSize: fontSize.sm },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  note: { fontFamily: fonts.regular, textAlign: 'center', color: c.textMuted, fontSize: 11 },
}));
