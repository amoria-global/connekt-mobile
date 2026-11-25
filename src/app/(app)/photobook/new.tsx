/**
 * New photobook, in three steps: Albums, Photos, Details.
 *
 * Photos come from the albums the person can really use (event, free, purchased, content, their own); the server lists
 * only photos they may add, so a paid or priced content photo they have not bought is never shown. A book uses ONE
 * photographer's photos, so once a photo is chosen, albums of any other photographer are disabled. The order of the
 * numbers on the grid becomes the book's order.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Alert } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { FadedChipRow } from '@/components/ui/FadedChipRow';
import { StatusChip } from '@/components/ui/StatusChip';
import { PrimaryButton, GhostButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { createPhotobook, getEventTerms, getPhotobook, savePhotographerEdits, listPickerAlbums, listPickerPhotos, sendPhotobookToClient, type EventTerms, type PickerAlbum, type PickerPhoto } from '@/features/photobooks/api';
import { pbCopy, photoCountLabel, type CopyKey } from '@/features/photobooks/copy';
import { SOURCE_TONE, type SourceKey } from '@/features/photobooks/model';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { formatPrice } from '@/utils/format';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';

type Step = 'albums' | 'photos' | 'details';
type Chip = 'all' | SourceKey;
type Picked = { id: string; thumb?: string; albumId: string; ownerId?: string };

const CHIPS: { key: Chip; label: CopyKey }[] = [
  { key: 'all', label: 'chip_all' },
  { key: 'event', label: 'chip_event' },
  { key: 'free', label: 'chip_free' },
  { key: 'purchased', label: 'chip_purchased' },
  { key: 'content', label: 'chip_content' },
  { key: 'mine', label: 'chip_mine' },
];

export default function NewPhotobookScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { language } = useLanguage();
  const t = useCallback((k: CopyKey, p?: Record<string, string | number>) => pbCopy(language, k, p), [language]);

  // Opened from a received book ("Add photos"): the photographer adds their own photos and saves; no details step.
  const { addTo } = useLocalSearchParams<{ addTo?: string }>();
  const existing = useAsync(useCallback(() => (addTo ? getPhotobook(addTo, true) : Promise.resolve(null)), [addTo]));
  const albumsAll = useAsync(useCallback(() => listPickerAlbums(), []));
  const albums = useMemo(
    () => ({ ...albumsAll, data: addTo ? (albumsAll.data ?? []).filter((a) => a.sourceType === 'mine') : albumsAll.data }),
    [albumsAll, addTo],
  );
  const [step, setStep] = useState<Step>('albums');
  const [chip, setChip] = useState<Chip>('all');
  const [current, setCurrent] = useState<PickerAlbum | null>(null);
  const [photos, setPhotos] = useState<Record<string, PickerPhoto[]>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photosError, setPhotosError] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [termsFor, setTermsFor] = useState<EventTerms | null>(null);

  const [name, setName] = useState('');
  const [layout, setLayout] = useState<'grid' | 'gallery-wall'>('grid');
  const [coverId, setCoverId] = useState<string | undefined>();
  const [linkEvent, setLinkEvent] = useState(true);
  const [busy, setBusy] = useState<'create' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lockedOwner = picked[0]?.ownerId;
  const albumById = useMemo(() => new Map((albums.data ?? []).map((a) => [a.id, a])), [albums.data]);

  // The event this book belongs to: every chosen photo's album shares one event. Anything else is an event-less book.
  const eventId = useMemo(() => {
    const ids = new Set(picked.map((p) => albumById.get(p.albumId)?.eventId));
    if (ids.size !== 1) return undefined;
    const only = [...ids][0];
    return only || undefined;
  }, [picked, albumById]);
  useEffect(() => {
    let live = true;
    if (eventId) getEventTerms(eventId).then((x) => live && setTermsFor(x)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [eventId]);

  // Terms belong to the event they were fetched for; a different event shows none until its own arrive.
  const terms = eventId && termsFor?.eventId === eventId ? termsFor : null;

  const openAlbum = useCallback(
    async (a: PickerAlbum) => {
      setCurrent(a);
      setStep('photos');
      setPhotosError(false);
      if (photos[a.id]) return;
      setLoadingPhotos(true);
      try {
        const res = await listPickerPhotos(a.id, 0, 300);
        setPhotos((p) => ({ ...p, [a.id]: res.items }));
      } catch {
        setPhotosError(true);
      } finally {
        setLoadingPhotos(false);
      }
    },
    [photos],
  );

  const toggle = (a: PickerAlbum, p: PickerPhoto) =>
    setPicked((cur) =>
      cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, { id: p.id, thumb: p.thumbUrl, albumId: a.id, ownerId: a.ownerId }],
    );
  const albumPhotos = current ? photos[current.id] ?? [] : [];
  const allOn = albumPhotos.length > 0 && albumPhotos.every((p) => picked.some((x) => x.id === p.id));
  const selectAll = () => {
    if (!current) return;
    if (allOn) {
      setPicked((cur) => cur.filter((x) => !albumPhotos.some((p) => p.id === x.id)));
    } else {
      setPicked((cur) => [
        ...cur,
        ...albumPhotos.filter((p) => !cur.some((x) => x.id === p.id)).map((p) => ({ id: p.id, thumb: p.thumbUrl, albumId: current.id, ownerId: current.ownerId })),
      ]);
    }
  };

  const visibleAlbums = useMemo(() => (albums.data ?? []).filter((a) => chip === 'all' || a.sourceType === chip), [albums.data, chip]);
  const free = terms?.freePhotosLimit;
  const extras = free !== undefined ? Math.max(0, picked.length - free) : 0;

  const addPhotos = async () => {
    if (!addTo || !existing.data) return;
    setBusy('create');
    setError(null);
    try {
      const have = existing.data.photos.map((p) => p.id);
      await savePhotographerEdits(addTo, { mediaIds: [...have, ...picked.map((p) => p.id).filter((i) => !have.includes(i))] });
      router.back();
    } catch (e) {
      setError(isApiError(e) ? (e.status === 403 ? t('refused') : e.message) : t('load_failed'));
    } finally {
      setBusy(null);
    }
  };

  const submit = async (send: boolean) => {
    setBusy(send ? 'send' : 'create');
    setError(null);
    let created: string | undefined;
    try {
      const cover = picked.find((p) => p.id === coverId)?.thumb ?? picked[0]?.thumb;
      const book = await createPhotobook({
        name,
        layout,
        mediaIds: picked.map((p) => p.id),
        coverImage: cover,
        eventId: linkEvent ? eventId : undefined,
      });
      created = book.id;
      if (send) await sendPhotobookToClient(book.id);
      router.replace(`/photobook/${book.id}` as never);
    } catch (e) {
      const msg = isApiError(e) ? (e.status === 403 ? t('refused') : e.message) : t('load_failed');
      if (created) {
        // The book exists: open it so the person can send it from there.
        Alert.alert(t('act_send'), msg);
        router.replace(`/photobook/${created}` as never);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  const goBack = () => {
    if (step === 'details') setStep('photos');
    else if (step === 'photos') setStep('albums');
    else router.back();
  };

  const crumb = (
    <View style={styles.crumbs}>
      {(['albums', 'photos', 'details'] as const).map((s, i) => (
        <Text key={s} style={[styles.crumb, step === s && styles.crumbOn]}>
          {i + 1} {t(`step_${s}` as CopyKey)}
          {i < 2 ? '  ›  ' : ''}
        </Text>
      ))}
    </View>
  );

  const cell = Math.floor((width - spacing.lg * 2 - 6) / 3);

  return (
    <Screen padded={false} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.iconBtn}>
          <Ionicons name={step === 'albums' ? 'close' : 'chevron-back'} size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.heading}>{addTo ? t('add_photos') : t('new_book')}</Text>
        <View style={styles.iconBtn} />
      </View>
      {addTo ? null : crumb}

      {step === 'albums' ? (
        <View style={styles.flex}>
          <FadedChipRow contentContainerStyle={styles.chips}>
            {CHIPS.map((c) => (
              <StatusChip key={c.key} label={t(c.label)} selected={chip === c.key} onPress={() => setChip(c.key)} />
            ))}
          </FadedChipRow>
          {albums.loading && !albums.data ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : albums.error ? (
            <ErrorState title={t("error_title")} message={t("error_body")} onRetry={albumsAll.refresh} />
          ) : visibleAlbums.length === 0 ? (
            <EmptyState icon="images-outline" title={t('albums_empty_title')} message={t('albums_empty_body')} />
          ) : (
            <FlatList
              data={visibleAlbums}
              keyExtractor={(a) => a.id}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={Gap}
              renderItem={({ item: a }) => {
                const blocked = !!lockedOwner && !!a.ownerId && a.ownerId !== lockedOwner;
                const n = picked.filter((p) => p.albumId === a.id).length;
                return (
                  <Pressable
                    disabled={blocked}
                    onPress={() => void openAlbum(a)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: blocked }}
                    style={[styles.album, blocked && styles.dim]}
                  >
                    {a.coverUrl ? <Image source={{ uri: a.coverUrl }} style={styles.cover} contentFit="cover" /> : <View style={[styles.cover, styles.coverEmpty]} />}
                    <View style={styles.flex}>
                      <Text style={styles.title} numberOfLines={2}>
                        {a.title}
                      </Text>
                      <View style={styles.row}>
                        <StatusChip label={t(`src_${a.sourceType}` as CopyKey)} tone={SOURCE_TONE[a.sourceType as SourceKey] ?? 'neutral'} compact />
                        <Text style={styles.meta} numberOfLines={1}>
                          {a.priced ? `${a.usableCount}/${a.photoCount}` : photoCountLabel(language, a.photoCount)}
                        </Text>
                      </View>
                      {a.ownerName ? <Text style={styles.meta}>{a.ownerName}</Text> : null}
                      {blocked ? <Text style={styles.warn}>{t('one_photographer')}</Text> : null}
                    </View>
                    {n > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{n}</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                );
              }}
              ListFooterComponent={<Text style={styles.lock}>{t('lock_note')}</Text>}
            />
          )}
          <Bar>
            <View style={styles.flex}>
              <Text style={styles.count}>{t('n_selected', { n: picked.length })}</Text>
            </View>
            <PrimaryButton title={addTo ? t('add_photos') : t('next')} disabled={picked.length === 0 || (!!addTo && !existing.data)} loading={!!addTo && busy === 'create'} onPress={() => (addTo ? void addPhotos() : setStep('details'))} />
          </Bar>
        </View>
      ) : null}

      {step === 'photos' && current ? (
        <View style={styles.flex}>
          <View style={styles.photosHead}>
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={1}>
                {current.title}
              </Text>
              <Text style={styles.meta}>{t(`src_${current.sourceType}` as CopyKey)}</Text>
            </View>
            {albumPhotos.length > 0 ? (
              <Pressable onPress={selectAll} hitSlop={10} accessibilityRole="button">
                <Text style={styles.link}>{allOn ? t('clear_all') : t('select_all')}</Text>
              </Pressable>
            ) : null}
          </View>
          {loadingPhotos ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : photosError ? (
            <ErrorState title={t('error_title')} message={t('error_body')} onRetry={() => void openAlbum(current)} />
          ) : albumPhotos.length === 0 ? (
            <EmptyState icon="lock-closed-outline" title={t('no_photos')} message={t('lock_note')} />
          ) : (
            <FlatList
              data={albumPhotos}
              keyExtractor={(p) => p.id}
              numColumns={3}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={{ gap: 3 }}
              ItemSeparatorComponent={Tiny}
              ListFooterComponent={<Text style={styles.lock}>{t('lock_note')}</Text>}
              renderItem={({ item: p }) => {
                const idx = picked.findIndex((x) => x.id === p.id);
                return (
                  <Pressable
                    onPress={() => toggle(current, p)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: idx >= 0 }}
                    accessibilityLabel={p.caption ?? p.id}
                    style={{ width: cell, height: cell }}
                  >
                    {p.thumbUrl ? <Image source={{ uri: p.thumbUrl }} style={styles.thumb} contentFit="cover" recyclingKey={p.id} accessibilityIgnoresInvertColors /> : <View style={[styles.thumb, styles.coverEmpty]} />}
                    <View style={[styles.tick, idx >= 0 && styles.tickOn]}>{idx >= 0 ? <Text style={styles.tickText}>{idx + 1}</Text> : null}</View>
                  </Pressable>
                );
              }}
            />
          )}
          <Bar>
            <View style={styles.flex}>
              <Text style={styles.count}>{t('n_selected', { n: picked.length })}</Text>
              {free !== undefined ? (
                <Text style={styles.meta}>
                  {t('free_up_to', { n: free })}
                  {extras > 0 ? `  ·  ${t('extras_over', { n: extras, price: formatPrice(terms?.pricePerExtraPhoto) })}` : ''}
                </Text>
              ) : null}
            </View>
            <GhostButton title={t('step_albums')} onPress={() => setStep('albums')} />
            <PrimaryButton title={addTo ? t('add_photos') : t('next')} disabled={picked.length === 0 || (!!addTo && !existing.data)} loading={!!addTo && busy === 'create'} onPress={() => (addTo ? void addPhotos() : setStep('details'))} />
          </Bar>
        </View>
      ) : null}

      {step === 'details' ? (
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('name_label')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('name_placeholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={120}
              accessibilityLabel={t('name_label')}
            />
            <Text style={styles.label}>{t('layout_label')}</Text>
            <Segmented
              value={layout}
              onChange={setLayout}
              options={[
                { label: t('layout_grid'), value: 'grid' },
                { label: t('layout_wall'), value: 'gallery-wall' },
              ]}
            />
            <Text style={styles.label}>{t('cover_label')}</Text>
            <Text style={styles.meta}>{t('cover_hint')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverRow}>
              {picked.slice(0, 40).map((p, i) => {
                const on = (coverId ?? picked[0]?.id) === p.id;
                return (
                  <Pressable key={p.id} onPress={() => setCoverId(p.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.coverPick, on && styles.coverPickOn]}>
                    {p.thumb ? <Image source={{ uri: p.thumb }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.coverEmpty]} />}
                    {i === 0 && !coverId ? null : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {eventId ? (
              <Pressable onPress={() => setLinkEvent((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: linkEvent }} style={styles.eventRow}>
                <Ionicons name={linkEvent ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.title}>{t('event_label')}</Text>
                  <Text style={styles.meta}>
                    {linkEvent ? terms?.title ?? albumById.get(picked[0]?.albumId ?? '')?.eventTitle ?? '' : t('event_none')}
                  </Text>
                  {linkEvent && free !== undefined ? <Text style={styles.meta}>{t('free_up_to', { n: free })}</Text> : null}
                </View>
              </Pressable>
            ) : null}
            <Text style={styles.label}>{t('review_label')}</Text>
            <Text style={styles.meta}>{photoCountLabel(language, picked.length)}</Text>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <Bar>
            <GhostButton title={t('create')} disabled={!name.trim() || !!busy} loading={busy === 'create'} onPress={() => void submit(false)} />
            <View style={styles.flex}>
              <PrimaryButton title={t('create_send')} disabled={!name.trim() || !!busy} loading={busy === 'send'} onPress={() => void submit(true)} />
            </View>
          </Bar>
        </View>
      ) : null}
    </Screen>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.bar}>{children}</View>;
}
function Gap() {
  return <View style={{ height: spacing.sm }} />;
}
function Tiny() {
  return <View style={{ height: 3 }} />;
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { color: c.text, fontFamily: fonts.bold, fontSize: 18 },
  crumbs: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  crumb: { color: c.textMuted, fontFamily: fonts.medium, fontSize: 12.5 },
  crumbOn: { color: c.link, fontFamily: fonts.bold },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  album: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  dim: { opacity: 0.45 },
  cover: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: c.surfaceMuted },
  coverEmpty: { backgroundColor: c.surfaceMuted },
  title: { color: c.text, fontFamily: fonts.bold, fontSize: 14.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 },
  meta: { color: c.textMuted, fontFamily: fonts.regular, fontSize: 12.5 },
  warn: { color: c.pending, fontFamily: fonts.medium, fontSize: 12 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, paddingHorizontal: 6 },
  badgeText: { color: c.textOnPrimary, fontFamily: fonts.bold, fontSize: 12 },
  lock: { color: c.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', paddingVertical: spacing.md },
  photosHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  link: { color: c.link, fontFamily: fonts.bold, fontSize: 14 },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  thumb: { width: '100%', height: '100%', borderRadius: 6 },
  tick: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.textOnPrimary, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: c.primary, borderColor: c.primary },
  tickText: { color: c.textOnPrimary, fontFamily: fonts.bold, fontSize: 11.5 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingHorizontal: spacing.lg, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
  count: { color: c.text, fontFamily: fonts.bold, fontSize: 15 },
  form: { padding: spacing.lg, gap: spacing.sm },
  label: { color: c.textSoft, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, marginTop: spacing.sm },
  input: { minHeight: 48, borderRadius: radii.lg, paddingHorizontal: spacing.md, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, fontFamily: fonts.regular, fontSize: 15 },
  coverRow: { gap: 6, paddingVertical: 6 },
  coverPick: { width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  coverPickOn: { borderColor: c.primary },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, marginTop: spacing.sm },
  error: { color: c.error, fontFamily: fonts.medium, fontSize: 13.5 },
}));
