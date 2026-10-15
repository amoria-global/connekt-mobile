import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Fab } from '@/components/ui/Fab';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { deletePackage, listPackages, type Package } from '@/features/packages/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

export default function PackagesScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const styles = useStyles();
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
      <ScreenHeader duplicatesHeader title="My Packages" subtitle="Services clients can book" />
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, busyId === item.id && styles.dim, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: '/package/new',
                params: { editId: item.id, data: JSON.stringify(item) },
              })
            }
          >
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              {item.price != null ? (
                <Text style={styles.price}>
                  {formatPrice(item.price, item.currency)}
                  {item.priceUnit ? ` ${item.priceUnit}` : ''}
                </Text>
              ) : null}
            </View>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            <Text style={styles.meta}>
              {[
                item.durationHours ? `${item.durationHours}h` : null,
                item.includedPhotos ? `${item.includedPhotos} photos` : null,
                item.includedVideos ? `${item.includedVideos} videos` : null,
                item.hasLiveStream ? 'Live stream' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={styles.cardActions}>
              <Text style={styles.editHint}>Tap to edit</Text>
              <Text
                style={styles.geoLink}
                onPress={() => router.push(`/event/geo-pricing?packageId=${item.id}` as never)}
              >
                Geo pricing
              </Text>
              <Text style={styles.delete} onPress={() => onDelete(item)}>
                Delete
              </Text>
            </View>
          </Pressable>
        )}
        emptyIcon="pricetags-outline"
        emptyTitle="No packages yet"
        emptyMessage="Create packages so clients can book your services at a set price."
      />
      <Fab icon="add" onPress={() => router.push('/package/new')} />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.xs,
  },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  editHint: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text, flex: 1 },
  price: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.primary },
  desc: { fontSize: fontSize.sm, color: c.textSoft },
  meta: { fontSize: fontSize.xs, color: c.textMuted },
  geoLink: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.primary },
  delete: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.error },
}));
