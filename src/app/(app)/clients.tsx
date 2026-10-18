import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { listClients } from '@/features/clients/api';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { useRole } from '@/features/auth/role';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

export default function ClientsScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { isCoordinator } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listClients(isCoordinator), [isCoordinator]),
  );

  return (
    <Screen padded={false}>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        title={t('b2_clientsTitle')}
        subtitle={isCoordinator ? t('b2_clientsSubtitleCoord') : t('b2_clientsSubtitlePhotog')}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => {
          const initials = (item.name[0] ?? '?').toUpperCase();
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.push(`/client/${item.id}` as Href)}
            >
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
                    {(item.bookings === 1 ? t('b2_clientsBookingsOne') : t('b2_clientsBookingsOther')).replace('{count}', String(item.bookings))}
                  </Text>
                ) : null}
              </View>
              {item.totalSpent != null ? (
                <Text style={styles.spent}>{formatPrice(item.totalSpent, item.currency)}</Text>
              ) : null}
              <Pressable
                hitSlop={8}
                style={styles.chatAction}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/conversation/${item.id}?name=${encodeURIComponent(item.name)}` as Href);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('b2_clientsMessageA11y').replace('{name}', item.name)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.primary} />
              </Pressable>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
        emptyIcon="people-outline"
        emptyTitle={t('b2_clientsEmptyTitle')}
        emptyMessage={t('b2_clientsEmptyMessage')}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
  },
  pressed: { opacity: 0.7 },
  avatar: { width: 48, height: 48, borderRadius: radii.full, backgroundColor: c.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  initials: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  body: { flex: 1, gap: 1 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  email: { fontSize: fontSize.sm, color: c.textMuted },
  meta: { fontSize: fontSize.xs, color: c.textMuted },
  spent: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.primary },
  chatAction: {
    padding: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
}));
