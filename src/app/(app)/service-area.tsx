/**
 * Service area: the area or neighbourhood a photographer works in, shown to clients as an approximate position on the map.
 *
 * Two steps on one screen (design/connekyt-service-area-reference.png, B and C):
 *   1. Search: our own place search, areas and neighbourhoods only, never a street address.
 *   2. Confirm: the area card, an approximate-circle preview when map tiles load, and Save.
 *
 * The app sends only the id of the chosen place. The server looks up the centre itself, so the position is never sent from here.
 * No admin review is needed, and "Remove my area" takes the photographer off the map straight away. Without map tiles the screen
 * still works: the preview is simply absent (see AreaPreview).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, GhostButton, PrimaryButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { showToast } from '@/features/errors/store';
import { useSharedT } from '@/i18n/sharedStrings';
import { isApiError } from '@/store/auth';
import { alpha, fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import {
  getAreaDetails,
  removeServiceArea,
  saveServiceArea,
  searchAreas,
  type AreaDetails,
  type AreaSuggestion,
} from '@/features/serviceArea/api';
import { AreaPreview } from '@/features/serviceArea/AreaPreview';
import { useServiceArea } from '@/features/serviceArea/useServiceArea';

type SearchState = 'idle' | 'loading' | 'done' | 'error';

export default function ServiceAreaScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const router = useRouter();
  const { area: saved, loaded } = useServiceArea();

  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AreaSuggestion[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [notice, setNotice] = useState<string | null>(null);

  const [picked, setPicked] = useState<AreaSuggestion | null>(null);
  const [details, setDetails] = useState<AreaDetails | null>(null);
  const [detailsState, setDetailsState] = useState<'idle' | 'loading' | 'error'>('idle');

  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasSaved = !!saved?.set;
  // Which step is showing: the confirm step when an area is picked or already saved (and the photographer is not changing it).
  const confirming = picked !== null || (hasSaved && !changing);

  // Search runs from the input (debounced), not from an effect: each keystroke cancels the one before it.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const runSearch = useCallback((text: string, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    abort.current?.abort();
    const q = text.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchState('idle');
      return;
    }
    setSearchState('loading');
    const ac = new AbortController();
    abort.current = ac;
    timer.current = setTimeout(async () => {
      try {
        const r = await searchAreas(q, ac.signal);
        if (ac.signal.aborted) return;
        setResults(r);
        setSearchState('done');
      } catch {
        if (!ac.signal.aborted) setSearchState('error');
      }
    }, delay);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  const choose = useCallback(
    async (s: AreaSuggestion) => {
      setNotice(null);
      setActionError(null);
      setPicked(s);
      setDetails(null);
      setDetailsState('loading');
      try {
        const d = await getAreaDetails(s.placeId);
        if (!d.isArea) {
          setPicked(null);
          setDetailsState('idle');
          setNotice(tr('Choose an area or neighbourhood, not a street address.'));
          return;
        }
        if (!d.supported) {
          setPicked(null);
          setDetailsState('idle');
          setNotice(tr('Connekyt is not available in that country yet.'));
          return;
        }
        setDetails(d);
        setDetailsState('idle');
      } catch {
        setDetailsState('error');
      }
    },
    [tr],
  );

  const back = () => {
    if (picked) {
      setPicked(null);
      setDetails(null);
      setDetailsState('idle');
      setActionError(null);
      return;
    }
    router.back();
  };

  const change = () => {
    setChanging(true);
    setPicked(null);
    setDetails(null);
    setActionError(null);
  };

  const save = async () => {
    if (!picked || busy) return;
    setBusy('save');
    setActionError(null);
    try {
      const a = await saveServiceArea(picked.placeId);
      showToast({ message: tr(`You're on the map in ${a.name ?? picked.name}`), tone: 'info' });
      router.back();
    } catch (e) {
      setActionError(isApiError(e) && e.message ? e.message : tr('We could not save your service area. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove');
    setActionError(null);
    try {
      await removeServiceArea();
      showToast({ message: tr("You're off the map"), tone: 'info' });
      router.back();
    } catch (e) {
      setActionError(isApiError(e) && e.message ? e.message : tr('We could not remove your service area. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  // What the confirm step shows: the new choice, or the area already saved.
  const cardName = details?.name || picked?.name || saved?.name || '';
  const cardContext = details?.context || (picked ? picked.secondary : saved?.context) || '';
  const lat = details ? details.latitude : saved?.latitude ?? null;
  const lng = details ? details.longitude : saved?.longitude ?? null;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={tr('Back')}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">{tr('Service area')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!loaded ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : confirming ? (
          // ───────────── Step 2: confirm ─────────────
          <>
            {detailsState === 'loading' ? (
              <GlassCard style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{tr('Checking this area')}</Text>
              </GlassCard>
            ) : detailsState === 'error' && picked ? (
              <InlineError
                message={tr('We could not check that area right now.')}
                actionLabel={tr('Try again')}
                onAction={() => void choose(picked)}
              />
            ) : (
              <>
                <AreaPreview lat={lat} lng={lng} />

                <GlassCard style={styles.areaCard}>
                  <IconTile icon="location-outline" tone="primary" size="lg" />
                  <View style={styles.areaText}>
                    <Text style={styles.areaName} numberOfLines={1}>{cardName}</Text>
                    {cardContext ? <Text style={styles.areaContext} numberOfLines={1}>{cardContext}</Text> : null}
                    <Text style={styles.areaTag}>{tr('approximate area')}</Text>
                  </View>
                  <Button title={tr('Change')} variant="outline" onPress={change} />
                </GlassCard>

                <View style={styles.note}>
                  <Ionicons name="eye-outline" size={16} color={colors.success} />
                  <Text style={styles.noteText}>
                    {tr('Clients see this approximate area and a rounded distance. Your address is never shown.')}
                  </Text>
                </View>

                {actionError ? (
                  <InlineError
                    message={actionError}
                    actionLabel={tr('Try again')}
                    onAction={() => void (picked ? save() : remove())}
                  />
                ) : null}

                {picked ? (
                  <PrimaryButton title={tr('Save service area')} onPress={save} loading={busy === 'save'} disabled={!details || busy !== null} />
                ) : (
                  <PrimaryButton title={tr('Done')} onPress={() => router.back()} />
                )}

                {hasSaved ? (
                  <View style={styles.removeWrap}>
                    <GhostButton title={tr('Remove my area')} onPress={remove} loading={busy === 'remove'} disabled={busy !== null} />
                    <Text style={styles.muted}>{tr('Removing takes you off the map straight away.')}</Text>
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : (
          // ───────────── Step 1: search ─────────────
          <>
            <Text style={styles.lead}>
              {tr('Choose the area or neighbourhood where you usually work. We place you on the map at its centre.')}
            </Text>

            <View>
              <Input
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  runSearch(t, 300);
                  setNotice(null);
                }}
                placeholder={tr('Search area or neighbourhood')}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={tr('Search area or neighbourhood')}
                leftElement={<Ionicons name="search" size={18} color={colors.textMuted} />}
              />
              {query ? (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    runSearch('', 0);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Clear')}
                  hitSlop={10}
                  style={styles.clear}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {notice ? (
              <View style={styles.warn}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.warnText}>{notice}</Text>
              </View>
            ) : null}

            {searchState === 'loading' ? (
              <GlassCard style={styles.center}>
                <ActivityIndicator color={colors.accent} />
              </GlassCard>
            ) : searchState === 'error' ? (
              <InlineError
                message={tr('Area search is unavailable right now.')}
                actionLabel={tr('Try again')}
                onAction={() => runSearch(query, 0)}
              />
            ) : searchState === 'done' && results.length === 0 ? (
              <GlassCard style={styles.empty}>
                <IconTile icon="search-outline" tone="primary" size="lg" />
                <Text style={styles.emptyTitle}>{tr(`No areas match "${query.trim()}"`)}</Text>
                <Text style={styles.muted}>{tr('Try a nearby neighbourhood or district.')}</Text>
              </GlassCard>
            ) : results.length > 0 ? (
              <GlassCard style={styles.list}>
                {results.map((r, i) => (
                  <Pressable
                    key={r.placeId}
                    onPress={() => void choose(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name}, ${r.secondary}`}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
                  >
                    <IconTile icon="location-outline" tone="primary" size="md" />
                    <View style={styles.rowText}>
                      <HighlightedName name={r.name} query={query.trim()} />
                      {r.secondary ? <Text style={styles.areaContext} numberOfLines={1}>{r.secondary}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </GlassCard>
            ) : null}

            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.noteText}>
                {tr('Areas only, no street addresses. Only areas in countries Connekyt supports are listed.')}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );

}

/** The area's name with the part the photographer typed in bold. */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const styles = useStyles();
  const at = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <Text style={styles.areaName} numberOfLines={1}>{name}</Text>;
  return (
    <Text style={styles.areaName} numberOfLines={1}>
      {name.slice(0, at)}
      <Text style={styles.match}>{name.slice(at, at + query.length)}</Text>
      {name.slice(at + query.length)}
    </Text>
  );
}

