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
import { useLanguage } from '@/hooks/useLanguage';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

type Tab = 'mine' | 'joined';

const COLLAB_I18N = {
  en: {
    errLoad: 'Could not load your albums.',
    errLoadTitle: 'Could not load your albums',
    tryAgain: 'Try again',
    eyebrow: 'COLLABORATE',
    title: 'Work on albums together',
    subtitle: 'Invite fellow photographers to an album. They submit photos, and you choose what goes in.',
    toReview: 'to review',
    collaborator: 'collaborator',
    collaborators: 'collaborators',
    joined: 'joined',
    pasteInviteLabel: 'Paste the invite link you received',
    inviteLinkA11y: 'Invite link',
    cancel: 'Cancel',
    continueBtn: 'Continue',
    joinWithLinkA11y: 'Join an album with an invite link',
    joinWithLink: 'Join an album with a link',
    myAlbumsTab: 'My albums ({count})',
    joinedTab: 'Joined ({count})',
    noAlbumsTitle: 'You have no albums yet',
    noAlbumsMsg: 'Create an album first. Then open it here to invite photographers.',
    goToGallery: 'Go to Gallery',
    photosCount: '{count} photos',
    noCollaborators: 'No collaborators',
    noJoinedTitle: 'You have not joined any albums',
    noJoinedMsg: 'When a photographer sends you an invite link, open it or paste it above to start submitting photos.',
    pasteLinkBtn: 'Paste a link',
    albumOwner: 'Album owner',
    waitingCount: '{count} waiting',
    addedCount: '{count} added',
    notAcceptedCount: '{count} not accepted',
  },
  fr: {
    errLoad: 'Impossible de charger vos albums.',
    errLoadTitle: 'Impossible de charger vos albums',
    tryAgain: 'Réessayer',
    eyebrow: 'COLLABORER',
    title: 'Travaillez sur des albums ensemble',
    subtitle: 'Invitez d’autres photographes à un album. Ils soumettent des photos et vous choisissez ce qui est ajouté.',
    toReview: 'à examiner',
    collaborator: 'collaborateur',
    collaborators: 'collaborateurs',
    joined: 'rejoints',
    pasteInviteLabel: 'Collez le lien d’invitation reçu',
    inviteLinkA11y: 'Lien d’invitation',
    cancel: 'Annuler',
    continueBtn: 'Continuer',
    joinWithLinkA11y: 'Rejoindre un album avec un lien d’invitation',
    joinWithLink: 'Rejoindre un album avec un lien',
    myAlbumsTab: 'Mes albums ({count})',
    joinedTab: 'Rejoints ({count})',
    noAlbumsTitle: 'Vous n’avez pas encore d’album',
    noAlbumsMsg: 'Créez d’abord un album, puis ouvrez-le ici pour inviter des photographes.',
    goToGallery: 'Aller à la galerie',
    photosCount: '{count} photos',
    noCollaborators: 'Aucun collaborateur',
    noJoinedTitle: 'Vous n’avez rejoint aucun album',
    noJoinedMsg: 'Lorsqu’un photographe vous envoie un lien d’invitation, ouvrez-le ou collez-le ci-dessus pour soumettre des photos.',
    pasteLinkBtn: 'Coller un lien',
    albumOwner: 'Propriétaire de l’album',
    waitingCount: '{count} en attente',
    addedCount: '{count} ajoutées',
    notAcceptedCount: '{count} refusées',
  },
  es: {
    errLoad: 'No se pudieron cargar tus álbumes.',
    errLoadTitle: 'No se pudieron cargar tus álbumes',
    tryAgain: 'Intentar de nuevo',
    eyebrow: 'COLABORAR',
    title: 'Trabajen juntos en álbumes',
    subtitle: 'Invita a otros fotógrafos a un álbum. Ellos envían fotos y tú eliges qué se incluye.',
    toReview: 'por revisar',
    collaborator: 'colaborador',
    collaborators: 'colaboradores',
    joined: 'unidos',
    pasteInviteLabel: 'Pega el enlace de invitación recibido',
    inviteLinkA11y: 'Enlace de invitación',
    cancel: 'Cancelar',
    continueBtn: 'Continuar',
    joinWithLinkA11y: 'Unirse a un álbum con un enlace de invitación',
    joinWithLink: 'Unirse a un álbum con un enlace',
    myAlbumsTab: 'Mis álbumes ({count})',
    joinedTab: 'Unidos ({count})',
    noAlbumsTitle: 'Aún no tienes álbumes',
    noAlbumsMsg: 'Crea primero un álbum y ábrelo aquí para invitar fotógrafos.',
    goToGallery: 'Ir a la galería',
    photosCount: '{count} fotos',
    noCollaborators: 'Sin colaboradores',
    noJoinedTitle: 'No te has unido a ningún álbum',
    noJoinedMsg: 'Cuando un fotógrafo te envíe un enlace de invitación, ábrelo o pégalo arriba para enviar fotos.',
    pasteLinkBtn: 'Pegar un enlace',
    albumOwner: 'Propietario del álbum',
    waitingCount: '{count} en espera',
    addedCount: '{count} añadidas',
    notAcceptedCount: '{count} no aceptadas',
  },
} as const;

