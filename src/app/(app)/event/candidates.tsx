/**
 * A posted event's answers: photographers who said yes, grouped as top, good
 * and possible matches, and how everyone else is doing. Same content and
 * order as the web dashboard. Choosing one is re-checked by the server and
 * creates the booking; payment then goes through the shared checkout.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { keepIfSame, useForegroundPolling } from '@/hooks/useForegroundPolling';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { CandidateCard } from '@/features/hybrid/CandidateCard';
import { getPhotographer, type PhotographerPackage } from '@/features/photographers/api';
import { convertToDirectRescue, getHybridOptions, listEventCandidates, selectPhotographer, syncServerClock } from '@/features/hybrid/api';
import type { CandidateSummary, CandidatesResponse } from '@/features/hybrid/types';
import { budgetLabel, CountdownText, hhmm, MODE_META, SMART_TIER_ORDER, SMART_TIER_RANGE, smartTierOf, TIER_META } from '@/features/hybrid/hybridUi';
import { BookingModeSelector } from '@/features/booking/BookingModeSelector';
import { isMatchBooked } from '@/features/hybrid/status';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { formatPrice } from '@/utils/format';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme, onFill } from '@/theme';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { Sheet } from '@/components/ui/Sheet';

/** Cards in a band's row before View more. */
const TIER_ROW = 4;

