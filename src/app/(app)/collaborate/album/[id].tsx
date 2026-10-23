/**
 * The owner's workspace for one album, mirrors the dashboard's
 * /user/photographer/collaborate/albums/[id].
 *  - Review: tap a photo to see it large and decide; long-press to select
 *    several and decide for all of them at once.
 *  - People: collaborators and invite links not used yet.
 *  - History: photos already approved or rejected.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { cancelInvite, createInvite, getOwnedAlbum, removeCollaborator, reviewSubmissions } from '@/features/collab/api';
import { AlbumCover, PersonRow, StatusChip } from '@/features/collab/components';
import { daysLeft, timeAgo, type Collaborator, type OwnedAlbumDetail, type Submission } from '@/features/collab/model';
import { useLanguage } from '@/hooks/useLanguage';
import { isApiError } from '@/store/auth';

const OA_I18N = {
  en: {
    errLoad: "Could not load this album.",
    errOpenTitle: "Could not open this album",
    tryAgain: "Try again",
    stayInReviewTitle: "Some photos stayed in review",
    stayInReviewMsg: "{count} photo(s) were already published by another photographer, so they could not be added. You can reject them instead.",
    errSaveDecision: "Could not save your decision",
    pleaseTryAgain: "Please try again.",
    shareInviteMsg: "Join my album \"{title}\" on Connekyt and submit your photos: {link}",
    errCreateInvite: "Could not create the invite link",
    keep: "Keep",
    errUpdateCollab: "Could not update collaborators",
    removeTitle: "Remove {name}?",
    removeMsg: "They will no longer be able to submit photos to this album. Photos they already submitted stay in your review queue. To bring them back, send them a new link.",
    remove: "Remove",
    yourAlbum: "YOUR ALBUM",
    photosCollabMeta: "{photos} photos · {collabs} collaborator(s)",
    invitePhotographer: "Invite a photographer",
    tabReview: "Review ({count})",
    tabPeople: "People ({count})",
    tabHistory: "History",
    nothingToReview: "Nothing to review",
    nothingToReviewNoCollab: "Invite a photographer. Photos they submit will wait here for your decision.",
    nothingToReviewCaughtUp: "You are all caught up. New photos from your collaborators will appear here.",
    selectedCount: "{count} selected",
    tapToReviewHint: "Tap to review · long press to select",
    clear: "Clear",
    selectAll: "Select all",
    collaboratorsTitle: "Collaborators",
    noCollaboratorsYet: "No one yet. Create an invite link and send it to a photographer you work with.",
    joinedCaption: "Joined {ago} · {count} photos",
    openInviteLinks: "Open invite links",
    noInvitesYet: "None. One link can bring in as many photographers as you send it to.",
    inviteLinkFallback: "Invite link",
    joinedCountMeta: "{count} joined · {left}",
    share: "Share",
    cancelLinkTitle: "Cancel this link?",
    cancelLinkMsg: "Nobody else can join with it. Photographers who already joined stay.",
    cancelLinkBtn: "Cancel link",
    cancel: "Cancel",
    noDecisionsTitle: "No decisions yet",
    noDecisionsMsg: "Photos you approve or reject are listed here.",
    reject: "Reject",
    addCount: "Add {count}",
    close: "Close",
    submittedAgo: "Submitted {ago}",
    addToAlbum: "Add to album",
    yourNote: "Your note: {note}",
    rejectSheetTitle: "Reject {count} photo(s)?",
    rejectSheetSub: "They stay out of the album. The photographer is told, with your note if you add one.",
    notePlaceholder: "Note for the photographer (optional)",
  },
  fr: {
    errLoad: "Impossible de charger cet album.",
    errOpenTitle: "Impossible d’ouvrir cet album",
    tryAgain: "Réessayer",
    stayInReviewTitle: "Certaines photos sont restées en examen",
    stayInReviewMsg: "{count} photo(s) étaient déjà publiées par un autre photographe et n’ont pas pu être ajoutées. Vous pouvez les refuser.",
    errSaveDecision: "Impossible d’enregistrer votre décision",
    pleaseTryAgain: "Veuillez réessayer.",
    shareInviteMsg: "Rejoignez mon album \"{title}\" sur Connekyt et soumettez vos photos : {link}",
    errCreateInvite: "Impossible de créer le lien d’invitation",
    keep: "Garder",
    errUpdateCollab: "Impossible de mettre à jour les collaborateurs",
    removeTitle: "Retirer {name} ?",
    removeMsg: "Cette personne ne pourra plus soumettre de photos à cet album. Les photos déjà soumises restent dans votre file d’attente.",
    remove: "Retirer",
    yourAlbum: "VOTRE ALBUM",
    photosCollabMeta: "{photos} photos · {collabs} collaborateur(s)",
    invitePhotographer: "Inviter un photographe",
    tabReview: "Examiner ({count})",
    tabPeople: "Personnes ({count})",
    tabHistory: "Historique",
    nothingToReview: "Rien à examiner",
    nothingToReviewNoCollab: "Invitez un photographe. Les photos soumises attendront votre décision ici.",
    nothingToReviewCaughtUp: "Vous êtes à jour. Les nouvelles photos de vos collaborateurs apparaîtront ici.",
    selectedCount: "{count} sélectionnée(s)",
    tapToReviewHint: "Appuyez pour examiner · appui long pour sélectionner",
    clear: "Effacer",
    selectAll: "Tout sélectionner",
    collaboratorsTitle: "Collaborateurs",
    noCollaboratorsYet: "Personne pour l’instant. Créez un lien d’invitation et envoyez-le à un photographe.",
    joinedCaption: "A rejoint {ago} · {count} photos",
    openInviteLinks: "Liens d’invitation actifs",
    noInvitesYet: "Aucun. Un seul lien peut inviter autant de photographes que vous le souhaitez.",
    inviteLinkFallback: "Lien d’invitation",
    joinedCountMeta: "{count} rejoint(s) · {left}",
    share: "Partager",
    cancelLinkTitle: "Annuler ce lien ?",
    cancelLinkMsg: "Plus personne ne pourra rejoindre avec ce lien. Les photographes déjà présents restent.",
    cancelLinkBtn: "Annuler le lien",
    cancel: "Annuler",
    noDecisionsTitle: "Aucune décision pour l’instant",
    noDecisionsMsg: "Les photos approuvées ou refusées sont listées ici.",
    reject: "Refuser",
    addCount: "Ajouter {count}",
    close: "Fermer",
    submittedAgo: "Soumise {ago}",
    addToAlbum: "Ajouter à l’album",
    yourNote: "Votre note : {note}",
    rejectSheetTitle: "Refuser {count} photo(s) ?",
    rejectSheetSub: "Elles restent hors de l’album. Le photographe en est informé avec votre note.",
    notePlaceholder: "Note pour le photographe (optionnel)",
  },
  es: {
    errLoad: "No se pudo cargar este álbum.",
    errOpenTitle: "No se pudo abrir este álbum",
    tryAgain: "Intentar de nuevo",
    stayInReviewTitle: "Algunas fotos permanecieron en revisión",
    stayInReviewMsg: "{count} foto(s) ya fueron publicadas por otro fotógrafo y no pudieron añadirse. Puedes rechazarlas.",
    errSaveDecision: "No se pudo guardar tu decisión",
    pleaseTryAgain: "Por favor inténtalo de nuevo.",
    shareInviteMsg: "Únete a mi álbum \"{title}\" en Connekyt y envía tus fotos: {link}",
    errCreateInvite: "No se pudo crear el enlace de invitación",
    keep: "Conservar",
    errUpdateCollab: "No se pudieron actualizar los colaboradores",
    removeTitle: "¿Eliminar a {name}?",
    removeMsg: "Ya no podrá enviar fotos a este álbum. Las fotos ya enviadas permanecen en tu cola de revisión.",
    remove: "Eliminar",
    yourAlbum: "TU ÁLBUM",
    photosCollabMeta: "{photos} fotos · {collabs} colaborador(es)",
    invitePhotographer: "Invitar a un fotógrafo",
    tabReview: "Revisar ({count})",
    tabPeople: "Personas ({count})",
    tabHistory: "Historial",
    nothingToReview: "Nada por revisar",
    nothingToReviewNoCollab: "Invita a un fotógrafo. Las fotos que envíe esperarán aquí tu decisión.",
    nothingToReviewCaughtUp: "Estás al día. Las nuevas fotos de tus colaboradores aparecerán aquí.",
    selectedCount: "{count} seleccionada(s)",
    tapToReviewHint: "Toca para revisar · mantén presionado para seleccionar",
    clear: "Limpiar",
    selectAll: "Seleccionar todo",
    collaboratorsTitle: "Colaboradores",
    noCollaboratorsYet: "Nadie aún. Crea un enlace de invitación y envíalo a un fotógrafo.",
    joinedCaption: "Se unió {ago} · {count} fotos",
    openInviteLinks: "Enlaces de invitación abiertos",
    noInvitesYet: "Ninguno. Un enlace puede invitar a tantos fotógrafos como quieras.",
    inviteLinkFallback: "Enlace de invitación",
    joinedCountMeta: "{count} unido(s) · {left}",
    share: "Compartir",
    cancelLinkTitle: "¿Cancelar este enlace?",
    cancelLinkMsg: "Nadie más podrá unirse con él. Los fotógrafos que ya se unieron permanecen.",
    cancelLinkBtn: "Cancelar enlace",
    cancel: "Cancelar",
    noDecisionsTitle: "Aún no hay decisiones",
    noDecisionsMsg: "Las fotos que apruebes o rechaces aparecerán aquí.",
    reject: "Rechazar",
    addCount: "Añadir {count}",
    close: "Cerrar",
    submittedAgo: "Enviada {ago}",
    addToAlbum: "Añadir al álbum",
    yourNote: "Tu nota: {note}",
    rejectSheetTitle: "¿Rechazar {count} foto(s)?",
    rejectSheetSub: "Quedarán fuera del álbum. Se notificará al fotógrafo con tu nota si añades una.",
    notePlaceholder: "Nota para el fotógrafo (opcional)",
  },
} as const;
import { buildKinyarwandaDict } from '@/i18n/kinyarwanda';
import { buildSwahiliDict } from '@/i18n/swahili';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

type Tab = 'review' | 'people' | 'history';
const GAP = 8;
const OA_RW = buildKinyarwandaDict(OA_I18N.en);
const OA_SW = buildSwahiliDict(OA_I18N.en);

function getOaTr(language: string) {
  if (language === 'rw') return OA_RW;
  if (language === 'sw') return OA_SW;
  return (OA_I18N as any)[language] ?? OA_I18N.en;
}

export default function OwnerAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { language } = useLanguage();
  const tr = getOaTr(language);
  const { width } = useWindowDimensions();
  const [data, setData] = useState<OwnedAlbumDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('review');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Submission | null>(null);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const d = await getOwnedAlbum(id);
      setData(d);
      navigation.setOptions({ title: d.album.title });
    } catch (e) {
      setError(isApiError(e) ? e.message : tr.errLoad);
    }
  }, [id, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pending = useMemo(() => (data?.submissions ?? []).filter((s) => s.status === 'PENDING')
    .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? '')), [data]);
  const decided = useMemo(() => (data?.submissions ?? []).filter((s) => s.status !== 'PENDING'), [data]);
  const submittedBy = useMemo(() => {
    const m = new Map<string, number>();
    (data?.submissions ?? []).forEach((s) => m.set(s.collaborator.id, (m.get(s.collaborator.id) ?? 0) + 1));
    return m;
  }, [data]);

  const columns = width >= 700 ? 4 : 3;
  const tile = Math.floor((Math.min(width, 900) - spacing.xl * 2 - GAP * (columns - 1)) / columns);
  const selecting = selected.size > 0;

  const toggle = (sid: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(sid)) next.delete(sid); else next.add(sid);
    return next;
  });

  const decide = async (ids: string[], decision: 'APPROVE' | 'REJECT', reason?: string) => {
    setBusy(true);
    try {
      const r = await reviewSubmissions(ids, decision, reason);
      setSelected(new Set());
      setPreview(null);
      setRejecting(null);
      if (r.duplicates.length > 0) {
        Alert.alert(tr.stayInReviewTitle, tr.stayInReviewMsg.replace('{count}', String(r.duplicates.length)));
      }
      await load();
    } catch (e) {
      Alert.alert(tr.errSaveDecision, isApiError(e) ? e.message : tr.pleaseTryAgain);
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const created = await createInvite(data.album.id);
      await load();
      await Share.share({
        message: tr.shareInviteMsg.replace('{title}', data.album.title).replace('{link}', created.link),
      });
    } catch (e) {
      if (isApiError(e)) Alert.alert(tr.errCreateInvite, e.message);
    } finally {
      setBusy(false);
    }
  };

  const shareLink = (link: string) => {
    Share.share({ message: tr.shareInviteMsg.replace('{title}', data?.album.title ?? '').replace('{link}', link) });
  };

  const confirmThen = (title: string, message: string, confirm: string, action: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: tr.keep, style: 'cancel' },
      {
        text: confirm,
        style: 'destructive',
        onPress: async () => {
          try { await action(); await load(); } catch (e) {
            Alert.alert(tr.errUpdateCollab, isApiError(e) ? e.message : tr.pleaseTryAgain);
          }
        },
      },
    ]);
  };

  const askRemove = (c: Collaborator) => confirmThen(tr.removeTitle.replace('{name}', c.name), tr.removeMsg, tr.remove, () => removeCollaborator(c.membershipId));

  if (!data) {
    return (
      <Screen padded={false}>
        {error ? (
          <EmptyState icon="alert-circle-outline" title={tr.errOpenTitle} message={error} action={{ label: tr.tryAgain, onPress: load }} />
        ) : (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        )}
      </Screen>
    );
  }

  const { album, collaborators, invites } = data;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={[styles.content, selecting && { paddingBottom: 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCover}><AlbumCover uri={album.coverImage} title={album.title} /></View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{tr.yourAlbum}</Text>
            <Text style={styles.title} numberOfLines={2}>{album.title}</Text>
            <Text style={styles.muted}>{tr.photosCollabMeta.replace('{photos}', String(album.imageCount)).replace('{collabs}', String(collaborators.length))}</Text>
          </View>
        </View>

        <Button title={tr.invitePhotographer} onPress={invite} loading={busy && !rejecting && !preview} />

        <Segmented<Tab>
          value={tab}
          onChange={(t) => { setTab(t); setSelected(new Set()); }}
          options={[
            { value: 'review', label: tr.tabReview.replace('{count}', String(pending.length)) },
            { value: 'people', label: tr.tabPeople.replace('{count}', String(collaborators.length)) },
            { value: 'history', label: tr.tabHistory },
          ]}
        />

        {tab === 'review' && (pending.length === 0 ? (
          <EmptyState icon="file-tray-outline" title={tr.nothingToReview}
            message={collaborators.length === 0 ? tr.nothingToReviewNoCollab : tr.nothingToReviewCaughtUp} />
        ) : (
          <>
            <View style={styles.reviewBar}>
              <Text style={styles.muted}>{selecting ? tr.selectedCount.replace('{count}', String(selected.size)) : tr.tapToReviewHint}</Text>
              <Pressable hitSlop={8} onPress={() => setSelected(selecting ? new Set() : new Set(pending.map((s) => s.id)))}
                accessibilityRole="button">
                <Text style={styles.link}>{selecting ? tr.clear : tr.selectAll}</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {pending.map((s) => (
                <ReviewTile key={s.id} s={s} size={tile} selecting={selecting} selected={selected.has(s.id)}
                  onPress={() => (selecting ? toggle(s.id) : setPreview(s))} onLongPress={() => toggle(s.id)} />
              ))}
            </View>
          </>
        ))}

        {tab === 'people' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{tr.collaboratorsTitle}</Text>
            {collaborators.length === 0 ? (
              <Text style={styles.muted}>{tr.noCollaboratorsYet}</Text>
            ) : collaborators.map((c) => (
              <View key={c.membershipId} style={styles.row}>
                <View style={styles.flex}>
                  <PersonRow person={c} caption={tr.joinedCaption.replace('{ago}', timeAgo(c.joinedAt)).replace('{count}', String(submittedBy.get(c.id) ?? 0))} />
                </View>
                <Pressable onPress={() => askRemove(c)} hitSlop={8} accessibilityRole="button"
                  accessibilityLabel={`Remove ${c.name}`}>
                  <Text style={styles.danger}>{tr.remove}</Text>
                </Pressable>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{tr.openInviteLinks}</Text>
            {invites.length === 0 ? (
              <Text style={styles.muted}>{tr.noInvitesYet}</Text>
            ) : invites.map((inv) => (
              <View key={inv.id} style={styles.row}>
                <Ionicons name="link-outline" size={20} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{inv.note || tr.inviteLinkFallback}</Text>
                  <Text style={styles.muted}>
                    {tr.joinedCountMeta.replace('{count}', String(inv.joinedCount)).replace('{left}', daysLeft(inv.expiresAt))}
                  </Text>
                </View>
                <Pressable onPress={() => shareLink(inv.link)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share invite link">
                  <Text style={styles.link}>{tr.share}</Text>
                </Pressable>
                <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel invite link"
                  onPress={() => confirmThen(tr.cancelLinkTitle, tr.cancelLinkMsg, tr.cancelLinkBtn, () => cancelInvite(inv.id))}>
                  <Text style={styles.danger}>{tr.cancel}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {tab === 'history' && (decided.length === 0 ? (
          <EmptyState icon="time-outline" title={tr.noDecisionsTitle} message={tr.noDecisionsMsg} />
        ) : (
          <View style={styles.grid}>
            {decided.map((s) => (
              <Pressable key={s.id} onPress={() => setPreview(s)} style={[styles.tile, { width: tile, height: tile }]}
                accessibilityRole="button" accessibilityLabel={`Photo from ${s.collaborator.name}, ${s.status.toLowerCase()}`}>
                {(s.thumbnailUrl || s.imageUrl) ? <Image source={{ uri: s.thumbnailUrl || s.imageUrl }} style={styles.tileImage} contentFit="cover" /> : null}
                <View style={styles.tileStatus}><StatusChip status={s.status} /></View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      {selecting && tab === 'review' && (
        <View style={styles.actionBar}>
          <Button title={tr.reject} variant="outline" style={styles.flex} disabled={busy}
            onPress={() => { setNote(''); setRejecting(Array.from(selected)); }} />
          <Button title={tr.addCount.replace('{count}', String(selected.size))} style={styles.flex} loading={busy}
            onPress={() => decide(Array.from(selected), 'APPROVE')} />
        </View>
      )}

      {/* Large preview with the decision */}
      <Modal visible={!!preview} animationType="fade" transparent onRequestClose={() => setPreview(null)}>
        <View style={styles.previewBackdrop}>
          <Pressable style={styles.previewClose} onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {(preview?.thumbnailUrl || preview?.imageUrl) ? <Image source={{ uri: preview.thumbnailUrl || preview.imageUrl }} style={styles.previewImage} contentFit="contain" /> : null}
          {preview && (
            <View style={styles.previewPanel}>
              <PersonRow person={preview.collaborator} caption={tr.submittedAgo.replace('{ago}', timeAgo(preview.submittedAt))} />
              {preview.status === 'PENDING' ? (
                <View style={styles.previewActions}>
                  <Button title={tr.reject} variant="outline" style={styles.flex}
                    onPress={() => { setNote(''); setRejecting([preview.id]); }} />
                  <Button title={tr.addToAlbum} style={styles.flex} loading={busy} onPress={() => decide([preview.id], 'APPROVE')} />
                </View>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  <StatusChip status={preview.status} />
                  {preview.reviewNote ? <Text style={styles.muted}>{tr.yourNote.replace('{note}', preview.reviewNote)}</Text> : null}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Reject note, stacked on the preview when opened from it */}
        {rejecting && preview ? (
          <RejectSheet count={rejecting?.length ?? 0} note={note} onNote={setNote} busy={busy}
          onCancel={() => setRejecting(null)} onConfirm={() => rejecting && decide(rejecting, 'REJECT', note)} />
        ) : null}
      </Modal>

      <Modal visible={!!rejecting && !preview} animationType="slide" transparent onRequestClose={() => setRejecting(null)}>
        <RejectSheet count={rejecting?.length ?? 0} note={note} onNote={setNote} busy={busy}
          onCancel={() => setRejecting(null)} onConfirm={() => rejecting && decide(rejecting, 'REJECT', note)} />
      </Modal>
    </Screen>
  );
}

function ReviewTile({ s, size, selecting, selected, onPress, onLongPress }: {
  s: Submission; size: number; selecting: boolean; selected: boolean; onPress: () => void; onLongPress: () => void;
}) {
  const styles = useStyles();
  const { language } = useLanguage();
  const tr = getOaTr(language);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tile, { width: size, height: size }, selected && styles.tileSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Photo from ${s.collaborator.name}${selected ? ', selected' : ''}`}
      accessibilityHint={selecting ? 'Tap to select or unselect' : 'Tap to review, long press to select several'}
    >
      {(s.thumbnailUrl || s.imageUrl) ? <Image source={{ uri: s.thumbnailUrl || s.imageUrl }} style={styles.tileImage} contentFit="cover" transition={120} /> : null}
      {selecting && (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      )}
    </Pressable>
  );
}

function RejectSheet({ count, note, onNote, busy, onCancel, onConfirm }: {
  count: number; note: string; onNote: (v: string) => void; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { language } = useLanguage();
  const tr = getOaTr(language);
  return (
    <View style={styles.sheetBackdrop}>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{tr.rejectSheetTitle.replace('{count}', String(count))}</Text>
        <Text style={styles.muted}>{tr.rejectSheetSub}</Text>
        <TextInput
          value={note}
          onChangeText={onNote}
          placeholder={tr.notePlaceholder}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          style={styles.noteInput}
          accessibilityLabel="Note for the photographer"
        />
        <View style={styles.previewActions}>
          <Button title={tr.cancel} variant="ghost" style={styles.flex} onPress={onCancel} />
          <Button title={tr.reject} variant="danger" style={styles.flex} loading={busy} onPress={onConfirm} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  flex: { flex: 1 },
  header: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  headerCover: { width: 84, height: 64, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  eyebrow: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  title: { color: c.text, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, fontFamily: fonts.bold },
  muted: { color: c.textMuted, fontSize: fontSize.sm },
  link: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  danger: { color: c.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  reviewBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  tileSelected: { borderWidth: 3, borderColor: c.primary },
  tileImage: { width: '100%', height: '100%' },
  tileStatus: { position: 'absolute', left: 6, bottom: 6 },
  check: {
    position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: c.primary, borderColor: c.primary },
  section: { gap: spacing.md },
  sectionTitle: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.card,
    borderRadius: radii.md, borderWidth: 1, borderColor: c.borderSoft, padding: spacing.md, minHeight: 56,
  },
  rowTitle: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  actionBar: {
    ...e(3), position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.md,
    padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: c.elevated, borderTopWidth: 1, borderTopColor: c.borderSoft,
  },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  previewClose: { position: 'absolute', top: 48, right: 20, zIndex: 2, padding: 8 },
  previewImage: { width: '100%', height: '62%' },
  previewPanel: { backgroundColor: c.elevated, margin: spacing.lg, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  previewActions: { flexDirection: 'row', gap: spacing.md },
  sheetBackdrop: { ...StyleFill, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.elevated, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, gap: spacing.md },
  sheetTitle: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  noteInput: {
    minHeight: 88, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, padding: spacing.md,
    color: c.text, fontSize: fontSize.sm, textAlignVertical: 'top', backgroundColor: c.surface,
  },
}));

// Absolute fill without importing StyleSheet just for this.
const StyleFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
