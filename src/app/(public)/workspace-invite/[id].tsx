/**
 * Landing point for connekt://workspace-invite/<invitation id>: an invitation to work in another photographer's
 * workspace, opened from the app (or a pasted link). The id is kept first, so signing in or up (and the one-time code
 * and two-factor that follow) cannot lose it. Someone already signed in goes straight to the invitation in Collaborate;
 * someone who is not goes to sign-in, which sends a person with no account on to sign-up as a photographer with the
 * invited address filled in.
 */
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { inviteIdFromText } from '@/features/workspace/invite';
import { clearPendingWorkspaceInvite, setPendingWorkspaceInvite } from '@/features/workspace/pendingInvite';
import { useAuth } from '@/store/auth';
import { useOnboarding } from '@/store/onboarding';
import { useTheme } from '@/theme';

export default function WorkspaceInviteScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const status = useAuth((s) => s.status);
  const termsAccepted = useOnboarding((s) => s.termsAccepted);

  useEffect(() => {
    // Wait for auth and the terms flag to load, so the decision below is real.
    if (status === 'idle' || status === 'loading' || termsAccepted === null) return;
    const id = inviteIdFromText(rawId);
    if (!id) {
      router.replace('/' as Href);
      return;
    }
    (async () => {
      if (status === 'authenticated' && termsAccepted === true) {
        // Already signed in: the invitation is shown in Collaborate, so nothing needs to be kept.
        await clearPendingWorkspaceInvite().catch(() => {});
        router.replace(`/collaborate?invite=${id}` as Href);
        return;
      }
      await setPendingWorkspaceInvite(id).catch(() => {});
      // First-run terms come before everything else; the layout takes over from there.
      if (termsAccepted) router.replace({ pathname: '/login', params: { invite: id } } as Href);
    })();
  }, [rawId, status, termsAccepted, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