export default function CollaborateHub() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { language } = useLanguage();
  const s = COLLAB_I18N[language] ?? COLLAB_I18N.en;
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
      setError(isApiError(e) ? e.message : s.errLoad);
    }
  }, [s.errLoad]);

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
          <EmptyState icon="cloud-offline-outline" title={s.errLoadTitle} message={error}
            action={{ label: s.tryAgain, onPress: load }} />
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
          <Text style={styles.eyebrow}>{s.eyebrow}</Text>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.subtitle}>{s.subtitle}</Text>
        </View>

        <View style={styles.statsCard}>
          <Stat value={toReview} label={s.toReview} accent />
          <View style={styles.statDivider} />
          <Stat value={collaborators} label={collaborators === 1 ? s.collaborator : s.collaborators} />
          <View style={styles.statDivider} />
          <Stat value={joined.length} label={s.joined} />
        </View>

        {joinOpen ? (
          <View style={styles.joinCard}>
            <Text style={styles.joinLabel}>{s.pasteInviteLabel}</Text>
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
              accessibilityLabel={s.inviteLinkA11y}
            />
            <View style={styles.joinActions}>
              <Button title={s.cancel} variant="ghost" onPress={() => { setJoinOpen(false); setLink(''); }} style={styles.flex} />
              <Button title={s.continueBtn} onPress={openJoin} disabled={!tokenFromInput(link)} style={styles.flex} />
            </View>
          </View>
        ) : (
          <Pressable style={({ pressed }) => [styles.joinRow, pressed && styles.pressed]} onPress={() => setJoinOpen(true)}
            accessibilityRole="button" accessibilityLabel={s.joinWithLinkA11y}>
            <Ionicons name="enter-outline" size={20} color={colors.primary} />
            <Text style={styles.joinRowText}>{s.joinWithLink}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: s.myAlbumsTab.replace('{count}', String(owned.length)) },
            { value: 'joined', label: s.joinedTab.replace('{count}', String(joined.length)) },
          ]}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {tab === 'mine' ? (
          ownedSorted.length === 0 ? (
            <EmptyState icon="images-outline" title={s.noAlbumsTitle}
              message={s.noAlbumsMsg}
              action={{ label: s.goToGallery, onPress: () => router.push('/gallery' as Href) }} />
          ) : (
            ownedSorted.map((a) => (
              <Pressable key={a.id} onPress={() => router.push(`/collaborate/album/${a.id}` as Href)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${a.title}, ${a.pendingCount} ${s.toReview}, ${a.collaboratorCount} ${s.collaborators}`}>
                <View style={styles.cover}>
                  <AlbumCover uri={a.coverImage} title={a.title} />
                  {a.pendingCount > 0 && (
                    <View style={styles.pendingBadge}><Text style={styles.pendingText}>{a.pendingCount} {s.toReview}</Text></View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{a.title}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}><Ionicons name="image-outline" size={13} /> {s.photosCount.replace('{count}', String(a.imageCount))}</Text>
                    <Text style={styles.meta}>
                      <Ionicons name="people-outline" size={13} />{' '}
                      {a.collaboratorCount === 0 ? s.noCollaborators : `${a.collaboratorCount} ${a.collaboratorCount === 1 ? s.collaborator : s.collaborators}`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )
        ) : joined.length === 0 ? (
          <EmptyState icon="people-outline" title={s.noJoinedTitle}
            message={s.noJoinedMsg}
            action={{ label: s.pasteLinkBtn, onPress: () => setJoinOpen(true) }} />
        ) : (
          joined.map((a) => (
            <Pressable key={a.id} onPress={() => router.push(`/collaborate/joined/${a.id}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button" accessibilityLabel={`${a.title}, ${a.owner.name}`}>
              <View style={styles.cover}><AlbumCover uri={a.coverImage} title={a.title} /></View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{a.title}</Text>
                <PersonRow person={a.owner} caption={s.albumOwner} size={28} />
                <View style={styles.countsRow}>
                  <Text style={[styles.count, { color: colors.warning }]}>{s.waitingCount.replace('{count}', String(a.counts.pending))}</Text>
                  <Text style={[styles.count, { color: colors.success }]}>{s.addedCount.replace('{count}', String(a.counts.approved))}</Text>
                  <Text style={styles.count}>{s.notAcceptedCount.replace('{count}', String(a.counts.rejected))}</Text>
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
