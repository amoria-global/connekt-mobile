import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { env } from '@/config/env';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { fetchGoogleProfile, googleLogin, isEmailRegistered } from './api';
import type { GoogleProfile } from './api';
import type { CustomerType } from './types';

// Ensures the auth popup/redirect is dismissed correctly.
WebBrowser.maybeCompleteAuthSession();

/**
 * `customerType` is REQUIRED and has NO default.
 *
 * It used to default to 'Client'. Because the login screen rendered
 * <GoogleButton /> with no role, every Google sign-up from that screen silently
 * created a Client — a Photographer or Coordinator got the wrong role with no
 * error anywhere. Making this required turns that class of bug into a compile
 * error instead of a silent data defect.
 *
 * For a sign-in where no role has been chosen yet, pass the role the user
 * selected; if none exists, send them to role selection first rather than
 * guessing.
 */
type Props =
  /**
   * REGISTRATION. The role the user picked is mandatory and is what the new
   * account is created with. There is no default: the old `customerType =
   * 'Client'` fallback meant a Photographer signing up with Google silently
   * became a Client, with no error anywhere.
   */
  | { mode: 'signup'; customerType: CustomerType; label?: string }
  /**
   * SIGN-IN. No role is known here, so this mode must never create an account.
   * `/auth/google` creates one when the email is unknown, so we check first and
   * hand an unrecognised profile back via `onNeedsRole` for the caller to route
   * into role selection. Existing accounts keep the role already stored — the
   * backend only sets customerType when it creates the customer.
   */
  | { mode: 'login'; onNeedsRole: (profile: GoogleProfile) => void; label?: string };

/**
 * Whether the client ID required by THIS platform is present.
 *
 * `expo-auth-session`'s Google provider throws (invariantClientId) if the
 * platform's own client ID is missing - so a build that only sets the iOS /
 * Android IDs still crashed on web where `webClientId` is mandatory. We gate
 * on the platform-specific id, not "any id is set".
 *
 * The native branches used to read `|| !!env.googleWebClientId`, which is the
 * "any id is set" this comment says we do not do. The consequence was a live
 * 400 from Google: with only a web client ID configured, the button rendered
 * on a phone, useAuthRequest received only `webClientId`, and expo-auth-session
 * built a CUSTOM SCHEME redirect for native. Google refuses that pairing -
 *
 *     Error 400: invalid_request
 *     Custom scheme URIs are not allowed for 'WEB' client type.
 *
 * A web client ID cannot stand in for a native one. They are different OAuth
 * client types with different allowed redirect URIs: https for web, a custom
 * scheme (or reversed client id) for iOS and Android. Falling back to the web
 * ID on a device can only ever produce that error, so it is better to show the
 * "not configured" state and say which variable is missing.
 *
 * Extracted as a pure, exported function so it can be tested off-device. The
 * bug it replaces was a single `||` in an expression nothing could reach.
 */
export function isGoogleConfiguredFor(
  platform: string,
  ids: { web?: string; ios?: string; android?: string },
): boolean {
  if (platform === 'web') return !!ids.web;
  if (platform === 'ios') return !!ids.ios;
  if (platform === 'android') return !!ids.android;
  return false;
}

const googleConfiguredForPlatform = isGoogleConfiguredFor(Platform.OS, {
  web: env.googleWebClientId,
  ios: env.googleIosClientId,
  android: env.googleAndroidClientId,
});

/**
 * "Continue with Google". Splitting on the platform-aware config flag keeps
 * hook order consistent while avoiding the `useAuthRequest` invariant crash
 * when the platform's Google client ID isn't set.
 *
 * When the platform has no client ID, the button is ABSENT in a release build
 * and diagnostic in a dev build.
 *
 * Rendering it anyway was a guaranteed App Store rejection. Seen on a
 * simulator: the button looks completely normal, and tapping it raises
 * "Google sign-in not configured. Add your ios Google OAuth client ID
 * (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) to enable this." An App Review tester
 * taps every sign-in button, and a non-functioning one is guideline 2.1, app
 * completeness. The alert also prints an internal environment variable name
 * to whoever is holding the phone, which is not something a user should ever
 * be shown.
 *
 * A sign-in button that cannot sign anyone in should not exist. Apple's own
 * 4.8 obligation is unaffected: it attaches to third-party sign-in the app
 * actually OFFERS, so hiding Google here removes the requirement rather than
 * breaching it, and Sign in with Apple stays regardless.
 *
 * In development the diagnostic is the useful behaviour, so __DEV__ keeps it.
 */
export function GoogleButton(props: Props) {
  const { label = 'Continue with Google' } = props;
  if (!googleConfiguredForPlatform) {
    if (!__DEV__) return null;
    return (
      <Shell
        label={label}
        onPress={() =>
          Alert.alert(
            'Google sign-in not configured',
            `Add your ${Platform.OS} Google OAuth client ID (EXPO_PUBLIC_GOOGLE_${Platform.OS === 'web' ? 'WEB' : Platform.OS === 'ios' ? 'IOS' : 'ANDROID'}_CLIENT_ID) to enable this.`,
          )
        }
      />
    );
  }
  return <ConfiguredGoogleButton {...props} label={label} />;
}

function ConfiguredGoogleButton(props: Props) {
  const { label } = props;
  const applySession = useAuth((s) => s.applySession);
  const [loading, setLoading] = useState(false);

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

        if (props.mode === 'login') {
          // Never create an account from the sign-in screen: we have no role.
          if (!(await isEmailRegistered(profile.email))) {
            props.onNeedsRole(profile);
            return;
          }
          // Existing account — the backend ignores customerType for a customer
          // it did not just create, so the stored role is preserved.
          const session = await googleLogin(profile, 'Client');
          applySession(session);
          return;
        }

        const session = await googleLogin(profile, props.customerType);
        applySession(session); // root guard redirects into the app
      } catch (err) {
        Alert.alert('Google sign-in failed', isApiError(err) ? err.message : 'Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [response, props, applySession]);

  return (
    <Shell label={label} loading={loading} disabled={loading || !request} onPress={() => promptAsync()} />
  );
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
  const styles = useStyles();
  const { colors } = useTheme();
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

const useStyles = makeStyles((c) => ({
  btn: {
    height: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
}));
