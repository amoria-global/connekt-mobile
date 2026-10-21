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
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { LivePill, LiveTwinkle } from '@/components/ui/live';
import { ActionButton, Card, IconTile, StatusBadge, StatusText } from './kit';
import { ProgressRing } from './charts';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** A real photograph when the event has one, otherwise an icon tile of the same size (never a blank grey box). */
export function Thumb({ uri, size = 88 }: { uri?: string; size?: number }) {
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
  const card = (
    <Card style={flush || shoot.live ? styles.flush : undefined}>
      <View style={styles.shootRow}>
        <Thumb uri={shoot.cover} />
        <View style={styles.shootText}>
          {shoot.live ? <LivePill label="Live now" size="xs" sparkle /> : <StatusBadge {...shoot.status} />}
          <Text style={styles.shootTitle} numberOfLines={2}>
            {shoot.title}
          </Text>
          <MetaLine icon="calendar-outline" text={shoot.when} />
          {shoot.location ? <MetaLine icon="location-outline" text={shoot.location} /> : null}
          {shoot.client ? <MetaLine icon="person-outline" text={`Client: ${shoot.client}`} /> : null}
          {shoot.photographer ? <MetaLine icon="camera-outline" text={`Photographer: ${shoot.photographer}`} /> : null}
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
  return (
    <Card>
      <View style={styles.shootRow}>
        <Thumb uri={cover} size={76} />
        <View style={styles.shootText}>
          <Text style={styles.shootTitle} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.meta} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <MetaLine icon="time-outline" text={when} />
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
          <Text style={styles.meta}>{earningsCaption}</Text>
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
                <Text style={styles.ringOutOf}>out of 5</Text>
              </View>
            ) : (
              <Text style={styles.ringNone} maxFontSizeMultiplier={1.6}>
                {loadingReviews ? 'N/A' : 'No reviews yet'}
              </Text>
            )}
          </ProgressRing>
          {ratingText ? (
            // The rating and the review list come from different endpoints, so a count is shown only when the list has one.
            <Text style={styles.meta}>
              {reviewCount > 0 ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'Average rating'}
            </Text>
          ) : null}
        </Card>
      </View>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.key} style={styles.tile} accessible accessibilityLabel={`${t.label}, ${loading ? 'loading' : t.value}`}>
            <IconTile icon={t.icon} tone="primary" size={28} />
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {loading ? ' ' : t.value}
            </Text>
            <Text style={styles.tileLabel} numberOfLines={2} maxFontSizeMultiplier={1.6}>
              {t.label}
            </Text>
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
        <Text style={styles.meta} numberOfLines={1}>
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
  fill: { flex: 1 },
  thumbFallback: { borderRadius: radii.md, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  shootRow: { flexDirection: 'row', gap: spacing.md },
  shootText: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  shootTitle: { color: c.text, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  meta: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, alignSelf: 'stretch' },
  metaIcon: { marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  overviewTop: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  earnCard: { flex: 1.15, gap: 6, justifyContent: 'space-between' },
  ratingCard: { flex: 1, alignItems: 'center', gap: 6 },
  earnHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  earnLabel: { flexShrink: 1, color: c.textSoft, fontSize: 12.5, fontWeight: '700' },
  earnValue: { color: c.text, fontSize: 24, fontWeight: '800', minHeight: 30 },
  ringCentre: { alignItems: 'center' },
  ringValue: { color: c.text, fontSize: 22, fontWeight: '800', lineHeight: 26 },
  ringOutOf: { color: c.textMuted, fontSize: 11 },
  ringNone: { color: c.textMuted, fontSize: 11.5, fontWeight: '600', textAlign: 'center', paddingHorizontal: 14 },
  tiles: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  tile: {
    flex: 1,
    gap: 5,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  tileValue: { color: c.text, fontSize: 20, fontWeight: '800' },
  tileLabel: { color: c.textMuted, fontSize: 12, lineHeight: 15 },

  earnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2, minHeight: 60 },
  divider: { borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  rowAmount: { alignItems: 'flex-end', maxWidth: '42%', gap: 2 },
  amount: { color: c.text, fontSize: 15, fontWeight: '800' },
}));
