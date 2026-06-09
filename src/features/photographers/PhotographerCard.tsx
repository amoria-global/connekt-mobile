import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Rating } from '@/components/ui/Rating';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import type { Photographer } from './api';

export function PhotographerCard({ photographer }: { photographer: Photographer }) {
  const initials = (photographer.name?.[0] ?? '?').toUpperCase();
  return (
    <View style={styles.card}>
      {photographer.avatar ? (
        <Image source={{ uri: photographer.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {photographer.name}
        </Text>
        {photographer.category ? (
          <Text style={styles.category} numberOfLines={1}>
            {photographer.category}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Rating value={photographer.rating} count={photographer.reviewCount} />
          {photographer.location ? (
            <View style={styles.location}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {photographer.location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  avatar: { width: 56, height: 56, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  avatarText: { color: colors.textOnPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  category: { fontSize: fontSize.sm, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  locationText: { fontSize: fontSize.xs, color: colors.textMuted },
});
