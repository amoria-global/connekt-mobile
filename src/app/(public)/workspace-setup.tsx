import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthGlassLayout } from '@/features/auth/AuthGlassLayout';
import { completeWorkspaceSetup, isNeedsTotp, previewWorkspaceSetup, type SetupError, type SetupPreview } from '@/features/auth/api';
import { challengeParams } from '@/features/auth/twoFactor';
import { passwordStrength, SETUP_PASSWORD_RULE } from '@/features/workspace/setupPassword';
import { isApiError, useAuth } from '@/store/auth';
import { fontSize, fontWeight, makeStyles, spacing, useTheme } from '@/theme';

/**
 * First visit from the "Set up your access" email (connekt://workspace-setup?invite=<id>&t=<secret>): "<Owner> invited
 * you to their workspace", the email (fixed, not editable), a password and its confirmation, then "Open workspace". No
 * name, phone, role or profile fields: opening the link proved the email. An address that already has a login signs in
 * with its own password instead, and the workspace is added to it.
 */
export default function WorkspaceSetupScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ invite?: string; t?: string }>();
  const invitationId = typeof params.invite === 'string' ? params.invite : '';
  const token = typeof params.t === 'string' ? params.t : '';
  const applySession = useAuth((s) => s.applySession);

  // A link with no id or secret cannot be checked: it is invalid from the start, with nothing to ask the server.
  const [stage, setStage] = useState<'checking' | 'invalid' | 'form' | 'existing'>(invitationId && token ? 'checking' : 'invalid');
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!invitationId || !token) return;
    void previewWorkspaceSetup(invitationId, token).then((p) => {
      if (!live) return;
      if (!p || !p.found || !p.open) setStage('invalid');
      else {
        setPreview(p);
        setStage(p.account === 'existing' ? 'existing' : 'form');
      }
    });
    return () => { live = false; };
  }, [invitationId, token]);

  const meter = useMemo(() => passwordStrength(password), [password]);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = SETUP_PASSWORD_RULE.test(password) && password === confirm && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const session = await completeWorkspaceSetup({ invitationId, token, password, confirmPassword: confirm });
      applySession(session);
      // This screen is in the public group, which the sign-in guard leaves alone: go into the app, where the workspace opens.
      router.replace('/');
    } catch (err) {
      if (isNeedsTotp(err)) {
        router.push({ pathname: '/verify-totp', params: challengeParams(err.challenge) } as never);
        return;
      }
      const code = (err as SetupError).errorCode;
      if (code === 'EXISTING_ACCOUNT') setStage('existing');
      else if (code === 'LINK_INVALID') setStage('invalid');
      else setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'checking') {
    return <AuthGlassLayout title="Checking your invitation" subtitle="One moment."><View /></AuthGlassLayout>;
  }

  if (stage === 'invalid') {
    return (
      <AuthGlassLayout title="This link is no longer valid" subtitle="Invitation links work once and expire after 7 days. Ask the person who invited you to send a new one. If you already set a password, sign in instead.">
        <Button title="Go to sign in" onPress={() => router.replace('/login')} />
      </AuthGlassLayout>
    );
  }

  const title = preview?.ownerName ? `${preview.ownerName} invited you to their workspace` : 'You were invited to a workspace';

  if (stage === 'existing') {
    return (
      <AuthGlassLayout title={title} subtitle={`${preview?.email ?? 'This email'} already has a Connekyt account, so there is nothing to set up. Sign in with your existing password and the workspace is added next to your own.`}>
        <Button title="Sign in to add this workspace" onPress={() => router.replace({ pathname: '/login', params: { email: preview?.email ?? '' } } as never)} />
      </AuthGlassLayout>
    );
  }

  return (
    <AuthGlassLayout title="Set up your access" subtitle={title}>
      <Input glass label="Email" value={preview?.email ?? ''} editable={false} accessibilityLabel="Email, fixed" />
      <Input glass label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <View style={styles.meter} accessibilityLabel={password ? `Password strength: ${meter.label}` : undefined}>
        <View style={styles.bars}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.bar, i <= meter.score && { backgroundColor: meter.tone === 'good' ? colors.success : meter.tone === 'fair' ? colors.warning : colors.error }]} />
          ))}
        </View>
        <Text style={styles.hint}>{password ? `${meter.label}. ` : ''}At least 8 characters, with a letter, a number and one of @!#$%^&*=+</Text>
      </View>
      <Input glass label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password"
        error={mismatch ? 'The two passwords do not match.' : undefined} />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <Button title="Open workspace" onPress={submit} loading={busy} disabled={!canSubmit} />
      <Pressable onPress={() => router.replace('/login')} hitSlop={12} accessibilityRole="link" style={styles.link}>
        <Text style={styles.linkText}>Next time, sign in with this email and your password</Text>
      </Pressable>
    </AuthGlassLayout>
  );
}

const useStyles = makeStyles((c) => ({
  meter: { gap: spacing.xs },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.borderSoft },
  hint: { color: c.textMuted, fontSize: fontSize.xs },
  error: { color: c.error, fontSize: fontSize.sm },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
}));
