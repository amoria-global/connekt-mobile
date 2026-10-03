import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { CandidateCard } from '@/features/hybrid/CandidateCard';
import { listEventCandidates, selectPhotographer } from '@/features/hybrid/api';
import type { CandidateSummary, CandidatesResponse } from '@/features/hybrid/types';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { isApiError } from '@/store/auth';
import { formatPrice } from '@/utils/format';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function EventCandidatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ id?: string; eventId?: string }>();
  const eventId = params.id || params.eventId || '';

  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // Escrow payment state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payHandoff, setPayHandoff] = useState<{ declarationId: string; depositAmount?: number; currency?: string } | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSummary | null>(null);

  const fetchCandidates = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await listEventCandidates(eventId);
      setData(res);
    } catch (e) {
      console.warn('Could not fetch candidates:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Polling every 12 seconds if 0 candidates approved yet
  useEffect(() => {
    if (data && data.candidates && data.candidates.length > 0) return;
    const interval = setInterval(fetchCandidates, 12000);
    return () => clearInterval(interval);
  }, [data, fetchCandidates]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCandidates();
  };

  const handleSelectCandidate = (candidate: CandidateSummary) => {
    Alert.alert(
      'Confirm Selection',
      `Book ${candidate.name} for your event? This will reserve their availability and start your secure escrow deposit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Pay Deposit',
          onPress: async () => {
            setSelectingId(candidate.candidateId);
            try {
              const res = await selectPhotographer(eventId, {
                candidateId: candidate.candidateId,
                photographerId: candidate.photographerId,
                escrowPercentage: 50,
              });

              setSelectedCandidate(candidate);
              setPayHandoff({
                declarationId: res.declarationId,
                depositAmount: res.depositAmount,
                currency: res.currency,
              });
              setCheckoutOpen(true);
            } catch (e: any) {
              const msg = isApiError(e) ? e.message : 'Could not confirm photographer. Please try again.';
              Alert.alert('Selection Error', msg);
              fetchCandidates();
            } finally {
              setSelectingId(null);
            }
          },
        },
      ],
    );
  };

  const handleViewProfile = (candidate: CandidateSummary) => {
    router.push(`/photographer/${candidate.photographerId}` as never);
  };

  const candidates = data?.candidates ?? [];

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />

      <UserHeaderBand
        title="Approved Candidates"
        subtitle={
          candidates.length > 0
            ? `${candidates.length} local talent ready & available for your event date.`
            : 'Broadcasting your event brief to local verified photographers.'
        }
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching available photographers...</Text>
        </View>
      ) : candidates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.radarCircle}>
            <Ionicons name="radio-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Inviting Local Photographers</Text>
          <Text style={styles.emptyDesc}>
            Your brief has been sent to matching local creators. Only photographers who explicitly confirm availability will appear here.
          </Text>
          <View style={styles.tipBox}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.tipText}>
              Approvals typically arrive within 30 to 60 minutes. We'll send you an instant push notification as soon as they respond!
            </Text>
          </View>
          <Pressable style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.refreshBtnText}>Check for responses</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.candidateId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <CandidateCard
              candidate={item}
              onSelect={handleSelectCandidate}
              onViewProfile={handleViewProfile}
              selecting={selectingId === item.candidateId}
            />
          )}
        />
      )}

      {/* Shared Downstream Escrow Checkout */}
      {payHandoff && (
        <HandoffCheckoutSheet
          visible={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          handoff={{ type: 'BOOKING_DECLARATION', declarationId: payHandoff.declarationId }}
          title="Booking Deposit Escrow"
          subtitle={selectedCandidate?.name || 'Photographer'}
          amountLabel={formatPrice(payHandoff.depositAmount ?? 0, payHandoff.currency)}
          onSettled={() => {
            setCheckoutOpen(false);
            Alert.alert(
              'Booking Confirmed!',
              'Your deposit is securely held in Connekyt Escrow. The photographer has been locked for your date.',
              [
                {
                  text: 'View Event',
                  onPress: () => router.replace(`/event/${eventId}` as never),
                },
              ],
            );
          }}
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  list: {
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  radarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginVertical: spacing.md,
    maxWidth: 340,
  },
  tipText: {
    fontSize: fontSize.xs,
    color: c.textSoft,
    flex: 1,
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  refreshBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
}));
