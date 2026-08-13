import { useEffect, useRef, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { env } from '@/config/env';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { emailTaken, fetchGoogleProfile, googleLogin } from './api';
import { openWebLogin, openWebSignup } from './webSignup';
import type { CustomerType } from './types';

// Ensures the auth popup/redirect is dismissed correctly.
WebBrowser.maybeCompleteAuthSession();

type Props = {
  /** Role to register under. Used as-is on the sign-up screen. */
  customerType?: CustomerType;
  label?: string;
  /**
   * Marks this as a SIGN-IN button that may also have to register.
   *
   * `/auth/google` is login-or-register, so the login screen can't know which
   * it's doing until Google returns an email. When this is set, the button
   * checks whether that email already has an account: if it does the user is
   * signed straight in (their stored role is kept — the backend ignores
   * `customerType` for existing accounts), and only a genuinely NEW email
   * triggers this callback to pick a role. Return `null` to abort.
   *
   * Leave it unset on the sign-up screen, where the role is already known and
   * registering is the whole point.
   */
  askRoleForNewAccount?: () => Promise<CustomerType | null>;
};

/**
 * Whether the client ID required by THIS platform is present.
 * `expo-auth-session`'s Google provider throws (invariantClientId) if the
 * platform's own client ID is missing — so a build that only sets the iOS /
 * Android IDs still crashed on web where `webClientId` is mandatory. We gate
 * on the platform-specific id, not "any id is set".
 */
const googleConfiguredForPlatform =
  Platform.OS === 'web'
    ? !!env.googleWebClientId
    : Platform.OS === 'ios'
      ? !!env.googleIosClientId || !!env.googleWebClientId
      : Platform.OS === 'android'
        ? !!env.googleAndroidClientId || !!env.googleWebClientId
        : false;

/**
 * Expo Go cannot do native Google OAuth.
 *
 * `expo-auth-session` only returns the app's own `connekt://` redirect URI in
 * Standalone/Bare builds (see `makeRedirectUri`); under Expo Go it falls back
 * to `Linking.createURL()`, i.e. `exp://192.168.x.x:8081/--/`. Google rejects
 * that redirect for native AND web OAuth clients, and the old auth.expo.io
 * proxy that used to paper over this is gone in expo-auth-session 7. On top of
 * that, an Android OAuth client is bound to this app's package + signing
 * certificate, whereas Expo Go runs as `host.exp.exponent`.
 *
 * So in Expo Go we route Google through the browser instead — the same web
 * hand-off registration already uses. knockout's Google sign-up honors our
 * `redirect` deep link and bounces a real session straight back to the app.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Native OAuth only works in a dev/production build with a client ID set. */
const nativeGoogleAvailable = !isExpoGo && googleConfiguredForPlatform;

/**
 * "Continue with Google". Splitting on module-level constants keeps hook order
 * stable while avoiding the `useAuthRequest` invariant crash when the
 * platform's Google client ID isn't set.
 */
export function GoogleButton({
  customerType = 'Client',
  label = 'Continue with Google',
  askRoleForNewAccount,
}: Props) {
  if (!nativeGoogleAvailable) {
    return (
      <WebHandoffGoogleButton
        customerType={customerType}
        label={label}
        askRoleForNewAccount={askRoleForNewAccount}
      />
    );
  }
  return (
    <ConfiguredGoogleButton
      customerType={customerType}
      label={label}
      askRoleForNewAccount={askRoleForNewAccount}
    />
  );
}

function ConfiguredGoogleButton({ customerType = 'Client', label, askRoleForNewAccount }: Props) {
  const applySession = useAuth((s) => s.applySession);
  const [loading, setLoading] = useState(false);

  // Read from a ref in the response handler so the async OAuth round-trip
  // can't come back and register under a stale value.
  const roleRef = useRef<CustomerType>(customerType ?? 'Client');
  roleRef.current = customerType ?? 'Client';
  const askRef = useRef(askRoleForNewAccount);
  askRef.current = askRoleForNewAccount;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: env.googleWebClientId || undefined,
    iosClientId: env.googleIosClientId || undefined,
    androidClientId: env.googleAndroidClientId || undefined,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const accessToken = response.authentication?.accessToken;
    if (!accessToken) return;

    (async () => {
      setLoading(true);
      try {
        const profile = await fetchGoogleProfile(accessToken);
        let role = roleRef.current;

        const ask = askRef.current;
        if (ask) {
          // Sign-in button: only a brand-new email is a registration, and only
          // a registration needs a role. Returning users go straight through.
          let isNew: boolean;
          try {
            isNew = !(await emailTaken(profile.email));
          } catch {
            // Couldn't tell — ask rather than guess. Asking an existing user is
            // merely redundant (the backend ignores the role for them);
            // guessing would create a new account under the wrong one.
            isNew = true;
          }
          if (isNew) {
            const picked = await ask();
            if (!picked) return; // dismissed — don't create anything
            role = picked;
          }
        }

        const session = await googleLogin(profile, role);
        applySession(session); // root guard redirects into the app
      } catch (err) {
        Alert.alert('Google sign-in failed', isApiError(err) ? err.message : 'Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [response, applySession]);

  return (
    <Shell
      label={label}
      loading={loading}
      disabled={loading || !request}
      onPress={() => void promptAsync()}
    />
  );
}

/**
 * Browser fallback used in Expo Go (and any build without a native client ID):
 * open the matching web auth page and let the user continue with Google there.
 * The web redirects back into `connekt://auth-callback` carrying a minted
 * session, which the helper persists for us.
 */
function WebHandoffGoogleButton({ customerType = 'Client', label, askRoleForNewAccount }: Props) {
  const applySession = useAuth((s) => s.applySession);
  const [loading, setLoading] = useState(false);

  // Sign-in button → open the web LOGIN page (no role: signing in never creates
  // an account, and someone with an account shouldn't land on a sign-up form).
  // Sign-up button → the web sign-up with the chosen role already applied.
  const isSignIn = !!askRoleForNewAccount;

  const onPress = async () => {
    setLoading(true);
    try {
      const result = isSignIn
        ? await openWebLogin()
        : await openWebSignup(customerType ?? 'Client');
      if (result.status === 'success') {
        applySession(result.session);
      } else if (result.status === 'registered') {
        Alert.alert('Account created', 'Your account is ready. Please sign in to continue.');
      }
      // 'cancelled' → user backed out; stay put silently.
    } catch (err) {
      Alert.alert('Google sign-in failed', isApiError(err) ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return <Shell label={label} loading={loading} disabled={loading} onPress={() => void onPress()} />;
}

function Shell({
  label,
  loading,
  disabled,
  onPress,
}: {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <GoogleIcon size={18} />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
});
