/**
 * Where a pasted invite link lands, mirrors the dashboard's
 * /user/photographer/collaborate/join/[token]. Shows whose album it is
 * and what joining means before the photographer commits.
 */
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { acceptInvite, previewInvite } from '@/features/collab/api';
import { AlbumCover, PersonRow } from '@/features/collab/components';
import type { InvitePreview } from '@/features/collab/model';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

const BLOCKED: Record<string, { icon: 'person-outline' | 'person-remove-outline' | 'ban-outline' | 'time-outline'; title: string; message: string }> = {
  OWNER: { icon: 'person-outline', title: 'This is your own album', message: 'Send this link to the photographers you want to invite. Any number of them can join with it.' },
  REMOVED: { icon: 'person-remove-outline', title: 'You were removed from this album', message: 'The album owner removed you after this link was made. Ask them for a new link to rejoin.' },
  REVOKED: { icon: 'ban-outline', title: 'This link was cancelled', message: 'The album owner cancelled it. Ask them for a new one if you should still join.' },
  EXPIRED: { icon: 'time-outline', title: 'This link has expired', message: 'Invite links last 14 days. Ask the album owner for a new one.' },
};

export default function JoinInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  // Everything below belongs to one token. State is keyed by it, so a new link can never show the previous album,
  // error or "joining" spinner, without resetting state inside an effect.
  const [loaded, setLoaded] = useState<{ token: string; preview: InvitePreview | null; error: string | null } | null>(null);
  const [joiningToken, setJoiningToken] = useState<string | null>(null);
  const here = loaded && loaded.token === token ? loaded : null;
  const preview = here?.preview ?? null;
  const error = here?.error ?? null;
  const joining = joiningToken === token;

  useEffect(() => {
    if (!token) return;
    let current = true;
    previewInvite(token)
      .then((p) => current && setLoaded({ token, preview: p, error: null }))
      .catch(
        (e) =>
          current &&
          setLoaded({ token, preview: null, error: isApiError(e) ? e.message : 'This invite link is not valid.' }),
      );
    return () => {
      current = false;
    };
  }, [token]);

  const join = async () => {
    if (!token) return;
    setJoiningToken(token);
    setLoaded((l) => (l && l.token === token ? { ...l, error: null } : l));
    try {
      const albumId = await acceptInvite(token);
      router.replace(`/collaborate/joined/${albumId}` as Href);
    } catch (e) {
      setLoaded((l) =>
        l && l.token === token ? { ...l, error: isApiError(e) ? e.message : 'Could not join this album.' } : l,
      );
      setJoiningToken(null);
    }
  };

  const back = { label: 'Go to Collaborate', onPress: () => router.replace('/collaborate' as Href) };

  if (!preview) {
    return (
      <Screen padded={false}>
        {error ? (
          <EmptyState icon="link-outline" title="This invite link does not work" message={error} action={back} />
        ) : (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        )}
      </Screen>
    );
  }

  const blocked = BLOCKED[preview.state];
  if (blocked) {
    return <Screen padded={false}><EmptyState icon={blocked.icon} title={blocked.title} message={blocked.message} action={back} /></Screen>;
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          <AlbumCover uri={preview.album.coverImage} title={preview.album.title} />
        </View>
        <Text style={styles.title}>{preview.album.title}</Text>
        <PersonRow person={preview.owner} caption="invited you to collaborate on this album" />

        <View style={styles.points}>
          <Point icon="cloud-upload-outline" text="You can submit your photos to this album." />
          <Point icon="checkmark-done-outline" text={`${preview.owner.name} reviews each one and decides what is added.`} />
          <Point icon="shield-checkmark-outline" text="You do not get access to their account, clients or earnings, and they do not get access to yours." />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {preview.state === 'ALREADY_MEMBER' ? (
          <Button title="Open album" onPress={() => router.replace(`/collaborate/joined/${preview.album.id}` as Href)} />
        ) : (
          <Button title="Join album" onPress={join} loading={joining} />
        )}
      </ScrollView>
    </Screen>
  );
}

function Point({ icon, text }: { icon: 'cloud-upload-outline' | 'checkmark-done-outline' | 'shield-checkmark-outline'; text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  cover: { height: 190, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  title: { color: c.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, fontFamily: fonts.bold },
  points: { gap: spacing.md, backgroundColor: c.tint, borderRadius: radii.lg, padding: spacing.lg },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pointText: { flex: 1, color: c.text, fontSize: fontSize.sm, lineHeight: 20 },
  error: { color: c.error, fontSize: fontSize.sm },
}));
