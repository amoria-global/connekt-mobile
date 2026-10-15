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
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function TvDevicesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listTvDevices(), []));

  const onRemove = (device: TvDevice) => {
    Alert.alert('Disconnect TV', `Remove "${device.deviceLabel}" from your account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
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
      <ScreenHeader duplicatesHeader title="Manage TVs" subtitle="TVs connected to your Connekyt account" />
      <View style={styles.action}>
        <Button title="Connect a new TV" onPress={() => router.push('/connect-to-tv' as Href)} />
        <Pressable style={styles.payOnTv} onPress={() => router.push('/pay-on-tv' as Href)}>
          <Ionicons name="card-outline" size={20} color={colors.primary} />
          <View style={styles.payOnTvText}>
            <Text style={styles.payOnTvTitle}>Pay for a stream on a TV</Text>
            <Text style={styles.payOnTvSub}>Scan the payment QR your TV shows and pay from here.</Text>
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
        emptyTitle="No TVs connected"
        emptyMessage="Scan the QR code on your Smart TV's login screen to connect it."
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onRemove(item)}>
            <Ionicons name="tv-outline" size={22} color={colors.primary} />
            <View style={styles.rowText}>
              <Text style={styles.label}>{item.deviceLabel}</Text>
              <Text style={styles.meta}>
                Paired {item.pairedAt}
                {item.lastSeenAt ? ` • last seen ${item.lastSeenAt}` : ''}
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
