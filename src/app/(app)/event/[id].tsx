import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { getEvent } from '@/features/events/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error } = useAsync(useCallback(() => getEvent(id), [id]));

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

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {data?.coverImage ? (
          <Image source={{ uri: data.coverImage }} style={styles.cover} contentFit="cover" transition={250} />
        ) : null}

        <View style={styles.headerRow}>
          <Text style={styles.title}>{data?.title}</Text>
          <StatusPill status={data?.status} />
        </View>

        <View style={styles.infoCard}>
          {data?.eventDate ? <Row icon="calendar-outline" text={formatDate(data.eventDate)} /> : null}
          {data?.startTime ? (
            <Row
              icon="time-outline"
              text={data.endTime ? `${data.startTime} – ${data.endTime}` : data.startTime}
            />
          ) : null}
          {data?.location ? <Row icon="location-outline" text={data.location} /> : null}
          {data?.photographerName ? (
            <Row icon="camera-outline" text={data.photographerName} />
          ) : null}
          {data?.category ? <Row icon="pricetag-outline" text={data.category} /> : null}
        </View>

        {data?.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this event</Text>
            <Text style={styles.body}>{data.description}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl },
  cover: { width: '100%', height: 180, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted },
  headerRow: { gap: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, fontSize: fontSize.md, color: colors.textSoft },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.md, color: colors.textSoft, lineHeight: 24 },
});
