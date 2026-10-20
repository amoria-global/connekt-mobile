import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { ListRow } from '@/features/client/studio';
import { Card, ErrorNotice, IconTile, SectionHeader, SkeletonCard } from '@/features/photographer/kit';
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
import { spacing, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

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
  const { data, loading, error, refresh } = useAsync(useCallback(() => getPreferences(base), [base]));

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
      <ScrollView contentContainerStyle={styles.scroll}>
        <UserHeaderBand eyebrow="SETTINGS" title={t('preferencesTitle')} subtitle={t('preferencesSubtitle')} duplicatesHeader />

        <SectionHeader title="App" />
        <Card style={styles.card}>
          <ListRow
            icon="globe-outline"
            title={t('languageSectionTitle')}
            meta={t('languageSectionSubtitle')}
            trailing={<Text style={styles.valueText}>{currentLangInfo.nativeLabel}</Text>}
            onPress={() => setLangSheetVisible(true)}
            accessibilityLabel={`${t('languageSectionTitle')}: currently ${currentLangInfo.nativeLabel}`}
            divider
          />
          <ListRow
            icon="cash-outline"
            title={t('currencySectionTitle')}
            meta={t('currencySectionSubtitle')}
            trailing={<Text style={styles.valueText}>{currency}</Text>}
            onPress={() => setCurrencySheetVisible(true)}
            accessibilityLabel={`${t('currencySectionTitle')}: currently ${currency}`}
          />
        </Card>

        <SectionHeader title="Notifications" />
        {loading && !data ? (
          <View style={styles.group}>
            <SkeletonCard height={72} />
            <SkeletonCard height={72} />
          </View>
        ) : error && !data ? (
          <ErrorNotice message={error} onRetry={refresh} />
        ) : (
          <>
            <Card style={styles.card}>
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
                    <IconTile icon={TOGGLE_ICONS[toggleItem.key] ?? 'notifications-outline'} tone="primary" size={36} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
                      <Text style={styles.rowDesc} maxFontSizeMultiplier={1.3}>{desc}</Text>
                    </View>
                    <Switch
                      value={values[toggleItem.key] ?? true}
                      onValueChange={(v) => onToggle(toggleItem.key, v)}
                      accessibilityLabel={label}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                );
              })}
            </Card>

            {Platform.OS === 'android' && isPhotographer && bypassDnd !== null ? (
              <Card style={[styles.card, styles.dndCard]}>
                <ListRow
                  icon={bypassDnd ? 'notifications' : 'notifications-off-outline'}
                  tone={bypassDnd ? 'success' : 'warning'}
                  title={t('dndTitle')}
                  meta={bypassDnd ? t('dndOnDesc') : t('dndOffDesc')}
                  onPress={() => void openRingingChannelSettings()}
                  accessibilityLabel="Open Do Not Disturb settings for booking alerts"
                />
              </Card>
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

const TOGGLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  email_notifications: 'mail-outline',
  push_notifications: 'phone-portrait-outline',
  booking_notifications: 'calendar-outline',
  payment_notifications: 'card-outline',
  album_notifications: 'images-outline',
  gift_notifications: 'gift-outline',
  stream_fee_notifications: 'videocam-outline',
};

const useStyles = makeStyles((c) => ({
  group: { gap: spacing.sm },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  card: { padding: 0 },
  valueText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.link },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 64 },
  dndCard: { marginTop: spacing.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  rowDesc: { fontSize: 12, color: c.textMuted },
}));
