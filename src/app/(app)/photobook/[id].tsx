/**
 * Photobook detail: a cover mosaic, the title and facts, ONE status card with the action that matters now, a timeline,
 * and the photos.
 *
 * Client side: Send to photographer, Pay for extras (event books over the free limit), Accept or Request changes.
 * Photographer side (a book received from a client): add photos, reorder, Save edits, Send back for review, Close.
 * Photos the viewer does not own or hasn't bought arrive from the server as watermarked thumbnails (or without a url),
 * so nothing here can show or save an original it should not; this screen only draws what it is given.
 */
import { useCallback, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Alert } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { AccentButton, GhostButton, PrimaryButton } from '@/components/ui/Button';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import {
  acceptPhotobook,
  dismissReceivedPhotobook,
  getPhotobook,
  requestPhotobookChanges,
  resubmitPhotobook,
  savePhotographerEdits,
  sendPhotobookToClient,
  type PhotobookDetail,
} from '@/features/photobooks/api';
import { pbCopy, photoCountLabel, type CopyKey } from '@/features/photobooks/copy';
import { Mosaic } from '@/features/photobooks/PhotobookRow';
import { SOURCE_TONE, nextAction, sourcesOf, statusInfo, timelineOf, type Shelf } from '@/features/photobooks/model';
import { albumDateText } from '@/features/gallery/albumFacts';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { formatPrice } from '@/utils/format';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';

