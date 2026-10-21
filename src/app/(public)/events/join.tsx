/**
 * Public "join package" selector.
 *
 * Web parity: knockout/app/pages/events/join-package.tsx
 *
 * Purchases now happen on the web: instead of the old in-app package
 * selection + payment funnel, the screen shows the per-person fee and a
 * single (policy-gated) "Buy access on connekyt.com" button that opens
 * the web join-package page. On Android nothing purchasable is shown.
 *
 * NEW (web parity additions):
 *   • "Have a group invite code?" redeem section below the package picker.
 *     Viewers who received a shared group link can paste the code here and
 *     jump straight to the live stream without paying individually.
 *     → POST /public/streams/{id}/redeem-group-code
 *
 *   • After a successful GROUP payment: the pay screen calls
 *     generateGroupAccess, saves {code, expiresAt, people, refid} to
 *     storage under `groupCode_{id}`, and returns here with ?codeReady=1.
 *     We surface the code card + an email-invite input (web parity:
 *     the group code modal that opens after payment).
 */
import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { openWebCheckout, streamAccessUrl } from '@/features/payments/webCheckout';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { redeemGroupCode } from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import { storage } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { formatPrice } from '@/utils/format';
import { useLanguage } from '@/store/language';
import { useStackClearance } from '@/hooks/useScrollClearance';


type SavedGroupCode = {
  code: string;
  expiresAt?: string;
  people: number;
  refid: string;
  remainingInvites: number;
};

function feeLabel(
  fee: number,
  code: string | null | undefined,
  t: ReturnType<typeof useLanguage.getState>['t'],
  symbol?: string | null,
): string {
  if (!fee || fee <= 0) return t('b4_priceFree');
  return formatPrice(fee, code || 'RWF');
}

function isExpired(isoDate?: string): boolean {
  if (!isoDate) return false;
  return new Date(isoDate).getTime() < Date.now();
}

