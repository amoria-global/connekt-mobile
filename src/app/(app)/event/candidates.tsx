/**
 * A posted event's answers: photographers who said yes, grouped as top, good
 * and possible matches, and how everyone else is doing. Same content and
 * order as the web dashboard. Choosing one is re-checked by the server and
 * creates the booking; payment then goes through the shared checkout.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { CandidateCard } from '@/features/hybrid/CandidateCard';
import { convertToDirectRescue, getHybridOptions, listEventCandidates, selectPhotographer, syncServerClock } from '@/features/hybrid/api';
import type { CandidateSummary, CandidatesResponse, RecommendationTier } from '@/features/hybrid/types';
import { budgetLabel, CountdownText, hhmm, MODE_META, TIER_META } from '@/features/hybrid/hybridUi';
import { BookingModeSelector } from '@/features/booking/BookingModeSelector';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { isApiError } from '@/store/auth';
import { formatPrice } from '@/utils/format';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

const TIERS: RecommendationTier[] = ['HIGH', 'MEDIUM', 'LOW'];

export default function EventCandidatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
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
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payHandoff, setPayHandoff] = useState<{ declarationId: string; depositAmount?: number; currency?: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setData(await listEventCandidates(eventId));
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load the photographers who answered.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    syncServerClock();
    getHybridOptions().then((o) => setEscrowOptions(o.escrowOptions)).catch(() => {});
    load();
  }, [load]);

  const active = (data?.matchStatus || '').toUpperCase() === 'ACTIVE';
  useEffect(() => {
    if (data && !active && data.candidates.length > 0) return;
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [active, data, load]);

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
      Alert.alert('Could not book', isApiError(e) ? e.message : 'Could not confirm this photographer. Please try again.');
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
      Alert.alert('Could not switch', isApiError(e) ? e.message : 'Please try again.');
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
        {TIERS.filter((t) => candidates.some((c) => c.recommendationTier === t)).map((t) => (
          <View key={t} style={{ gap: spacing.sm }}>
            <View>
              <Text style={[styles.tierTitle, { color: TIER_META[t].color }]} accessibilityRole="header">{TIER_META[t].label.toUpperCase()}</Text>
              <Text style={styles.hint}>{TIER_META[t].hint}</Text>
            </View>
            {candidates.filter((c) => c.recommendationTier === t).map((c) => (
              <CandidateCard key={c.candidateId} candidate={c}
                onSelect={(cand) => { setEscrow(50); setChoosing(cand); }}
                onViewProfile={(cand) => router.push(`/photographer/${cand.photographerId}` as never)} />
            ))}
          </View>
        ))}
        <Text style={styles.hint}>Groups show how closely each photographer fits your request. They are a recommendation, not a guarantee of quality.</Text>
      </View>
    );
  } else if (active || !data) {
    content = (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: MODE_META.HYBRID.soft }]}><Ionicons name="radio-outline" size={30} color={MODE_META.HYBRID.color} /></View>
        <Text style={styles.emptyTitle}>Waiting for photographers to answer</Text>
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          {data?.pendingCount ?? 0} photographer{data?.pendingCount === 1 ? ' is' : 's are'} deciding now. Anyone who passes is replaced by the next best match. We'll notify you as soon as someone says yes.
        </Text>
      </View>
    );
  } else {
    content = (
      <View style={{ gap: spacing.md }}>
        <View style={styles.warn}>
          <Ionicons name="hourglass-outline" size={18} color="#B45309" />
          <Text style={[styles.body, { flex: 1 }]}>
            {data.status === 'MATCHING_FAILED' ? 'Nobody fit this event when it was posted.' : 'Matching ended without a photographer saying yes.'} Post it again with a wider area or budget, or book one yourself.
          </Text>
        </View>
        {data.canRepost ? (
          <Pressable onPress={() => setRepostOpen(true)} style={[styles.choice, { borderColor: MODE_META.HYBRID.color, backgroundColor: MODE_META.HYBRID.soft }]} accessibilityRole="button">
            <Ionicons name="radio-outline" size={20} color={MODE_META.HYBRID.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.choiceTitle}>Post again</Text>
              <Text style={styles.hint}>Change the area, budget or type and alert photographers again.</Text>
            </View>
          </Pressable>
        ) : null}
        {data.canConvertToDirect ? (
          <Pressable onPress={switchToDirect} disabled={converting} style={[styles.choice, { borderColor: MODE_META.DIRECT.color, backgroundColor: MODE_META.DIRECT.soft }]} accessibilityRole="button">
            <Ionicons name="search" size={20} color={MODE_META.DIRECT.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.choiceTitle}>{converting ? 'Switching…' : 'Find a Photographer instead'}</Text>
              <Text style={styles.hint}>Browse photographers and send a request yourself.</Text>
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
        <Pressable onPress={goBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: MODE_META.HYBRID.color }]}>POST MY EVENT · ANSWERS</Text>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{data?.eventTitle || 'Your event'}</Text>
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
                [candidates.length, 'said yes', '#047857'],
                [data.pendingCount ?? 0, 'deciding', colors.info],
                [data.declinedCount ?? 0, 'passed', colors.textMuted],
                [(data.expiredCount ?? 0) + (data.noLongerAvailableCount ?? 0), 'missed it', colors.textMuted],
              ] as [number, string, string][]).map(([n, l, c]) => (
                <Text key={l} style={styles.count}><Text style={{ color: c, fontWeight: fontWeight.extrabold }}>{n}</Text> {l}</Text>
              ))}
            </View>
            {active && data.windowExpiresAt ? (
              <View style={styles.window}>
                <Ionicons name="time-outline" size={13} color={MODE_META.HYBRID.color} />
                <Text style={styles.windowText}>Answers close in </Text>
                <CountdownText to={data.windowExpiresAt} doneText="a moment" style={styles.windowText} />
              </View>
            ) : null}
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {content}
      </ScrollView>

      <Modal visible={!!choosing} transparent animationType="fade" onRequestClose={() => !submitting && setChoosing(null)}>
        <Pressable style={styles.scrim} onPress={() => !submitting && setChoosing(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Book {choosing?.name}?</Text>
            <Text style={styles.body}>We check they are still free for the whole event, then create your booking. How much do you want to pay now?</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {escrowOptions.map((p) => (
                <Pressable key={p} onPress={() => setEscrow(p)} accessibilityRole="radio" accessibilityState={{ checked: escrow === p }}
                  style={[styles.escrow, escrow === p && { borderColor: colors.primary, backgroundColor: colors.tint }]}>
                  <Text style={styles.escrowPct}>{p}%</Text>
                  <Text style={styles.hint}>{p === 100 ? 'Pay in full' : 'Now, rest later'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}><Ionicons name="shield-checkmark" size={12} color="#047857" /> Held by Connekyt and released by milestones: event day, then delivery.</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable onPress={() => setChoosing(null)} disabled={submitting} style={styles.secondary} accessibilityRole="button"><Text style={styles.secondaryText}>Cancel</Text></Pressable>
              <Pressable onPress={confirmChoice} disabled={submitting} style={styles.primary} accessibilityRole="button">
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Book and pay {escrow}%</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
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
          title="First payment"
          subtitle={payHandoff.name}
          amountLabel={formatPrice(payHandoff.depositAmount ?? 0, payHandoff.currency)}
          onSettled={() => {
            setCheckoutOpen(false);
            Alert.alert('Booked', `${payHandoff.name} is booked. Your payment is held by Connekyt and released by milestones.`, [
              { text: 'View event', onPress: () => router.replace(`/event/${eventId}` as never) },
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
  windowText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#F20C8F' },
  tierTitle: { fontSize: 12, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  error: { color: c.error, backgroundColor: c.errorBg, padding: spacing.md, borderRadius: radii.md, fontSize: fontSize.sm },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing['2xl'] },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
  warn: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: c.warningBg },
  choice: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 2, alignItems: 'center' },
  choiceTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
  scrim: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], padding: spacing.lg, gap: spacing.md },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  escrow: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radii.md, borderWidth: 2, borderColor: c.border },
  escrowPct: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  primary: { flex: 1.4, minHeight: 50, borderRadius: radii.md, backgroundColor: '#F20C8F', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: fontWeight.extrabold, fontSize: fontSize.sm },
  secondary: { flex: 1, minHeight: 50, borderRadius: radii.md, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.textSoft, fontWeight: fontWeight.bold },
}));
