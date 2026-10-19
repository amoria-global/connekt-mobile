import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
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
import { openRingingChannelSettings, ringingBypassesDnd } from '@/features/notifications/push';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function PreferencesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
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

  // Android: do booking requests and opportunities ring through Do Not
  // Disturb? Re-read when the user comes back from the settings page.
  const [bypassDnd, setBypassDnd] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android' || !isPhotographer) return;
    const read = () => void ringingBypassesDnd().then(setBypassDnd);
    read();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => sub.remove();
  }, [isPhotographer]);

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

          {Platform.OS === 'android' && isPhotographer && bypassDnd !== null ? (
            <Pressable
              style={[styles.card, styles.dndCard]}
              onPress={() => void openRingingChannelSettings()}
              accessibilityRole="button"
              accessibilityLabel="Open Do Not Disturb settings for booking alerts"
            >
              <View style={styles.row}>
                <Ionicons
                  name={bypassDnd ? 'notifications' : 'notifications-off-outline'}
                  size={22}
                  color={bypassDnd ? colors.primary : colors.textMuted}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Ring during Do Not Disturb</Text>
                  <Text style={styles.rowDesc}>
                    {bypassDnd
                      ? 'On. Booking requests and opportunities ring even when Do Not Disturb is on.'
                      : 'Off. Tap, then turn on "Override Do Not Disturb" so booking requests still ring.'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  dndCard: { marginTop: spacing.lg },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  rowDesc: { fontSize: 12, color: c.textMuted },
}));
