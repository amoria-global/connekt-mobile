import React from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import type { PhotographerOpportunity } from './types';

type Props = {
  opportunity: PhotographerOpportunity;
  onApprove: (item: PhotographerOpportunity) => void;
  onReject: (item: PhotographerOpportunity) => void;
  onPress?: (item: PhotographerOpportunity) => void;
  busy?: boolean;
};

export function OpportunityCard({ opportunity, onApprove, onReject, onPress, busy }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  const isApproved = opportunity.status === 'APPROVED';
  const isRejected = opportunity.status === 'REJECTED';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>NEW OPPORTUNITY</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {opportunity.distanceKm != null && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate-outline" size={12} color={colors.primary} />
              <Text style={styles.distanceText}>{opportunity.distanceKm.toFixed(1)} km away</Text>
            </View>
          )}
          {onPress && !isApproved && !isRejected && (
            <Pressable
              style={styles.radarPill}
              onPress={() => onPress(opportunity)}
              hitSlop={6}
            >
              <Ionicons name="flash" size={11} color={colors.accent} />
              <Text style={styles.radarPillText}>Call Alert</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {opportunity.eventTitle}
      </Text>

      {opportunity.clientName ? (
        <View style={styles.clientRow}>
          <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
          <Text style={styles.clientText}>Client: {opportunity.clientName}</Text>
        </View>
      ) : null}

      <View style={styles.metaList}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {opportunity.eventDate} • {opportunity.startTime?.slice(0, 5)}
            {opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''}
            {opportunity.durationHours ? ` (${opportunity.durationHours} hrs)` : ''}
          </Text>
        </View>

        {(opportunity.eventAddress || opportunity.venue || opportunity.eventCity || opportunity.city) && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {opportunity.eventAddress ||
                [opportunity.venue, opportunity.eventCity || opportunity.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}

        {(opportunity.estimatedEarnings != null || opportunity.minBudget != null || opportunity.maxBudget != null) && (
          <View style={styles.metaRow}>
            <Ionicons name="cash-outline" size={14} color={colors.primary} />
            <Text style={styles.budgetText}>
              {opportunity.estimatedEarnings != null
                ? `${opportunity.currency || 'RWF'} ${opportunity.estimatedEarnings.toLocaleString()} (Est. Payout)`
                : opportunity.minBudget != null && opportunity.maxBudget != null
                  ? `${formatPrice(opportunity.minBudget, opportunity.currency)} – ${formatPrice(opportunity.maxBudget, opportunity.currency)}`
                  : formatPrice(opportunity.maxBudget ?? opportunity.minBudget ?? 0, opportunity.currency)}
            </Text>
            {opportunity.escrowGuaranteed && (
              <View style={styles.escrowBadge}>
                <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                <Text style={styles.escrowBadgeText}>Escrow Protected</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* CLIENT INSTRUCTIONS IF SPECIFIED */}
      {opportunity.instructions ? (
        <View style={styles.instructionsBox}>
          <View style={styles.instructionsHeader}>
            <Ionicons name="document-text-outline" size={13} color={colors.primary} />
            <Text style={styles.instructionsTitle}>Client Brief / Notes:</Text>
          </View>
          <Text style={styles.instructionsText}>{opportunity.instructions}</Text>
        </View>
      ) : null}

      {/* WHY YOU MATCH REASONS */}
      {opportunity.matchReasons && opportunity.matchReasons.length > 0 && (
        <View style={styles.matchReasonsBox}>
          <Text style={styles.matchReasonsTitle}>Why you match:</Text>
          {opportunity.matchReasons.map((reason, idx) => (
            <View key={idx} style={styles.reasonRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ACTIONS */}
      <View style={styles.actionsRow}>
        {isApproved ? (
          <View style={styles.statusBoxApproved}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={styles.statusTextApproved}>Approved — Waiting for client selection</Text>
          </View>
        ) : isRejected ? (
          <View style={styles.statusBoxRejected}>
            <Ionicons name="close-circle" size={16} color={colors.error} />
            <Text style={styles.statusTextRejected}>Opportunity declined</Text>
          </View>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [styles.rejectBtn, pressed && styles.btnPressed]}
              onPress={() => onReject(opportunity)}
              disabled={busy}
            >
              <Ionicons name="close" size={16} color={colors.error} />
              <Text style={styles.rejectBtnText}>Decline</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.approveBtn, pressed && styles.btnPressed]}
              onPress={() => onApprove(opportunity)}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.approveBtnText}>I'm Available</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeContainer: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: 0.5,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  clientText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  metaList: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: fontSize.xs,
    color: c.textSoft,
  },
  budgetText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.tint,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.2)',
  },
  escrowBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.primary,
  },
  instructionsBox: {
    backgroundColor: 'rgba(8, 58, 133, 0.05)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.15)',
    padding: spacing.sm + 2,
    gap: 4,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  instructionsTitle: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#083A85',
    letterSpacing: 0.2,
  },
  instructionsText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.text,
    lineHeight: 18,
  },
  matchReasonsBox: {
    backgroundColor: c.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: 6,
  },
  matchReasonsTitle: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonText: {
    fontSize: fontSize.xs,
    color: c.text,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 4,
  },
  rejectBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.error,
    backgroundColor: c.errorBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rejectBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.error,
  },
  approveBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  statusBoxApproved: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    backgroundColor: c.tint,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.18)',
  },
  statusTextApproved: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  statusBoxRejected: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
  },
  statusTextRejected: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.tintAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(242, 12, 143, 0.25)',
  },
  radarPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.accent,
  },
}));
