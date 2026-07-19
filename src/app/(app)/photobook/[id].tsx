import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { mintHandoffUrl, openWebCheckout } from '@/features/payments/webCheckout';
import { isApiError } from '@/store/auth';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPhotobook, type PhotobookPhoto } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function PhotobookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, loading, error } = useAsync(useCallback(() => getPhotobook(id), [id]));
  const [payBusy, setPayBusy] = useState(false);

  // Extras are paid on connekyt.com: mint a short-lived BOOKING_DECLARATION
  // handoff token for this declaration and open the web receiver. The server
  // derives the amount — nothing is collected in the app. Only reachable
  // behind the digitalPurchasesEnabled gate below.
  const onPayExtras = async () => {
    if (!digitalPurchasesEnabled || payBusy) return;
    const declarationId = data?.paymentDeclarationId;
    if (!declarationId) {
      // No declaration to hand off — fall back to the payments list, which
      // is a read-only overview (not a payment collector).
      router.push('/payments' as never);
      return;
    }
    setPayBusy(true);
    try {
      const url = await mintHandoffUrl('BOOKING_DECLARATION', { declarationId });
      await openWebCheckout(url);
    } catch (e) {
      Alert.alert(
        'Could not open payment',
        isApiError(e) ? e.message : 'Please try again.',
      );
    } finally {
      setPayBusy(false);
    }
  };

  const gap = spacing.sm;
  const cols = 3;
  const cell = (width - spacing.lg * 2 - gap * (cols - 1)) / cols;

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={data?.photos ?? []}
        keyExtractor={(p) => p.id}
        numColumns={cols}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {data?.coverImage ? (
              <Image source={{ uri: data.coverImage }} style={styles.cover} contentFit="cover" transition={200} />
            ) : null}
            <View style={styles.titleRow}>
              <Text style={styles.title}>{data?.name}</Text>
              {data?.status ? <StatusPill status={data.status} /> : null}
            </View>
            {data?.photographerName ? <Text style={styles.meta}>By {data.photographerName}</Text> : null}
            {data?.description ? <Text style={styles.desc}>{data.description}</Text> : null}
            {data?.paymentRequired && data?.extraPhotosAmount && digitalPurchasesEnabled ? (
              <Pressable
                style={({ pressed }) => [styles.payBanner, pressed && { opacity: 0.85 }]}
                onPress={() => void onPayExtras()}
                disabled={payBusy}
              >
                {payBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                )}
                <Text style={styles.payText}>
                  {data.extraPhotosCount ?? 0} extra photos · {formatMoney(data.extraPhotosAmount)} · pay on connekyt.com
                </Text>
                <Ionicons name="open-outline" size={16} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <Photo photo={item} size={cell} />}
        ListEmptyComponent={
          <EmptyState icon="images-outline" title="No photos" message="This photobook has no photos yet." />
        }
      />
    </Screen>
  );
}

function Photo({ photo, size }: { photo: PhotobookPhoto; size: number }) {
  return (
    <Pressable
      onPress={() => photo.url && WebBrowser.openBrowserAsync(photo.url)}
      style={[styles.cell, { width: size, height: size }]}
    >
      <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  cover: { width: '100%', height: 170, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  desc: { fontSize: fontSize.md, color: colors.textSoft, lineHeight: 22 },
  payBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  payText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary },
  cell: { borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surfaceMuted, marginBottom: spacing.sm },
});
