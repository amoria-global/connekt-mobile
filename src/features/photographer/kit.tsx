/**
 * Small component family for the photographer workspace (home, wallet, calendar).
 * Presentational only: no data fetching, no business rules. Colours come from the
 * active palette so light and dark both work.
 *
 * Midnight Glass (design/brief.png): every block is glass (`Card`, `MetricCard`,
 * notices), actions are flat fills or glass with a stroke, and colour carries meaning:
 * blue action, magenta attention, cyan live or collaboration, amber pending. The one
 * raised button on a screen is the kit's `PrimaryButton`, never an ActionButton.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, makeStyles, radii, shadows, spacing, tracking, useTheme } from '@/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton as Pulse } from '@/components/ui/Skeleton';
import { useSharedT } from '@/i18n/sharedStrings';

type IconName = keyof typeof Ionicons.glyphMap;

/** Minimum comfortable touch size (iOS 44pt, Android 48dp). */
export const TOUCH = 48;

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  right,
  flush,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
  /** Drops the side padding when the parent already provides the gutter. */
  flush?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  return (
    <View style={[styles.sectionHeader, flush && { paddingHorizontal: 0 }]}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle} accessibilityRole="header" numberOfLines={3}>
          {tr(title)}
        </Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle} numberOfLines={4}>
            {tr(subtitle)}
          </Text>
        ) : null}
      </View>
      {right}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${tr(actionLabel)}, ${tr(title)}`}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
        >
          <Text style={styles.sectionActionText}>{tr(actionLabel)}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.link} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Horizontally browsable row of independent cards. The next card peeks in so
 * it is clear there is more. Snaps per card. Keep it short (a preview), and
 * pair it with a "See all" route when the full collection is larger.
 */
export function HCarousel<T>({
  data,
  keyOf,
  renderItem,
  label,
  itemWidth,
}: {
  data: readonly T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Screen-reader name for the list. */
  label: string;
  /** Override the responsive card width. */
  itemWidth?: number;
}) {
  const { width } = useWindowDimensions();
  // One card takes the full row (no dead strip beside it); several leave the next card peeking in.
  const cardW =
    itemWidth ?? (data.length === 1 ? width - spacing.lg * 2 : Math.min(340, Math.max(236, Math.round(width * 0.84))));
  const gap = spacing.md;
  return (
    <FlatList
      horizontal
      data={data as T[]}
      keyExtractor={keyOf}
      renderItem={({ item }) => <View style={{ width: cardW }}>{renderItem(item)}</View>}
      ItemSeparatorComponent={Gap}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardW + gap}
      decelerationRate="fast"
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      accessibilityLabel={label}
      // Let a vertical swipe that starts on a card still scroll the page.
      directionalLockEnabled
      nestedScrollEnabled
      // Previews are short, so render every card: off-screen cards stay reachable
      // by screen readers and by tests. Longer lists fall back to virtualisation.
      initialNumToRender={Math.min(data.length, 12)}
      windowSize={7}
    />
  );
}

export function MetricCard({
  label,
  value,
  caption,
  icon,
  tone = 'primary',
  onPress,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  /** Already formatted. Pass "N/A" for unknown, never a fabricated zero. */
  value: string;
  caption?: string;
  icon?: IconName;
  tone?: 'primary' | 'accent' | 'success' | 'warning';
  onPress?: () => void;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const toneColor = { primary: colors.link, accent: colors.accentLight, success: colors.success, warning: colors.pending }[tone];
  // The icon tile carries the tone too (blue wallet, amber clock, green check).
  const toneTile = { primary: colors.tint, accent: colors.tintAccent, success: colors.successBg, warning: colors.pendingBg }[tone];
  const body = (
    <>
      <View style={styles.metricTop}>
        {icon ? (
          <View style={[styles.metricIcon, { backgroundColor: toneTile }]}>
            <Ionicons name={icon} size={16} color={toneColor} />
          </View>
        ) : null}
        <Text style={styles.metricLabel} maxFontSizeMultiplier={1.6}>
          {tr(label)}
        </Text>
        {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textMuted} /> : null}
      </View>
      {loading ? (
        <Skeleton height={26} width="70%" />
      ) : (
        <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
      )}
      {caption ? (
        <Text style={styles.metricCaption}>
          {tr(caption)}
        </Text>
      ) : null}
    </>
  );
  const a11y = loading ? `${tr(label)}, loading` : `${tr(label)}, ${value}${caption ? `, ${tr(caption)}` : ''}`;
  const card = <GlassCard style={styles.metricCard}>{body}</GlassCard>;
  if (!onPress) {
    return (
      <View style={[styles.metricWrap, style]} accessible accessibilityLabel={a11y}>
        {card}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.metricWrap, style, pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
}

/** Filled primary, outlined secondary, or quiet tertiary action. Always has a text label. */
export function ActionButton({
  label,
  icon,
  onPress,
  variant = 'secondary',
  disabled,
  busy,
  badge,
  caption,
  compact,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'accent' | 'teal';
  disabled?: boolean;
  busy?: boolean;
  badge?: number;
  /** A second, quieter line under the label (Opportunities: "Booking requests"). */
  caption?: string;
  /** Shorter control for use inside cards (44dp). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const { fontScale } = useWindowDimensions();
  // At large text two buttons per row leave a label only ~100dp beside its icon, which split words ("Opportuniti / es").
  // Stacking the icon over the label gives it the whole button width.
  const stacked = fontScale > 1.3 && !!icon && !busy;
  const inactive = disabled || busy;
  // A secondary action with items waiting on the photographer (a badge) takes the accent: magenta is attention.
  const attention = variant === 'secondary' && !!badge;
  const fg =
    variant === 'primary'
      ? colors.textOnPrimary
      : variant === 'destructive'
        ? colors.error
        : variant === 'accent' || attention
          ? colors.accentLight
          : variant === 'teal'
            ? colors.active
            : colors.text;
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${tr(label)}, ${badge} waiting` : tr(label)}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={({ pressed }) => [
        styles.action,
        compact && styles.actionCompact,
        stacked && styles.actionStacked,
        variant === 'primary' && styles.actionPrimary,
        variant !== 'primary' && variant !== 'tertiary' && variant !== 'destructive' && styles.actionGlass,
        (variant === 'tertiary' || variant === 'destructive') && styles.actionQuiet,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={fg} />
      ) : null}
      {caption ? (
        <View style={[styles.actionTextCol, stacked && { alignItems: 'center' }]}>
          <Text style={[styles.actionText, styles.actionTextLeft, stacked && { textAlign: 'center' }, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.6}>
            {tr(label)}
          </Text>
          <Text style={[styles.actionCaption, stacked && { textAlign: 'center' }, variant === 'primary' && { color: colors.textOnPrimary, opacity: 0.85 }]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {tr(caption)}
          </Text>
        </View>
      ) : (
        <Text style={[styles.actionText, { color: fg }]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
          {tr(label)}
        </Text>
      )}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Small rounded icon tile, the prototype marker at the start of every information row. */
export function IconTile({
  icon,
  tone = 'primary',
  size = 34,
}: {
  icon: IconName;
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'teal';
  size?: number;
}) {
  const { colors } = useTheme();
  const fg = { primary: colors.link, accent: colors.accentLight, success: colors.success, warning: colors.pending, error: colors.error, teal: colors.active }[tone];
  const bg = {
    primary: colors.tint,
    accent: colors.tintAccent,
    success: colors.successBg,
    warning: colors.pendingBg,
    error: colors.errorBg,
    teal: colors.activeBg,
  }[tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.36), backgroundColor: bg, borderWidth: 1, borderColor: colors.stroke, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

/** A status as a small icon and a word in its own colour (never colour alone, and lighter than a pill in a dense row). */
export function StatusText({ label, tone, icon }: { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'live' | 'active'; icon?: IconName }) {
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const fg = { success: colors.success, warning: colors.pending, error: colors.error, info: colors.link, neutral: colors.textMuted, live: colors.liveText, active: colors.active }[tone];
  const glyph = icon ?? ({ success: 'checkmark-circle', warning: 'time', error: 'alert-circle', info: 'information-circle', neutral: 'ellipse-outline', live: 'radio', active: 'sync' }[tone] as IconName);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={glyph} size={12} color={fg} />
      <Text style={{ color: fg, fontSize: 12, fontFamily: fonts.semibold }} numberOfLines={1} maxFontSizeMultiplier={1.6}>
        {tr(label)}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
}) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const displayLabel = tr(label);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {displayLabel}
        {count != null ? ` ${count}` : ''}
      </Text>
    </Pressable>
  );
}

/** Segmented tabs (Overview / Analytics / Activity, Week / Month / Year). */
export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  const styles = useStyles();
  const { tr } = useSharedT();
  return (
    <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel={label}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segmentItem, on && styles.segmentItemOn]}
          >
            <Text
              style={[styles.segmentText, on && styles.segmentTextOn]}
              numberOfLines={1}
              // Four short words must fit one row at the largest system text size, so the tab label shrinks a little
              // rather than turning "Agenda" into "Agen...".
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              maxFontSizeMultiplier={1.6}
            >
              {tr(t.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Status carried by an icon and a word, never by colour alone. */
export function StatusBadge({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'live' | 'active';
  icon?: IconName;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const map = {
    success: [colors.successBg, colors.success, 'checkmark-circle'],
    warning: [colors.pendingBg, colors.pending, 'time'],
    error: [colors.errorBg, colors.error, 'alert-circle'],
    info: [colors.tint, colors.link, 'ellipse'],
    neutral: [colors.glassTop, colors.textSoft, 'ellipse-outline'],
    live: [colors.liveDeep, colors.textOnPrimary, 'radio'],
    active: [colors.activeBg, colors.active, 'sync'],
  } as const;
  const [bg, fg, defaultIcon] = map[tone];
  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Ionicons name={icon ?? (defaultIcon as IconName)} size={12} color={fg} />
      <Text style={[styles.badgePillText, { color: fg }]} numberOfLines={2}>
        {tr(label)}
      </Text>
    </View>
  );
}

export function Skeleton({ height, width = '100%', radius = radii.sm }: { height: number; width?: number | `${number}%`; radius?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Pulse height={height} width={width} radius={radius} />
    </View>
  );
}

/** Placeholder card with the same footprint as the content it stands in for, so layout does not jump. */
export function SkeletonCard({ height = 96 }: { height?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.cardWrap} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <GlassCard style={[styles.cardInner, { minHeight: height, gap: spacing.sm }]}>
        <Skeleton height={12} width="40%" />
        <Skeleton height={24} width="65%" />
        <Skeleton height={10} width="50%" />
      </GlassCard>
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
  compact,
  flush,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
  /** Drops the side margin when the parent already provides the gutter. */
  flush?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  return (
    <View style={[styles.notice, flush && { marginHorizontal: 0 }]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={compact ? 18 : 22} color={colors.error} />
      <Text style={[styles.noticeText, { color: colors.error }]}>{tr(message)}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={[styles.retryText, { color: colors.error }]}>{tr('Try again')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyNote({
  icon = 'file-tray-outline',
  title,
  body,
  actionLabel,
  onAction,
  compact,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Icon, words and one action in a short block, for places where an empty state must not dominate the screen. */
  compact?: boolean;
}) {
  const styles = useStyles();
  const { tr } = useSharedT();
  if (compact) {
    return (
      <View style={styles.cardWrap}>
      <GlassCard style={styles.emptyCompact}>
        <View style={styles.emptyCompactTop}>
          <IconTile icon={icon} tone="primary" size={36} />
          <View style={styles.emptyCompactText}>
            <Text style={styles.emptyTitleLeft}>{tr(title)}</Text>
            {body ? <Text style={styles.emptyBodyLeft}>{tr(body)}</Text> : null}
          </View>
        </View>
        {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} variant="secondary" compact /> : null}
      </GlassCard>
      </View>
    );
  }
  return (
    <View style={styles.cardWrap}>
      <GlassCard style={styles.empty}>
        <IconTile icon={icon} tone="primary" size={44} />
        <Text style={styles.emptyTitle}>{tr(title)}</Text>
        {body ? <Text style={styles.emptyBody}>{tr(body)}</Text> : null}
        {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} variant="secondary" /> : null}
      </GlassCard>
    </View>
  );
}

/** Raised surface used by every block in the workspace. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  // The gutter sits on an outer view so the glass keeps its own shadow and corner clip.
  const { marginHorizontal, marginTop, marginBottom, margin, ...inner } = (StyleSheet.flatten([styles.card, style]) ?? {}) as ViewStyle;
  return (
    <View style={{ marginHorizontal, marginTop, marginBottom, margin }}>
      <GlassCard style={inner}>{children}</GlassCard>
    </View>
  );
}

export const useStyles = makeStyles((c) => ({
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  cardWrap: { marginHorizontal: spacing.lg },
  cardInner: { borderRadius: radii.lg, padding: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionHeaderText: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: c.text, fontSize: 20, fontFamily: fonts.display, letterSpacing: tracking(20, -0.02) },
  sectionSubtitle: { color: c.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: TOUCH, paddingLeft: spacing.sm },
  sectionActionText: { color: c.link, fontSize: 14, fontFamily: fonts.semibold },
  metricWrap: { flex: 1 },
  metricCard: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 6,
    minHeight: 96,
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metricIcon: { width: 32, height: 32, borderRadius: 11, borderWidth: 1, borderColor: c.stroke, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { flex: 1, color: c.textSoft, fontSize: 13, fontFamily: fonts.medium, lineHeight: 17 },
  metricValue: { color: c.text, fontSize: 24, fontFamily: fonts.display, letterSpacing: tracking(24, -0.03) },
  metricCaption: { color: c.textMuted, fontSize: 12, lineHeight: 16, fontFamily: fonts.regular },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: TOUCH,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Flat blue fill with the raised family's top highlight; the screen's one raised button is PrimaryButton.
  actionPrimary: { backgroundColor: c.primary, borderColor: c.primary, boxShadow: shadows.highlight },
  // Every other action is glass with a stroke.
  actionGlass: { backgroundColor: c.glassTop, borderColor: c.stroke },
  actionQuiet: { backgroundColor: 'transparent' },
  actionCompact: { minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: 6 },
  actionTextCol: { flexShrink: 1, minWidth: 0 },
  actionTextLeft: { textAlign: 'left' },
  actionCaption: { color: c.textMuted, fontSize: 12, marginTop: 1, fontFamily: fonts.regular },
  actionStacked: { flexDirection: 'column', gap: spacing.xs, paddingHorizontal: spacing.sm },
  actionText: { fontSize: 15, fontFamily: fonts.bold, flexShrink: 1, textAlign: 'center' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: c.textOnPrimary, fontSize: 12, fontFamily: fonts.bold },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.glassTop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: c.tint, borderColor: c.primaryLight },
  chipText: { color: c.textSoft, fontSize: 14, fontFamily: fonts.semibold },
  chipTextSelected: { color: c.text },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
    boxShadow: shadows.inset,
    borderRadius: radii.md,
    padding: 4,
    marginHorizontal: spacing.lg,
  },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: radii.md - 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  segmentItemOn: { backgroundColor: c.primary, boxShadow: shadows.highlight },
  segmentText: { color: c.textMuted, fontSize: 14, fontFamily: fonts.semibold },
  segmentTextOn: { color: c.textOnPrimary },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  badgePillText: { fontSize: 12, fontFamily: fonts.semibold },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.errorLine,
    backgroundColor: c.errorBg,
  },
  noticeText: { flex: 1, minWidth: 160, fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  retryText: { fontSize: 14, fontFamily: fonts.bold },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
  },
  emptyCompact: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  emptyCompactTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyCompactText: { flex: 1, minWidth: 0, gap: 2 },
  emptyTitleLeft: { color: c.text, fontSize: 16, fontFamily: fonts.display },
  emptyBodyLeft: { color: c.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  emptyTitle: { color: c.text, fontSize: 18, fontFamily: fonts.display, textAlign: 'center' },
  emptyBody: { color: c.textSoft, fontSize: 14, lineHeight: 20, textAlign: 'center', fontFamily: fonts.regular },
}));

/** Module level so the carousel keeps one separator type and does not remount each gap on every render. */
function Gap() {
  return <View style={{ width: spacing.md }} />;
}
