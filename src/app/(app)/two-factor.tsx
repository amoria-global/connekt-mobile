import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { disableTotp, enableTotp, getTotpStatus, setupTotp, type TotpSetup } from '@/features/security/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function TwoFactorScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
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
      setMsg(isApiError(err) ? err.message : 'Could not start setup.');
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
      setMsg(isApiError(err) ? err.message : 'Could not enable two-factor.');
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
      setMsg(isApiError(err) ? err.message : 'Could not disable two-factor.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Two-factor authentication" subtitle="Add an extra layer of security" />
      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.statusCard, data?.enabled && styles.statusOn]}>
            <Ionicons
              name={data?.enabled ? 'shield-checkmark' : 'shield-outline'}
              size={26}
              color={data?.enabled ? colors.success : colors.textMuted}
            />
            <Text style={styles.statusText}>
              {data?.enabled ? 'Two-factor is ON' : 'Two-factor is OFF'}
            </Text>
          </View>
          {error && !data ? <Text style={styles.error}>{error}</Text> : null}

          {data?.enabled ? (
            <View style={styles.section}>
              <Text style={styles.body}>
                Enter a code from your authenticator app to turn two-factor off.
              </Text>
              <Input label="Authenticator code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
              <Button title="Disable two-factor" variant="ghost" onPress={onDisable} loading={busy} />
            </View>
          ) : setup ? (
            <View style={styles.section}>
              <Text style={styles.body}>
                Scan this QR code with Google Authenticator (or any TOTP app), then enter the 6-digit
                code to finish.
              </Text>
              {setup.qrCode ? (
                <Image source={{ uri: setup.qrCode }} style={styles.qr} contentFit="contain" />
              ) : null}
              {setup.secret ? (
                <Text style={styles.secret}>
                  Or enter this key manually: <Text style={styles.secretCode}>{setup.secret}</Text>
                </Text>
              ) : null}
              <Input label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
              <Button title="Verify & enable" onPress={onEnable} loading={busy} />
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.body}>
                Protect your account with an authenticator app. You&apos;ll enter a 6-digit code when
                signing in.
              </Text>
              <Button title="Enable two-factor" onPress={onStartSetup} loading={busy} />
            </View>
          )}

          {msg ? <Text style={styles.error}>{msg}</Text> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  statusOn: { borderColor: c.success, backgroundColor: c.successBg },
  statusText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  section: { gap: spacing.lg },
  body: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 21 },
  qr: { width: 200, height: 200, alignSelf: 'center', backgroundColor: c.surface, borderRadius: radii.md },
  secret: { fontSize: fontSize.sm, color: c.textSoft, textAlign: 'center' },
  secretCode: { fontWeight: fontWeight.bold, color: c.text },
  error: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },
}));
