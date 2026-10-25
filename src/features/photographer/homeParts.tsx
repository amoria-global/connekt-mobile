/**
 * Home building blocks for the photographer workspace: the priority task, a shoot
 * card with its photograph, the business overview and a recent-earnings row.
 * Presentational only. Every value is passed in already formatted, and a value
 * that is unknown arrives as "N/A", never as a zero.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { darkPalette, fonts, makeStyles, radii, shadows, spacing, tracking, useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { DateTile } from '@/components/ui/DateTile';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { LivePill, LiveTwinkle } from '@/components/ui/live';
import { useSharedT } from '@/i18n/sharedStrings';
import { ActionButton, Card, IconTile, StatusBadge, StatusText } from './kit';
import { ProgressRing } from './charts';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'live' | 'active';

/** A real photograph when the event has one, otherwise an icon tile of the same size (never a blank grey box). */
export function Thumb({ uri, size = 60 }: { uri?: string; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radii.md }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.thumbFallback, { width: size, height: size }]}>
      <Ionicons name="camera-outline" size={Math.round(size * 0.36)} color={colors.link} />
    </View>
  );
}

function MetaLine({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.metaLine}>
      <Ionicons name={icon} size={13} color={colors.textMuted} style={styles.metaIcon} />
      <Text style={styles.meta} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

export type ShootFacts = {
  title: string;
  cover?: string;
  status: { label: string; tone: Tone };
  live?: boolean;
  when: string;
  location?: string;
  client?: string;
  /** Who is shooting it, for the client side. */
  photographer?: string;
};

/**
 * A shoot with its photograph at the left, the facts at the right and compact
 * actions below. `actions` are only the ones the caller can really perform.
 */
export function ShootCard({ shoot, actions, flush = true }: { shoot: ShootFacts; actions: ReactNode; flush?: boolean }) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const card = (
    <Card style={flush || shoot.live ? styles.flush : undefined}>
      <View style={styles.shootRow}>
        <Thumb uri={shoot.cover} />
        <View style={styles.shootText}>
          {shoot.live ? <LivePill label="Live now" size="xs" sparkle /> : <StatusBadge {...shoot.status} />}
          <Text style={styles.shootTitle} numberOfLines={2}>
            {tr(shoot.title)}
          </Text>
          <MetaLine icon="calendar-outline" text={tr(shoot.when)} />
          {shoot.location ? <MetaLine icon="location-outline" text={shoot.location} /> : null}
          {shoot.client ? <MetaLine icon="person-outline" text={`${tr('Client')}: ${shoot.client}`} /> : null}
          {shoot.photographer ? <MetaLine icon="camera-outline" text={`${tr('Photographer')}: ${shoot.photographer}`} /> : null}
        </View>
      </View>
      <View style={styles.actions}>{actions}</View>
    </Card>
  );
  if (!shoot.live) return card;
  return (
    <LiveTwinkle active radius={radii.lg} style={!flush ? styles.twinkleWrap : undefined}>
      {card}
    </LiveTwinkle>
  );
}

const CHIP_TONE: Record<Tone, ChipTone> = { success: 'success', warning: 'pending', error: 'error', info: 'primary', neutral: 'neutral', live: 'live', active: 'active' };

/**
 * The next shoot as Home leads with it (design/home.png): the paper calendar tile (the screen's
 * one tactile object), status, title and facts, then View shoot and a square Message button.
 * The date is the most useful fact, so it is the biggest thing on the card.
 */