export default function EventCandidatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; eventId?: string }>();
  const eventId = params.id || params.eventId || '';

  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<CandidateSummary | null>(null);
  const [escrow, setEscrow] = useState(50);
  const [escrowOptions, setEscrowOptions] = useState<number[]>([50, 70, 100]);
  const [detail, setDetail] = useState<CandidateSummary | null>(null);
  const [packagesFor, setPackagesFor] = useState<CandidateSummary | null>(null);
  const [loadedPackages, setLoadedPackages] = useState<{ id: string; list: PhotographerPackage[] } | null>(null);
  const packagesLoading = !!packagesFor && loadedPackages?.id !== packagesFor.photographerId;
  const packages = loadedPackages && packagesFor && loadedPackages.id === packagesFor.photographerId ? loadedPackages.list : [];
  const { width: screenW } = useWindowDimensions();
  // Four across when the screen is wide enough; on a phone the row of four scrolls sideways.
  const rowW = Math.min(screenW, 720) - spacing.lg * 2;
  const cardWidth = rowW >= 560 ? Math.floor((rowW - spacing.sm * 3) / 4) : 148;
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payHandoff, setPayHandoff] = useState<{ declarationId: string; depositAmount?: number; currency?: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const next = await listEventCandidates(eventId);
      setData((prev) => (prev ? keepIfSame(prev, next) : next));
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : t('b3_cand_load_err'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    syncServerClock();
    getHybridOptions()
      .then((o) => {
        if (Array.isArray(o?.escrowOptions) && o.escrowOptions.length) setEscrowOptions(o.escrowOptions);
      })
      .catch(() => {});
    load();
  }, [load]);

  const active = (data?.matchStatus || '').toUpperCase() === 'ACTIVE';
  useEffect(() => {
    if (!packagesFor) return;
    let live = true;
    const id = packagesFor.photographerId;
    getPhotographer(id)
      .then((d) => { if (live) setLoadedPackages({ id, list: d.packages }); })
      .catch(() => { if (live) setLoadedPackages({ id, list: [] }); });
    return () => { live = false; };
  }, [packagesFor]);

  const settled = !!data && !active && (data.candidates.length > 0 || isMatchBooked(data));
  useForegroundPolling(load, 12000, !settled);

  const confirmChoice = async () => {
    if (!choosing) return;
    setSubmitting(true);
    try {
      const res = await selectPhotographer(eventId, {
        candidateId: choosing.candidateId,
        photographerId: choosing.photographerId,
        escrowPercentage: escrow,
      });
      setPayHandoff({ declarationId: res.declarationId, depositAmount: res.depositAmount, currency: res.currency, name: choosing.name });
      setChoosing(null);
      if (res.declarationId) setCheckoutOpen(true);
      else router.replace(`/event/${eventId}` as never);
    } catch (e) {
      setChoosing(null);
      Alert.alert(t('b3_cand_could_not_book'), isApiError(e) ? e.message : t('b3_cand_could_not_confirm'));
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const switchToDirect = async () => {
    setConverting(true);
    try {
      await convertToDirectRescue(eventId);
      router.replace('/photographers' as never);
    } catch (e) {
      Alert.alert(t('b3_cand_could_not_switch'), isApiError(e) ? e.message : t('b3_conv_try_again'));
    } finally {
      setConverting(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/events' as never));
  const candidates = data?.candidates ?? [];
  const budget = budgetLabel(data?.minBudget, data?.maxBudget);

  let content: React.ReactNode;
  if (loading && !data) {
    content = <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />;
  } else if (candidates.length > 0) {
    content = (
      <View style={{ gap: spacing.lg }}>
        {SMART_TIER_ORDER.map((tTier) => {
          const inTier = candidates.filter((c) => smartTierOf(c) === tTier);
          if (inTier.length === 0) return null;
          const open = !!expandedTiers[tTier];
          const meta = TIER_META[tTier];
          const extra = inTier.length - TIER_ROW;
          return (
            <View key={tTier} style={styles.band}>
              <View style={styles.tierHead}>
                <View style={[styles.tierIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={16} color={meta.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierTitle, { color: meta.color }]} accessibilityRole="header">{meta.label.toUpperCase()}</Text>
                  <Text style={styles.hint}>Score {SMART_TIER_RANGE[tTier]} · {inTier.length} accepted</Text>
                </View>
                {extra > 0 ? (
                  <Pressable
                    onPress={() => setExpandedTiers((p) => ({ ...p, [tTier]: !open }))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    style={[styles.tierMore, { borderColor: meta.color }]}
                  >
                    <Text style={[styles.tierMoreText, { color: meta.color }]}>{open ? 'Show less' : `View more (${extra})`}</Text>
                  </Pressable>
                ) : null}
              </View>
              {open ? (
                <View style={styles.bandGrid}>
                  {inTier.map((c) => <CandidateCard key={c.candidateId} candidate={c} width={cardWidth} onOpen={setDetail} />)}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bandRow}>
                  {inTier.slice(0, TIER_ROW).map((c) => <CandidateCard key={c.candidateId} candidate={c} width={cardWidth} onOpen={setDetail} />)}
                </ScrollView>
              )}
            </View>
          );
        })}
        <Text style={styles.hint}>{t('b3_cand_groups_hint')}</Text>
      </View>
    );
  } else if (isMatchBooked(data)) {
    // Someone was chosen: answers are closed because the event is booked, not because matching failed.
    content = (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.successBg }]}><Ionicons name="checkmark" size={30} color={colors.success} /></View>
        <Text style={styles.emptyTitle}>{t('b3_cand_booked_title')}</Text>
        <Text style={[styles.hint, { textAlign: 'center' }]}>{t('b3_cand_booked_hint')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
          {payHandoff?.declarationId ? (
            <Pressable onPress={() => setCheckoutOpen(true)} style={styles.primary} accessibilityRole="button">
              <Text style={styles.primaryText}>{t('b3_cand_pay_first')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.replace(`/event/${eventId}` as never)} style={payHandoff?.declarationId ? styles.secondary : styles.primary} accessibilityRole="button">
            <Text style={payHandoff?.declarationId ? styles.secondaryText : styles.primaryText}>{t('b3_cand_view_event')}</Text>
          </Pressable>
        </View>
      </View>
    );
  } else if (active || !data) {
    content = (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: MODE_META.HYBRID.soft }]}><Ionicons name="radio-outline" size={30} color={MODE_META.HYBRID.color} /></View>
        <Text style={styles.emptyTitle}>{t('b3_cand_waiting_title')}</Text>
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          {data?.pendingCount === 1
            ? t('b3_cand_waiting_one')
            : t('b3_cand_waiting_many', { count: data?.pendingCount ?? 0 })}
        </Text>
      </View>
    );
  } else {
    content = (
      <View style={{ gap: spacing.md }}>
        <View style={styles.warn}>
          <Ionicons name="hourglass-outline" size={18} color={colors.pending} />
          <Text style={[styles.body, { flex: 1 }]}>
            {data.status === 'MATCHING_FAILED' ? t('b3_cand_nobody_fit') : t('b3_cand_matching_ended')} {t('b3_cand_repost_prompt')}
          </Text>
        </View>
        {data.canRepost ? (
          <Pressable onPress={() => setRepostOpen(true)} style={[styles.choice, { borderColor: MODE_META.HYBRID.color, backgroundColor: MODE_META.HYBRID.soft }]} accessibilityRole="button">
            <Ionicons name="radio-outline" size={20} color={MODE_META.HYBRID.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.choiceTitle}>{t('b3_cand_post_again')}</Text>
              <Text style={styles.hint}>{t('b3_cand_repost_hint')}</Text>
            </View>
          </Pressable>
        ) : null}
        {data.canConvertToDirect ? (
          <Pressable onPress={switchToDirect} disabled={converting} style={[styles.choice, { borderColor: MODE_META.DIRECT.color, backgroundColor: MODE_META.DIRECT.soft }]} accessibilityRole="button">
            <Ionicons name="search" size={20} color={MODE_META.DIRECT.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.choiceTitle}>{converting ? t('b3_cand_switching') : t('b3_cand_find_instead')}</Text>
              <Text style={styles.hint}>{t('b3_cand_browse_hint')}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('b3_cand_go_back')}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: MODE_META.HYBRID.color }]}>{t('b3_cand_eyebrow')}</Text>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{data?.eventTitle || t('b3_cand_your_event')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        {data ? (
          <View style={styles.summary}>
            {data.eventDate ? <Text style={styles.body}><Ionicons name="calendar-outline" size={13} /> {data.eventDate}{data.startTime ? ` · ${hhmm(data.startTime)}–${hhmm(data.endTime)}` : ''}{data.durationLabel ? ` · ${data.durationLabel}` : ''}</Text> : null}
            {data.city || data.venue ? <Text style={styles.body}><Ionicons name="location-outline" size={13} /> {data.city || data.venue}</Text> : null}
            {budget ? <Text style={styles.body}><Ionicons name="cash-outline" size={13} /> {budget}</Text> : null}
            <View style={styles.counts}>
              {([
                [candidates.length, t('b3_cand_said_yes'), colors.success],
                [data.pendingCount ?? 0, t('b3_cand_deciding'), colors.info],
                [data.declinedCount ?? 0, t('b3_cand_passed'), colors.textMuted],
                [(data.expiredCount ?? 0) + (data.noLongerAvailableCount ?? 0), t('b3_cand_missed_it'), colors.textMuted],
              ] as [number, string, string][]).map(([n, l, c]) => (
                <Text key={l} style={styles.count}><Text style={{ color: c, fontWeight: fontWeight.extrabold }}>{n}</Text> {l}</Text>
              ))}
            </View>
            {active && data.windowExpiresAt ? (
              <View style={styles.window}>
                <Ionicons name="time-outline" size={13} color={MODE_META.HYBRID.color} />
                <Text style={styles.windowText}>{t('b3_cand_answers_close_in')}</Text>
                <CountdownText to={data.windowExpiresAt} doneText={t('b3_cand_a_moment')} style={styles.windowText} />
              </View>
            ) : null}
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {content}
      </ScrollView>

      <Sheet
        visible={!!detail}
        title={detail?.name ?? ''}
        subtitle={detail ? [detail.primarySpecialty, `${TIER_META[smartTierOf(detail)].label}${detail.matchScore != null ? ` · Score ${detail.matchScore}` : ''}`].filter(Boolean).join(' · ') : undefined}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.detailBox}>
              <Text style={styles.hint}>
                {[detail.photographerType === 'STUDIO' ? 'Company / Studio' : 'Freelancer', detail.distanceLabel || detail.city].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.hint}>
                {detail.deliveryPolicy === 'PHOTOGRAPHER_PACKAGE'
                  ? `Accepted with their own delivery policy${detail.packageDeliveryDays ? ` (${detail.packageDeliveryDays} days)` : ''}`
                  : 'Accepted with your requested delivery schedule'}
              </Text>
            </View>
            <Pressable
              onPress={() => { const cand = detail; setDetail(null); setEscrow(50); setChoosing(cand); }}
              style={styles.primary}
              accessibilityRole="button"
              accessibilityLabel={`Confirm ${detail.name} and pay`}
            >
              <Text style={styles.primaryText}>Confirm and Pay</Text>
            </Pressable>
            <Pressable
              onPress={() => { const id = detail.photographerId; setDetail(null); router.push(`/photographer/${id}?tab=Portfolio` as never); }}
              style={styles.detailAction}
              accessibilityRole="button"
            >
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={styles.detailActionText}>View portfolio</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => { setPackagesFor(detail); setDetail(null); }}
              style={styles.detailAction}
              accessibilityRole="button"
            >
              <Ionicons name="cube-outline" size={18} color={colors.primary} />
              <Text style={styles.detailActionText}>View packages and delivery policy</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!packagesFor}
        title={packagesFor ? `${packagesFor.name}: packages` : ''}
        subtitle={packagesFor?.deliveryPolicy === 'PHOTOGRAPHER_PACKAGE' ? 'Delivery follows their own policy' : 'Delivery follows your requested schedule'}
        onClose={() => setPackagesFor(null)}
        footer={packagesFor ? (
          <Pressable
            onPress={() => { const cand = packagesFor; setPackagesFor(null); setEscrow(50); setChoosing(cand); }}
            style={styles.primary}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Confirm and Pay</Text>
          </Pressable>
        ) : undefined}
      >
        {packagesFor ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.detailBox}>
              <Text style={styles.tierTitle}>DELIVERY POLICY</Text>
              <Text style={styles.detailTitle}>
                {packagesFor.deliveryPolicy === 'PHOTOGRAPHER_PACKAGE' ? 'Photographer\u2019s package policy' : 'Your requested schedule'}
              </Text>
              <Text style={styles.hint}>
                {packagesFor.deliveryPolicy === 'PHOTOGRAPHER_PACKAGE'
                  ? `Choosing them updates your event\u2019s digital and print delivery to their package${packagesFor.packageDeliveryDays ? ` (${packagesFor.packageDeliveryDays} days turnaround)` : ''}.${packagesFor.packageDeliveryDescription ? ` ${packagesFor.packageDeliveryDescription}` : ''}`
                  : 'They accepted the delivery timing you asked for. Nothing changes on your event.'}
              </Text>
            </View>
            {packagesFor.matchedPackageName ? (
              <View style={styles.detailBox}>
                <Text style={styles.tierTitle}>MATCHED TO YOUR EVENT</Text>
                <Text style={styles.detailTitle}>{packagesFor.matchedPackageName}</Text>
                <Text style={styles.hint}>
                  {[
                    packagesFor.matchedPackagePrice != null ? formatPrice(packagesFor.matchedPackagePrice, packagesFor.matchedPackageCurrency) : null,
                    packagesFor.matchedPackageHours ? `${packagesFor.matchedPackageHours}h coverage` : null,
                    packagesFor.matchedPackagePhotos ? `${packagesFor.matchedPackagePhotos} photos` : null,
                    packagesFor.matchedPackageVideos ? `${packagesFor.matchedPackageVideos} videos` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ) : null}
            <Text style={styles.tierTitle}>ALL PACKAGES</Text>
            {packagesLoading ? <ActivityIndicator color={colors.primary} /> : null}
            {!packagesLoading && packages.length === 0 ? <Text style={styles.hint}>No other packages are listed yet.</Text> : null}
            {packages.map((pk) => (
              <View key={String(pk.id)} style={[styles.detailAction, pk.id === packagesFor.matchedPackageId && { borderColor: colors.primary }]}>
                <Text style={styles.detailActionText} numberOfLines={2}>{pk.name}</Text>
                {pk.price != null ? <Text style={styles.hint}>{formatPrice(pk.price, pk.currency)}</Text> : null}
              </View>
            ))}
            <Pressable
              onPress={() => { const id = packagesFor.photographerId; setPackagesFor(null); router.push(`/photographer/${id}` as never); }}
              style={styles.detailAction}
              accessibilityRole="button"
            >
              <Ionicons name="person-outline" size={18} color={colors.primary} />
              <Text style={styles.detailActionText}>Open full profile</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </Sheet>

      <Modal visible={!!choosing} transparent animationType="fade" onRequestClose={() => !submitting && setChoosing(null)}>
        <GlassScrim style={styles.scrim} onPress={() => !submitting && setChoosing(null)}>
          <GlassSheetHost style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>{t('b3_cand_book_name', { name: choosing?.name ?? '' })}</Text>
            <Text style={styles.body}>{t('b3_cand_book_body')}</Text>
            {choosing?.deliveryPolicy === 'PHOTOGRAPHER_PACKAGE' ? (
              <View style={styles.policyNoticeBox}>
                <Ionicons name="cube-outline" size={16} color={colors.info} />
                <Text style={styles.policyNoticeText}>
                  This photographer accepted with their package delivery policy. Confirming them will update your event&apos;s digital and print delivery schedule to match their package{choosing.packageDeliveryDays ? ` (${choosing.packageDeliveryDays} days turnaround)` : ''}.
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {escrowOptions.map((p) => (
                <Pressable key={p} onPress={() => setEscrow(p)} accessibilityRole="radio" accessibilityState={{ checked: escrow === p }}
                  style={[styles.escrow, escrow === p && { borderColor: colors.primary, backgroundColor: colors.tint }]}>
                  <Text style={styles.escrowPct}>{p}%</Text>
                  <Text style={styles.hint}>{p === 100 ? t('b3_cand_pay_full') : t('b3_cand_now_rest_later')}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}><Ionicons name="shield-checkmark" size={12} color={colors.success} /> {t('b3_cand_escrow_note')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable onPress={() => setChoosing(null)} disabled={submitting} style={styles.secondary} accessibilityRole="button"><Text style={styles.secondaryText}>{t('b3_conv_cancel')}</Text></Pressable>
              <Pressable onPress={confirmChoice} disabled={submitting} style={styles.primary} accessibilityRole="button">
                {submitting ? <ActivityIndicator color={onFill} /> : <Text style={styles.primaryText}>{t('b3_cand_book_and_pay_pct', { pct: escrow })}</Text>}
              </Pressable>
            </View>
          </GlassSheetHost>
        </GlassScrim>
      </Modal>

      {repostOpen && data ? (
        <BookingModeSelector
          visible={repostOpen}
          onClose={() => { setRepostOpen(false); load(); }}
          existingEvent={{ id: eventId, title: data.eventTitle, eventDate: data.eventDate, startTime: data.startTime, endTime: data.endTime, city: data.city, venue: data.venue }}
        />
      ) : null}

      {payHandoff ? (
        <HandoffCheckoutSheet
          visible={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          handoff={{ type: 'BOOKING_DECLARATION', declarationId: payHandoff.declarationId }}
          title={t('b3_cand_first_payment')}
          subtitle={payHandoff.name}
          amountLabel={typeof payHandoff.depositAmount === 'number' && Number.isFinite(payHandoff.depositAmount) ? formatPrice(payHandoff.depositAmount, payHandoff.currency) : undefined}
          onSettled={() => {
            setCheckoutOpen(false);
            Alert.alert(t('b3_cand_booked_alert_title'), t('b3_cand_booked_alert_msg', { name: payHandoff.name }), [
              { text: t('b3_cand_view_event'), onPress: () => router.replace(`/event/${eventId}` as never) },
            ]);
          }}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  summary: { backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: 6 },
  body: { fontSize: fontSize.sm, color: c.textSoft, lineHeight: 20 },
  hint: { fontSize: fontSize.xs, color: c.textMuted, lineHeight: 17 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  count: { fontSize: fontSize.xs, color: c.textSoft, backgroundColor: c.surfaceMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full, overflow: 'hidden' },
  window: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(242,12,143,0.10)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, marginTop: 4 },
  windowText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.accent },
  detailBox: { gap: 4, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceMuted },
  detailTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
  detailAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: c.border },
  detailActionText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  band: { gap: spacing.sm },
  bandRow: { gap: spacing.sm, paddingRight: spacing.sm },
  bandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tierIcon: { width: 32, height: 32, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  tierMore: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.md, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  tierMoreText: { fontSize: 12, fontWeight: fontWeight.bold },
  tierTitle: { fontSize: 12, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  error: { color: c.error, backgroundColor: c.errorBg, padding: spacing.md, borderRadius: radii.md, fontSize: fontSize.sm },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing['2xl'] },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
  warn: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: c.warningBg },
  choice: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 2, alignItems: 'center' },
  choiceTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: spacing.lg, gap: spacing.md },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  policyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  policyNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: c.textSoft,
  },
  escrow: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radii.md, borderWidth: 2, borderColor: c.border },
  escrowPct: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  primary: { flex: 1.4, minHeight: 50, borderRadius: radii.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: c.textOnPrimary, fontWeight: fontWeight.extrabold, fontSize: fontSize.sm },
  secondary: { flex: 1, minHeight: 50, borderRadius: radii.md, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.textSoft, fontWeight: fontWeight.bold },
}));
