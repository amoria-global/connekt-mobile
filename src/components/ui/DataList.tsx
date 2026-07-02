import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from './EmptyState';
import { colors, fonts, fontSize, fontWeight, spacing } from '@/theme';

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
  /** Extra top padding so content clears a floating top bar. */
  topInset?: number;
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
  topInset = 0,
}: Props<T>): ReactElement {
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
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const header =
    title || headerExtra ? (
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  listContent: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  header: { gap: 2, marginBottom: spacing.xs },
  headerExtra: { marginTop: spacing.md, marginBottom: spacing.xs },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
});
