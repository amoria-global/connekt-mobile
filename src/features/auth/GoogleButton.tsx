import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { env } from '@/config/env';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { fetchGoogleProfile, googleLogin } from './api';
import type { CustomerType } from './types';

// Ensures the auth popup/redirect is dismissed correctly.
WebBrowser.maybeCompleteAuthSession();

type Props = { customerType?: CustomerType; label?: string };

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
 * "Continue with Google". Splitting on the platform-aware config flag keeps
 * hook order consistent while avoiding the `useAuthRequest` invariant crash
 * when the platform's Google client ID isn't set.
 */
export function GoogleButton({ customerType = 'Client', label = 'Continue with Google' }: Props) {
  if (!googleConfiguredForPlatform) {
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
  return <ConfiguredGoogleButton customerType={customerType} label={label} />;
}

function ConfiguredGoogleButton({ customerType = 'Client', label }: Props) {
  const applySession = useAuth((s) => s.applySession);
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: env.googleWebClientId || undefined,
    iosClientId: env.googleIosClientId || undefined,
    androidClientId: env.googleAndroidClientId || undefined,
  });

  useEffect(() => {
    // Google reports configuration problems (a Web client id used on Android,
    // a missing SHA-1) as an error response. Silently ignoring it left users
    // staring at Google's "Access blocked" page with nothing in the app.
    if (response?.type === 'error') {
      Alert.alert(
        'Google sign-in is unavailable',
        response.error?.description || response.error?.message || 'Please sign in with your email and password for now.',
      );
      return;
    }
    if (response?.type !== 'success') return;
    const accessToken = response.authentication?.accessToken;
    if (!accessToken) return;

    (async () => {
      setLoading(true);
      try {
        const profile = await fetchGoogleProfile(accessToken);
        const session = await googleLogin(profile, customerType ?? 'Client');
        applySession(session); // root guard redirects into the app
      } catch (err) {
        Alert.alert('Google sign-in failed', isApiError(err) ? err.message : 'Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [response, customerType, applySession]);

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
