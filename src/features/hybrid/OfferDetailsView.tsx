/**
 * Offer details for one Post My Event opportunity, in the Home screen's style. The photographer reviews the client's
 * offer against their own package, chooses how to deliver, and answers from one sticky footer.
 *
 * Presentation only: accepting and rejecting go through the handlers the screen already has, with the same two delivery
 * policies as before (the client's schedule, or the photographer's package policy).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { PrimaryButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { NavGroup, NavRow } from '@/components/ui/Compact';
import { chipColors } from '@/components/ui/StatusChip';
import type { ParsedOfferBrief } from './offerBrief';
import type { PhotographerOpportunity } from './types';
import { deliverableRows, deliveryRows, formatMoney, packageDifference, type LabelValue } from './offerPresentation';

export type OfferDeliveryChoice = 'CLIENT' | 'PHOTOGRAPHER_PACKAGE';
type Section = 'venue' | 'availability' | 'policies' | 'coordinator';
type Tr = (text: string) => string;

type Props = {
  opportunity: PhotographerOpportunity;
  brief: ParsedOfferBrief;
  coverUri: string;
  headline: string;
  /** "Sat, 7 Nov 2026", already formatted. */
  dateText: string;
  /** Venue and city in title case. */
  placeText: string;
  /** Time left to answer, or null once there is none to show. */
  timeLeft: string | null;
  expired: boolean;
  /** The client's offer in the offer's currency, or null for a flexible budget. */
  offer: number | null;
  currency: string;
  pkg: { name: string; price: number; currency: string; days?: number | null } | null;
  busyAction: 'accept_client' | 'accept_package' | 'reject' | null;
  topInset: number;
  bottomInset: number;
  tr: Tr;
  onBack: () => void;
  onAccept: (choice: OfferDeliveryChoice) => void;
  onReject: () => void;
};

