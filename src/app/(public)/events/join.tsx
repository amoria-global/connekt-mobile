/**
 * Public "join package" selector.
 *
 * Mirrors the web `pages/events/join-package.tsx` first step: guests pick
 * Individual or Group (with a viewer count), then move on to the payment
 * step. We don't apply the web's 10% group discount client-side — the
 * backend computes it on initiate (server-trusted pricing).
 */
import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80';

type Pkg = 'individual' | 'group';

function feeLabel(fee: number, code: string, symbol?: string): string {
  if (!fee || fee <= 0) return 'Free';
  return `${fee.toLocaleString()} ${symbol ?? code}`;
}

export default function JoinPackageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error } = useAsync(
    useCallback(() => getPublicEventDetailed(id), [id]),
  );

  const [pkg, setPkg] = useState<Pkg>('individual');
  const [people, setPeople] = useState('2');

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error ?? 'Could not load this event.'}</Text>
        </View>
      </Screen>
    );
  }

  const peopleNum = Math.max(1, parseInt(people || '1', 10) || 1);
  const perPerson = data.streamFee;
  const total =
    pkg === 'group'
      ? Math.round(perPerson * peopleNum * 0.9) // mirror web's 10% group preview
      : perPerson;
  const totalLabel = feeLabel(
    total,
    data.streamFeeCurrencyCode,
    data.streamFeeCurrencySymbol,
  );

  const onProceed = () => {
    const params = new URLSearchParams({
      id,
      package: pkg,
      people: pkg === 'group' ? String(peopleNum) : '1',
    });
    router.push(`/events/pay?${params.toString()}` as unknown as Href);
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.previewCard}>
          <Image
            source={{ uri: data.coverImage || COVER_FALLBACK }}
            style={styles.previewCover}
            contentFit="cover"
          />
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle} numberOfLines={2}>
              {data.title}
            </Text>
            <Text style={styles.previewMeta}>
              {data.location ?? data.organizer ?? data.category ?? 'Connekyt event'}
            </Text>
            <Text style={styles.previewFee}>
              {feeLabel(perPerson, data.streamFeeCurrencyCode, data.streamFeeCurrencySymbol)} / person
            </Text>
          </View>
        </View>

        <Text style={styles.h2}>Choose your package</Text>

        <Pressable
          style={[styles.opt, pkg === 'individual' && styles.optActive]}
          onPress={() => setPkg('individual')}
        >
          <View style={[styles.radio, pkg === 'individual' && styles.radioActive]}>
            {pkg === 'individual' ? <View style={styles.radioInner} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optTitle}>Individual</Text>
            <Text style={styles.optHint}>Single viewer access for one device.</Text>
          </View>
          <Ionicons name="person" size={22} color={colors.primary} />
        </Pressable>

        <Pressable
          style={[styles.opt, pkg === 'group' && styles.optActive]}
          onPress={() => setPkg('group')}
        >
          <View style={[styles.radio, pkg === 'group' && styles.radioActive]}>
            {pkg === 'group' ? <View style={styles.radioInner} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optTitle}>Group · save 10%</Text>
            <Text style={styles.optHint}>
              Get a shareable code for friends or family. Pay once, everyone joins.
            </Text>
          </View>
          <Ionicons name="people" size={22} color={colors.accent} />
        </Pressable>

        {pkg === 'group' ? (
          <View style={styles.peopleCard}>
            <Text style={styles.peopleLabel}>How many viewers?</Text>
            <View style={styles.peopleRow}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setPeople(String(Math.max(2, peopleNum - 1)))}
                disabled={peopleNum <= 2}
              >
                <Ionicons name="remove" size={22} color={colors.primary} />
              </Pressable>
              <TextInput
                value={people}
                onChangeText={(t) => setPeople(t.replace(/[^0-9]/g, ''))}
                style={styles.peopleInput}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Pressable
                style={styles.stepBtn}
                onPress={() => setPeople(String(peopleNum + 1))}
              >
                <Ionicons name="add" size={22} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={styles.peopleHint}>
              Minimum 2 viewers. 10% off the per-person price applies automatically.
            </Text>
          </View>
        ) : null}

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total to pay</Text>
          <Text style={styles.totalValue}>{totalLabel}</Text>
        </View>

        <Button title="Continue to payment" onPress={onProceed} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },

  previewCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  previewCover: { width: 96, height: 96, backgroundColor: colors.surfaceMuted },
  previewBody: { flex: 1, padding: spacing.md, gap: 2, justifyContent: 'center' },
  previewTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  previewMeta: { color: colors.textMuted, fontSize: fontSize.xs },
  previewFee: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 4 },

  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },

  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  optActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  optHint: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },

  peopleCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  peopleLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'flex-start' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  peopleInput: {
    minWidth: 64,
    fontSize: fontSize.xl,
    textAlign: 'center',
    color: colors.text,
    fontWeight: fontWeight.bold,
    padding: 0,
  },
  peopleHint: { fontSize: fontSize.xs, color: colors.textMuted },

  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
  },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  totalValue: { color: colors.textOnPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
});