export default function JoinPackageScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useStackClearance();
  const { id, codeReady } = useLocalSearchParams<{ id: string; codeReady?: string }>();
  const router = useRouter();
  const { data, loading, error } = useAsync(
    useCallback(() => getPublicEventDetailed(id), [id]),
  );

  // Group code that was generated after a previous (pre-web-checkout)
  // payment — still surfaced from storage so paid group owners keep their
  // code. codeReady=1 is legacy deep-link support.
  const [savedCode, setSavedCode] = useState<SavedGroupCode | null>(null);
  useEffect(() => {
    storage
      .get(`groupCode_${id}`)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw) as SavedGroupCode;
          if (!isExpired(d.expiresAt)) setSavedCode(d);
          else storage.remove(`groupCode_${id}`).catch(() => {});
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, [id, codeReady]);

  // Redeem section — for viewers who received a group invite link
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemUsername, setRedeemUsername] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const onRedeem = async () => {
    if (!redeemCode.trim() || !redeemUsername.trim()) {
      setRedeemError(t('b4_joinEnterCodeAndName'));
      return;
    }
    setRedeemBusy(true);
    setRedeemError(null);
    try {
      const fingerprint = await getDeviceId();
      const res = await redeemGroupCode(id, {
        inviteCode: redeemCode.trim(),
        viewerUsername: redeemUsername.trim() || fingerprint,
      });
      if (!res.ok) {
        const msg = res.message ?? '';
        if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('full')) {
          setRedeemError(t('b4_joinCodeLimitReached'));
        } else if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
          setRedeemError(t('b4_joinCodeExpired'));
        } else {
          setRedeemError(msg || t('b4_couldNotRedeemCode'));
        }
        return;
      }
      if (res.viewerId) {
        await storage.set(`anonymousViewer_${id}`, res.viewerId).catch(() => {});
      }
      router.replace(
        `/events/live-stream?id=${id}${res.viewerId ? `&viewerId=${res.viewerId}` : ''}` as unknown as Href,
      );
    } catch (e) {
      setRedeemError(isApiError(e) ? e.message : t('b4_couldNotRedeemCode'));
    } finally {
      setRedeemBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error ?? t('b4_couldNotLoadEvent')}</Text>
        </View>
      </Screen>
    );
  }

  const perPerson = data.streamFee ?? 0;
  const perPersonLabel = feeLabel(
    perPerson,
    data.streamFeeCurrencyAbbreviation,
    t,
    data.streamFeeCurrencySymbol,
  );

  // Purchase happens in the app (events/pay), gated by the policy flag below.
  const onBuy = () => {
    if (!digitalPurchasesEnabled) return;
    router.push(`/(public)/events/pay?id=${id}` as unknown as Href);
  };

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: clearance }]}>
        {/* Saved group code (shown after payment returns with code) */}
        {savedCode ? (
          <View style={styles.codeCard}>
            <View style={styles.codeCardHeader}>
              <Ionicons name="ticket" size={20} color={colors.primary} />
              <Text style={styles.codeCardTitle}>{t('b4_yourGroupInviteCode')}</Text>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>{savedCode.code}</Text>
            </View>
            <Text style={styles.codeHint}>
              {savedCode.remainingInvites === 1
                ? t('b4_shareGroupCodeHintSingular', { count: savedCode.remainingInvites })
                : t('b4_shareGroupCodeHintPlural', { count: savedCode.remainingInvites })}
            </Text>
            {savedCode.expiresAt ? (
              <Text style={styles.codeExpiry}>
                {t('b4_expiresDate', { date: new Date(savedCode.expiresAt).toLocaleDateString() })}
              </Text>
            ) : null}
            <Button
              title={t('b4_watchNow')}
              onPress={() =>
                router.replace(
                  `/events/live-stream?id=${id}` as unknown as Href,
                )
              }
            />
          </View>
        ) : null}

        {/* Event preview card */}
        <View style={styles.previewCard}>
          <Image
            source={data.eventPhoto ? { uri: data.eventPhoto } : EVENT_COVER_PLACEHOLDER}
            style={styles.previewCover}
            contentFit="cover"
          />
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle} numberOfLines={2}>
              {data.title}
            </Text>
            <Text style={styles.previewMeta}>
              {data.location ?? data.eventOrganizer ?? data.eventCategory?.name ?? t('b4_connekytEvent')}
            </Text>
            <Text style={styles.previewFee}>
              {t('b4_perPerson', { price: feeLabel(perPerson, data.streamFeeCurrencyAbbreviation, t, data.streamFeeCurrencySymbol) })}
            </Text>
          </View>
        </View>

        {/* The purchase funnel lives on connekyt.com now. On Android it's
            absent entirely and only the invite-code path below remains. */}
        {!digitalPurchasesEnabled ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>{t('b4_ticketedEvent')}</Text>
            <Text style={styles.peopleHint}>
              {t('b4_useInviteCodeBelow')}
            </Text>
          </View>
        ) : null}

        {digitalPurchasesEnabled ? (
          <>
            {/* Fee card */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t('b4_streamAccess')}</Text>
              <Text style={styles.totalValue}>{t('b4_perPerson', { price: perPersonLabel })}</Text>
            </View>

            <Button title={t('b4_ctaBuyAccess')} onPress={onBuy} />
            <Text style={styles.peopleHint}>
              {t('b4_payForYourselfHint')}
            </Text>
            <Button
              title={t('b4_buyGroupPackage')}
              variant="outline"
              onPress={() => void openWebCheckout(streamAccessUrl(id))}
            />
          </>
        ) : null}

        {/* Group invite code redeem section
            Web parity: join-package.tsx invite code input at the bottom.
            Viewers who received a shared code skip payment entirely. */}
        <View style={styles.redeemSection}>
          <Pressable
            style={styles.redeemToggle}
            onPress={() => {
              setRedeemOpen((v) => !v);
              setRedeemError(null);
            }}
          >
            <Ionicons
              name={redeemOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.redeemToggleText}>{t('b4_haveGroupInviteCode')}</Text>
          </Pressable>

          {redeemOpen ? (
            <View style={styles.redeemForm}>
              <Text style={styles.redeemHint}>
                {t('b4_redeemSharedCodeHint')}
              </Text>
              <Input
                placeholder={t('b4_inviteCodePlaceholder')}
                value={redeemCode}
                onChangeText={(t) => {
                  setRedeemCode(t);
                  setRedeemError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                placeholder={t('b4_yourDisplayNamePlaceholder')}
                value={redeemUsername}
                onChangeText={setRedeemUsername}
                autoCapitalize="words"
              />
              {redeemError ? (
                <View style={styles.redeemErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.redeemErrorText}>{redeemError}</Text>
                </View>
              ) : null}
              <Button
                title={redeemBusy ? t('b4_joining') : t('b4_joinWithInviteCode')}
                onPress={onRedeem}
                loading={redeemBusy}
                disabled={!redeemCode.trim() || !redeemUsername.trim() || redeemBusy}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },

  // Saved group code card (shown after payment)
  codeCard: {
    backgroundColor: c.infoBg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.primary,
    padding: spacing.lg,
    gap: spacing.md,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.primary },
  codeBox: {
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  codeText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  codeHint: { fontSize: fontSize.sm, color: c.textSoft, lineHeight: 20 },
  codeExpiry: { fontSize: fontSize.xs, color: c.textMuted },

  // Event preview
  previewCard: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  previewCover: { width: 96, height: 96, backgroundColor: c.surfaceMuted },
  previewBody: { flex: 1, padding: spacing.md, gap: 2, justifyContent: 'center' },
  previewTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  previewMeta: { color: c.textMuted, fontSize: fontSize.xs },
  previewFee: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 4 },

  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },

  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
  optActive: { borderColor: c.primary, backgroundColor: c.infoBg },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: c.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  optTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  optHint: { fontSize: fontSize.sm, color: c.textMuted, marginTop: 2 },

  peopleCard: {
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.sm,
  },
  peopleLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'flex-start' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  peopleInput: {
    minWidth: 64,
    fontSize: fontSize.xl,
    textAlign: 'center',
    color: c.text,
    fontWeight: fontWeight.bold,
    padding: 0,
  },
  peopleHint: { fontSize: fontSize.xs, color: c.textMuted },

  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: c.primary,
    borderRadius: radii.lg,
  },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  totalValue: { color: c.textOnPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },

  // Redeem section (web parity: invite code input)
  redeemSection: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  redeemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.lg,
  },
  redeemToggleText: {
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  redeemForm: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  redeemHint: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
  redeemErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.errorBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  redeemErrorText: { flex: 1, color: c.error, fontSize: fontSize.sm },
}));
