import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Platform, Pressable, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { appleLogin, isNeedsRole, isNeedsTotp } from './api';
import type { AppleProfile } from './api';
import { appleSignInStatus, isAppleSignInCancelled, requestAppleCredential } from './apple';
import type { CustomerType } from './types';

/** Same two-mode contract as GoogleButton, for the same reason: no silent default role. */
type Props =
  /** REGISTRATION. The role the user picked is what a new account is created with. */
  | { mode: 'signup'; customerType: CustomerType; label?: string }
  /**
   * SIGN-IN. No role is known here, so this mode must never create an account.
   * The backend is asked not to register an unknown Apple ID (`createIfMissing:
   * false`); the verified profile comes back via `onNeedsRole` for the caller
   * to route into role selection. Existing accounts keep their stored role.
   */
  | { mode: 'login'; onNeedsRole: (profile: AppleProfile) => void; label?: string };

/**
 * Availability is an async native query, so the button mounts hidden and
 * appears once known.
 *
 * In development the reason for a `false` is logged once. Rendering nothing is
 * right in production - an auth option the device cannot honour should not be
 * offered - but it is indistinguishable from the button having been deleted,
 * and that ambiguity has already cost real debugging time. The log makes the
 * difference between "Android, working as intended" and "this host app has no
 * expo-apple-authentication, build a dev client" visible in one line.
 */
function useAppleSignInAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    appleSignInStatus().then((status) => {
      if (cancelled) return;
      setAvailable(status.available);
      if (__DEV__ && !status.available) {
        const why = {
          'not-ios': 'Apple sign-in is iOS-only, so the button is hidden here by design.',
          'unsupported-device':
            'iOS reports Apple sign-in unavailable (iOS 12 or earlier, or an unsupported device).',
          'module-missing':
            'expo-apple-authentication is not in this host app. Expo Go does not carry it for '
            + 'this SDK - run a development build (npx expo install expo-dev-client, '
            + 'eas build --profile development) and the button returns.',
        }[status.reason ?? 'not-ios'];
        console.warn(`[AppleButton] hidden: ${why}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

/**
 * "Continue with Apple". Always rendered on login and registration so that
 * users on all platforms see the option, with native sign-in invoked where available.
 *
 * Follows Apple's button guidelines: Apple logo, black button in light mode
 * and white in dark mode, same height and radius as the Google button so the
 * two read as one group.
 */
export function AppleButton(props: Props) {
  const { label = 'Continue with Apple' } = props;
  const router = useRouter();
  const applySession = useAuth((s) => s.applySession);
  const [loading, setLoading] = useState(false);
  const styles = useStyles();
  const { isDark } = useTheme();
  const available = useAppleSignInAvailable();

  // Apple's Human Interface Guidelines allow only black, white or white with an
  // outline for Sign in with Apple, and App Review enforces it: black on a
  // light screen, white on a dark one. A brand-coloured button also competed
  // with the screen's real primary action.
  const background = isDark ? '#FFFFFF' : '#000000';
  const foreground = isDark ? '#000000' : '#FFFFFF';
  const borderColor = background;

  const onPress = async () => {
    if (!available) {
      Alert.alert(
        'Apple Sign-In',
        Platform.OS === 'ios'
          ? 'Sign in with Apple requires a physical iOS device with an Apple ID or a development build.'
          : 'Sign in with Apple is currently supported on iOS devices.',
      );
      return;
    }
    setLoading(true);
    try {
      // In sign-in mode the role is irrelevant: the backend only reads
      // customerType when it creates an account, which this mode forbids.
      const credential = await requestAppleCredential(
        props.mode === 'signup' ? props.customerType : 'Client',
      );
      const session = await appleLogin(credential, { createIfMissing: props.mode === 'signup' });
      applySession(session); // root guard redirects into the app
    } catch (err) {
      if (isAppleSignInCancelled(err)) return;
      if (isNeedsRole(err) && props.mode === 'login') {
        props.onNeedsRole(err.profile);
        return;
      }
      if (isNeedsTotp(err)) {
        router.push({ pathname: '/verify-totp', params: { customerId: err.customerId } });
        return;
      }
      const message = isApiError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Please try again.';
      Alert.alert('Apple sign-in failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: background, borderColor },
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          <AppleLogo size={18} color={foreground} />
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function AppleLogo({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  );
}

const useStyles = makeStyles(() => ({
  btn: {
    height: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
}));