export function OfferDetailsView(p: Props) {
  const { colors, gradients, isDark } = useTheme();
  const styles = useStyles();
  const { tr, brief, opportunity, pkg } = p;
  const [bookmarked, setBookmarked] = useState(false);
  const [viewingAs, setViewingAs] = useState<'photographer' | 'coordinator'>('photographer');
  const [open, setOpen] = useState<Section | null>(null);
  const [choice, setChoice] = useState<OfferDeliveryChoice>('CLIENT');

  const locked = p.busyAction !== null || p.expired;
  const diff = packageDifference(p.offer, pkg ? pkg.price : null, pkg?.currency ?? p.currency);
  const diffColors =
    diff?.tone === 'positive'
      ? chipColors(colors, gradients, isDark, 'success')
      : diff?.tone === 'warning'
        ? chipColors(colors, gradients, isDark, 'pending')
        : chipColors(colors, gradients, isDark, 'neutral');
  const live = chipColors(colors, gradients, isDark, p.expired ? 'neutral' : 'success');
  const clock = chipColors(colors, gradients, isDark, 'pending');
  const toggle = (s: Section) => setOpen((cur) => (cur === s ? null : s));
  const time = opportunity.startTime
    ? `${opportunity.startTime.slice(0, 5)}${opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''}`
    : tr('Time to be confirmed');
  const acceptLabel =
    p.busyAction === 'accept_client' || p.busyAction === 'accept_package'
      ? tr('Sending...')
      : p.offer != null
        ? `${tr('Accept offer')} · ${formatMoney(p.offer, p.currency)}`
        : tr('Accept offer');

  const renderRows = (rows: LabelValue[]) => (
    <View style={styles.rows}>
      {rows.map((r, i) => (
        <View key={r.label} style={[styles.row, i > 0 && styles.rowDivider]}>
          <Text style={styles.rowLabel}>{tr(r.label)}</Text>
          <Text style={styles.rowValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );

  const renderRadio = (value: OfferDeliveryChoice, title: string, caption: string) => {
    const on = choice === value;
    return (
      <Pressable
        key={value}
        onPress={() => setChoice(value)}
        disabled={locked}
        accessibilityRole="radio"
        accessibilityLabel={title}
        accessibilityState={{ checked: on, disabled: locked }}
        style={[styles.radio, on && styles.radioOn]}
      >
        <View style={[styles.dot, on && styles.dotOn]}>{on ? <View style={styles.dotCore} /> : null}</View>
        <View style={styles.radioText}>
          <Text style={styles.radioTitle}>{title}</Text>
          <Text style={styles.radioCaption}>{caption}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(p.topInset, 12) }]}>
      <View style={styles.header}>
        <Pressable onPress={p.onBack} style={styles.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('Back')}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {tr('Offer details')}
        </Text>
        <Pressable
          onPress={() => setBookmarked((b) => !b)}
          style={styles.iconBtn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={tr('Bookmark offer')}
        >
          <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={21} color={bookmarked ? colors.accent : colors.textSoft} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          <Image source={{ uri: p.coverUri }} style={styles.coverImg} contentFit="cover" />
          <View style={styles.coverChips}>
            <View style={[styles.chip, styles.chipOnCover, { borderColor: live.fg }]}>
              <View style={[styles.statusDot, { backgroundColor: live.fg }]} />
              <Text style={[styles.chipText, { color: live.fg }]}>{p.expired ? tr('Expired') : tr('Open offer')}</Text>
            </View>
            {p.timeLeft ? (
              <View style={[styles.chip, styles.chipOnCover, { borderColor: clock.fg }]} accessibilityLabel={`${tr('Respond in')} ${p.timeLeft}`}>
                <Ionicons name="stopwatch-outline" size={13} color={clock.fg} />
                <Text style={[styles.chipText, { color: clock.fg }]}>{`${tr('Respond in')} ${p.timeLeft}`}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.headline}>{p.headline}</Text>
          <Text style={styles.summary}>{`${p.dateText} · ${brief.coverageHoursLabel} · ${brief.coverageModeLabel}`}</Text>
        </View>

        <Segmented
          value={viewingAs}
          onChange={(v) => {
            setViewingAs(v);
            setOpen(v === 'coordinator' ? 'coordinator' : null);
          }}
          options={[
            { label: tr('Photographer'), value: 'photographer' },
            { label: tr('Coordinator'), value: 'coordinator' },
          ]}
        />

        <View style={styles.card}>
          <View style={styles.compare}>
            <View style={styles.compareCol}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>{tr("CLIENT'S OFFER")}</Text>
              <Text style={styles.bigAmount}>{p.offer != null ? formatMoney(p.offer, p.currency) : tr('Flexible budget')}</Text>
              <Text style={styles.caption}>{tr('Full requested scope')}</Text>
            </View>
            <View style={styles.compareCol}>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{tr('YOUR PACKAGE')}</Text>
              {pkg ? (
                <>
                  <Text style={styles.pkgName}>{pkg.name}</Text>
                  <Text style={styles.caption}>{formatMoney(pkg.price, pkg.currency)}</Text>
                </>
              ) : (
                <Text style={styles.caption}>{tr('No active package')}</Text>
              )}
            </View>
          </View>
          <View style={[styles.note, { backgroundColor: diffColors.bg }]}>
            <Text style={[styles.noteText, { color: diff ? diffColors.fg : colors.textSoft }]}>
              {diff ? `${diff.text}. ${tr('Compare inclusions below.')}` : tr('Configure packages in Profile to compare.')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>{tr('REQUESTED DELIVERABLES')}</Text>
          {renderRows(deliverableRows(brief, { liveStream: opportunity.hasLiveStream, wishes: opportunity.allowWishInvites }))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>{tr('DELIVERY REQUESTED')}</Text>
          {renderRows(deliveryRows(brief))}
        </View>

        <NavGroup>
          <View>
            <NavRow icon="location-outline" tone="primary" title={tr('Venue, schedule & references')} onPress={() => toggle('venue')} />
            {open === 'venue' ? (
              <View style={styles.expand}>
                <Text style={styles.expandTitle}>
                  {p.placeText}
                  {opportunity.distanceLabel ? ` (${opportunity.distanceLabel})` : ''}
                </Text>
                <Text style={styles.expandText}>{`${p.dateText} · ${time}`}</Text>
                {brief.rawNotes ? <Text style={styles.expandText}>{brief.rawNotes}</Text> : null}
              </View>
            ) : null}
          </View>
          <View>
            <NavRow icon="people-outline" tone="active" title={tr('Check availability & team')} onPress={() => toggle('availability')} />
            {open === 'availability' ? (
              <View style={styles.expand}>
                <Text style={styles.expandText}>{`${p.dateText} · ${time} · ${brief.coverageModeLabel} (${brief.coverageHoursLabel})`}</Text>
              </View>
            ) : null}
          </View>
          <View>
            <NavRow icon="document-text-outline" tone="pending" title={tr('Policies & exclusions')} onPress={() => toggle('policies')} />
            {open === 'policies' ? (
              <View style={styles.expand}>
                <Text style={styles.expandText}>{`${tr("Client's schedule")}: ${brief.digitalDeliveryLabel}`}</Text>
                <Text style={styles.expandText}>
                  {`${tr('Your package')}: ${pkg?.days ? `${pkg.days} ${pkg.days === 1 ? tr('day') : tr('days')}` : tr('Not set')}`}
                </Text>
              </View>
            ) : null}
          </View>
          <View>
            <NavRow
              icon="add-circle-outline"
              tone="accent"
              title={tr('Propose coordination services')}
              caption={tr('For coordinators · separate scope & price')}
              onPress={() => toggle('coordinator')}
            />
            {open === 'coordinator' ? (
              <View style={styles.expand}>
                <Text style={styles.expandText}>
                  {tr('After you accept, you can propose event coordination as a separate service, with its own scope and fee.')}
                </Text>
              </View>
            ) : null}
          </View>
        </NavGroup>

        <View style={styles.card} accessibilityRole="radiogroup" accessibilityLabel={tr('How do you want to deliver?')}>
          <Text style={styles.cardEyebrow}>{tr('HOW DO YOU WANT TO DELIVER?')}</Text>
          {renderRadio('CLIENT', tr("Client's delivery schedule"), tr('Book immediately when the client pays.'))}
          {renderRadio('PHOTOGRAPHER_PACKAGE', tr('My package delivery policy'), tr('The client must agree before booking.'))}
          <Text style={styles.caption}>{tr("Both options keep the client's price and scope.")}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(p.bottomInset, 10) + 4 }]}>
        <PrimaryButton title={acceptLabel} onPress={() => p.onAccept(choice)} disabled={locked} accessibilityLabel={tr('Accept offer')} />
        <Pressable
          onPress={p.onReject}
          disabled={p.busyAction !== null}
          accessibilityRole="button"
          accessibilityLabel={tr('Reject offer')}
          style={({ pressed }) => [styles.reject, pressed && { opacity: 0.85 }, p.busyAction !== null && { opacity: 0.5 }]}
        >
          <Text style={styles.rejectText}>{p.busyAction === 'reject' ? tr('Sending...') : tr('Reject offer')}</Text>
        </Pressable>
        <Text style={styles.footNote}>{tr('Booking confirms once the client pays.')}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  iconBtn: { width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.stroke },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  cover: { height: 150, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: c.well },
  coverImg: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const) },
  coverChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, paddingHorizontal: spacing.md, borderRadius: radii.full },
  chipOnCover: { backgroundColor: c.surface, borderWidth: 1 },
  chipText: { fontFamily: fonts.bold, fontSize: fontSize.xs },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  titleBlock: { gap: 2 },
  headline: { fontFamily: fonts.display, fontSize: fontSize.xl, color: c.text },
  summary: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 20, color: c.textSoft },
  card: { borderRadius: radii.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface, padding: spacing.md, gap: spacing.md },
  compare: { flexDirection: 'row', gap: spacing.lg },
  compareCol: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: fontSize.xs, letterSpacing: 0.8 },
  bigAmount: { fontFamily: fonts.display, fontSize: fontSize.xl, color: c.text },
  pkgName: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text },
  caption: { fontFamily: fonts.regular, fontSize: fontSize.xs, lineHeight: 18, color: c.textSoft },
  note: { borderRadius: radii.md, padding: spacing.md },
  noteText: { fontFamily: fonts.medium, fontSize: fontSize.sm, lineHeight: 20 },
  cardEyebrow: { fontFamily: fonts.semibold, fontSize: fontSize.xs, letterSpacing: 0.8, color: c.textMuted },
  rows: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, minHeight: 44, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.stroke },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 22, color: c.textSoft },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: fontSize.sm, lineHeight: 22, color: c.text },
  expand: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  expandTitle: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: c.text },
  expandText: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 20, color: c.textSoft },
  radio: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.well },
  radioOn: { borderColor: c.primary },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.textMuted, alignItems: 'center', justifyContent: 'center' },
  dotOn: { borderColor: c.primary },
  dotCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  radioText: { flex: 1, gap: 2 },
  radioTitle: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: c.text },
  radioCaption: { fontFamily: fonts.regular, fontSize: fontSize.xs, lineHeight: 18, color: c.textSoft },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.stroke, backgroundColor: c.background },
  reject: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, borderWidth: 1, borderColor: c.error },
  rejectText: { fontFamily: fonts.bold, fontSize: fontSize.md, color: c.error },
  footNote: { textAlign: 'center', fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.textMuted },
}));
