/**
 * A photographer who said yes to a posted event, as one compact card in a recommendation band's row:
 * profile (photo and name), role, speciality, Smart Match score, estimated distance and how they
 * accepted. Tapping it opens the choose panel.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import type { CandidateSummary } from './types';
import { smartTierOf, TIER_META } from './hybridUi';
import { useSharedT } from '@/i18n/sharedStrings';

type Props = {
  candidate: CandidateSummary;
  onOpen: (candidate: CandidateSummary) => void;
  width: number;
};

export function CandidateCard({ candidate: c, onOpen, width }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();
  const tier = TIER_META[smartTierOf(c)];
  const role = c.photographerType === 'STUDIO' ? tr('Company / Studio') : tr('Freelancer / Individual');
  const status = tr('Accepted');
  const score = c.matchScore != null ? `${c.matchScore}` : null;

  return (
    <Pressable
      onPress={() => onOpen(c)}
      style={[styles.card, { width, borderColor: tier.color }]}
      accessibilityRole="button"
      accessibilityLabel={[c.name, role, c.primarySpecialty, score ? `Score ${score}` : null, c.distanceLabel, status].filter(Boolean).join(', ')}
    >
      <View style={styles.top}>
        <View style={styles.avatar}>
          {c.avatar ? <Image source={{ uri: c.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
            : <Text style={styles.initial}>{c.name.charAt(0)}</Text>}
        </View>
        {score ? (
          <View style={[styles.score, { backgroundColor: tier.bg }]}>
            <Text style={[styles.scoreText, { color: tier.color }]}>{score}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
      <Text style={styles.role} numberOfLines={1}>{role}</Text>
      {c.primarySpecialty ? <Text style={styles.specialty} numberOfLines={2}>{c.primarySpecialty}</Text> : null}
      <View style={styles.row}>
        <Ionicons name="location-outline" size={12} color={colors.textMuted} />
        <Text style={styles.meta} numberOfLines={1}>{c.distanceLabel || c.city || tr('Distance not shown')}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="checkmark-circle" size={12} color={colors.success} />
        <Text style={[styles.meta, { color: colors.success }]} numberOfLines={1}>{status}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, padding: spacing.sm, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.primary },
  score: { minWidth: 34, paddingHorizontal: 8, height: 24, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 12, fontWeight: fontWeight.extrabold },
  name: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: c.text },
  role: { fontSize: 11, color: c.textMuted },
  specialty: { fontSize: 11.5, color: c.textSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flex: 1, fontSize: 11, color: c.textSoft },
}));
