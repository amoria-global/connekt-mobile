/**
 * Public "join package" selector.
 *
 * Web parity: knockout/app/pages/events/join-package.tsx
 *
 * Matches the web flow 1:1:
 *   1. Pick Individual or Group (with a viewer count stepper).
 *   2. Total card (shows 10% group discount preview — backend reconfirms).
 *   3. On Continue → /events/pay?id=…&package=…&people=…
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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80';

type Pkg = 'individual' | 'group';

type SavedGroupCode = {
  code: string;
  expiresAt?: string;
  people: number;
  refid: string;
  remainingInvites: number;
};

function feeLabel(fee: number, code: string | null | undefined, symbol?: string | null): string {
  if (!fee || fee <= 0) return 'Free';
  return `${fee.toLocaleString()} ${symbol || code || 'RWF'}`;
}

function isExpired(isoDate?: string): boolean {
  if (!isoDate) return false;
  return new Date(isoDate).getTime() < Date.now();
}

export default function JoinPackageScreen() {
  const { id, codeReady } = useLocalSearchParams<{ id: string; codeReady?: string }>();
  const router = useRouter();
  const { data, loading, error } = useAsync(
    useCallback(() => getPublicEventDetailed(id), [id]),
  );

  const [pkg, setPkg] = useState<Pkg>('individual');
  const [people, setPeople] = useState('2');

  // Group code that was generated after a previous payment (auto-show when
  // returning from /events/pay with codeReady=1).
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
      setRedeemError('Please enter the invite code and a display name.');
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
          setRedeemError('This group code has reached its viewer limit.');
        } else if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
          setRedeemError('This group code is no longer valid.');
        } else {
          setRedeemError(msg || 'Could not redeem the code.');
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
      setRedeemError(isApiError(e) ? e.message : 'Could not redeem the code.');
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
          <Text style={styles.muted}>{error ?? 'Could not load this event.'}</Text>
        </View>
      </Screen>
    );
  }

  const peopleNum = Math.max(2, parseInt(people || '2', 10) || 2);
  const perPerson = data.streamFee ?? 0;
  const groupDiscount = data.groupDiscountPercentage ?? 10;
  const total =
    pkg === 'group'
      ? Math.round(perPerson * peopleNum * (1 - groupDiscount / 100))
      : perPerson;
  const totalLabel = feeLabel(total, data.streamFeeCurrencyAbbreviation, data.streamFeeCurrencySymbol);

  const onProceed = () => {
    if (!digitalPurchasesEnabled) return;
    const params = new URLSearchParams({
      id,
      package: pkg,
      people: pkg === 'group' ? String(peopleNum) : '1',
    });
    router.push(`/events/pay?${params.toString()}` as unknown as Href);
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Saved group code (shown after payment returns with code) */}
        {savedCode ? (
          <View style={styles.codeCard}>
            <View style={styles.codeCardHeader}>
              <Ionicons name="ticket" size={20} color={colors.primary} />
              <Text style={styles.codeCardTitle}>Your group invite code</Text>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>{savedCode.code}</Text>
            </View>
            <Text style={styles.codeHint}>
              Share this code with up to {savedCode.remainingInvites} more viewer
              {savedCode.remainingInvites === 1 ? '' : 's'}. Each person enters it on the event
              page to join your group stream.
            </Text>
            {savedCode.expiresAt ? (
              <Text style={styles.codeExpiry}>
                Expires {new Date(savedCode.expiresAt).toLocaleDateString()}
              </Text>
            ) : null}
            <Button
              title="Watch now"
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
            source={{ uri: data.eventPhoto || COVER_FALLBACK }}
            style={styles.previewCover}
            contentFit="cover"
          />
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle} numberOfLines={2}>
              {data.title}
            </Text>
            <Text style={styles.previewMeta}>
              {data.location ?? data.eventOrganizer ?? data.eventCategory?.name ?? 'Connekyt event'}
            </Text>
            <Text style={styles.previewFee}>
              {feeLabel(perPerson, data.streamFeeCurrencyAbbreviation, data.streamFeeCurrencySymbol)} / person
            </Text>
          </View>
        </View>

        {/* Package selection through to the pay button is the purchase funnel;
            on Android it's absent and only the invite-code path below remains. */}
        {!digitalPurchasesEnabled ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Ticketed event</Text>
            <Text style={styles.peopleHint}>
              If you already have access, use your invite code below.
            </Text>
          </View>
        ) : null}

        {digitalPurchasesEnabled ? (
        <>
        <Text style={styles.h2}>Choose your package</Text>

        {/* Individual */}
        <Pressable
          style={[styles.opt, pkg === 'individual' && styles.optActive]}
          onPress={() => setPkg('individual')}
        >
          <View style={[styles.radio, pkg === 'individual' && styles.radioActive]}>
            {pkg === 'individual' ? <View style={styles.radioInner} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optTitle}>Individual</Text>
            <Text style={styles.optHint}>Single viewer access for one device.</Text>
          </View>
          <Ionicons name="person" size={22} color={colors.primary} />
        </Pressable>

        {/* Group */}
        <Pressable
          style={[styles.opt, pkg === 'group' && styles.optActive]}
          onPress={() => setPkg('group')}
        >
          <View style={[styles.radio, pkg === 'group' && styles.radioActive]}>
            {pkg === 'group' ? <View style={styles.radioInner} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optTitle}>
              Group
              {groupDiscount > 0 ? ` · save ${groupDiscount}%` : ''}
            </Text>
            <Text style={styles.optHint}>
              Get a shareable code for friends or family. Pay once, everyone joins.
            </Text>
          </View>
          <Ionicons name="people" size={22} color={colors.accent} />
        </Pressable>

        {pkg === 'group' ? (
          <View style={styles.peopleCard}>
            <Text style={styles.peopleLabel}>How many viewers?</Text>
            <View style={styles.peopleRow}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setPeople(String(Math.max(2, peopleNum - 1)))}
                disabled={peopleNum <= 2}
              >
                <Ionicons name="remove" size={22} color={colors.primary} />
              </Pressable>
              <TextInput
                value={people}
                onChangeText={(t) => setPeople(t.replace(/[^0-9]/g, ''))}
                style={styles.peopleInput}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Pressable
                style={styles.stepBtn}
                onPress={() => setPeople(String(peopleNum + 1))}
              >
                <Ionicons name="add" size={22} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={styles.peopleHint}>
              Minimum 2 viewers.{groupDiscount > 0 ? ` ${groupDiscount}% off the per-person price applies automatically.` : ''}
            </Text>
          </View>
        ) : null}

        {/* Total card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total to pay</Text>
          <Text style={styles.totalValue}>{totalLabel}</Text>
        </View>

        <Button title="Continue to payment" onPress={onProceed} />
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
            <Text style={styles.redeemToggleText}>Have a group invite code?</Text>
          </Pressable>

          {redeemOpen ? (
            <View style={styles.redeemForm}>
              <Text style={styles.redeemHint}>
                If someone shared a group code with you, enter it below to join their stream
                without paying separately.
              </Text>
              <Input
                placeholder="Invite code"
                value={redeemCode}
                onChangeText={(t) => {
                  setRedeemCode(t);
                  setRedeemError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                placeholder="Your display name"
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
                title={redeemBusy ? 'Joining…' : 'Join with invite code'}
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

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },

  // Saved group code card (shown after payment)
  codeCard: {
    backgroundColor: colors.infoBg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  codeText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  codeHint: { fontSize: fontSize.sm, color: colors.textSoft, lineHeight: 20 },
  codeExpiry: { fontSize: fontSize.xs, color: colors.textMuted },

  // Event preview
  previewCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  previewCover: { width: 96, height: 96, backgroundColor: colors.surfaceMuted },
  previewBody: { flex: 1, padding: spacing.md, gap: 2, justifyContent: 'center' },
  previewTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  previewMeta: { color: colors.textMuted, fontSize: fontSize.xs },
  previewFee: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 4 },

  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },

  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  optActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  optHint: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },

  peopleCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  peopleLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'flex-start' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  peopleInput: {
    minWidth: 64,
    fontSize: fontSize.xl,
    textAlign: 'center',
    color: colors.text,
    fontWeight: fontWeight.bold,
    padding: 0,
  },
  peopleHint: { fontSize: fontSize.xs, color: colors.textMuted },

  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
  },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  totalValue: { color: colors.textOnPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },

  // Redeem section (web parity: invite code input)
  redeemSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  redeemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.lg,
  },
  redeemToggleText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  redeemForm: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  redeemHint: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  redeemErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  redeemErrorText: { flex: 1, color: colors.error, fontSize: fontSize.sm },
});
