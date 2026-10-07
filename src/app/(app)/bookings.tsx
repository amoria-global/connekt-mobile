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
import { useCallback, useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { StatusPill } from '@/components/ui/StatusPill';
import { useRole } from '@/features/auth/role';
import { acceptBooking, listBookings, rejectBooking, type Booking } from '@/features/bookings/api';
import {
  listOpportunities,
  approveOpportunity,
  rejectOpportunity,
  convertToHybridRescue,
} from '@/features/hybrid/api';
import type { PhotographerOpportunity } from '@/features/hybrid/types';
import { OpportunityCard } from '@/features/hybrid/OpportunityCard';
import { IncomingOpportunityAlertModal } from '@/features/hybrid/IncomingOpportunityAlertModal';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { env } from '@/config/env';

type Tab = 'direct' | 'opportunities';

export default function BookingsScreen() {
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
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

  const fetchOpportunities = useCallback(async () => {
    if (!isPhotographer || !env.hybridBookingEnabled) return;
    setLoadingOpp(true);
    try {
      const res = await listOpportunities();
      const pending = res.filter((opp) => {
        const s = (opp.status ?? '').toUpperCase();
        return s !== 'APPROVED' && s !== 'REJECTED' && s !== 'DECLINED' && s !== 'EXPIRED';
      });
      setOpportunities(pending);
    } catch (e) {
      console.warn('Could not load opportunities:', e);
    } finally {
      setLoadingOpp(false);
    }
  }, [isPhotographer]);

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
        'Opportunity Approved!',
        'You have been added to the client’s shortlist. You will be notified as soon as they select your proposal.',
      );
      fetchOpportunities();
    } catch (e) {
      Alert.alert('Approval error', isApiError(e) ? e.message : 'Could not approve this opportunity.');
    } finally {
      setOppBusyId(null);
    }
  };

  const onRejectOpp = async (opp: PhotographerOpportunity) => {
    setOppBusyId(opp.candidateId);
    try {
      await rejectOpportunity(opp.candidateId);
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
          <Pressable
            style={[styles.segmentBtn, activeTab === 'direct' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('direct')}
          >
            <Ionicons
              name="calendar-outline"
              size={15}
              color={activeTab === 'direct' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.segmentText, activeTab === 'direct' && styles.segmentTextActive]}>
              Direct Requests
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeTab === 'opportunities' && styles.segmentBtnActive]}
            onPress={() => {
              setActiveTab('opportunities');
              fetchOpportunities();
            }}
          >
            <Ionicons
              name="sparkles-outline"
              size={15}
              color={activeTab === 'opportunities' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'opportunities' && styles.segmentTextActive,
              ]}
            >
              Open Opportunities
            </Text>
            {opportunities.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{opportunities.length}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* TAB 1: DIRECT REQUESTS */}
      {activeTab === 'direct' ? (
        loading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error && !data?.length ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : !data?.length ? (
          <View style={styles.centered}>
            <EmptyState
              icon="briefcase-outline"
              title="No bookings yet"
              message={
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
                    <Text style={styles.eventTitle} numberOfLines={1}>
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
                      <StatusPill status={b.status} />
                    </View>
                  </View>

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
                      <Pressable
                        onPress={() => {
                          setRejecting(b);
                          setReason('');
                        }}
                        disabled={isBusy}
                        style={[styles.action, styles.actionGhost]}
                      >
                        <Ionicons name="close" size={16} color={colors.error} />
                        <Text style={[styles.actionText, { color: colors.error }]}>Reject</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onAccept(b)}
                        disabled={isBusy}
                        style={[styles.action, styles.actionPrimary]}
                      >
                        {isBusy ? (
                          <ActivityIndicator color={colors.textOnPrimary} />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} />
                            <Text style={[styles.actionText, styles.actionTextPrimary]}>Accept</Text>
                          </>
                        )}
                      </Pressable>
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
                      <Pressable
                        style={styles.rescueBtn}
                        onPress={() => onRescueToHybrid(b.eventId!)}
                        disabled={rescuingId === b.eventId}
                      >
                        {rescuingId === b.eventId ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
                            <Text style={styles.rescueBtnText}>Find Available Matches</Text>
                          </>
                        )}
                      </Pressable>
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
          {loadingOpp && opportunities.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : opportunities.length === 0 ? (
            <View style={styles.centered}>
              <EmptyState
                icon="sparkles-outline"
                title="No open opportunities right now"
                message="When clients in your area post event briefs matching your profile, they will appear here for you to claim."
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
      <Text style={styles.rowText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceMuted,
  },
  segmentBtnActive: {
    backgroundColor: c.tint,
    borderColor: c.primary,
  },
  segmentText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.textMuted,
  },
  segmentTextActive: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  badgeCount: {
    backgroundColor: c.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  list: { padding: spacing.xl, paddingBottom: 120, gap: spacing.md },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: 4,
  },
  cardPressed: { opacity: 0.85 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
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
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  actionGhost: { borderColor: c.error, backgroundColor: c.errorBg },
  actionPrimary: { borderColor: c.primary, backgroundColor: c.primary },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  actionTextPrimary: { color: c.textOnPrimary },

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
    fontSize: 11,
    color: c.textSoft,
  },
  rescueBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginTop: 4,
  },
  rescueBtnText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
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
}));
