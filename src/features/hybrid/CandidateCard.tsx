/**
 * A photographer who said yes to a posted event. Shows the recommendation
 * tier (a matching recommendation, not a quality guarantee), never the
 * internal score; rating only when there are reviews.
 */
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme, onFill } from '@/theme';
import type { CandidateSummary } from './types';
import { MODE_META, TierBadge } from './hybridUi';
import { useSharedT } from '@/i18n/sharedStrings';

type Props = {
  candidate: CandidateSummary;
  onSelect: (candidate: CandidateSummary) => void;
  onViewProfile?: (candidate: CandidateSummary) => void;
  selecting?: boolean;
};

export function CandidateCard({ candidate: c, onSelect, onViewProfile, selecting }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={styles.avatar}>
          {c.avatar ? <Image source={{ uri: c.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
            : <Text style={styles.initial}>{c.name.charAt(0)}</Text>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={2}>{c.name}</Text>
          <TierBadge tier={c.recommendationTier} />
        </View>
      </View>

      <View style={styles.meta}>
        <Meta icon={c.photographerType === 'STUDIO' ? 'business-outline' : 'person-outline'} text={c.photographerType === 'STUDIO' ? tr('Company / Studio') : tr('Freelancer / Individual')} />
        {c.distanceLabel ? <Meta icon="location-outline" text={c.distanceLabel} /> : null}
        {c.rating != null && c.reviewCount ? (
          <Meta icon="star" iconColor="#F59E0B" text={`${c.rating.toFixed(1)} · ${c.reviewCount} ${tr('reviews')}`} />
        ) : <Meta icon="star-outline" text={tr('No reviews yet')} muted />}
        {c.typicalPriceRange ? <Meta icon="pricetag-outline" text={c.typicalPriceRange} /> : null}
        {c.instagram?.handle ? <Meta icon="logo-instagram" text={`@${c.instagram.handle}`} /> : null}
      </View>

      {c.specialties.length > 0 ? (
        <View style={styles.tags}>
          {c.specialties.slice(0, 4).map((s) => <Text key={s} style={styles.tag}>{s}</Text>)}
        </View>
      ) : null}
      {c.about ? <Text style={styles.about} numberOfLines={3}>{c.about}</Text> : null}

      <View style={styles.actions}>
        {onViewProfile ? (
          <Pressable onPress={() => onViewProfile(c)} style={styles.secondary} accessibilityRole="button" accessibilityLabel={tr('View portfolio')}>
            <Text style={styles.secondaryText}>{tr('View portfolio')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onSelect(c)} disabled={selecting} style={[styles.primary, selecting && { opacity: 0.6 }]}
          accessibilityRole="button" accessibilityLabel={tr('Choose')}>
          {selecting ? <ActivityIndicator color={onFill} /> : <Text style={styles.primaryText}>{tr('Choose')}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function Meta({ icon, text, iconColor, muted }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; iconColor?: string; muted?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={13} color={iconColor || colors.primary} />
      <Text style={[styles.metaText, muted && { color: colors.textMuted }]} numberOfLines={2}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderRadius: radii.xl, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.primary },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
  meta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: fontSize.sm, color: c.textSoft, flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 11, color: c.textSoft, backgroundColor: c.surfaceMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, overflow: 'hidden' },
  about: { fontSize: fontSize.xs, color: c.textMuted, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primary: { flex: 1, minHeight: 46, borderRadius: radii.md, backgroundColor: MODE_META.HYBRID.color, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: c.textOnPrimary, fontWeight: fontWeight.extrabold, fontSize: fontSize.sm },
  secondary: { flex: 1, minHeight: 46, borderRadius: radii.md, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.text, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
}));
