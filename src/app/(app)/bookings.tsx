/**
 * Bookings — Photographer accept/reject queue & Open Opportunities.
 *
 * For Photographers this is the inbox of booking requests from clients,
 * now extended with the Hybrid "Open Opportunities" feed.
 *
 * Clients hit the same endpoint to see their booking requests (the
 * backend filters /bookings by the signed-in user's role internally).
 * Rejected direct bookings offer a 1-tap "Convert to Hybrid Match" rescue.
 *
 * Endpoints (web & backend parity):
 *   GET  /bookings                         → list direct bookings
 *   POST /bookings/{id}/accept             → accept direct booking
 *   POST /bookings/{id}/reject  { reason } → reject direct booking
 *   GET  /photographer/opportunities       → list hybrid leads
 *   POST /opportunities/{id}/approve       → approve hybrid lead
 *   POST /opportunities/{id}/reject        → decline hybrid lead
 *   POST /events/{id}/convert-to-hybrid    → direct decline rescue hook
 */
import { useCallback, useState, useEffect, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { ActionButton, Chip, EmptyNote, ErrorNotice, IconTile, SectionHeader, SegmentedTabs, SkeletonCard, StatusBadge } from '@/features/photographer/kit';
import { StatusBreakdownCard, type BreakdownSegment } from '@/features/client/ClientCharts';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { statusTone } from '@/features/payments/statusBucket';
import { useRole } from '@/features/auth/role';
import { acceptBooking, listBookings, rejectBooking, type Booking } from '@/features/bookings/api';
import {
  listOpportunities,
  getOpportunity,
  approveOpportunity,
  rejectOpportunity,
  convertToHybridRescue,
} from '@/features/hybrid/api';
import type { PhotographerOpportunity } from '@/features/hybrid/types';
import { OpportunityCard } from '@/features/hybrid/OpportunityCard';
import { opportunityFilterFor } from '@/features/hybrid/status';
import { IncomingOpportunityAlertModal } from '@/features/hybrid/IncomingOpportunityAlertModal';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { env } from '@/config/env';
import { useSharedT } from '@/i18n/sharedStrings';

type Tab = 'direct' | 'opportunities';

export default function BookingsScreen() {
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();
  const router = useRouter();
  const { tab, candidate } = useLocalSearchParams<{ tab?: string; candidate?: string }>();
  const { isPhotographer } = useRole();

  // Tab state for photographer
  const [activeTab, setActiveTab] = useState<Tab>(() => (tab === 'opportunities' ? 'opportunities' : 'direct'));

  useEffect(() => {
    if (tab === 'opportunities') {
      setActiveTab('opportunities');
    }
  }, [tab]);

  // Direct bookings
  const { data, loading, error, refresh } = useAsync(useCallback(() => listBookings(), []));

  // Hybrid opportunities
  const [opportunities, setOpportunities] = useState<PhotographerOpportunity[]>([]);
  const [loadingOpp, setLoadingOpp] = useState(false);
  const [oppBusyId, setOppBusyId] = useState<string | null>(null);
  const [fullscreenOpp, setFullscreenOpp] = useState<PhotographerOpportunity | null>(null);
  // New invites, ones waiting for the client, or everything that happened.
  const [oppFilter, setOppFilter] = useState<'PENDING_RESPONSE' | 'APPROVED' | 'ALL'>('PENDING_RESPONSE');
  const [oppError, setOppError] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    if (!isPhotographer || !env.hybridBookingEnabled) return;
    setLoadingOpp(true);
    try {
      const res = await listOpportunities(oppFilter);
      setOpportunities(oppFilter === 'ALL'
        ? res.filter((o) => o.status !== 'INVITED' && o.status !== 'APPROVED')
        : res);
      setOppError(null);
    } catch (e) {
      setOppError(isApiError(e) ? e.message : 'Could not load opportunities.');
    } finally {
      setLoadingOpp(false);
    }
  }, [isPhotographer, oppFilter]);

  // A notification for one opportunity opens it full screen when it is still
  // open, and otherwise shows the filter that lists it: selected, not
  // selected, expired and closed ones are under History, not New.
  useEffect(() => {
    if (!candidate || !isPhotographer) return;
    getOpportunity(String(candidate))
      .then((o) => {
        setOppFilter(opportunityFilterFor(o.status));
        if (o.status === 'INVITED') setFullscreenOpp(o);
      })
      .catch(() => {});
  }, [candidate, isPhotographer]);

  useEffect(() => {
    if (!isPhotographer || !env.hybridBookingEnabled) return;
    fetchOpportunities();
    const timer = setInterval(fetchOpportunities, 6000);
    return () => clearInterval(timer);
  }, [isPhotographer, fetchOpportunities]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');
  const [rescuingId, setRescuingId] = useState<string | null>(null);

  const onAccept = (booking: Booking) => {
    Alert.alert(
      'Accept booking',
      `Confirm "${booking.eventTitle}" with ${booking.clientName ?? 'this client'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setBusyId(booking.id);
            try {
              await acceptBooking(booking.id);
              await refresh();
            } catch (e) {
              Alert.alert('Could not accept', isApiError(e) ? e.message : 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const submitReject = async () => {
    if (!rejecting) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      Alert.alert('Reason required', 'Add a short note so the client knows why.');
      return;
    }
    setBusyId(rejecting.id);
    try {
      await rejectBooking(rejecting.id, trimmed);
      setRejecting(null);
      setReason('');
      await refresh();
    } catch (e) {
      Alert.alert('Could not reject', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  // Opportunity actions
  const onApproveOpp = async (opp: PhotographerOpportunity) => {
    setOppBusyId(opp.candidateId);
    try {
      await approveOpportunity(opp.candidateId);
      Alert.alert(
        'You said yes',
        `The client now sees you for ${opp.eventTitle} and can choose you. We'll tell you the outcome either way.`,
      );
      fetchOpportunities();
    } catch (e) {
      Alert.alert('Approval error', isApiError(e) ? e.message : 'Could not approve this opportunity.');
    } finally {
      setOppBusyId(null);
    }
  };

  const onRejectOpp = (opp: PhotographerOpportunity) => {
    Alert.alert('Pass on this one?', `${opp.eventTitle} goes to the next photographer.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Already booked', onPress: () => sendReject(opp, 'Already booked') },
      { text: 'Pass', style: 'destructive', onPress: () => sendReject(opp) },
    ]);
  };

  const sendReject = async (opp: PhotographerOpportunity, why?: string) => {
    setOppBusyId(opp.candidateId);
    try {
      await rejectOpportunity(opp.candidateId, why);
      setOpportunities((prev) => prev.filter((o) => o.candidateId !== opp.candidateId));
    } catch (e) {
      Alert.alert('Decline error', isApiError(e) ? e.message : 'Could not decline this opportunity.');
    } finally {
      setOppBusyId(null);
    }
  };

  // Direct-to-Hybrid rescue
  const onRescueToHybrid = async (eventId: string) => {
    setRescuingId(eventId);
    try {
      await convertToHybridRescue(eventId);
      router.push(`/event/candidates?id=${eventId}` as never);
    } catch (e) {
      Alert.alert('Rescue failed', isApiError(e) ? e.message : 'Could not convert to hybrid match.');
    } finally {
      setRescuingId(null);
    }
  };

  return (
    <Screen padded={false}>
      <UserHeaderBand
        duplicatesHeader
        hideTitle
        eyebrow="REQUESTS"
        title="Bookings"
        subtitle={
          isPhotographer
            ? 'Manage client requests and explore nearby event leads.'
            : 'Your booking requests to photographers and their status.'
        }
      />

      {/* Segmented Control for Photographer (Direct vs Opportunities) */}
      {isPhotographer && env.hybridBookingEnabled && (
        <View style={styles.segmentContainer}>
          <SegmentedTabs
            label="Booking sections"
            value={activeTab}
            onChange={(k) => {
              setActiveTab(k);
              if (k === 'opportunities') fetchOpportunities();
            }}
            tabs={[
              { key: 'direct', label: 'Direct requests' },
              { key: 'opportunities', label: opportunities.length > 0 ? `Opportunities (${opportunities.length})` : 'Opportunities' },
            ]}
          />
        </View>
      )}

      {/* TAB 1: DIRECT REQUESTS */}
      {activeTab === 'direct' ? (
        loading && !data ? (
          <View style={styles.skeletonList}>
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
          </View>
        ) : error && !data?.length ? (
          <View style={styles.stateWrap}>
            <ErrorNotice message={error} onRetry={refresh} />
          </View>
        ) : !data?.length ? (
          <View style={styles.stateWrap}>
            <EmptyNote
              icon="briefcase-outline"
              title="No bookings yet"
              body={
                isPhotographer
                  ? 'New requests from clients land here. Configure your packages to start receiving them.'
                  : 'When you book a photographer, your requests appear here.'
              }
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
            }
          >
            <View style={{ marginHorizontal: -spacing.lg }}>
              <StatusBreakdownCard
                segments={[
                  {
                    key: 'accepted',
                    label: 'Accepted',
                    value: data.filter((b) => (b.status ?? '').toUpperCase() === 'ACCEPTED' || (b.status ?? '').toUpperCase() === 'CONFIRMED').length,
                    color: colors.success,
                  },
                  {
                    key: 'pending',
                    label: 'Pending',
                    value: data.filter((b) => (b.status ?? '').toUpperCase() === 'PENDING').length,
                    color: colors.warning,
                  },
                  {
                    key: 'rejected',
                    label: 'Rejected',
                    value: data.filter((b) => (b.status ?? '').toUpperCase() === 'REJECTED' || (b.status ?? '').toUpperCase() === 'CANCELLED').length,
                    color: colors.error,
                  },
                ]}
                centerLabel="bookings"
                summary="Bookings by status"
                emptyText="No bookings yet."
              />
            </View>
            <SectionHeader
              title={isPhotographer ? 'Requests' : 'Your bookings'}
              subtitle={`${data.length} request${data.length === 1 ? '' : 's'}`}
            />
            {data.map((b) => {
              const isPending = (b.status ?? '').toUpperCase() === 'PENDING';
              const isRejected = (b.status ?? '').toUpperCase() === 'REJECTED';
              const isBusy = busyId === b.id;

              return (
                <Pressable
                  key={b.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => router.push(`/event/${b.id}` as never)}
                >
                  <View style={styles.cardHead}>
                    <IconTile icon="calendar" tone={isRejected ? 'error' : isPending ? 'warning' : 'primary'} size={36} />
                    <Text style={styles.eventTitle} numberOfLines={3}>
                      {b.eventTitle}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {(isPhotographer ? (b.clientId && b.clientName) : (b.photographerId && b.photographerName)) ? (
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            const partnerId = isPhotographer ? b.clientId! : b.photographerId!;
                            const partnerName = isPhotographer ? b.clientName! : b.photographerName!;
                            router.push(
                              `/conversation/${partnerId}?name=${encodeURIComponent(partnerName)}` as never
                            );
                          }}
                          style={styles.chatAction}
                          accessibilityRole="button"
                          accessibilityLabel="Message"
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {b.status ? (
                    <View style={styles.statusLine}>
                      <StatusBadge label={b.status.replace(/_/g, ' ')} tone={statusTone(b.status)} />
                    </View>
                  ) : null}

                  {b.clientName ? <Row icon="person-outline" text={b.clientName} /> : null}
                  {b.photographerName && !b.clientName ? <Row icon="camera-outline" text={b.photographerName} /> : null}
                  {b.eventDate ? <Row icon="calendar-outline" text={formatDate(b.eventDate)} /> : null}
                  {b.proposedPrice != null ? (
                    <Row
                      icon="cash-outline"
                      text={`Proposed ${formatPrice(b.proposedPrice, b.currency)}`}
                    />
                  ) : null}

                  {/* Photographer Actions on PENDING */}
                  {isPhotographer && isPending ? (
                    <View style={styles.actionRow}>
                      <ActionButton
                        compact
                        variant="destructive"
                        icon="close"
                        label="Reject"
                        disabled={isBusy}
                        style={styles.actionBtn}
                        onPress={() => {
                          setRejecting(b);
                          setReason('');
                        }}
                      />
                      <ActionButton compact variant="primary" icon="checkmark" label="Accept" busy={isBusy} style={styles.actionBtn} onPress={() => onAccept(b)} />
                    </View>
                  ) : null}

                  {/* Client Rescue Hook on REJECTED (Section 7.0) */}
                  {!isPhotographer && isRejected && b.eventId ? (
                    <View style={styles.rescueCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="sparkles" size={14} color={colors.primary} />
                        <Text style={styles.rescueTitle}>Find another photographer?</Text>
                      </View>
                      <Text style={styles.rescueDesc}>
                        Broadcast this event to other available local photographers with one tap.
                      </Text>
                      <ActionButton
                        compact
                        variant="accent"
                        icon="paper-plane-outline"
                        label="Find Available Matches"
                        busy={rescuingId === b.eventId}
                        onPress={() => onRescueToHybrid(b.eventId!)}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )
      ) : (
        /* TAB 2: OPEN OPPORTUNITIES (HYBRID) */
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loadingOpp}
              onRefresh={fetchOpportunities}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.oppExplainer}>
            <Ionicons name="information-circle-outline" size={16} color="#F20C8F" />
            <Text style={styles.oppExplainerText}>
              Opportunities come from clients who used Post My Event: you were matched because you are free for the whole event and fit what they asked for. Say yes and the client sees you; they choose one photographer. Direct requests are sent to you by name.
            </Text>
          </View>
          <View style={styles.oppFilters}>
            {([['PENDING_RESPONSE', 'New'], ['APPROVED', 'Waiting for client'], ['ALL', 'History']] as const).map(([k, l]) => (
              <Chip key={k} label={l} selected={oppFilter === k} onPress={() => setOppFilter(k)} />
            ))}
          </View>
          {oppError ? <ErrorNotice message={oppError} onRetry={fetchOpportunities} compact /> : null}
          {loadingOpp && opportunities.length === 0 ? (
            <View style={styles.skeletonList}>
              <SkeletonCard height={140} />
              <SkeletonCard height={140} />
            </View>
          ) : opportunities.length === 0 ? (
            <View style={styles.stateWrap}>
              <EmptyNote
                icon="radio-outline"
                title={oppFilter === 'PENDING_RESPONSE' ? 'No open opportunities right now' : oppFilter === 'APPROVED' ? 'Nothing waiting for a client' : 'No history yet'}
                body={oppFilter === 'PENDING_RESPONSE'
                  ? 'When a client posts an event that fits your profile and calendar, it appears here and your phone rings. Add your Instagram and city in Profile to be matched more often.'
                  : oppFilter === 'APPROVED' ? 'Opportunities you said yes to wait here until the client chooses.' : 'Past opportunities and their outcomes appear here.'}
              />
            </View>
          ) : (
            opportunities.map((opp) => (
              <OpportunityCard
                key={opp.candidateId}
                opportunity={opp}
                onApprove={onApproveOpp}
                onReject={onRejectOpp}
                onPress={(o) => setFullscreenOpp(o)}
                busy={oppBusyId === opp.candidateId}
                highlighted={candidate === opp.candidateId}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Reject reason modal */}
      <Modal
        visible={!!rejecting}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setRejecting(null);
          setReason('');
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setRejecting(null);
            setReason('');
          }}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Reject booking</Text>
          <Text style={styles.sheetSub}>
            Let {rejecting?.clientName ?? 'the client'} know why so they can adjust their request.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Already booked that weekend."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            numberOfLines={3}
          />
          <Button
            title="Send rejection"
            onPress={submitReject}
            loading={busyId === rejecting?.id}
            disabled={!reason.trim() || busyId === rejecting?.id}
          />
        </View>
      </Modal>

      {/* Full-Screen Incoming Opportunity Alert (Uber / Ringing Call Style) */}
      <IncomingOpportunityAlertModal
        opportunity={fullscreenOpp}
        visible={fullscreenOpp !== null}
        onApprove={async (opp) => {
          setFullscreenOpp(null);
          await onApproveOpp(opp);
        }}
        onReject={async (opp) => {
          setFullscreenOpp(null);
          await onRejectOpp(opp);
        }}
        onDismiss={() => setFullscreenOpp(null)}
      />
    </Screen>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.rowText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  segmentContainer: { paddingVertical: spacing.sm },
  skeletonList: { padding: spacing.lg, gap: spacing.md },
  stateWrap: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  actionBtn: { flex: 1 },
  statusLine: { alignSelf: 'flex-start', marginBottom: 2 },
  list: { paddingBottom: 120, gap: spacing.md },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: c.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: 4,
  },
  cardPressed: { opacity: 0.85 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
  },
  chatAction: {
    padding: 5,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  eventTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { flex: 1, fontSize: fontSize.sm, color: c.textSoft },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  // Direct-to-hybrid rescue
  rescueCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: c.tint,
    borderRadius: radii.md,
    gap: 4,
  },
  rescueTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  rescueDesc: {
    fontSize: 12,
    color: c.textSoft,
  },

  // Reject sheet
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,18,23,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  sheetSub: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: c.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  oppExplainer: { flexDirection: 'row', gap: 8, padding: 12, marginHorizontal: spacing.lg, borderRadius: 14, backgroundColor: 'rgba(242,12,143,0.08)', marginBottom: 10 },
  oppExplainerText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: c.textSoft },
  oppFilters: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginBottom: 12, flexWrap: 'wrap' },
}));
