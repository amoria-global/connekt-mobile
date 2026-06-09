import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRole } from '@/features/auth/role';
import {
  NOTIFICATION_TOGGLES,
  getPreferences,
  preferencesBase,
  setPreference,
} from '@/features/preferences/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function PreferencesScreen() {
  const { isPhotographer, isCoordinator } = useRole();
  const base = preferencesBase({ isPhotographer, isCoordinator });
  const { data, loading, error } = useAsync(useCallback(() => getPreferences(base), [base]));

  // Local toggle state; default ON unless the backend says "false" (matches web).
  const [values, setValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, boolean> = {};
    for (const t of NOTIFICATION_TOGGLES) next[t.key] = data[t.key] !== 'false';
    setValues(next);
  }, [data]);

  const onToggle = (key: string, value: boolean) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Fire-and-forget; revert on failure.
    setPreference(base, key, value).catch(() => {
      setValues((v) => ({ ...v, [key]: !value }));
    });
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Notifications" subtitle="Choose what you hear about" />
      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            {NOTIFICATION_TOGGLES.map((t, i) => (
              <View key={t.key} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{t.label}</Text>
                  <Text style={styles.rowDesc}>{t.description}</Text>
                </View>
                <Switch
                  value={values[t.key] ?? true}
                  onValueChange={(v) => onToggle(t.key, v)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  rowDesc: { fontSize: fontSize.xs, color: colors.textMuted },
});
