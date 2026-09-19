import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { Screen } from '@/components/ui/Screen';
import { resendOtp, verifyOtp } from '@/features/auth/api';
import { isApiError, useAuth } from '@/store/auth';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

const RESEND_COOLDOWN_S = 30;

export default function VerifyOtpScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const { customerId, email, phone } = useLocalSearchParams<{
    customerId: string;
    email?: string;
    phone?: string;
  }>();
  // The OTP is emailed when an email was given, otherwise texted to the phone.
  const channel = email || phone || 'you';
  const channelKind = email ? 'email' : 'phone';
  const applySession = useAuth((s) => s.applySession);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Seconds until Resend is allowed again. Starts at the cooldown because a
  // code was just sent by signup or login before this screen opened.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Without a customerId there is nothing to verify or resend. Say so rather
  // than leaving buttons that silently do nothing.
  const missingCustomer = !customerId;
  const missingMessage = 'This verification session has expired. Go back and sign in again to get a new code.';

  const onVerify = async (codeToVerify?: string) => {
    if (!customerId) {
      setError(missingMessage);
      return;
    }
    const code = (codeToVerify ?? otp).trim();
    if (code.length === 0) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const session = await verifyOtp(customerId, code);
      applySession(session); // root guard redirects into the app
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Verification failed. Try again.');
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!customerId) {
      setError(missingMessage);
      return;
    }
    if (resending || cooldown > 0) return;
    setError(null);
    setInfo(null);
    setResending(true);
    setOtp('');
    try {
      await resendOtp(customerId);
      setOtp('');
      setInfo(`A new code has been sent to your ${channelKind}. Use the newest code, earlier codes no longer work. Check your spam folder if it does not arrive.`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Verify your account</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to <Text style={styles.email}>{channel}</Text>. Enter it below to activate your account.
          </Text>
        </View>

        <OtpInput
          label="Verification code"
          value={otp}
          onChange={(v) => {
            setOtp(v);
            if (error) setError(null);
          }}
          onComplete={(completedCode) => {
            void onVerify(completedCode);
          }}
          error={error ?? (missingCustomer ? missingMessage : undefined)}
        />

        {info ? <Text style={styles.info}>{info}</Text> : null}

        <Button title="Verify" onPress={() => onVerify()} loading={submitting} />

        <Pressable
          onPress={onResend}
          disabled={resending || cooldown > 0 || missingCustomer}
          accessibilityRole="button"
          accessibilityState={{ disabled: resending || cooldown > 0 || missingCustomer }}
          style={styles.resend}
        >
          <Text style={styles.resendText}>
            Didn&apos;t get a code?{' '}
            {resending ? (
              <Text style={styles.muted}>Sending...</Text>
            ) : cooldown > 0 ? (
              <Text style={styles.muted}>Resend in {cooldown}s</Text>
            ) : (
              <Text style={styles.link}>Resend</Text>
            )}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  backBtnPressed: {
    opacity: 0.75,
    backgroundColor: c.borderSoft,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  logo: {
    width: 44,
    height: 44,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: c.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  email: {
    color: c.text,
    fontWeight: fontWeight.bold,
  },
  info: {
    color: c.success,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  resend: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  resendText: {
    color: c.textMuted,
    fontSize: fontSize.sm,
  },
  link: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  muted: {
    color: c.textMuted,
    fontWeight: fontWeight.semibold,
  },
}));
