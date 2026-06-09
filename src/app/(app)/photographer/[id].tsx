import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Rating } from '@/components/ui/Rating';
import { Screen } from '@/components/ui/Screen';
import { getPhotographer } from '@/features/photographers/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function PhotographerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error } = useAsync(useCallback(() => getPhotographer(id), [id]));

  const book = (pkg?: { id: string; price?: number; currency?: string }) => {
    if (!data) return;
    router.push({
      pathname: '/event/new',
      params: {
        photographerId: data.id,
        photographerName: data.name,
        packageId: pkg?.id,
        amount: pkg?.price != null ? String(pkg.price) : undefined,
        currency: pkg?.currency,
      },
    });
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const initials = (data?.name?.[0] ?? '?').toUpperCase();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profile}>
          {data?.avatar ? (
            <Image source={{ uri: data.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{data?.name}</Text>
          {data?.category ? <Text style={styles.category}>{data.category}</Text> : null}
          <Rating value={data?.rating} count={data?.reviewCount} />
        </View>

        {data?.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.body}>{data.bio}</Text>
          </View>
        ) : null}

        {data?.packages.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Packages</Text>
            {data.packages.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.packageRow, pressed && styles.pressed]}
                onPress={() => book(p)}
              >
                <View style={styles.packageInfo}>
                  <Text style={styles.packageName}>{p.name}</Text>
                  {p.price != null ? (
                    <Text style={styles.packagePrice}>{formatMoney(p.price, p.currency)}</Text>
                  ) : null}
                </View>
                <View style={styles.bookBtn}>
                  <Text style={styles.bookText}>Book</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.requestBtn, pressed && styles.pressed]}
            onPress={() => book()}
          >
            <Ionicons name="calendar" size={18} color={colors.textOnPrimary} />
            <Text style={styles.requestText}>Request a booking</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl },
  profile: { alignItems: 'center', gap: spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  avatarText: { color: colors.textOnPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  category: { fontSize: fontSize.sm, color: colors.textMuted },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.md, color: colors.textSoft, lineHeight: 24 },
  packageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: { opacity: 0.85 },
  packageInfo: { flex: 1, gap: 2 },
  packageName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  packagePrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  bookBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  bookText: { color: colors.textOnPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
  },
  requestText: { color: colors.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
