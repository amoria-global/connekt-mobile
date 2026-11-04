import { useCallback, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { OtpInput, OTP_LENGTH } from '@/components/ui/OtpInput';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { formatCountdown, isCodeError, type CodeError } from '@/features/auth/twoFactor';
import { ListRow } from '@/features/client/studio';
import { ActionButton, Card, ErrorNotice, SectionHeader, SkeletonCard, StatusBadge } from '@/features/photographer/kit';
import {
  disableEmailMethod,
  disableTotpChecked,
  enableEmailMethod,
  enableTotpChecked,
  getTwoFactorStatus,
  groupKey,
  sendEmailMethodCode,
  setupTotp,
  type TotpSetup,
} from '@/features/security/api';
import { useAsync } from '@/hooks/useAsync';
import { copyText } from '@/utils/copyText';
import { useCountdown } from '@/hooks/useCountdown';
import { useSharedT } from '@/i18n/sharedStrings';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';

type Flow = 'totp-on' | 'totp-off' | 'email-on' | 'email-off';

/**
 * Pick how a code is asked for at sign-in: an authenticator app, an email code, or both.
 * Every code is checked by the server; this screen only collects it and shows the answer.
 */
export default function TwoFactorScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  const { tr } = useSharedT();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getTwoFactorStatus(), []));

  const [flow, setFlow] = useState<Flow | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [keyCopied, setKeyCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [sentTo, setSentTo] = useState<string | undefined>();
  const submitting = useRef(false);

  const lockSeconds = useCountdown(lockedUntil);
  const resendSeconds = useCountdown(resendAt);
  const locked = lockSeconds > 0;

  const reset = () => {
    setCode('');
    setMsg(null);
    setAttemptsLeft(null);
    setLockedUntil(null);
    setResendAt(null);
    setDone(false);
  };

  const fail = (err: unknown, fallback: string) => {
    if (isCodeError(err)) {
      const e: CodeError = err;
      if (e.retryAfterSeconds) {
        const until = Date.now() + e.retryAfterSeconds * 1000;
        if (e.errorCode === 'LOCKED') setLockedUntil(until);
        else setResendAt(until);
      }
      setAttemptsLeft(typeof e.attemptsLeft === 'number' ? e.attemptsLeft : null);
      setMsg(e.message);
    } else {
      setMsg(isApiError(err) ? err.message : fallback);
    }
  };

  const sendEmail = async (purpose: 'ENABLE' | 'DISABLE') => {
    setBusy(true);
    setMsg(null);
    try {
      const sent = await sendEmailMethodCode(purpose);
      // Measured on the server clock, so a phone with the wrong time still counts right.
      const skew = Date.parse(sent.serverTime) - Date.now();
      setResendAt(Date.parse(sent.resendAvailableAt) - skew);
      setSentTo(sent.maskedEmail);
    } catch (err) {
      fail(err, 'We could not send a code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Straight to the clipboard on builds that have the module, the share sheet (which has Copy) on older ones.
  const onCopyKey = async (secret: string) => {
    if (!secret) return;
    const out = await copyText(secret, { sensitive: true });
    setCopyFailed(out === 'failed');
    if (out === 'copied') {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const open = async (next: Flow) => {
    reset();
    setFlow(next);
    if (next === 'totp-on') {
      setBusy(true);
      try {
        setSetup(await setupTotp());
      } catch (err) {
        setFlow(null);
        setMsg(isApiError(err) ? err.message : t('b1_twoFactorSetupErr'));
      } finally {
        setBusy(false);
      }
    } else if (next === 'email-on') {
      await sendEmail('ENABLE');
    } else if (next === 'email-off') {
      await sendEmail('DISABLE');
    }
  };

  const close = () => {
    reset();
    setFlow(null);
    setSetup(null);
  };

  const submit = async (value: string) => {
    if (!flow || submitting.current || locked || value.length !== OTP_LENGTH) return;
    submitting.current = true;
    setBusy(true);
    setMsg(null);
    try {
      if (flow === 'totp-on') await enableTotpChecked(value);
      else if (flow === 'totp-off') await disableTotpChecked(value);
      else if (flow === 'email-on') await enableEmailMethod(value);
      else await disableEmailMethod(value);
      setDone(true);
      await refresh();
      close();
    } catch (err) {
      setCode('');
      setShakeKey((k) => k + 1);
      fail(err, t('b1_twoFactorEnableErr'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const copy = (
    <Text style={styles.body}>
      {flow === 'email-on' || flow === 'email-off'
        ? sentTo
          ? `${tr('We sent a 6-digit code to')} ${sentTo}.`
          : tr('We sent a 6-digit code to your email.')
        : flow === 'totp-off'
          ? t('b1_twoFactorDisableBody')
          : t('b1_twoFactorScanBody')}
    </Text>
  );

  const shownError = locked ? `Too many wrong codes. Try again in ${formatCountdown(lockSeconds)}.` : (msg ?? undefined);
  const hint = !locked && msg && attemptsLeft != null ? `${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left` : undefined;
  const isEmailFlow = flow === 'email-on' || flow === 'email-off';

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
              icon={data?.enabled ? 'shield-checkmark' : 'shield-outline'}
              tone={data?.enabled ? 'success' : 'primary'}
              title={data?.enabled ? t('b1_twoFactorStatusOn') : t('b1_twoFactorStatusOff')}
              trailing={<StatusBadge label={data?.enabled ? 'ON' : 'OFF'} tone={data?.enabled ? 'success' : 'neutral'} />}
            />
          </Card>
          {error && !data ? <ErrorNotice flush message={error} onRetry={refresh} /> : null}

          {data && !flow ? (
            <>
              <SectionHeader flush title={tr('Sign-in methods')} />
              <Card style={styles.card}>
                <ListRow
                  icon="phone-portrait-outline"
                  tone={data.totpEnabled ? 'success' : 'primary'}
                  title={tr('Authenticator app')}
                  meta={tr('A code from an app like Google Authenticator')}
                  trailing={<StatusBadge label={data.totpEnabled ? 'ON' : 'OFF'} tone={data.totpEnabled ? 'success' : 'neutral'} />}
                />
                <View style={styles.rowAction}>
                  <ActionButton
                    variant={data.totpEnabled ? 'destructive' : 'primary'}
                    label={data.totpEnabled ? tr('Turn off') : tr('Set up')}
                    onPress={() => open(data.totpEnabled ? 'totp-off' : 'totp-on')}
                    busy={busy}
                    disabled={busy}
                  />
                </View>
              </Card>
              <Card style={styles.card}>
                <ListRow
                  icon="mail-outline"
                  tone={data.emailEnabled ? 'success' : 'primary'}
                  title={tr('Email code')}
                  meta={data.maskedEmail ? `${tr('Sent to')} ${data.maskedEmail}` : tr('A code sent to your email')}
                  trailing={<StatusBadge label={data.emailEnabled ? 'ON' : 'OFF'} tone={data.emailEnabled ? 'success' : 'neutral'} />}
                />
                <View style={styles.rowAction}>
                  <ActionButton
                    variant={data.emailEnabled ? 'destructive' : 'primary'}
                    label={data.emailEnabled ? tr('Turn off') : tr('Set up')}
                    onPress={() => open(data.emailEnabled ? 'email-off' : 'email-on')}
                    busy={busy}
                    disabled={busy}
                  />
                </View>
              </Card>
            </>
          ) : null}

          {flow ? (
            <>
              <SectionHeader
                flush
                title={
                  flow === 'totp-on' || flow === 'email-on' ? tr('Confirm the code') : tr('Enter a code to turn this off')
                }
              />
              <Card style={styles.section}>
                {copy}
                {flow === 'totp-on' && setup?.qrCode ? (
                  <Image source={{ uri: setup.qrCode }} style={styles.qr} contentFit="contain" accessibilityLabel={tr('QR code for your authenticator app')} />
                ) : null}
                {flow === 'totp-on' && setup?.secret ? (
                  <View style={styles.keyBox}>
                    <Text style={styles.keyLabel}>{t('b1_twoFactorManualKey')}</Text>
                    {/* Selectable too, for anyone who prefers to press and hold. */}
                    <Text selectable style={styles.key} accessibilityLabel={`${tr('Setup key')} ${groupKey(setup.secret)}`}>
                      {groupKey(setup.secret)}
                    </Text>
                    <ActionButton
                      variant="secondary"
                      icon="copy-outline"
                      compact
                      label={keyCopied ? tr('Copied') : tr('Copy key')}
                      onPress={() => onCopyKey(setup.secret ?? '')}
                    />
                    {copyFailed ? <Text style={styles.keyLabel}>{tr('Could not copy. Press and hold the key to copy it.')}</Text> : null}
                  </View>
                ) : null}
                <OtpInput
                  label={tr('6-digit code')}
                  value={code}
                  onChange={setCode}
                  onComplete={submit}
                  error={shownError}
                  hint={hint}
                  busy={busy}
                  success={done}
                  editable={!locked}
                  shakeKey={shakeKey}
                />
                {isEmailFlow ? (
                  <Pressable
                    onPress={() => sendEmail(flow === 'email-on' ? 'ENABLE' : 'DISABLE')}
                    disabled={resendSeconds > 0 || busy || locked}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: resendSeconds > 0 || busy || locked }}
                  >
                    <Text style={[styles.resend, (resendSeconds > 0 || locked) && styles.resendOff]}>
                      {resendSeconds > 0 ? `${tr('Resend code in')} ${formatCountdown(resendSeconds)}` : tr('Resend code')}
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
              <ActionButton
                variant="primary"
                label={flow === 'totp-on' || flow === 'email-on' ? t('b1_twoFactorVerifyBtn') : tr('Turn off')}
                onPress={() => submit(code)}
                busy={busy}
                disabled={busy || locked || code.length !== OTP_LENGTH}
              />
              <ActionButton variant="secondary" label={tr('Cancel')} onPress={close} disabled={busy} />
            </>
          ) : null}

          {msg && !flow ? <ErrorNotice flush message={msg} compact /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  card: { marginHorizontal: 0, padding: 0 },
  section: { marginHorizontal: 0, gap: spacing.md, padding: spacing.lg },
  rowAction: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  body: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 21 },
  qr: { width: 200, height: 200, alignSelf: 'center', backgroundColor: c.surface, borderRadius: radii.md },
  keyBox: { gap: spacing.xs, alignItems: 'center' },
  keyLabel: { fontSize: fontSize.xs, color: c.textMuted },
  key: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text, letterSpacing: 1.5 },
  resend: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.primary, textAlign: 'center' },
  resendOff: { color: c.textMuted },
}));
