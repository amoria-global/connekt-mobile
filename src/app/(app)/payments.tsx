import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { listPayments } from '@/features/payments/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function PaymentsScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPayments(), []));

  return (
    <Screen padded={false}>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        title="Payments"
        subtitle="Your payment history"
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(`/payment/${item.id}`)}
          >
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              {item.createdAt ? <Text style={styles.date}>{formatDate(item.createdAt)}</Text> : null}
              {item.amount != null ? (
                <Text style={styles.amount}>{formatMoney(item.amount, item.currency)}</Text>
              ) : null}
            </View>
            <StatusPill status={item.status} />
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        emptyIcon="card-outline"
        emptyTitle="No payments yet"
        emptyMessage="Your event payments and purchases will appear here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  date: { fontSize: fontSize.xs, color: colors.textMuted },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary, marginTop: 2 },
});