export default function PhotobookDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { language } = useLanguage();
  const t = useCallback((k: CopyKey, p?: Record<string, string | number>) => pbCopy(language, k, p), [language]);
  const { id, received: receivedParam } = useLocalSearchParams<{ id: string; received?: string }>();
  const received = receivedParam === '1';
  const shelf: Shelf = received ? 'received' : 'mine';

  const { data, loading, error, refresh } = useAsync(useCallback(() => getPhotobook(id, received), [id, received]));
  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [note, setNote] = useState('');
  const [payDeclarationId, setPayDeclarationId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  // The photographer's working order, and the photo picked up to move.
  const [order, setOrder] = useState<string[] | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const photos = useMemo(() => {
    const base = data?.photos ?? [];
    if (!order) return base;
    const byId = new Map(base.map((p) => [p.id, p]));
    const ordered = order.map((x) => byId.get(x)).filter((p): p is NonNullable<typeof p> => !!p);
    return [...ordered, ...base.filter((p) => !order.includes(p.id))];
  }, [data?.photos, order]);

  const canEdit = received && (data?.status === 'SENT_TO_PHOTOGRAPHER' || data?.status === 'PHOTOGRAPHER_EDITING');
  const dirty = !!order && !!data && order.join() !== data.photos.map((p) => p.id).join();

  const run = async (op: () => Promise<void>, fallback = 'load_failed' as CopyKey) => {
    setBusy(true);
    setErr(null);
    try {
      await op();
      setOrder(null);
      await refresh();
    } catch (e) {
      setErr(isApiError(e) ? (e.status === 403 ? t('refused') : e.message) : t(fallback));
    } finally {
      setBusy(false);
    }
  };

  const confirm = (title: string, body: string | undefined, cta: string, onYes: () => void, destructive = false) =>
    Alert.alert(title, body, [
      { text: t('cancel'), style: 'cancel' },
      { text: cta, style: destructive ? 'destructive' : 'default', onPress: onYes },
    ]);

  const move = (toId: string) => {
    if (!moving || moving === toId) {
      setMoving(null);
      return;
    }
    const ids = photos.map((p) => p.id);
    const from = ids.indexOf(moving);
    const to = ids.indexOf(toId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrder(ids);
    setMoving(null);
  };

  if (loading && !data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (error && !data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Top onBack={() => router.back()} />
        <ErrorState title={t('load_failed')} message={t('error_body')} onRetry={refresh} />
      </Screen>
    );
  }
  if (!data) return null;

  const b: PhotobookDetail = data;
  const info = statusInfo(b, shelf);
  const statusLabel = info.raw ? info.raw : t(info.key as CopyKey);
  const action = nextAction(b, shelf, photos.length > 0);
  const timeline = timelineOf(b);
  const sources = sourcesOf(b);
  const isEvent = !!b.eventId;
  const extrasN = b.extraPhotosCount ?? 0;
  const previews = photos.map((p) => p.url).filter((u): u is string => !!u).slice(0, 3);
  const who = b.toName ?? b.senderName ?? '';
  const layoutName = b.layout === 'gallery-wall' ? t('layout_wall') : t('layout_grid');
  const cell = Math.floor((width - spacing.lg * 2 - 6) / 3);

  // The wait line, when there is nothing for this person to do.
  const waiting =
    action !== 'wait'
      ? undefined
      : received
        ? b.status === 'PENDING_PAYMENT'
          ? t('w_pay_photog')
          : t('w_review_photog')
        : b.status === 'PHOTOGRAPHER_EDITING'
          ? t('w_editing', { name: who || '…' })
          : t('w_with', { name: who || '…' });

  return (
    <Screen padded={false} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Top onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Mosaic previews={previews.length ? previews : b.previews} size="hero" />
        <Text style={styles.title}>{b.name}</Text>
        <Text style={styles.meta}>
          {[photoCountLabel(language, photos.length), t('layout_row', { layout: layoutName })].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.chips}>
          {sources.map((s) => (
            <StatusChip key={s} label={t(`src_${s}` as CopyKey)} tone={SOURCE_TONE[s]} compact />
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <StatusChip label={statusLabel} tone={info.tone} />
            {who ? <Text style={styles.meta}>{received ? t('from_who', { name: who }) : t('to_who', { name: who })}</Text> : null}
          </View>

          {b.status === 'COMPLETED' ? <Text style={styles.body}>{b.closedByPhotographer ? t('w_closed') : t('w_done')}</Text> : null}
          {waiting ? <Text style={styles.body}>{waiting}</Text> : null}
          {b.changeRequestNote && (b.status === 'SENT_TO_PHOTOGRAPHER' || b.status === 'PHOTOGRAPHER_EDITING') ? (
            <Text style={styles.note}>{t('changes_note', { note: b.changeRequestNote })}</Text>
          ) : null}

          {action === 'send' ? (
            <>
              <Text style={styles.body}>{t('act_send_body')}</Text>
              <PrimaryButton
                title={t('act_send')}
                loading={busy}
                onPress={() => confirm(t('confirm_send_title'), t('confirm_send_body'), t('act_send'), () => void run(() => sendPhotobookToClient(id)))}
              />
            </>
          ) : null}

          {action === 'pay' ? (
            <>
              <Text style={styles.body}>{t('act_pay_body')}</Text>
              {digitalPurchasesEnabled ? (
                <AccentButton
                  title={t('act_pay', { price: formatPrice(b.extraPhotosAmount), n: extrasN })}
                  onPress={() => (b.paymentDeclarationId ? setPayDeclarationId(b.paymentDeclarationId) : router.push('/payments' as Href))}
                />
              ) : (
                <Text style={styles.note}>{t('pay_on_web')}</Text>
              )}
            </>
          ) : null}

          {action === 'review' ? (
            <>
              <Text style={styles.body}>
                {t('review_body')} {isEvent ? t('accept_event') : t('accept_plain')}
              </Text>
              {changesOpen ? (
                <View style={styles.changes}>
                  <Text style={styles.label}>{t('changes_title')}</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('changes_placeholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={1000}
                    style={styles.noteInput}
                    accessibilityLabel={t('changes_title')}
                  />
                  <View style={styles.btnRow}>
                    <GhostButton title={t('cancel')} onPress={() => setChangesOpen(false)} />
                    <View style={styles.flex}>
                      <PrimaryButton
                        title={t('changes_send')}
                        disabled={!note.trim()}
                        loading={busy}
                        onPress={() => void run(async () => { await requestPhotobookChanges(id, note); setChangesOpen(false); setNote(''); })}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <View style={styles.flex}>
                    <PrimaryButton
                      title={t('act_accept')}
                      loading={busy}
                      onPress={() => confirm(t('act_accept'), isEvent ? t('accept_event') : t('accept_plain'), t('act_accept'), () => void run(() => acceptPhotobook(id)))}
                    />
                  </View>
                  <GhostButton title={t('act_changes')} onPress={() => setChangesOpen(true)} />
                </View>
              )}
            </>
          ) : null}

          {action === 'edit' || action === 'resubmit' ? (
            <>
              <Text style={styles.body}>{t('edit_intro')}</Text>
              <View style={styles.btnRow}>
                <View style={styles.flex}>
                  <PrimaryButton
                    title={t('act_resubmit')}
                    loading={busy}
                    disabled={photos.length === 0}
                    onPress={() =>
                      confirm(t('confirm_resubmit_title'), t('confirm_resubmit_body'), t('act_resubmit'), () =>
                        void run(async () => {
                          if (dirty) await savePhotographerEdits(id, { mediaIds: photos.map((p) => p.id) });
                          await resubmitPhotobook(id);
                        }),
                      )
                    }
                  />
                </View>
                {dirty ? (
                  <GhostButton title={t('act_save')} loading={busy} onPress={() => void run(() => savePhotographerEdits(id, { mediaIds: photos.map((p) => p.id) }))} />
                ) : null}
              </View>
              <Pressable
                onPress={() => confirm(t('confirm_close_title'), t('act_close_body'), t('act_close'), () => void run(async () => { await dismissReceivedPhotobook(id); router.back(); }), true)}
                accessibilityRole="button"
                style={styles.closeBtn}
              >
                <Text style={styles.closeText}>{t('act_close')}</Text>
              </Pressable>
            </>
          ) : null}
          {err ? (
            <Text style={styles.error} accessibilityRole="alert">
              {err}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          {timeline.map((s, i) => (
            <View key={s.key} style={styles.tlRow}>
              <View style={styles.tlRail}>
                <View style={[styles.dot, s.state === 'done' && styles.dotDone, s.state === 'current' && styles.dotNow]}>
                  {s.state === 'done' ? <Ionicons name="checkmark" size={12} color={colors.textOnPrimary} /> : null}
                </View>
                {i < timeline.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <Text style={[styles.tlText, s.state === 'current' && styles.tlNow, s.state === 'todo' && styles.tlTodo]}>{t(s.key)}</Text>
              <Text style={styles.meta}>{s.date ? albumDateText(s.date) ?? '' : s.state === 'current' ? '' : ''}</Text>
            </View>
          ))}
        </View>

        <View style={styles.photosHead}>
          <Text style={styles.sectionTitle}>
            {t('photos')} · {photos.length}
          </Text>
          {canEdit ? <Text style={styles.meta}>{moving ? t('move_hint') : t('hold_reorder')}</Text> : null}
        </View>
        {canEdit ? (
          <GhostButton title={t('add_photos')} onPress={() => router.push(`/photobook/new?addTo=${id}` as Href)} />
        ) : null}
        {photos.length === 0 ? (
          <EmptyState
            icon="image-outline"
            title={t('no_photos_left')}
            message={canEdit ? t('edit_intro') : t('no_photos')}
            action={canEdit ? { label: t('add_photos'), onPress: () => router.push(`/photobook/new?addTo=${id}` as Href) } : undefined}
          />
        ) : (
          <View style={styles.grid}>
            {photos.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => (moving ? move(p.id) : setViewer(i))}
                onLongPress={canEdit ? () => setMoving(p.id) : undefined}
                delayLongPress={250}
                accessibilityRole="imagebutton"
                accessibilityLabel={p.caption ?? `${t('photos')} ${i + 1}`}
                style={[{ width: cell, height: cell }, moving === p.id && styles.picked]}
              >
                {p.url ? <Image source={{ uri: p.url }} style={styles.thumb} contentFit="cover" recyclingKey={p.id} accessibilityIgnoresInvertColors /> : <View style={[styles.thumb, styles.noImg]}><Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} /></View>}
                {!p.original ? (
                  <View style={styles.wm} pointerEvents="none">
                    <Text style={styles.wmText}>{t('watermarked')}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
        {moving ? <GhostButton title={t('move_cancel')} onPress={() => setMoving(null)} /> : null}
      </ScrollView>

      {viewer !== null && photos[viewer] ? (
        <Pressable style={styles.lightbox} onPress={() => setViewer(null)} accessibilityRole="button" accessibilityLabel={t('done')}>
          {photos[viewer].url ? <Image source={{ uri: photos[viewer].url }} style={styles.full} contentFit="contain" accessibilityIgnoresInvertColors /> : <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />}
          {!photos[viewer].original ? <Text style={styles.lightboxNote}>{t('watermarked')}</Text> : null}
          <View style={styles.lbNav}>
            <Pressable hitSlop={14} onPress={() => setViewer(Math.max(0, viewer - 1))} accessibilityRole="button" accessibilityLabel={t('back')}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
            <Text style={styles.meta}>
              {viewer + 1} / {photos.length}
            </Text>
            <Pressable hitSlop={14} onPress={() => setViewer(Math.min(photos.length - 1, viewer + 1))} accessibilityRole="button" accessibilityLabel={t('next')}>
              <Ionicons name="chevron-forward" size={28} color={colors.text} />
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      <HandoffCheckoutSheet
        visible={!!payDeclarationId}
        onClose={() => setPayDeclarationId(null)}
        onSettled={() => void refresh()}
        handoff={payDeclarationId ? { type: 'BOOKING_DECLARATION', declarationId: payDeclarationId } : null}
        title={b.name}
        subtitle={t('act_pay_body')}
      />
    </Screen>
  );
}

function Top({ onBack }: { onBack: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { language } = useLanguage();
  return (
    <View style={styles.top}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={pbCopy(language, 'back')} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.heading}>{pbCopy(language, 'title')}</Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { color: c.text, fontFamily: fonts.bold, fontSize: 18 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 96 },
  title: { color: c.text, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4 },
  meta: { color: c.textMuted, fontFamily: fonts.regular, fontSize: 12.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  body: { color: c.textSoft, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  note: { color: c.pending, fontFamily: fonts.medium, fontSize: 13.5 },
  label: { color: c.textSoft, fontFamily: fonts.bold, fontSize: 12.5 },
  changes: { gap: spacing.sm },
  noteInput: { minHeight: 84, textAlignVertical: 'top', padding: spacing.md, borderRadius: radii.lg, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, fontFamily: fonts.regular, fontSize: 14.5 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  closeBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: c.textSoft, fontFamily: fonts.semibold, fontSize: 14 },
  error: { color: c.error, fontFamily: fonts.medium, fontSize: 13.5 },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 34 },
  tlRail: { width: 18, alignItems: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: c.success, borderColor: c.success },
  dotNow: { backgroundColor: c.accent, borderColor: c.accent },
  line: { width: 2, flex: 1, minHeight: 14, backgroundColor: c.border },
  tlText: { flex: 1, color: c.text, fontFamily: fonts.medium, fontSize: 14 },
  tlNow: { fontFamily: fonts.bold },
  tlTodo: { color: c.textMuted },
  photosHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: c.text, fontFamily: fonts.bold, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  thumb: { width: '100%', height: '100%', borderRadius: 6 },
  noImg: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceMuted },
  picked: { borderWidth: 3, borderColor: c.accent, borderRadius: 8 },
  wm: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full, backgroundColor: c.surface },
  wmText: { color: c.textSoft, fontFamily: fonts.medium, fontSize: 10 },
  lightbox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  full: { width: '100%', height: '75%' },
  lightboxNote: { color: c.textSoft, fontFamily: fonts.medium, fontSize: 13 },
  lbNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
}));
