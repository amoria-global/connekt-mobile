import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { getAnalytics } from '@/features/analytics/api';
import { useRole } from '@/features/auth/role';
import { useAsync } from '@/hooks/useAsync';
import { getWallet } from '@/features/wallet/api';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function AnalyticsScreen() {
  const { role } = useRole();
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const { data, loading, error } = useAsync(
    useCallback(() => getAnalytics(role, wallet.data?.currency), [role, wallet.data?.currency]),
  );

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Your activity at a glance</Text>

        {loading && !data ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error && !data ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : data?.length ? (
          <View style={styles.grid}>
            {data.map((s) => (
              <View key={s.key} style={styles.card}>
                <Text style={styles.value} numberOfLines={1}>
                  {s.value}
                </Text>
                <Text style={styles.label}>{s.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.center}>
            <Ionicons name="bar-chart-outline" size={36} color={colors.textMuted} />
            <Text style={styles.muted}>No analytics yet.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  loader: { marginTop: spacing['2xl'] },
  center: { alignItems: 'center', gap: spacing.md, marginTop: spacing['2xl'] },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  value: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.primary },
  label: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold },
});
