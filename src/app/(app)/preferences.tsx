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
import { LanguageSelectorSheet } from '@/components/LanguageSelectorSheet';
import { CurrencySelectorSheet } from '@/components/CurrencySelectorSheet';
import { SUPPORTED_LANGUAGES, useLanguage } from '@/store/language';
import { useCurrency } from '@/store/currency';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function PreferencesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { language, t } = useLanguage();
  const currency = useCurrency((s) => s.currency);
  const currencies = useCurrency((s) => s.currencies);
  const currentCurrency = currencies.find((c) => c.code === currency);

  const [langSheetVisible, setLangSheetVisible] = useState(false);
  const [currencySheetVisible, setCurrencySheetVisible] = useState(false);
  const currentLangInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

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
      <ScreenHeader
        title={t('preferencesTitle')}
        subtitle={t('preferencesSubtitle')}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* App Preferences: Language & Currency */}
        <View style={[styles.card, styles.langCard]}>
          {/* Language Preference Row */}
          <Pressable
            style={styles.row}
            onPress={() => setLangSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('languageSectionTitle')}: currently ${currentLangInfo.nativeLabel}`}
          >
            <View style={styles.langIconWrap}>
              <Ionicons name="globe-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{t('languageSectionTitle')}</Text>
              <Text style={styles.rowDesc}>{t('languageSectionSubtitle')}</Text>
            </View>
            <View style={styles.langBadge}>
              <Text style={styles.langBadgeText}>{currentLangInfo.nativeLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {/* Currency Preference Row */}
          <Pressable
            style={[styles.row, styles.rowBorder]}
            onPress={() => setCurrencySheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('currencySectionTitle')}: currently ${currency}`}
          >
            <View style={styles.langIconWrap}>
              <Ionicons name="cash-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{t('currencySectionTitle')}</Text>
              <Text style={styles.rowDesc}>{t('currencySectionSubtitle')}</Text>
            </View>
            <View style={styles.langBadge}>
              <Text style={styles.langBadgeText}>{currency}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

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
          <>
            <View style={styles.card}>
              {NOTIFICATION_TOGGLES.map((toggleItem, i) => {
                let label = toggleItem.label;
                let desc = toggleItem.description;
                if (toggleItem.key === 'email_notifications') {
                  label = t('emailNotificationsTitle');
                  desc = t('emailNotificationsDesc');
                } else if (toggleItem.key === 'push_notifications') {
                  label = t('pushNotificationsTitle');
                  desc = t('pushNotificationsDesc');
                } else if (toggleItem.key === 'booking_notifications') {
                  label = t('bookingNotificationsTitle');
                  desc = t('bookingNotificationsDesc');
                } else if (toggleItem.key === 'payment_notifications') {
                  label = t('paymentNotificationsTitle');
                  desc = t('paymentNotificationsDesc');
                } else if (toggleItem.key === 'album_notifications') {
                  label = t('albumNotificationsTitle');
                  desc = t('albumNotificationsDesc');
                } else if (toggleItem.key === 'gift_notifications') {
                  label = t('giftNotificationsTitle');
                  desc = t('giftNotificationsDesc');
                } else if (toggleItem.key === 'stream_fee_notifications') {
                  label = t('streamFeeNotificationsTitle');
                  desc = t('streamFeeNotificationsDesc');
                }

                return (
                  <View key={toggleItem.key} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowLabel}>{label}</Text>
                      <Text style={styles.rowDesc}>{desc}</Text>
                    </View>
                    <Switch
                      value={values[toggleItem.key] ?? true}
                      onValueChange={(v) => onToggle(toggleItem.key, v)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                );
              })}
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
                    <Text style={styles.rowLabel}>{t('dndTitle')}</Text>
                    <Text style={styles.rowDesc}>
                      {bypassDnd ? t('dndOnDesc') : t('dndOffDesc')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      <LanguageSelectorSheet
        visible={langSheetVisible}
        onClose={() => setLangSheetVisible(false)}
      />

      <CurrencySelectorSheet
        visible={currencySheetVisible}
        onClose={() => setCurrencySheetVisible(false)}
      />
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
  langCard: {
    marginBottom: spacing.lg,
  },
  langIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  langBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  dndCard: { marginTop: spacing.lg },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  rowDesc: { fontSize: 12, color: c.textMuted },
}));
