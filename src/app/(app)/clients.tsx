import { useCallback } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { listClients } from '@/features/clients/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function ClientsScreen() {
  const { data, loading, error, refresh } = useAsync(useCallback(() => listClients(), []));

  return (
    <Screen padded={false}>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        title="Clients"
        subtitle="People who have booked you"
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => {
          const initials = (item.name[0] ?? '?').toUpperCase();
          return (
            <View style={styles.row}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.email ? (
                  <Text style={styles.email} numberOfLines={1}>
                    {item.email}
                  </Text>
                ) : null}
                {item.bookings != null ? (
                  <Text style={styles.meta}>
                    {item.bookings} booking{item.bookings === 1 ? '' : 's'}
                  </Text>
                ) : null}
              </View>
              {item.totalSpent != null ? (
                <Text style={styles.spent}>{formatMoney(item.totalSpent, item.currency)}</Text>
              ) : null}
            </View>
          );
        }}
        emptyIcon="people-outline"
        emptyTitle="No clients yet"
        emptyMessage="Clients who book your services will appear here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  avatar: { width: 48, height: 48, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  initials: { color: colors.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  body: { flex: 1, gap: 1 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textMuted },
  meta: { fontSize: fontSize.xs, color: colors.textMuted },
  spent: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
});
