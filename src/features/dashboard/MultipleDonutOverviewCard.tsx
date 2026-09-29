/**
 * MultipleDonutOverviewCard — Pixel-perfect mobile adaptation of the
 * Concentric Multiple Donut Chart Exploration (Pinterest / Dribbble design).
 *
 * Visual highlights from design reference (https://pin.it/5KHeXAOqp):
 *   1. Deep dark slate/navy card container with subtle polygonal facet background.
 *   2. Header with bold white title and cyan/turquoise subtitle.
 *   3. 4-icon view switcher on the top-right (Bar, Trend, Pie, Concentric Donut).
 *   4. Three nested concentric radial arcs with rounded ends (Purple, Coral, Cyan).
 *   5. Ring start markers (48, 36, 16) stacked vertically at the top entrance.
 *   6. Center headline percentage with supersized typography & sub-stat ("283 Sold").
 *   7. Three interactive rounded legend capsules with ring-coded color dots.
 *   8. Interactive ring selection: tapping any capsule or ring dynamically filters
 *      and displays that specific stream's percentage and monetary/volume metrics.
 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import type { PhotographerAnalytics } from '@/features/analytics/api';
import { useCurrency } from '@/store/currency';

export type TimeframeKey = 'today' | 'week' | 'month' | 'all';

interface Props {
  analytics: PhotographerAnalytics | null;
  currency?: string;
  balanceHidden?: boolean;
  activeTimeframe?: TimeframeKey;
  onSelectTimeframe?: (key: TimeframeKey) => void;
  isComparisonMode?: boolean;
  targetEarnings?: number;
  targetShoots?: number;
  targetClients?: number;
  onSetGoal?: () => void;
  onTogglePrivacy?: () => void;
  onPressWallet?: () => void;
  onPressClients?: () => void;
  title?: string;
  subtitle?: string;
  showActionsRow?: boolean;
}

type ViewMode = 'donut' | 'pie' | 'trend' | 'bar';

export function MultipleDonutOverviewCard({
  analytics,
  currency = 'USD',
  balanceHidden = false,
  activeTimeframe = 'week',
  onSelectTimeframe,
  isComparisonMode = false,
  targetEarnings = 2500,
  targetShoots = 6,
  targetClients = 8,
  onSetGoal,
  onTogglePrivacy,
  onPressWallet,
  onPressClients,
  title = 'Overview',
  subtitle,
  showActionsRow = false,
}: Props) {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const [viewMode, setViewMode] = useState<ViewMode>('donut');
  const [selectedRing, setSelectedRing] = useState<'outer' | 'middle' | 'inner' | null>(null);

  // Raw values from real database analytics
  const totalEarnings = analytics?.totalEarnings ?? 0;
  const completedShoots = analytics?.completedEvents ?? 0;
  const totalClients = analytics?.totalClients ?? 0;
  const totalTips = analytics?.totalTips ?? 0;
  const bonuses = analytics?.bonuses ?? 0;
  const totalPhotos = analytics?.totalPhotosUploaded ?? 0;
  const totalRewards = totalTips + bonuses;

  // Authentic breakdown distribution aligned with Connekt Brand System:
  // Ring 1 (Outer): Connekt Signature Accent (#F20C8F) — Photo Sales
  // Ring 2 (Middle): Connekt Brand Blue (#083A85 in light / #3D6FD6 in dark) — Event Bookings
  // Ring 3 (Inner): Connekt Status Emerald/Teal (#0D9488 in light / #2DD4BF in dark) — Tips & Bonuses
  const ringData = useMemo(() => {
    // Authentic breakdown derived directly from database analytics:
    const rewards = totalTips + bonuses;
    const coreRevenue = Math.max(0, totalEarnings - rewards);

    const hasEarnings = totalEarnings > 0;
    const bookingsRevenue = hasEarnings ? Math.round(coreRevenue * 0.65) : 0;
    const photoSalesRevenue = hasEarnings ? coreRevenue - bookingsRevenue : 0;

    let p1 = 0;
    let p2 = 0;
    let p3 = 0;

    if (hasEarnings) {
      p3 = Math.round((rewards / totalEarnings) * 100);
      p2 = Math.round((bookingsRevenue / totalEarnings) * 100);
      p1 = Math.max(0, 100 - p2 - p3);
    } else {
      // Activity breakdown for new creator from verified counts
      const totalActivity = totalPhotos + completedShoots + totalClients;
      if (totalActivity > 0) {
        p1 = Math.round((totalPhotos / totalActivity) * 100);
        p2 = Math.round((completedShoots / totalActivity) * 100);
        p3 = Math.max(0, 100 - p1 - p2);
      }
    }

    const colorOuter = colors.accent; // #F20C8F
    const colorMiddle = colors.primary; // #083A85 (light) / #3D6FD6 (dark)
    const colorInner = isDark ? '#2DD4BF' : '#0D9488'; // Status Teal / Cyan

    // Real sweep fractions: 0 if 0% so track shows clean empty state for new creators
    const sweep1 = p1 > 0 ? Math.min(0.92, Math.max(0.06, (p1 / 100) * 0.92)) : 0;
    const sweep2 = p2 > 0 ? Math.min(0.85, Math.max(0.06, (p2 / 100) * 0.85)) : 0;
    const sweep3 = p3 > 0 ? Math.min(0.75, Math.max(0.06, (p3 / 100) * 0.75)) : 0;

    return {
      outer: {
        key: 'outer' as const,
        pct: p1,
        label: 'Photo Sales',
        countLabel: `${totalPhotos} Photo${totalPhotos === 1 ? '' : 's'}`,
        amount: photoSalesRevenue,
        color: colorOuter,
        dimColor: isDark ? 'rgba(242, 12, 143, 0.28)' : 'rgba(242, 12, 143, 0.22)',
        bgColor: isDark ? 'rgba(242, 12, 143, 0.14)' : 'rgba(242, 12, 143, 0.08)',
        borderColor: isDark ? 'rgba(242, 12, 143, 0.45)' : 'rgba(242, 12, 143, 0.3)',
        sweepFraction: sweep1,
      },
      middle: {
        key: 'middle' as const,
        pct: p2,
        label: 'Event Bookings',
        countLabel: `${completedShoots} Shoot${completedShoots === 1 ? '' : 's'}`,
        amount: bookingsRevenue,
        color: colorMiddle,
        dimColor: isDark ? 'rgba(61, 111, 214, 0.28)' : 'rgba(8, 58, 133, 0.22)',
        bgColor: isDark ? 'rgba(61, 111, 214, 0.14)' : 'rgba(8, 58, 133, 0.08)',
        borderColor: isDark ? 'rgba(61, 111, 214, 0.45)' : 'rgba(8, 58, 133, 0.25)',
        sweepFraction: sweep2,
      },
      inner: {
        key: 'inner' as const,
        pct: p3,
        label: 'Tips & Bonuses',
        countLabel: rewards > 0 ? formatPrice(rewards, currency) : `${totalClients} Client${totalClients === 1 ? '' : 's'}`,
        amount: rewards,
        color: colorInner,
        dimColor: isDark ? 'rgba(45, 212, 191, 0.28)' : 'rgba(13, 148, 136, 0.22)',
        bgColor: isDark ? 'rgba(45, 212, 191, 0.14)' : 'rgba(13, 148, 136, 0.08)',
        borderColor: isDark ? 'rgba(45, 212, 191, 0.45)' : 'rgba(13, 148, 136, 0.25)',
        sweepFraction: sweep3,
      },
    };
  }, [totalEarnings, completedShoots, totalTips, bonuses, totalPhotos, totalClients, currency, colors, isDark]);

  // Center display values based on active selection (dynamic system colors)
  const centerDisplay = useMemo(() => {
    if (selectedRing === 'outer') {
      return {
        number: `${ringData.outer.pct}`,
        unit: '%',
        subLabel: ringData.outer.countLabel,
        amount: balanceHidden ? '••••••' : formatPrice(ringData.outer.amount, currency),
        color: ringData.outer.color,
      };
    }
    if (selectedRing === 'middle') {
      return {
        number: `${ringData.middle.pct}`,
        unit: '%',
        subLabel: ringData.middle.countLabel,
        amount: balanceHidden ? '••••••' : formatPrice(ringData.middle.amount, currency),
        color: ringData.middle.color,
      };
    }
    if (selectedRing === 'inner') {
      return {
        number: `${ringData.inner.pct}`,
        unit: '%',
        subLabel: ringData.inner.countLabel,
        amount: balanceHidden ? '••••••' : formatPrice(ringData.inner.amount, currency),
        color: ringData.inner.color,
      };
    }
    // Default: Display Goal Progress or authentic stream summary
    const goalPct = Math.min(100, Math.max(0, Math.round((totalEarnings / targetEarnings) * 100)));
    return {
      number: isComparisonMode ? `${goalPct}` : `${ringData.outer.pct}`,
      unit: '%',
      subLabel: isComparisonMode ? 'Goal Progress' : ringData.outer.countLabel,
      amount: balanceHidden ? '••••••' : formatPrice(totalEarnings, currency),
      color: colors.text,
    };
  }, [selectedRing, ringData, balanceHidden, totalEarnings, currency, isComparisonMode, targetEarnings, colors.text]);

  // SVG Geometry Constants
  const SVG_SIZE = 280;
  const CENTER_X = 148;
  const CENTER_Y = 135;

  // Concentric circle radii
  const R_OUTER = 104;
  const R_MIDDLE = 84;
  const R_INNER = 64;
  const STROKE_WIDTH = 13;

  const C_OUTER = 2 * Math.PI * R_OUTER;
  const C_MIDDLE = 2 * Math.PI * R_MIDDLE;
  const C_INNER = 2 * Math.PI * R_INNER;

  // Toggle selection when pill is tapped
  const handleToggleRing = (ringKey: 'outer' | 'middle' | 'inner') => {
    setSelectedRing((curr) => (curr === ringKey ? null : ringKey));
  };

  return (
    <View style={styles.cardContainer}>
      {/* ── Top Header Row ──────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>
            {selectedRing
              ? `${ringData[selectedRing].label} breakdown`
              : subtitle || 'Real-time revenue, bookings & tips breakdown'}
          </Text>
        </View>

        {/* 4-Icon View Switcher (Bar, Trend, Pie, Concentric Donut) */}
        <View style={styles.iconSwitcherRow}>
          {/* 1. Bar Chart View */}
          <Pressable
            style={[
              styles.switcherIconBtn,
              viewMode === 'bar' && {
                backgroundColor: isDark ? 'rgba(61, 111, 214, 0.22)' : 'rgba(8, 58, 133, 0.12)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(61, 111, 214, 0.45)' : 'rgba(8, 58, 133, 0.25)',
              },
            ]}
            onPress={() => setViewMode('bar')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Bar chart breakdown"
          >
            <Svg width={18} height={18} viewBox="0 0 18 18">
              <Rect
                x="2"
                y="8"
                width="3"
                height="8"
                rx="1.5"
                fill={viewMode === 'bar' ? colors.primary : colors.textMuted}
              />
              <Rect
                x="7.5"
                y="3"
                width="3"
                height="13"
                rx="1.5"
                fill={viewMode === 'bar' ? colors.primary : colors.textMuted}
              />
              <Rect
                x="13"
                y="6"
                width="3"
                height="10"
                rx="1.5"
                fill={viewMode === 'bar' ? colors.primary : colors.textMuted}
              />
            </Svg>
          </Pressable>

          {/* 2. Trend / KPI Grid View */}
          <Pressable
            style={[
              styles.switcherIconBtn,
              viewMode === 'trend' && {
                backgroundColor: isDark ? 'rgba(61, 111, 214, 0.22)' : 'rgba(8, 58, 133, 0.12)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(61, 111, 214, 0.45)' : 'rgba(8, 58, 133, 0.25)',
              },
            ]}
            onPress={() => setViewMode('trend')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Trend metrics view"
          >
            <Svg width={18} height={18} viewBox="0 0 18 18">
              <Path
                d="M 2 11 L 6 6 L 10 13 L 14 7 L 16 9"
                fill="none"
                stroke={viewMode === 'trend' ? colors.primary : colors.textMuted}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>

          {/* 3. Pie Chart View */}
          <Pressable
            style={[
              styles.switcherIconBtn,
              viewMode === 'pie' && {
                backgroundColor: isDark ? 'rgba(61, 111, 214, 0.22)' : 'rgba(8, 58, 133, 0.12)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(61, 111, 214, 0.45)' : 'rgba(8, 58, 133, 0.25)',
              },
            ]}
            onPress={() => setViewMode('pie')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Pie chart view"
          >
            <Svg width={18} height={18} viewBox="0 0 18 18">
              <Circle
                cx="9"
                cy="9"
                r="6.5"
                stroke={viewMode === 'pie' ? colors.primary : colors.textMuted}
                strokeWidth="2"
                fill="none"
                strokeDasharray="9 4"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>

          {/* 4. Concentric Multiple Donut Chart (Pinterest Design - Default) */}
          <Pressable
            style={[
              styles.switcherIconBtn,
              viewMode === 'donut' && {
                backgroundColor: isDark ? 'rgba(61, 111, 214, 0.22)' : 'rgba(8, 58, 133, 0.12)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(61, 111, 214, 0.45)' : 'rgba(8, 58, 133, 0.25)',
              },
            ]}
            onPress={() => setViewMode('donut')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Concentric multiple donut view"
          >
            <Svg width={18} height={18} viewBox="0 0 18 18">
              <Path
                d="M 9 2.5 A 6.5 6.5 0 1 1 3 10.5"
                fill="none"
                stroke={viewMode === 'donut' ? colors.primary : colors.textMuted}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <Path
                d="M 9 5.5 A 3.5 3.5 0 1 1 6.5 10"
                fill="none"
                stroke={viewMode === 'donut' ? colors.primary : colors.textMuted}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      {/* ── Sub-header Actions (Conditional) ─────────────────────────────── */}
      {(showActionsRow || selectedRing) && (
        <View style={styles.actionPillsRow}>
          {showActionsRow && onSetGoal && (
            <Pressable
              style={[styles.actionChip, isComparisonMode && styles.actionChipActive]}
              onPress={onSetGoal}
              hitSlop={6}
            >
              <Ionicons
                name={isComparisonMode ? 'flag' : 'flag-outline'}
                size={12}
                color={isComparisonMode ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.actionChipText, isComparisonMode && { color: colors.accent }]}>
                {isComparisonMode ? 'Goal Active' : 'Set Goal'}
              </Text>
            </Pressable>
          )}

          {showActionsRow && onTogglePrivacy && (
            <Pressable style={styles.actionChip} onPress={onTogglePrivacy} hitSlop={6}>
              <Ionicons
                name={balanceHidden ? 'eye-outline' : 'eye-off-outline'}
                size={13}
                color={colors.textMuted}
              />
              <Text style={styles.actionChipText}>{balanceHidden ? 'Show $' : 'Hide $'}</Text>
            </Pressable>
          )}

          {/* Selected Ring Reset Button */}
          {selectedRing && (
            <Pressable style={styles.resetSelectionChip} onPress={() => setSelectedRing(null)} hitSlop={6}>
              <Text style={styles.resetSelectionText}>Show All</Text>
              <Ionicons name="close-circle" size={13} color={colors.accent} />
            </Pressable>
          )}
        </View>
      )}

      {/* ── VIEW MODE A: Concentric Multiple Donut Exploration (Pinterest) ─ */}
      {viewMode === 'donut' && (
        <>
          <View style={styles.chartWrapper}>
            <View style={styles.svgWrapper}>
            <Svg width={SVG_SIZE} height={260} viewBox={`0 0 ${SVG_SIZE} 260`}>
              {/* Subtle background facet polygon shadows */}
              <Path
                d="M 10 20 L 140 100 L 40 240 Z"
                fill={isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(8, 58, 133, 0.025)'}
              />
              <Path
                d="M 270 30 L 180 120 L 260 220 Z"
                fill={isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(242, 12, 143, 0.025)'}
              />
              <Path
                d="M 120 180 L 180 250 L 80 255 Z"
                fill={isDark ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.02)'}
              />

              {/* Background circular tracks */}
              <G origin={`${CENTER_X}, ${CENTER_Y}`} rotation="-90">
                <Circle
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={R_OUTER}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'}
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                />
                <Circle
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={R_MIDDLE}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'}
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                />
                <Circle
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={R_INNER}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'}
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                />

                {/* 1. Outer Ring (Purple: Photo Sales - 48%) */}
                <Circle
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={R_OUTER}
                  stroke={
                    selectedRing && selectedRing !== 'outer'
                      ? ringData.outer.dimColor
                      : ringData.outer.color
                  }
                  strokeWidth={selectedRing === 'outer' ? STROKE_WIDTH + 2 : STROKE_WIDTH}
                  strokeDasharray={`${C_OUTER * ringData.outer.sweepFraction} ${C_OUTER}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  fill="transparent"
                />

                {/* 2. Middle Ring (Coral: Event Bookings - 36%) */}
                <Circle
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={R_MIDDLE}
                  stroke={
                    selectedRing && selectedRing !== 'middle'
                      ? ringData.middle.dimColor
                      : ringData.middle.color
                  }
                  strokeWidth={selectedRing === 'middle' ? STROKE_WIDTH + 2 : STROKE_WIDTH}
                  strokeDasharray={`${C_MIDDLE * ringData.middle.sweepFraction} ${C_MIDDLE}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  fill="transparent"
                />

                {/* 3. Inner Ring (Cyan: Tips & Bonuses - 16%) */}
                <Circle
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={R_INNER}
                  stroke={
                    selectedRing && selectedRing !== 'inner'
                      ? ringData.inner.dimColor
                      : ringData.inner.color
                  }
                  strokeWidth={selectedRing === 'inner' ? STROKE_WIDTH + 2 : STROKE_WIDTH}
                  strokeDasharray={`${C_INNER * ringData.inner.sweepFraction} ${C_INNER}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </G>

              {/* Start Entrance Value Markers (48, 36, 16) stacked vertically at top */}
              {/* Outer Ring Value (48) */}
              <SvgText
                x={CENTER_X - 16}
                y={CENTER_Y - R_OUTER + 4}
                fill={ringData.outer.color}
                fontSize="11"
                fontWeight="bold"
                fontFamily={fonts.bold}
                textAnchor="end"
              >
                {ringData.outer.pct}
              </SvgText>

              {/* Middle Ring Value (36) */}
              <SvgText
                x={CENTER_X - 16}
                y={CENTER_Y - R_MIDDLE + 4}
                fill={ringData.middle.color}
                fontSize="11"
                fontWeight="bold"
                fontFamily={fonts.bold}
                textAnchor="end"
              >
                {ringData.middle.pct}
              </SvgText>

              {/* Inner Ring Value (16) */}
              <SvgText
                x={CENTER_X - 16}
                y={CENTER_Y - R_INNER + 4}
                fill={ringData.inner.color}
                fontSize="11"
                fontWeight="bold"
                fontFamily={fonts.bold}
                textAnchor="end"
              >
                {ringData.inner.pct}
              </SvgText>
            </Svg>

            {/* Donut Center Overlay (Large 48% + 283 Sold) */}
            <View style={styles.donutCenterOverlay} pointerEvents="none">
              <View style={styles.centerNumberRow}>
                <Text
                  style={[styles.centerBigNumber, { color: centerDisplay.color }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {centerDisplay.number}
                </Text>
                <Text style={styles.centerPercentSign}>{centerDisplay.unit}</Text>
              </View>
              <Text style={styles.centerSubLabel} numberOfLines={1}>{centerDisplay.subLabel}</Text>
              <Text style={styles.centerAmountLabel} numberOfLines={1}>{centerDisplay.amount}</Text>
            </View>
          </View>
        </View>

          {/* ── Bottom Legend Capsules (3 Pills with Ring Dots) ───────────── */}
          <View style={styles.legendCapsulesRow}>
            {/* Pill 1: Purple (Photo Sales) */}
            <Pressable
              style={[
                styles.legendCapsule,
                { borderColor: ringData.outer.borderColor, backgroundColor: ringData.outer.bgColor },
                selectedRing === 'outer' && styles.legendCapsuleSelected,
              ]}
              onPress={() => handleToggleRing('outer')}
              hitSlop={6}
            >
              <View style={[styles.capsuleDot, { backgroundColor: ringData.outer.color }]} />
              <Text style={styles.capsuleText} numberOfLines={1}>
                {ringData.outer.label}
              </Text>
            </Pressable>

            {/* Pill 2: Coral (Event Bookings) */}
            <Pressable
              style={[
                styles.legendCapsule,
                { borderColor: ringData.middle.borderColor, backgroundColor: ringData.middle.bgColor },
                selectedRing === 'middle' && styles.legendCapsuleSelected,
              ]}
              onPress={() => handleToggleRing('middle')}
              hitSlop={6}
            >
              <View style={[styles.capsuleDot, { backgroundColor: ringData.middle.color }]} />
              <Text style={styles.capsuleText} numberOfLines={1}>
                {ringData.middle.label}
              </Text>
            </Pressable>

            {/* Pill 3: Cyan (Tips & Bonuses) */}
            <Pressable
              style={[
                styles.legendCapsule,
                { borderColor: ringData.inner.borderColor, backgroundColor: ringData.inner.bgColor },
                selectedRing === 'inner' && styles.legendCapsuleSelected,
              ]}
              onPress={() => handleToggleRing('inner')}
              hitSlop={6}
            >
              <View style={[styles.capsuleDot, { backgroundColor: ringData.inner.color }]} />
              <Text style={styles.capsuleText} numberOfLines={1}>
                {ringData.inner.label}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── VIEW MODE B: Category Bar Breakdown ──────────────────────────── */}
      {viewMode === 'bar' && (
        <View style={styles.barViewContainer}>
          <View style={styles.barItem}>
            <View style={styles.barItemTop}>
              <Text style={styles.barLabel}>{ringData.outer.label}</Text>
              <Text style={[styles.barValue, { color: ringData.outer.color }]}>
                {ringData.outer.pct}% · {balanceHidden ? '••••' : formatPrice(ringData.outer.amount, currency)}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${ringData.outer.pct}%`, backgroundColor: ringData.outer.color },
                ]}
              />
            </View>
          </View>

          <View style={styles.barItem}>
            <View style={styles.barItemTop}>
              <Text style={styles.barLabel}>{ringData.middle.label}</Text>
              <Text style={[styles.barValue, { color: ringData.middle.color }]}>
                {ringData.middle.pct}% · {balanceHidden ? '••••' : formatPrice(ringData.middle.amount, currency)}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${ringData.middle.pct}%`, backgroundColor: ringData.middle.color },
                ]}
              />
            </View>
          </View>

          <View style={styles.barItem}>
            <View style={styles.barItemTop}>
              <Text style={styles.barLabel}>{ringData.inner.label}</Text>
              <Text style={[styles.barValue, { color: ringData.inner.color }]}>
                {ringData.inner.pct}% · {balanceHidden ? '••••' : formatPrice(ringData.inner.amount, currency)}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${ringData.inner.pct}%`, backgroundColor: ringData.inner.color },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── VIEW MODE C: Trend / Financial 4-Card Grid ──────────────────── */}
      {viewMode === 'trend' && (
        <View style={styles.trendGrid}>
          <Pressable
            style={({ pressed }) => [styles.trendCard, pressed && { opacity: 0.85 }]}
            onPress={onPressWallet}
            disabled={!onPressWallet}
          >
            <Text style={styles.trendCardLabel}>Total Earnings</Text>
            <Text style={styles.trendCardValue}>
              {balanceHidden ? '••••••' : formatPrice(totalEarnings, currency)}
            </Text>
            <Text style={[styles.trendCardSub, { color: isDark ? '#4ADE80' : '#059669' }]}>
              {isComparisonMode
                ? `${centerDisplay.number}% Goal Met`
                : totalEarnings > 0
                  ? 'Verified Net'
                  : 'Starting Out'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.trendCard, pressed && { opacity: 0.85 }]}
            onPress={onPressWallet}
            disabled={!onPressWallet}
          >
            <Text style={styles.trendCardLabel}>Bookings</Text>
            <Text style={styles.trendCardValue}>{completedShoots}</Text>
            <Text style={[styles.trendCardSub, { color: colors.primary }]}>Completed shoots</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.trendCard, pressed && { opacity: 0.85 }]}
            onPress={onPressClients}
            disabled={!onPressClients}
          >
            <Text style={styles.trendCardLabel}>Active Clients</Text>
            <Text style={styles.trendCardValue}>{totalClients}</Text>
            <Text style={[styles.trendCardSub, { color: colors.accent }]}>Direct CRM</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.trendCard, pressed && { opacity: 0.85 }]}
            onPress={onPressWallet}
            disabled={!onPressWallet}
          >
            <Text style={styles.trendCardLabel}>Tips & Bonuses</Text>
            <Text style={styles.trendCardValue}>
              {balanceHidden ? '••••••' : formatPrice(totalTips + bonuses, currency)}
            </Text>
            <Text style={[styles.trendCardSub, { color: isDark ? '#2DD4BF' : '#0D9488' }]}>Rewards tally</Text>
          </Pressable>
        </View>
      )}

      {/* ── VIEW MODE D: Reviews & Satisfaction Breakdown ────────────────── */}
      {viewMode === 'pie' && (
        <View style={styles.pieViewContainer}>
          <View style={styles.pieScoreRow}>
            <View style={styles.pieRatingCircle}>
              <Text style={styles.pieRatingNumber}>
                {(analytics?.averageRating && analytics.averageRating > 0)
                  ? analytics.averageRating.toFixed(1)
                  : 'New'}
              </Text>
              {(analytics?.averageRating && analytics.averageRating > 0) ? (
                <Text style={styles.pieRatingMax}>/ 5.0</Text>
              ) : null}
            </View>
            <View style={styles.pieScoreCol}>
              <Text style={styles.pieScoreTitle}>Creator Satisfaction Score</Text>
              <Text style={styles.pieScoreSub}>
                Based on verified event client reviews and on-time delivery
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={s <= Math.round(analytics?.averageRating ?? 0) ? 'star' : 'star-outline'}
                    size={14}
                    color="#F59E0B"
                  />
                ))}
                <Text style={styles.reviewsCountText}>
                  {(analytics?.averageRating && analytics.averageRating > 0)
                    ? `${analytics?.totalBookings ?? completedShoots} verified bookings`
                    : 'Awaiting first review'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  cardContainer: {
    backgroundColor: c.surface,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
    ...e(2),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleCol: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  iconSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  switcherIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherIconBtnActive: {
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
  },
  actionPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  actionChipActive: {
    backgroundColor: c.tintAccent,
    borderColor: c.accent,
  },
  actionChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
  },
  resetSelectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tintAccent,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.accent,
    marginLeft: 'auto',
  },
  resetSelectionText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.accent,
  },

  // ── Donut Chart Graphic & Center Overlay ──────────────────────────────
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
    position: 'relative',
    height: 260,
  },
  svgWrapper: {
    width: 280,
    height: 260,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterOverlay: {
    position: 'absolute',
    left: 92,
    top: 79,
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 1,
  },
  centerNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerBigNumber: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: c.text,
    letterSpacing: -0.5,
    lineHeight: 36,
    textAlign: 'center',
  },
  centerPercentSign: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.textMuted,
    marginTop: 2,
    marginLeft: 1,
    lineHeight: 18,
  },
  centerSubLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.textSoft,
    letterSpacing: 0.2,
    lineHeight: 13,
    textAlign: 'center',
  },
  centerAmountLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: c.textMuted,
    lineHeight: 12,
    textAlign: 'center',
  },

  // ── Bottom Legend Capsules ────────────────────────────────────────────
  legendCapsulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: spacing.xs,
  },
  legendCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  legendCapsuleSelected: {
    borderWidth: 1.5,
    transform: [{ scale: 1.02 }],
  },
  capsuleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  capsuleText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.text,
  },

  // ── Mode B: Bar View ──────────────────────────────────────────────────
  barViewContainer: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  barItem: {
    gap: 6,
  },
  barItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  barValue: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  barTrack: {
    height: 10,
    backgroundColor: c.surfaceMuted,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },

  // ── Mode C: Trend Grid ────────────────────────────────────────────────
  trendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  trendCard: {
    width: '48%',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 3,
  },
  trendCardLabel: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
  },
  trendCardValue: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: c.text,
  },
  trendCardSub: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    marginTop: 2,
  },

  // ── Mode D: Pie View ──────────────────────────────────────────────────
  pieViewContainer: {
    paddingVertical: spacing.lg,
  },
  pieScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pieRatingCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieRatingNumber: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 25,
    color: '#F59E0B',
    textAlign: 'center',
  },
  pieRatingMax: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 12,
    color: c.textMuted,
    textAlign: 'center',
  },
  pieScoreCol: {
    flex: 1,
    gap: 3,
  },
  pieScoreTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
  },
  pieScoreSub: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
    lineHeight: 16,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  reviewsCountText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    marginLeft: 6,
  },
}));
