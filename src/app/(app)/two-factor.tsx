import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { ListRow } from '@/features/client/studio';
import { ActionButton, Card, ErrorNotice, SectionHeader, SkeletonCard, StatusBadge } from '@/features/photographer/kit';
import { disableTotp, enableTotp, getTotpStatus, setupTotp, type TotpSetup } from '@/features/security/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';

export default function TwoFactorScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getTotpStatus(), []));
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onStartSetup = async () => {
    setMsg(null);
    setBusy(true);
    try {
      setSetup(await setupTotp());
    } catch (err) {
      setMsg(isApiError(err) ? err.message : t('b1_twoFactorSetupErr'));
    } finally {
      setBusy(false);
    }
  };

  const onEnable = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await enableTotp(code.trim());
      setSetup(null);
      setCode('');
      await refresh();
    } catch (err) {
      setMsg(isApiError(err) ? err.message : t('b1_twoFactorEnableErr'));
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await disableTotp(code.trim());
      setCode('');
      await refresh();
    } catch (err) {
      setMsg(isApiError(err) ? err.message : t('b1_twoFactorDisableErr'));
    } finally {
      setBusy(false);
    }
  };

  const enabled = !!data?.enabled;

  return (
    <Screen padded={false}>
      {loading && !data ? (
        <View style={styles.scroll}>
          <SkeletonCard height={72} />
          <SkeletonCard height={140} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <UserHeaderBand flush eyebrow="SECURITY" title={t('b1_twoFactorTitle')} subtitle={t('b1_twoFactorSubtitle')} duplicatesHeader />
          <Card style={styles.card}>
            <ListRow
              icon={enabled ? 'shield-checkmark' : 'shield-outline'}
              tone={enabled ? 'success' : 'primary'}
              title={enabled ? t('b1_twoFactorStatusOn') : t('b1_twoFactorStatusOff')}
              trailing={<StatusBadge label={enabled ? 'ON' : 'OFF'} tone={enabled ? 'success' : 'neutral'} />}
            />
          </Card>
          {error && !data ? <ErrorNotice flush message={error} onRetry={refresh} /> : null}

          {enabled ? (
            <>
              <SectionHeader flush title={t('b1_twoFactorDisableBtn')} />
              <Card style={styles.section}>
                <Text style={styles.body}>{t('b1_twoFactorDisableBody')}</Text>
                <Input label={t('b1_twoFactorAuthCodeLabel')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
              </Card>
              <View style={styles.danger}>
                <Text style={styles.dangerEyebrow}>DANGER ZONE</Text>
                <ActionButton variant="destructive" label={t('b1_twoFactorDisableBtn')} onPress={onDisable} busy={busy} disabled={busy} />
              </View>
            </>
          ) : setup ? (
            <>
              <SectionHeader flush title={t('b1_twoFactorVerifyBtn')} />
              <Card style={styles.section}>
                <Text style={styles.body}>{t('b1_twoFactorScanBody')}</Text>
                {setup.qrCode ? <Image source={{ uri: setup.qrCode }} style={styles.qr} contentFit="contain" /> : null}
                {setup.secret ? (
                  <Text style={styles.secret}>
                    {t('b1_twoFactorManualKey')} <Text style={styles.secretCode}>{setup.secret}</Text>
                  </Text>
                ) : null}
                <Input label={t('b1_twoFactorSixDigitLabel')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
              </Card>
              <ActionButton variant="primary" label={t('b1_twoFactorVerifyBtn')} onPress={onEnable} busy={busy} disabled={busy} />
            </>
          ) : (
            <>
              <Card style={styles.section}>
                <Text style={styles.body}>{t('b1_twoFactorIntroBody')}</Text>
              </Card>
              <ActionButton variant="primary" icon="shield-checkmark-outline" label={t('b1_twoFactorEnableBtn')} onPress={onStartSetup} busy={busy} disabled={busy} />
            </>
          )}

          {msg ? <ErrorNotice flush message={msg} compact /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  card: { marginHorizontal: 0, padding: 0 },
  section: { marginHorizontal: 0, gap: spacing.md, padding: spacing.lg },
  body: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 21 },
  qr: { width: 200, height: 200, alignSelf: 'center', backgroundColor: c.surface, borderRadius: radii.md },
  secret: { fontSize: fontSize.sm, color: c.textSoft, textAlign: 'center' },
  secretCode: { fontWeight: fontWeight.bold, color: c.text },
  danger: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: spacing.lg },
  dangerEyebrow: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.error, letterSpacing: 1 },
}));
