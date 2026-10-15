/**
 * Collaborate hub, mirrors the dashboard's /user/photographer/collaborate.
 *  - My albums: albums I own, with collaborators and photos to review.
 *  - Joined: albums other photographers invited me to.
 * Joining with a pasted link lives here too, since links shared in a chat
 * app open in the browser rather than the app.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { listJoinedAlbums, listOwnedAlbums } from '@/features/collab/api';
import { AlbumCover, PersonRow, Stat } from '@/features/collab/components';
import { tokenFromInput, type JoinedAlbum, type OwnedAlbum } from '@/features/collab/model';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

type Tab = 'mine' | 'joined';

export default function CollaborateHub() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');
  const [owned, setOwned] = useState<OwnedAlbum[] | null>(null);
  const [joined, setJoined] = useState<JoinedAlbum[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [link, setLink] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, j] = await Promise.all([listOwnedAlbums(), listJoinedAlbums()]);
      setOwned(o);
      setJoined(j);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load your albums.');
    }
  }, []);

  // Reload on focus so counts are fresh after reviewing or submitting.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ownedSorted = useMemo(
    () => [...(owned ?? [])].sort((a, b) => b.pendingCount - a.pendingCount || b.collaboratorCount - a.collaboratorCount),
    [owned],
  );
  const toReview = (owned ?? []).reduce((n, a) => n + a.pendingCount, 0);
  const collaborators = (owned ?? []).reduce((n, a) => n + a.collaboratorCount, 0);

  const openJoin = () => {
    const token = tokenFromInput(link);
    if (!token) return;
    setJoinOpen(false);
    setLink('');
    router.push(`/collaborate/join/${encodeURIComponent(token)}` as Href);
  };

  if (!owned || !joined) {
    return (
      <Screen padded={false}>
        {error ? (
          <EmptyState icon="cloud-offline-outline" title="Could not load your albums" message={error}
            action={{ label: 'Try again', onPress: load }} />
        ) : (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        )}
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>COLLABORATE</Text>
          <Text style={styles.title}>Work on albums together</Text>
          <Text style={styles.subtitle}>Invite fellow photographers to an album. They submit photos, and you choose what goes in.</Text>
        </View>

        <View style={styles.statsCard}>
          <Stat value={toReview} label="to review" accent />
          <View style={styles.statDivider} />
          <Stat value={collaborators} label={collaborators === 1 ? 'collaborator' : 'collaborators'} />
          <View style={styles.statDivider} />
          <Stat value={joined.length} label="joined" />
        </View>

        {joinOpen ? (
          <View style={styles.joinCard}>
            <Text style={styles.joinLabel}>Paste the invite link you received</Text>
            <TextInput
              value={link}
              onChangeText={setLink}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://dashboard.connekyt.com/…/join/…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              onSubmitEditing={openJoin}
              returnKeyType="go"
              accessibilityLabel="Invite link"
            />
            <View style={styles.joinActions}>
              <Button title="Cancel" variant="ghost" onPress={() => { setJoinOpen(false); setLink(''); }} style={styles.flex} />
              <Button title="Continue" onPress={openJoin} disabled={!tokenFromInput(link)} style={styles.flex} />
            </View>
          </View>
        ) : (
          <Pressable style={({ pressed }) => [styles.joinRow, pressed && styles.pressed]} onPress={() => setJoinOpen(true)}
            accessibilityRole="button" accessibilityLabel="Join an album with an invite link">
            <Ionicons name="enter-outline" size={20} color={colors.primary} />
            <Text style={styles.joinRowText}>Join an album with a link</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: `My albums (${owned.length})` },
            { value: 'joined', label: `Joined (${joined.length})` },
          ]}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {tab === 'mine' ? (
          ownedSorted.length === 0 ? (
            <EmptyState icon="images-outline" title="You have no albums yet"
              message="Create an album first. Then open it here to invite photographers."
              action={{ label: 'Go to Gallery', onPress: () => router.push('/gallery' as Href) }} />
          ) : (
            ownedSorted.map((a) => (
              <Pressable key={a.id} onPress={() => router.push(`/collaborate/album/${a.id}` as Href)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${a.title}, ${a.pendingCount} to review, ${a.collaboratorCount} collaborators`}>
                <View style={styles.cover}>
                  <AlbumCover uri={a.coverImage} title={a.title} />
                  {a.pendingCount > 0 && (
                    <View style={styles.pendingBadge}><Text style={styles.pendingText}>{a.pendingCount} to review</Text></View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{a.title}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}><Ionicons name="image-outline" size={13} /> {a.imageCount} photos</Text>
                    <Text style={styles.meta}>
                      <Ionicons name="people-outline" size={13} />{' '}
                      {a.collaboratorCount === 0 ? 'No collaborators' : `${a.collaboratorCount} collaborator${a.collaboratorCount === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )
        ) : joined.length === 0 ? (
          <EmptyState icon="people-outline" title="You have not joined any albums"
            message="When a photographer sends you an invite link, open it or paste it above to start submitting photos."
            action={{ label: 'Paste a link', onPress: () => setJoinOpen(true) }} />
        ) : (
          joined.map((a) => (
            <Pressable key={a.id} onPress={() => router.push(`/collaborate/joined/${a.id}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button" accessibilityLabel={`${a.title}, owned by ${a.owner.name}`}>
              <View style={styles.cover}><AlbumCover uri={a.coverImage} title={a.title} /></View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{a.title}</Text>
                <PersonRow person={a.owner} caption="Album owner" size={28} />
                <View style={styles.countsRow}>
                  <Text style={[styles.count, { color: colors.warning }]}>{a.counts.pending} waiting</Text>
                  <Text style={[styles.count, { color: colors.success }]}>{a.counts.approved} added</Text>
                  <Text style={styles.count}>{a.counts.rejected} not accepted</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  intro: { gap: spacing.xs },
  eyebrow: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  title: { color: c.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, fontFamily: fonts.bold },
  subtitle: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  statsCard: {
    ...e(1), flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
    borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft, padding: spacing.lg, gap: spacing.md,
  },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: c.borderSoft },
  joinRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.tint,
    borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48,
  },
  joinRowText: { flex: 1, color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  joinCard: { backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.md },
  joinLabel: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: radii.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, color: c.text, fontSize: fontSize.sm, backgroundColor: c.surface,
  },
  joinActions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  errorText: { color: c.error, fontSize: fontSize.sm },
  card: { ...e(1), backgroundColor: c.card, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.borderSoft },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  cover: { height: 150, backgroundColor: c.surfaceMuted },
  pendingBadge: {
    position: 'absolute', top: spacing.md, right: spacing.md, backgroundColor: c.accent,
    borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 4,
  },
  pendingText: { color: '#FFFFFF', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  cardTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: c.textMuted, fontSize: fontSize.xs },
  countsRow: { flexDirection: 'row', gap: spacing.lg, borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: spacing.sm },
  count: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
}));
