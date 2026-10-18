/**
 * A collaborator's workspace for an album someone else owns, mirrors the
 * dashboard's /user/photographer/collaborate/joined/[id]. Add photos from
 * the library; each one waits for the owner's decision. Follow what was
 * added or not accepted, with the owner's note.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { getJoinedAlbum, leaveAlbum, submitPhoto, withdrawSubmission } from '@/features/collab/api';
import { AlbumCover, PersonRow, StatusChip } from '@/features/collab/components';
import { timeAgo, type JoinedAlbumDetail, type SubmissionStatus } from '@/features/collab/model';
import { pickOriginalPhotos, type PickedImage } from '@/services/imagePicker';
import { useLanguage } from '@/hooks/useLanguage';
import { isApiError } from '@/store/auth';

const JA_I18N = {
  en: {
    filterAll: "All",
    filterWaiting: "Waiting",
    filterAdded: "Added",
    filterNotAccepted: "Not accepted",
    errLoad: "Could not load this album.",
    leftOutTitle: "{count} photo(s) left out",
    uploadFailed: "Upload failed",
    notSubmittedTitle: "{count} photo(s) not submitted",
    withdrawTitle: "Withdraw this photo?",
    withdrawMsg: "It will be removed before the owner reviews it.",
    keep: "Keep",
    withdraw: "Withdraw",
    errWithdraw: "Could not withdraw",
    tryAgain: "Please try again.",
    leaveTitle: "Leave this album?",
    leaveMsg: "You will no longer be able to submit photos to \"{title}\". Photos already added stay in the album. To come back, {owner} has to send you a new link.",
    stay: "Stay",
    leave: "Leave",
    errLeave: "Could not leave",
    cannotOpenTitle: "You cannot open this album",
    backToCollab: "Back to Collaborate",
    eyebrow: "COLLABORATING",
    ownerCaption: "Owns this album and reviews what you submit",
    submitTitle: "Submit your photos",
    submitSub: "Full quality. JPEG, PNG or WebP, up to 20 MB each, at least Full HD. Photos are only sent to {owner} when you tap Submit, and you can withdraw one until it is reviewed.",
    addMorePhotos: "Add more photos",
    addPhotos: "Add photos",
    readyCount: "{count} photo(s) ready to submit",
    submittingProgress: "Submitting {current} of {total}…",
    submitToOwner: "Submit {count} photo(s) to {owner}",
    submittedCount: "{done} submitted",
    failedCount: " · {failed} failed",
    rejectedCount: "{count} photo(s) rejected",
    dismiss: "Dismiss",
    emptyAllTitle: "Nothing submitted yet",
    emptyOtherTitle: "Nothing here",
    emptyAllMsg: "Photos you submit show up here with their review status.",
    emptyOtherMsg: "No photos with this status.",
    leaveAlbumBtn: "Leave album",
  },
  fr: {
    filterAll: "Toutes",
    filterWaiting: "En attente",
    filterAdded: "Ajoutées",
    filterNotAccepted: "Refusées",
    errLoad: "Impossible de charger cet album.",
    leftOutTitle: "{count} photo(s) ignorée(s)",
    uploadFailed: "Échec de l’envoi",
    notSubmittedTitle: "{count} photo(s) non soumise(s)",
    withdrawTitle: "Retirer cette photo ?",
    withdrawMsg: "Elle sera retirée avant que le propriétaire ne l’examine.",
    keep: "Garder",
    withdraw: "Retirer",
    errWithdraw: "Impossible de retirer",
    tryAgain: "Veuillez réessayer.",
    leaveTitle: "Quitter cet album ?",
    leaveMsg: "Vous ne pourrez plus soumettre de photos à \"{title}\". Les photos déjà ajoutées restent dans l’album. Pour revenir, {owner} devra vous envoyer un nouveau lien.",
    stay: "Rester",
    leave: "Quitter",
    errLeave: "Impossible de quitter",
    cannotOpenTitle: "Vous ne pouvez pas ouvrir cet album",
    backToCollab: "Retour à Collaborer",
    eyebrow: "COLLABORATION",
    ownerCaption: "Possède cet album et examine ce que vous soumettez",
    submitTitle: "Soumettre vos photos",
    submitSub: "Qualité maximale. JPEG, PNG ou WebP, jusqu’à 20 Mo chacune, au moins Full HD. Les photos ne sont envoyées à {owner} que lorsque vous appuyez sur Soumettre.",
    addMorePhotos: "Ajouter plus de photos",
    addPhotos: "Ajouter des photos",
    readyCount: "{count} photo(s) prête(s) à soumettre",
    submittingProgress: "Envoi {current} sur {total}…",
    submitToOwner: "Soumettre {count} photo(s) à {owner}",
    submittedCount: "{done} soumise(s)",
    failedCount: " · {failed} échouée(s)",
    rejectedCount: "{count} photo(s) refusée(s)",
    dismiss: "Fermer",
    emptyAllTitle: "Rien de soumis pour l’instant",
    emptyOtherTitle: "Rien ici",
    emptyAllMsg: "Les photos que vous soumettez apparaissent ici avec leur statut.",
    emptyOtherMsg: "Aucune photo avec ce statut.",
    leaveAlbumBtn: "Quitter l’album",
  },
  es: {
    filterAll: "Todas",
    filterWaiting: "En espera",
    filterAdded: "Añadidas",
    filterNotAccepted: "No aceptadas",
    errLoad: "No se pudo cargar este álbum.",
    leftOutTitle: "{count} foto(s) omitida(s)",
    uploadFailed: "Error al subir",
    notSubmittedTitle: "{count} foto(s) no enviada(s)",
    withdrawTitle: "¿Retirar esta foto?",
    withdrawMsg: "Se eliminará antes de que el propietario la revise.",
    keep: "Conservar",
    withdraw: "Retirar",
    errWithdraw: "No se pudo retirar",
    tryAgain: "Por favor inténtalo de nuevo.",
    leaveTitle: "¿Salir de este álbum?",
    leaveMsg: "Ya no podrás enviar fotos a \"{title}\". Las fotos ya añadidas permanecen en el álbum. Para volver, {owner} tendrá que enviarte un nuevo enlace.",
    stay: "Quedarse",
    leave: "Salir",
    errLeave: "No se pudo salir",
    cannotOpenTitle: "No puedes abrir este álbum",
    backToCollab: "Volver a Colaborar",
    eyebrow: "COLABORANDO",
    ownerCaption: "Es propietario de este álbum y revisa lo que envías",
    submitTitle: "Envía tus fotos",
    submitSub: "Calidad completa. JPEG, PNG o WebP, hasta 20 MB cada una, al menos Full HD. Las fotos solo se envían a {owner} cuando tocas Enviar.",
    addMorePhotos: "Añadir más fotos",
    addPhotos: "Añadir fotos",
    readyCount: "{count} foto(s) lista(s) para enviar",
    submittingProgress: "Enviando {current} de {total}…",
    submitToOwner: "Enviar {count} foto(s) a {owner}",
    submittedCount: "{done} enviada(s)",
    failedCount: " · {failed} fallida(s)",
    rejectedCount: "{count} foto(s) rechazada(s)",
    dismiss: "Descartar",
    emptyAllTitle: "Aún no se ha enviado nada",
    emptyOtherTitle: "Nada aquí",
    emptyAllMsg: "Las fotos que envíes aparecerán aquí con su estado de revisión.",
    emptyOtherMsg: "No hay fotos con este estado.",
    leaveAlbumBtn: "Salir del álbum",
  },
} as const;
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

type Filter = 'ALL' | SubmissionStatus;
const GAP = 8;

function cleanErrorMessage(name: string, raw: string): string {
  if (raw.toLowerCase().includes('low-quality') || raw.toLowerCase().includes('is only')) {
    const dimMatch = raw.match(/is only (\d+x\d+)/i) || raw.match(/\((\d+x\d+)\)/);
    const dim = dimMatch ? dimMatch[1].replace('x', ' × ') : null;
    let guide = 'Photos must be at least Full HD (1920 × 1080).';
    const guideMatch = raw.match(/((?:Photos|Every photo) must be at least .+$)/i);
    if (guideMatch) {
      guide = guideMatch[1].trim();
    }
    return `${dim ? `Resolution: ${dim} px. ` : ''}${guide}`;
  }
  let clean = raw;
  if (clean.startsWith(`${name}:`)) {
    clean = clean.slice(name.length + 1).trim();
  }
  return clean;
}

export default function JoinedAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { language } = useLanguage();
  const tr = JA_I18N[language] ?? JA_I18N.en;
  const FILTERS: [Filter, string][] = [['ALL', tr.filterAll], ['PENDING', tr.filterWaiting], ['APPROVED', tr.filterAdded], ['REJECTED', tr.filterNotAccepted]];
  const { width } = useWindowDimensions();
  const [data, setData] = useState<JoinedAlbumDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [failures, setFailures] = useState<Array<{ id: string; name: string; error: string }>>([]);
  const [staged, setStaged] = useState<PickedImage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const d = await getJoinedAlbum(id);
      setData(d);
      navigation.setOptions({ title: d.album.title });
    } catch (e) {
      setError(isApiError(e) ? e.message : tr.errLoad);
    }
  }, [id, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subs = useMemo(() => data?.submissions ?? [], [data]);
  const counts = useMemo(() => ({
    ALL: subs.length,
    PENDING: subs.filter((s) => s.status === 'PENDING').length,
    APPROVED: subs.filter((s) => s.status === 'APPROVED').length,
    REJECTED: subs.filter((s) => s.status === 'REJECTED').length,
  }), [subs]);
  const shown = filter === 'ALL' ? subs : subs.filter((s) => s.status === filter);
  const uploading = !!progress && progress.done + progress.failed < progress.total;

  const columns = width >= 700 ? 4 : 2;
  const tile = Math.floor((Math.min(width, 900) - spacing.xl * 2 - GAP * (columns - 1)) / columns);

  const addPhotos = async () => {
    if (!id || uploading) return;
    // Originals, not the compressed copies other screens upload: this is
    // delivery work another photographer puts in their album.
    const { photos: picked, skipped } = await pickOriginalPhotos(50);
    if (skipped.length > 0) {
      Alert.alert(tr.leftOutTitle.replace('{count}', String(skipped.length)),
        skipped.slice(0, 5).map((s) => `${s.name}: ${s.reason}`).join('\n'));
    }
    if (picked.length === 0) return;
    // Stage only. Nothing reaches the owner until the collaborator taps Submit.
    setProgress(null);
    setFailures([]);
    setStaged((cur) => {
      const have = new Set(cur.map((p) => p.uri));
      return [...cur, ...picked.filter((p) => !have.has(p.uri))];
    });
  };

  const removeStaged = (uri: string) => setStaged((cur) => cur.filter((p) => p.uri !== uri));

  const submitStaged = async () => {
    if (!id || uploading || staged.length === 0) return;
    const batch = staged;
    setFailures([]);
    let done = 0;
    let failed = 0;
    const failedItems: Array<{ id: string; name: string; error: string }> = [];
    setProgress({ done, failed, total: batch.length });
    // One at a time: phones on mobile data do better with a steady single
    // upload than several competing ones.
    for (const img of batch) {
      try {
        await submitPhoto(id, img);
        done += 1;
      } catch (e) {
        failed += 1;
        const msg = isApiError(e) ? e.message : tr.uploadFailed;
        failedItems.push({ id: `${Date.now()}-${failed}`, name: img.name ?? `Photo ${done + failed}`, error: msg });
      }
      setProgress({ done, failed, total: batch.length });
    }
    // Sent photos leave the staging list. Rejected ones stay out too, since the
    // same file would be rejected again; the collaborator picks a better one.
    setStaged([]);
    await load();
    if (failedItems.length > 0) {
      setFailures(failedItems);
      const firstClean = cleanErrorMessage(failedItems[0].name, failedItems[0].error);
      Alert.alert(tr.notSubmittedTitle.replace('{count}', String(failedItems.length)), firstClean);
    }
  };

  const withdraw = (sid: string) => {
    Alert.alert(tr.withdrawTitle, tr.withdrawMsg, [
      { text: tr.keep, style: 'cancel' },
      {
        text: tr.withdraw, style: 'destructive', onPress: async () => {
          try { await withdrawSubmission(sid); await load(); } catch (e) {
            Alert.alert(tr.errWithdraw, isApiError(e) ? e.message : tr.tryAgain);
          }
        },
      },
    ]);
  };

  const leave = () => {
    if (!data || !id) return;
    Alert.alert(tr.leaveTitle,
      tr.leaveMsg.replace('{title}', data.album.title).replace('{owner}', data.owner.name),
      [
        { text: tr.stay, style: 'cancel' },
        {
          text: tr.leave, style: 'destructive', onPress: async () => {
            try { await leaveAlbum(id); router.replace('/collaborate' as Href); } catch (e) {
              Alert.alert(tr.errLeave, isApiError(e) ? e.message : tr.tryAgain);
            }
          },
        },
      ]);
  };

  if (!data) {
    return (
      <Screen padded={false}>
        {error ? (
          <EmptyState icon="lock-closed-outline" title={tr.cannotOpenTitle} message={error}
            action={{ label: tr.backToCollab, onPress: () => router.replace('/collaborate' as Href) }} />
        ) : (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        )}
      </Screen>
    );
  }

  const { album, owner } = data;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCover}><AlbumCover uri={album.coverImage} title={album.title} /></View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{tr.eyebrow}</Text>
            <Text style={styles.title} numberOfLines={2}>{album.title}</Text>
          </View>
        </View>
        <PersonRow person={owner} caption={tr.ownerCaption} />

        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>{tr.submitTitle}</Text>
          <Text style={styles.muted}>
            {tr.submitSub.replace('{owner}', owner.name)}
          </Text>
          <Button title={staged.length > 0 ? tr.addMorePhotos : tr.addPhotos}
            variant={staged.length > 0 ? 'outline' : undefined} onPress={addPhotos} />
          {staged.length > 0 && (
            <View style={styles.stagedBox}>
              <Text style={styles.stagedTitle}>
                {tr.readyCount.replace('{count}', String(staged.length))}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stagedRow}>
                {staged.map((p) => (
                  <View key={p.uri} style={styles.stagedThumb}>
                    <Image source={{ uri: p.uri }} style={styles.fill} contentFit="cover" />
                    {!uploading && (
                      <Pressable onPress={() => removeStaged(p.uri)} hitSlop={6} style={styles.stagedRemove}
                        accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`}>
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
              <Button
                title={uploading
                  ? tr.submittingProgress.replace('{current}', String(Math.min(progress!.done + progress!.failed + 1, progress!.total))).replace('{total}', String(progress!.total))
                  : tr.submitToOwner.replace('{count}', String(staged.length)).replace('{owner}', owner.name)}
                onPress={submitStaged} loading={uploading} />
            </View>
          )}
          {progress && (
            <View style={styles.progressTrack} accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: progress.total, now: progress.done + progress.failed }}>
              <View style={[styles.progressFill, { width: `${Math.round(((progress.done + progress.failed) / progress.total) * 100)}%` }]} />
            </View>
          )}
          {progress && !uploading && (
            <Text style={styles.muted}>
              {tr.submittedCount.replace('{done}', String(progress.done))}{progress.failed > 0 ? tr.failedCount.replace('{failed}', String(progress.failed)) : ''}
            </Text>
          )}
          {failures.length > 0 && !uploading && (
            <View style={styles.errorBox}>
              <View style={styles.errorHeader}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorTitle}>
                  {tr.rejectedCount.replace('{count}', String(failures.length))}
                </Text>
                <Pressable onPress={() => setFailures([])} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Text style={styles.errorDismiss}>{tr.dismiss}</Text>
                </Pressable>
              </View>
              {failures.map((err) => (
                <View key={err.id} style={styles.errorRow}>
                  <Text style={styles.errorFileName} numberOfLines={1}>{err.name}</Text>
                  <Text style={styles.errorDetail}>{cleanErrorMessage(err.name, err.error)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([key, label]) => (
            <Pressable key={key} onPress={() => setFilter(key)} accessibilityRole="tab" accessibilityState={{ selected: filter === key }}
              style={[styles.filter, filter === key && styles.filterOn]}>
              <Text style={[styles.filterText, filter === key && styles.filterTextOn]}>{label} {counts[key]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {shown.length === 0 ? (
          <EmptyState icon="images-outline"
            title={filter === 'ALL' ? tr.emptyAllTitle : tr.emptyOtherTitle}
            message={filter === 'ALL' ? tr.emptyAllMsg : tr.emptyOtherMsg} />
        ) : (
          <View style={styles.grid}>
            {shown.map((s) => (
              <View key={s.id} style={[styles.card, { width: tile }]}>
                <View style={{ width: tile, height: tile, backgroundColor: colors.surfaceMuted }}>
                  {(s.thumbnailUrl || s.imageUrl) ? (
                    <Image source={{ uri: s.thumbnailUrl || s.imageUrl }} style={styles.fill} contentFit="cover" transition={120} />
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  <StatusChip status={s.status} />
                  {s.reviewNote ? <Text style={styles.note} numberOfLines={3}>“{s.reviewNote}”</Text> : null}
                  <View style={styles.cardFoot}>
                    <Text style={styles.small}>{timeAgo(s.submittedAt)}</Text>
                    {s.status === 'PENDING' && (
                      <Pressable onPress={() => withdraw(s.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Withdraw photo">
                        <Text style={styles.withdraw}>{tr.withdraw}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Button title={tr.leaveAlbumBtn} variant="ghost" onPress={leave} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  header: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  headerCover: { width: 84, height: 64, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  eyebrow: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  title: { color: c.text, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, fontFamily: fonts.bold },
  muted: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  uploadCard: {
    ...e(1), backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft,
    padding: spacing.lg, gap: spacing.md,
  },
  uploadTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  stagedBox: { gap: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: spacing.md },
  stagedTitle: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  stagedRow: { gap: spacing.sm },
  stagedThumb: { width: 72, height: 72, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  stagedRemove: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { height: 6, borderRadius: radii.full, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.full, backgroundColor: c.primary },
  filters: { gap: spacing.sm },
  filter: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: c.surfaceMuted, minHeight: 36, justifyContent: 'center' },
  filterOn: { backgroundColor: c.primary },
  filterText: { color: c.textSoft, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  filterTextOn: { color: c.textOnPrimary, fontWeight: fontWeight.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { backgroundColor: c.card, borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: c.borderSoft },
  cardBody: { padding: spacing.sm, gap: spacing.xs },
  note: { color: c.textSoft, fontSize: fontSize.xs, fontStyle: 'italic' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { color: c.textMuted, fontSize: fontSize.xs },
  withdraw: { color: c.error, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorTitle: {
    color: c.error,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorDismiss: {
    color: c.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textDecorationLine: 'underline',
  },
  errorRow: {
    backgroundColor: c.card,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  errorFileName: {
    color: c.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  errorDetail: {
    color: c.text,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
}));
