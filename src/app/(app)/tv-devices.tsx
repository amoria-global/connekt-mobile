import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { listTvDevices, removeTvDevice } from '@/features/tv/api';
import type { TvDevice } from '@/features/tv/types';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function TvDevicesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useLanguage();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listTvDevices(), []));

  const onRemove = (device: TvDevice) => {
    Alert.alert(t('b1_tvDisconnectTitle'), t('b1_tvDisconnectBody', { label: device.deviceLabel }), [
      { text: t('b1_tvCancel'), style: 'cancel' },
      {
        text: t('b1_tvDisconnect'),
        style: 'destructive',
        onPress: async () => {
          await removeTvDevice(device.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('b1_tvTitle')} subtitle={t('b1_tvSubtitle')} />
      <View style={styles.action}>
        <Button title={t('b1_tvConnectBtn')} onPress={() => router.push('/connect-to-tv' as Href)} />
        <Pressable style={styles.payOnTv} onPress={() => router.push('/pay-on-tv' as Href)}>
          <Ionicons name="card-outline" size={20} color={colors.primary} />
          <View style={styles.payOnTvText}>
            <Text style={styles.payOnTvTitle}>{t('b1_tvPayTitle')}</Text>
            <Text style={styles.payOnTvSub}>{t('b1_tvPaySub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(item) => item.id}
        emptyIcon="tv-outline"
        emptyTitle={t('b1_tvEmptyTitle')}
        emptyMessage={t('b1_tvEmptyBody')}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onRemove(item)}>
            <Ionicons name="tv-outline" size={22} color={colors.primary} />
            <View style={styles.rowText}>
              <Text style={styles.label}>{item.deviceLabel}</Text>
              <Text style={styles.meta}>
                {t('b1_tvPairedAt', { pairedAt: item.pairedAt })}
                {item.lastSeenAt ? ` • ${t('b1_tvLastSeenAt', { lastSeenAt: item.lastSeenAt })}` : ''}
              </Text>
            </View>
            <Ionicons name="close-circle-outline" size={22} color={colors.error} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  action: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  payOnTv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  payOnTvText: { flex: 1 },
  payOnTvTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  payOnTvSub: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  rowText: { flex: 1 },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  meta: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
}));
