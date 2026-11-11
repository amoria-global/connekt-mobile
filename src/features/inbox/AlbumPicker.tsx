import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PrimaryButton } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { listShareableAlbums, sendAlbums } from './api';
import {
  MAX_ALBUMS_PER_SHARE,
  filterAlbums,
  toggleSelection,
  type ShareBadge,
  type ShareTab,
  type ShareableAlbum,
} from './albumShare';

const BADGE_TONE: Record<ShareBadge, ChipTone> = { PAID: 'primary', PRIVATE: 'pending', FREE: 'success' };

/** The "+" panel: what can be sent. Albums are the one option today, and the list is where more would go. */
export function AttachSheet({
  visible,
  name,
  onClose,
  onShareAlbum,
}: {
  visible: boolean;
  name: string;
  onClose: () => void;
  onShareAlbum: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  return (
    <Sheet visible={visible} title={t('chat_send_to', { name })} onClose={onClose}>
      <Pressable
        onPress={onShareAlbum}
        accessibilityRole="button"
        accessibilityLabel={t('chat_share_album')}
        style={styles.option}
      >
        <View style={styles.optionIcon}>
          <Ionicons name="images-outline" size={18} color={colors.link} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.optionTitle}>{t('chat_share_album')}</Text>
          <Text style={styles.optionSub}>{t('chat_share_album_sub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.link} />
      </Pressable>
    </Sheet>
  );
}

function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Pick up to five of the photographer's own albums and send them as cards. The list is small, so the tabs and the
 * search run on the phone; archived and empty albums show why they cannot be sent instead of vanishing.
 */
export function AlbumPickerSheet(props: {
  visible: boolean;
  partnerId: string;
  name: string;
  onClose: () => void;
  onSent: () => void;
}) {
  // Mounted only while open, so every opening starts clean: nothing selected, a fresh load.
  if (!props.visible) return null;
  return <AlbumPickerBody {...props} />;
}

function AlbumPickerBody({
  visible,
  partnerId,
  name,
  onClose,
  onSent,
}: {
  visible: boolean;
  partnerId: string;
  name: string;
  onClose: () => void;
  /** The server accepted the share; the caller refreshes the thread. */
  onSent: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [albums, setAlbums] = useState<ShareableAlbum[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pickedTab, setPickedTab] = useState<ShareTab | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(() => {
    setAlbums(null);
    setLoadError(false);
    listShareableAlbums()
      .then(setAlbums)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    let live = true;
    listShareableAlbums()
      .then((a) => live && setAlbums(a))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  // Open on the tab that has albums, so the first thing seen is never an empty list next to a full one.
  const tab: ShareTab =
    pickedTab ??
    (albums && !albums.some((a) => a.tab === 'project') && albums.some((a) => a.tab === 'personal') ? 'personal' : 'project');
  const setTab = setPickedTab;

  const shown = useMemo(() => filterAlbums(albums ?? [], tab, query), [albums, tab, query]);

  const toggle = (a: ShareableAlbum) => {
    const r = toggleSelection(selected, a);
    setSelected(r.next);
    setProblem(r.limited ? t('chat_max_reached', { max: MAX_ALBUMS_PER_SHARE }) : null);
  };

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    setProblem(null);
    try {
      await sendAlbums(partnerId, selected, note);
      onSent();
      onClose();
    } catch (e) {
      setProblem(isApiError(e) ? e.message : t('b3_conv_not_sent_msg'));
    } finally {
      setSending(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      {problem ? (
        <Text style={styles.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : null}
      {selected.length ? (
        <TextInput
          style={styles.note}
          placeholder={t('chat_note_placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('chat_note_placeholder')}
          value={note}
          onChangeText={setNote}
          maxLength={500}
        />
      ) : null}
      <PrimaryButton
        title={selected.length <= 1 ? t('chat_send_albums_one') : t('chat_send_albums_many', { n: selected.length })}
        onPress={send}
        disabled={!selected.length}
        loading={sending}
      />
    </View>
  );

  const body = loadError ? (
    <ErrorState message={t('chat_albums_failed')} onRetry={load} />
  ) : albums === null ? (
    <View style={styles.skeletons} accessibilityLabel="Loading">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={56} height={56} radius={radii.md} />
          <View style={styles.flex}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={11} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  ) : albums.length === 0 ? (
    <EmptyState
      icon="images-outline"
      title={t('chat_no_albums')}
      message={t('chat_no_albums_sub')}
      action={{
        label: t('chat_create_album'),
        onPress: () => {
          onClose();
          router.push('/album/new');
        },
      }}
      card={false}
    />
  ) : (
    <>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { label: t('chat_tab_project'), value: 'project' },
          { label: t('chat_tab_personal'), value: 'personal' },
        ]}
      />
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('chat_search_albums')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('chat_search_albums')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>
      {shown.length === 0 ? (
        <Text style={styles.noMatch}>{query.trim() ? t('chat_no_matches', { q: query.trim() }) : t('chat_no_albums')}</Text>
      ) : (
        shown.map((a) => {
          const on = selected.includes(a.id);
          const disabled = !!a.disabledReason;
          const photos = a.photoCount === 1 ? t('chat_photo_one') : t('chat_photos', { n: a.photoCount });
          const reason =
            a.disabledReason === 'archived'
              ? t('chat_reason_archived')
              : a.disabledReason === 'empty'
                ? t('chat_reason_empty')
                : null;
          return (
            <Pressable
              key={a.id}
              onPress={() => toggle(a)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={`${a.title}, ${photos}${reason ? `, ${reason}` : ''}`}
              style={[styles.row, on && styles.rowOn, disabled && styles.rowOff]}
            >
              {a.cover ? (
                <Image source={{ uri: a.cover }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.noThumb]}>
                  <Ionicons name="images-outline" size={20} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {photos}
                  {shortDate(a.date) ? ` · ${shortDate(a.date)}` : ''}
                </Text>
                {reason ? <Text style={styles.reason}>{reason}</Text> : null}
              </View>
              <View style={styles.right}>
                <StatusChip
                  label={t(a.badge === 'PAID' ? 'chat_badge_paid' : a.badge === 'PRIVATE' ? 'chat_badge_private' : 'chat_badge_free')}
                  tone={disabled ? 'neutral' : BADGE_TONE[a.badge]}
                  compact
                />
                <Ionicons
                  name={on ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={on ? colors.primary : colors.textMuted}
                />
              </View>
            </Pressable>
          );
        })
      )}
    </>
  );

  return (
    <Sheet
      visible={visible}
      title={t('chat_pick_title')}
      subtitle={`${t('chat_send_to', { name })} · ${t('chat_pick_sub', { max: MAX_ALBUMS_PER_SHARE })}`}
      onClose={onClose}
      busy={sending}
      footer={albums && albums.length ? footer : undefined}
    >
      <View style={styles.list}>{body}</View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.tint,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  optionTitle: { color: c.text, fontSize: fontSize.md, fontFamily: fonts.semibold },
  optionSub: { color: c.textMuted, fontSize: 12, fontFamily: fonts.regular },
  list: { gap: spacing.sm },
  skeletons: { gap: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  searchInput: { flex: 1, color: c.text, fontSize: fontSize.md, fontFamily: fonts.regular, paddingVertical: 8 },
  noMatch: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  rowOn: { borderColor: c.primary, backgroundColor: c.tint },
  rowOff: { opacity: 0.6 },
  thumb: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: c.surfaceMuted },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: c.text, fontSize: fontSize.md, fontFamily: fonts.semibold },
  rowMeta: { color: c.textMuted, fontSize: 12, fontFamily: fonts.regular },
  reason: { color: c.pending, fontSize: 12, fontFamily: fonts.medium, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  footer: { gap: spacing.sm },
  note: {
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    color: c.text,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    backgroundColor: c.background,
  },
  problem: { color: c.error, fontSize: fontSize.sm, fontFamily: fonts.medium },
}));
