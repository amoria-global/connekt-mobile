import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { getClient, listFavoriteClientIds, toggleFavoriteClient } from '@/features/clients/api';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { useModeration } from '@/features/moderation/useModeration';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function ClientDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error } = useAsync(useCallback(() => getClient(id), [id]));

  const [favorite, setFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  useEffect(() => {
    let active = true;
    listFavoriteClientIds()
      .then((ids) => active && setFavorite(ids.includes(id)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  const [reportOpen, setReportOpen] = useState(false);
  const blocked = useModeration((s) => s.blockedIds.has(id));
  const block = useModeration((s) => s.block);
  const unblock = useModeration((s) => s.unblock);
  const loadModeration = useModeration((s) => s.load);

  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  const onBlock = () => {
    Alert.alert(
      `Block ${data?.name ?? 'this user'}?`,
      "They won't be able to message you, and you won't see their content.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await block(id);
            } catch (e) {
              Alert.alert('Could not block', isApiError(e) ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const onUnblock = async () => {
    try {
      await unblock(id);
    } catch (e) {
      Alert.alert('Could not unblock', isApiError(e) ? e.message : 'Please try again.');
    }
  };

  const onMoreActions = () => {
    Alert.alert(data?.name ?? 'Client actions', undefined, [
      { text: 'Report user', style: 'destructive', onPress: () => setReportOpen(true) },
      blocked
        ? { text: 'Unblock user', onPress: () => void onUnblock() }
        : { text: 'Block user', style: 'destructive' as const, onPress: onBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitUserReport = (reason: string, description: string) =>
    reportContent('USER', id, reason, description);

  const onToggleFavorite = async () => {
    setFavBusy(true);
    const optimistic = !favorite;
    setFavorite(optimistic);
    try {
      const next = await toggleFavoriteClient(id);
      if (typeof next === 'boolean') setFavorite(next);
    } catch {
      setFavorite(!optimistic); // revert
    } finally {
      setFavBusy(false);
    }
  };

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

  const initials = (data?.name?.[0] ?? '?').toUpperCase();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          {data?.avatar ? (
            <Image source={{ uri: data.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{data?.name}</Text>
          {data?.email ? <Text style={styles.meta}>{data.email}</Text> : null}
          {data?.phone ? <Text style={styles.meta}>{data.phone}</Text> : null}
          {data?.location ? <Text style={styles.meta}>{data.location}</Text> : null}

          <View style={styles.headerActions}>
            <Pressable
              style={[styles.favBtn, favorite && styles.favBtnActive]}
              onPress={onToggleFavorite}
              disabled={favBusy}
            >
              <Ionicons
                name={favorite ? 'star' : 'star-outline'}
                size={18}
                color={favorite ? '#B45309' : colors.primary}
              />
              <Text style={[styles.favText, favorite && styles.favTextActive]}>
                {favorite ? 'Favorite' : 'Add to favorites'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.moreBtn}
              onPress={onMoreActions}
              accessibilityRole="button"
              accessibilityLabel="Report or block this user"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.primary} />
            </Pressable>
          </View>

          {blocked ? <Text style={styles.blockedNote}>You blocked this user.</Text> : null}
        </View>

        <View style={styles.stats}>
          <Stat label="Bookings" value={String(data?.bookings ?? data?.events.length ?? 0)} />
          {data?.totalSpent != null ? (
            <Stat label="Total spent" value={formatMoney(data.totalSpent, data.currency)} />
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Events</Text>
        {data?.events.length ? (
          data.events.map((e) => (
            <Pressable
              key={e.id}
              style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
              onPress={() => router.push(`/event/${e.id}` as Href)}
            >
              <View style={styles.eventBody}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {e.title}
                </Text>
                {e.date ? <Text style={styles.eventDate}>{formatDate(e.date)}</Text> : null}
              </View>
              {e.status ? <StatusPill status={e.status} /> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))
        ) : (
          <Text style={styles.muted}>No events with this client yet.</Text>
        )}
      </ScrollView>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="USER"
        subject={data?.name}
        submit={submitUserReport}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: c.textMuted, fontSize: fontSize.sm },
  scroll: { padding: spacing.xl, gap: spacing.xl },
  headerCard: { alignItems: 'center', gap: spacing.xs },
  avatar: { width: 88, height: 88, borderRadius: radii.full, backgroundColor: c.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  initials: { color: c.textOnPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text, marginTop: spacing.sm },
  meta: { fontSize: fontSize.sm, color: c.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    width: 38,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  blockedNote: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: spacing.xs,
  },
  favBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  favBtnActive: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  favText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.primary },
  favTextActive: { color: '#B45309' },
  stats: { flexDirection: 'row', gap: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.primary },
  statLabel: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  eventDate: { fontSize: fontSize.xs, color: c.textMuted },
}));