export function NextShootCard({
  date,
  shoot,
  onView,
  onMessage,
}: {
  /** The shoot's day, or null when it has none yet (the tile then falls back to the photograph). */
  date: Date | null;
  shoot: ShootFacts;
  onView: () => void;
  onMessage?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const facts = [shoot.when, shoot.location, shoot.client].filter(Boolean) as string[];
  return (
    <View style={styles.cardGutter}>
      <GlassCard style={styles.nextCard}>
        <View style={styles.shootRow}>
          {date ? <DateTile date={date} variant="paper" showWeekday size={54} /> : <Thumb uri={shoot.cover} size={54} />}
          <View style={styles.shootText}>
            {shoot.live ? (
              <LivePill label="Live now" size="xs" sparkle />
            ) : (
              <StatusChip label={tr(shoot.status.label)} tone={CHIP_TONE[shoot.status.tone]} dot />
            )}
            <Text style={styles.nextTitle} numberOfLines={2}>
              {tr(shoot.title)}
            </Text>
            <Text style={styles.nextFacts} numberOfLines={2}>
              {facts.map((f) => tr(f)).join('  ·  ')}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button title="View shoot" onPress={onView} style={styles.fill} />
          {onMessage ? (
            <Pressable
              onPress={onMessage}
              accessibilityRole="button"
              accessibilityLabel={shoot.client ? `${tr('Message')} ${shoot.client}` : tr('Message')}
              style={({ pressed }) => [styles.squareBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </GlassCard>
    </View>
  );
}

/** A compact shoot row (design/events.png, Coming up): date well, title, time and place, chevron. */
export function ShootRow({ date, title, meta, onPress }: { date: Date | null; title: string; meta: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tr(title)}, ${meta}`}
      style={({ pressed }) => [styles.cardGutter, pressed && { opacity: 0.88 }]}
    >
      <GlassCard style={styles.shootRowCard}>
        {date ? <DateTile date={date} variant="glass" size={52} /> : <Thumb size={40} />}
        <View style={styles.shootText}>
          <Text style={styles.rowTitleDisplay} numberOfLines={1}>
            {tr(title)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </GlassCard>
    </Pressable>
  );
}

/** The one thing to act on today, with its photograph and its single next step. */
export function PriorityCard({
  title,
  subtitle,
  cover,
  when,
  status,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  cover?: string;
  when: string;
  status: { label: string; tone: Tone };
  actionLabel: string;
  onAction: () => void;
}) {
  const styles = useStyles();
  const { tr } = useSharedT();
  return (
    <Card>
      <View style={styles.shootRow}>
        <Thumb uri={cover} size={56} />
        <View style={styles.shootText}>
          <Text style={styles.shootTitle} numberOfLines={2}>
            {tr(title)}
          </Text>
          {subtitle ? (
            <Text style={styles.meta} numberOfLines={3}>
              {tr(subtitle)}
            </Text>
          ) : null}
          <MetaLine icon="time-outline" text={tr(when)} />
          <StatusText {...status} />
        </View>
      </View>
      <View style={styles.actions}>
        <ActionButton label={actionLabel} variant="primary" compact onPress={onAction} style={styles.fill} />
      </View>
    </Card>
  );
}

/** The business overview: lifetime earnings beside the rating ring, then three counted tiles. */
export function BusinessOverview({
  earnings,
  earningsCaption,
  rating,
  reviewCount,
  loadingReviews,
  tiles,
  loading,
}: {
  earnings: string;
  earningsCaption: string;
  /** Average out of 5, or null when there are no reviews. */
  rating: number | null;
  reviewCount: number;
  loadingReviews: boolean;
  tiles: readonly { key: string; label: string; value: string; icon: keyof typeof Ionicons.glyphMap }[];
  loading: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const ratingText = rating != null ? rating.toFixed(1) : null;
  return (
    <View>
      <View style={styles.overviewTop}>
        <Card style={[styles.flush, styles.earnCard]}>
          <View style={styles.earnHead}>
            <IconTile icon="cash-outline" tone="success" size={30} />
            <Text style={styles.earnLabel} maxFontSizeMultiplier={1.6}>
              Lifetime earnings
            </Text>
          </View>
          <Text style={styles.earnValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} accessibilityLabel={`Lifetime earnings, ${earnings}`}>
            {loading ? '' : earnings}
          </Text>
          <Text style={styles.meta}>{tr(earningsCaption)}</Text>
        </Card>
        <Card style={[styles.flush, styles.ratingCard]}>
          <Text style={styles.earnLabel} maxFontSizeMultiplier={1.6}>
            Reviews
          </Text>
          <ProgressRing
            size={92}
            stroke={9}
            fraction={rating != null ? rating / 5 : null}
            color={colors.accent}
            label={ratingText ? `Rating ${ratingText} out of 5 from ${reviewCount} reviews` : 'No reviews yet'}
          >
            {ratingText ? (
              <View style={styles.ringCentre}>
                <Text style={styles.ringValue} maxFontSizeMultiplier={1.6}>
                  {ratingText}
                </Text>
                <Text style={styles.ringOutOf}>{tr('out of 5')}</Text>
              </View>
            ) : (
              <Text style={styles.ringNone} maxFontSizeMultiplier={1.6}>
                {loadingReviews ? 'N/A' : tr('No reviews yet')}
              </Text>
            )}
          </ProgressRing>
          {ratingText ? (
            // The rating and the review list come from different endpoints, so a count is shown only when the list has one.
            <Text style={styles.meta}>
              {reviewCount > 0 ? `${reviewCount} ${tr(reviewCount === 1 ? 'review' : 'reviews')}` : tr('Average rating')}
            </Text>
          ) : null}
        </Card>
      </View>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.key} style={styles.fill} accessible accessibilityLabel={`${t.label}, ${loading ? 'loading' : t.value}`}>
            <GlassCard style={styles.tile}>
              <IconTile icon={t.icon} tone="primary" size={28} />
              <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {loading ? ' ' : t.value}
              </Text>
              <Text style={styles.tileLabel} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                {t.label}
              </Text>
            </GlassCard>
          </View>
        ))}
      </View>
    </View>
  );
}

/** One line of the recent-earnings list: icon tile, what and when, signed amount over its real status. */
export function EarningRow({
  title,
  when,
  amount,
  positive,
  status,
  divider,
  onPress,
  a11y,
}: {
  title: string;
  when: string;
  amount: string;
  positive: boolean;
  status: { label: string; tone: Tone };
  divider: boolean;
  onPress: () => void;
  a11y: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.earnRow, divider && styles.divider, pressed && { opacity: 0.85 }]}
    >
      <IconTile icon={positive ? 'arrow-down' : 'arrow-up'} tone={positive ? 'success' : 'warning'} size={34} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={3}>
          {when}
        </Text>
      </View>
      <View style={styles.rowAmount}>
        <Text style={[styles.amount, positive && { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {amount}
        </Text>
        <StatusText {...status} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flush: { marginHorizontal: 0 },
  twinkleWrap: { marginHorizontal: spacing.lg },
  cardGutter: { marginHorizontal: spacing.lg },
  fill: { flex: 1 },
  thumbFallback: {
    borderRadius: radii.md,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shootRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  shootText: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  shootTitle: { color: c.text, fontSize: 17, fontFamily: fonts.display, lineHeight: 22, letterSpacing: tracking(17, -0.02) },
  meta: { color: c.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, alignSelf: 'stretch' },
  metaIcon: { marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  nextCard: { borderRadius: radii.xl, padding: spacing.lg },
  nextTitle: { color: c.text, fontSize: 20, lineHeight: 25, fontFamily: fonts.display, letterSpacing: tracking(20, -0.02) },
  nextFacts: { color: c.textSoft, fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
  shootRowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, minHeight: 52 },
  rowTitleDisplay: { color: c.text, fontSize: 17, fontFamily: fonts.display, letterSpacing: tracking(17, -0.02) },
  squareBtn: {
    width: 52,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.glassTop,
    alignItems: 'center',
    justifyContent: 'center',
  },

  overviewTop: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  earnCard: { flex: 1.15, gap: 6, justifyContent: 'space-between' },
  ratingCard: { flex: 1, alignItems: 'center', gap: 6 },
  earnHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  earnLabel: { flexShrink: 1, color: c.textSoft, fontSize: 13, fontFamily: fonts.medium },
  earnValue: { color: c.text, fontSize: 26, fontFamily: fonts.display, minHeight: 32, letterSpacing: tracking(26, -0.03) },
  ringCentre: { alignItems: 'center' },
  ringValue: { color: c.text, fontSize: 24, fontFamily: fonts.display, lineHeight: 28 },
  ringOutOf: { color: c.textMuted, fontSize: 11, fontFamily: fonts.regular },
  ringNone: { color: c.textMuted, fontSize: 12, fontFamily: fonts.medium, textAlign: 'center', paddingHorizontal: 14 },
  tiles: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  tile: { flex: 1, gap: 5, padding: spacing.md, borderRadius: radii.lg },
  tileValue: { color: c.text, fontSize: 22, fontFamily: fonts.display },
  tileLabel: { color: c.textMuted, fontSize: 12, lineHeight: 15, fontFamily: fonts.regular },

  earnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2, minHeight: 60 },
  divider: { borderBottomWidth: 1, borderBottomColor: c.stroke },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: c.text, fontSize: 15, fontFamily: fonts.semibold },
  rowAmount: { alignItems: 'flex-end', maxWidth: '42%', gap: 2 },
  amount: { color: c.text, fontSize: 16, fontFamily: fonts.display },
}));
