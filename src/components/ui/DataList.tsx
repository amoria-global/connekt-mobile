import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRole } from '@/features/auth/role';
import { EmptyState } from './EmptyState';
import { SkeletonCard } from '@/features/photographer/kit';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

type Props<T> = {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  keyExtractor: (item: T, index: number) => string;
  renderItem: ListRenderItem<T>;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  emptyTitle: string;
  emptyMessage: string;
  /** Optional in-scroll header (scrolls under a translucent top bar). */
  title?: string;
  subtitle?: string;
  /** Optional element rendered under the title (e.g. a filter control). */
  headerExtra?: ReactElement;
  /** Optional element rendered at the bottom of the list (e.g. pagination controls). */
  footer?: ReactElement;
  /** Extra top padding so content clears a floating top bar. */
  topInset?: number;
  /** The native stack header already shows `title`; photographer screens then keep only the subtitle. */
  duplicatesHeader?: boolean;
  /** Show this many skeleton cards while the first read is in flight, instead of a spinner. */
  skeletonRows?: number;
};

export function DataList<T>({
  data,
  loading,
  error,
  onRefresh,
  keyExtractor,
  renderItem,
  emptyIcon,
  emptyTitle,
  emptyMessage,
  title,
  subtitle,
  headerExtra,
  footer,
  topInset = 0,
  duplicatesHeader,
  skeletonRows,
}: Props<T>): ReactElement {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const flat = useRole().isPhotographer;
  if (loading && !data && skeletonRows) {
    return (
      <View style={[styles.skeletons, { paddingTop: topInset }]}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <SkeletonCard key={i} height={72} />
        ))}
      </View>
    );
  }
  if (loading && !data) {
    return (
      <View style={[styles.centered, { paddingTop: topInset }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !data?.length) {
    return (
      <View style={[styles.centered, { paddingTop: topInset }]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
        <Text style={styles.errorText}>{tr(error)}</Text>
        {/* This branch renders no list, so there is nothing to pull — without an
            explicit control the user's only way out is to leave the screen. */}
        <Pressable
          style={({ pressed }) => [styles.retryBtn, flat && styles.retryFlat, pressed && { opacity: 0.75 }]}
          onPress={onRefresh}
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={16} color={flat ? colors.link : colors.textOnPrimary} />
          <Text style={[styles.retryText, flat && { color: colors.link }]}>{tr('Try again')}</Text>
        </Pressable>
      </View>
    );
  }

  const header =
    title || headerExtra ? (
      <View style={styles.header}>
        {title && !(flat && duplicatesHeader) ? <Text style={styles.title} accessibilityRole="header">{tr(title)}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{tr(subtitle)}</Text> : null}
        {headerExtra ? <View style={styles.headerExtra}>{headerExtra}</View> : null}
      </View>
    ) : null;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentContainerStyle={[
        styles.listContent, 
        { paddingTop: topInset + spacing.md, paddingBottom: 120 }
      ]}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          progressViewOffset={topInset}
        />
      }
      ListEmptyComponent={<EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />}
      ListFooterComponent={footer}
    />
  );
}

const useStyles = makeStyles((c) => ({
  skeletons: { padding: spacing.xl, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: c.primary,
  },
  retryFlat: { minHeight: 44, borderRadius: radii.md, backgroundColor: 'transparent', borderWidth: 1.25, borderColor: c.primary },
  retryText: { color: c.textOnPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  listContent: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  header: { gap: 2, marginBottom: spacing.xs },
  headerExtra: { marginTop: spacing.md, marginBottom: spacing.xs },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
}));
