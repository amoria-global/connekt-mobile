import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Fab } from '@/components/ui/Fab';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { deletePackage, listPackages, type Package } from '@/features/packages/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function PackagesScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPackages(), []));
  const [busyId, setBusyId] = useState<string | null>(null);

  const onDelete = (p: Package) => {
    Alert.alert('Delete package?', `"${p.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(p.id);
          try {
            await deletePackage(p.id);
            await refresh();
          } catch {
            Alert.alert('Could not delete', 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="My Packages" subtitle="Services clients can book" />
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={[styles.card, busyId === item.id && styles.dim]}>
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              {item.price != null ? (
                <Text style={styles.price}>{formatMoney(item.price, item.currency)}</Text>
              ) : null}
            </View>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            {item.duration ? <Text style={styles.meta}>{item.duration}</Text> : null}
            <Text style={styles.delete} onPress={() => onDelete(item)}>
              Delete
            </Text>
          </View>
        )}
        emptyIcon="pricetags-outline"
        emptyTitle="No packages yet"
        emptyMessage="Create packages so clients can book your services at a set price."
      />
      <Fab icon="add" onPress={() => router.push('/package/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
  },
  dim: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, flex: 1 },
  price: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  desc: { fontSize: fontSize.sm, color: colors.textSoft },
  meta: { fontSize: fontSize.xs, color: colors.textMuted },
  delete: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.error, marginTop: spacing.sm },
});
