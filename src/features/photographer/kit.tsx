/**
 * Small component family for the photographer workspace (home, wallet, calendar).
 * Presentational only: no data fetching, no business rules. Colours come from the
 * active palette so light and dark both work.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Minimum comfortable touch size (iOS 44pt, Android 48dp). */
export const TOUCH = 48;

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  right,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
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
  const cardW = itemWidth ?? Math.min(320, Math.max(220, Math.round(width * 0.78)));
  const gap = spacing.md;
  return (
    <FlatList
      horizontal
      data={data as T[]}
      keyExtractor={keyOf}
      renderItem={({ item }) => <View style={{ width: cardW }}>{renderItem(item)}</View>}
      ItemSeparatorComponent={() => <View style={{ width: gap }} />}
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
  const toneColor = { primary: colors.primary, accent: colors.accent, success: colors.success, warning: colors.warning }[tone];
  const body = (
    <>
      <View style={styles.metricTop}>
        {icon ? (
          <View style={[styles.metricIcon, { backgroundColor: colors.tint }]}>
            <Ionicons name={icon} size={16} color={toneColor} />
          </View>
        ) : null}
        <Text style={styles.metricLabel} maxFontSizeMultiplier={1.25}>
          {label}
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
          {caption}
        </Text>
      ) : null}
    </>
  );
  const a11y = loading ? `${label}, loading` : `${label}, ${value}${caption ? `, ${caption}` : ''}`;
  if (!onPress) {
    return (
      <View style={[styles.metricCard, style]} accessible accessibilityLabel={a11y}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.metricCard, style, pressed && styles.pressed]}
    >
      {body}
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
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary';
  disabled?: boolean;
  busy?: boolean;
  badge?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // At large text two buttons per row leave a label only ~100dp beside its icon, which split words ("Opportuniti / es").
  // Stacking the icon over the label gives it the whole button width.
  const stacked = fontScale > 1.3 && !!icon && !busy;
  const inactive = disabled || busy;
  const fg = variant === 'primary' ? colors.textOnPrimary : colors.link;
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} waiting` : label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={({ pressed }) => [
        styles.action,
        stacked && styles.actionStacked,
        variant === 'primary' && { backgroundColor: colors.primary, borderColor: colors.primary },
        variant === 'secondary' && { borderColor: colors.primary },
        variant === 'tertiary' && { borderColor: 'transparent' },
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
      <Text style={[styles.actionText, { color: fg }]} numberOfLines={2} maxFontSizeMultiplier={1.25}>
        {label}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
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
              maxFontSizeMultiplier={1.4}
            >
              {t.label}
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
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  icon?: IconName;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const map = {
    success: [colors.successBg, colors.success, 'checkmark-circle'],
    warning: [colors.warningBg, colors.warning, 'time'],
    error: [colors.errorBg, colors.error, 'alert-circle'],
    info: [colors.infoBg, colors.info, 'information-circle'],
    neutral: [colors.surfaceMuted, colors.textSoft, 'ellipse-outline'],
  } as const;
  const [bg, fg, defaultIcon] = map[tone];
  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Ionicons name={icon ?? (defaultIcon as IconName)} size={12} color={fg} />
      <Text style={[styles.badgePillText, { color: fg }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function Skeleton({ height, width = '100%', radius = radii.sm }: { height: number; width?: number | `${number}%`; radius?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width, borderRadius: radius, backgroundColor: colors.surfaceMuted, opacity: 0.6 }}
    />
  );
}

/** Placeholder card with the same footprint as the content it stands in for, so layout does not jump. */
export function SkeletonCard({ height = 96 }: { height?: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.card, { minHeight: height, gap: spacing.sm }]} accessibilityLabel="Loading">
      <Skeleton height={12} width="40%" />
      <Skeleton height={24} width="65%" />
      <Skeleton height={10} width="50%" />
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
  compact,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: colors.errorBg }]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={compact ? 18 : 22} color={colors.error} />
      <Text style={[styles.noticeText, { color: colors.error }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={[styles.retryText, { color: colors.error }]}>Try again</Text>
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
}: {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

/** Raised surface used by every block in the workspace. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export const useStyles = makeStyles((c, elevation) => ({
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  card: {
    backgroundColor: c.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    ...elevation(1),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionHeaderText: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, paddingLeft: spacing.sm },
  sectionActionText: { color: c.link, fontSize: 14, fontWeight: '700' },
  metricCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 96,
    ...elevation(1),
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metricIcon: { width: 28, height: 28, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { flex: 1, color: c.textSoft, fontSize: 13, fontWeight: '600' },
  metricValue: { color: c.text, fontSize: 22, fontWeight: '800' },
  metricCaption: { color: c.textMuted, fontSize: 12, lineHeight: 16 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: TOUCH,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  actionStacked: { flexDirection: 'column', gap: spacing.xs, paddingHorizontal: spacing.sm },
  actionText: { fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { color: c.textSoft, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: c.textOnPrimary },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    padding: 3,
    marginHorizontal: spacing.lg,
  },
  segmentItem: { flex: 1, minHeight: 42, borderRadius: radii.md - 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  segmentItemOn: { backgroundColor: c.primary },
  segmentText: { color: c.textSoft, fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: c.textOnPrimary, fontWeight: '800' },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgePillText: { fontSize: 12, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  noticeText: { flex: 1, minWidth: 160, fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  retryText: { fontSize: 14, fontWeight: '800' },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border,
  },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: c.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
}));