/** An inline error with a way to try again, in the error-states style: it names what failed and never blocks the screen. */
function InlineError({ message, actionLabel, onAction }: { message: string; actionLabel: string; onAction: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
      <Text style={styles.errorText}>{message}</Text>
      <Button title={actionLabel} variant="outline" onPress={onAction} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.glassSolid,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl },
  scroll: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  lead: { color: c.textSoft, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 20 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  muted: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs, textAlign: 'center' },
  clear: { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 56 },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.borderSoft },
  rowPressed: { backgroundColor: alpha(c.primary, 0.12) },
  rowText: { flex: 1, gap: 1 },
  areaName: { color: c.text, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  match: { color: c.link, fontFamily: fonts.bold },
  areaContext: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs },
  areaTag: { color: c.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  areaCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  areaText: { flex: 1, gap: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: c.tint },
  noteText: { flex: 1, color: c.textSoft, fontFamily: fonts.regular, fontSize: fontSize.xs, lineHeight: 17 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: c.warningBg },
  warnText: { flex: 1, color: c.warning, fontFamily: fonts.medium, fontSize: fontSize.xs },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.md, textAlign: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: c.errorBg, borderWidth: 1, borderColor: c.errorLine },
  errorText: { flex: 1, minWidth: 160, color: c.error, fontFamily: fonts.medium, fontSize: fontSize.xs },
  removeWrap: { alignItems: 'center', gap: spacing.xs },
}));
