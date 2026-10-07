/**
 * Landing point for connekt://scan/<eventId>, opened from the "Open in the
 * app" prompt on a scanned event QR page. Forwards to the guest event screen,
 * where the viewer enters their details. When the viewer is not yet signed in
 * or has not accepted the first-run terms, the id is also kept so the root
 * layout can deliver them to this same event once those steps are done.
 */
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { sanitizeEventId, setPendingScanEvent } from '@/features/events/scanIntent';
import { useAuth } from '@/store/auth';
import { useOnboarding } from '@/store/onboarding';
import { useTheme } from '@/theme';

export default function ScanEventScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const status = useAuth((s) => s.status);
  const termsAccepted = useOnboarding((s) => s.termsAccepted);

  useEffect(() => {
    // Wait for auth and the terms flag to load, so the decision below is real.
    if (status === 'idle' || status === 'loading' || termsAccepted === null) return;
    const id = sanitizeEventId(rawId);
    if (!id) {
      router.replace('/' as Href);
      return;
    }
    const ready = status === 'authenticated' && termsAccepted === true;
    (async () => {
      if (!ready) await setPendingScanEvent(id).catch(() => {});
      // First-run terms come before everything else; the layout takes over from there.
      if (termsAccepted) router.replace(`/(public)/event/${id}` as Href);
    })();
  }, [rawId, status, termsAccepted, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
