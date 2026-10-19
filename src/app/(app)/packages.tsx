import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { DataList } from '@/components/ui/DataList';
import { Fab } from '@/components/ui/Fab';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { deletePackage, listPackages, type Package } from '@/features/packages/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';

export default function PackagesScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { t } = useLanguage();
  const styles = useStyles();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPackages(), []));
  const [busyId, setBusyId] = useState<string | null>(null);

  const onDelete = (p: Package) => {
    Alert.alert(t('b2_packagesDeleteTitle'), t('b2_packagesDeleteMessage', { name: p.name }), [
      { text: t('b2_packagesCancel'), style: 'cancel' },
      {
        text: t('b2_packagesDelete'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(p.id);
          try {
            await deletePackage(p.id);
            await refresh();
          } catch {
            Alert.alert(t('b2_packagesDeleteErrorTitle'), t('b2_packagesTryAgain'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader duplicatesHeader title={t('b2_packagesTitle')} subtitle={t('b2_packagesSubtitle')} />
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
                item.includedPhotos ? t('b2_packagesPhotosCount', { count: item.includedPhotos }) : null,
                item.includedVideos ? t('b2_packagesVideosCount', { count: item.includedVideos }) : null,
                item.hasLiveStream ? t('b2_packagesLiveStream') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={styles.cardActions}>
              <Text style={styles.editHint}>{t('b2_packagesTapToEdit')}</Text>
              <Text
                style={styles.geoLink}
                onPress={() => router.push(`/event/geo-pricing?packageId=${item.id}` as never)}
              >
                {t('b2_packagesGeoPricing')}
              </Text>
              <Text style={styles.delete} onPress={() => onDelete(item)}>
                {t('b2_packagesDelete')}
              </Text>
            </View>
          </Pressable>
        )}
        emptyIcon="pricetags-outline"
        emptyTitle={t('b2_packagesEmptyTitle')}
        emptyMessage={t('b2_packagesEmptyMessage')}
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
