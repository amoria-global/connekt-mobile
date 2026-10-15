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
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Share, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { cancelInvite, createInvite, getOwnedAlbum, removeCollaborator, reviewSubmissions } from '@/features/collab/api';
import { AlbumCover, PersonRow, StatusChip } from '@/features/collab/components';
import { daysLeft, timeAgo, type Collaborator, type OwnedAlbumDetail, type Submission } from '@/features/collab/model';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

type Tab = 'review' | 'people' | 'history';
const GAP = 8;

export default function OwnerAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles();
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
      setError(isApiError(e) ? e.message : 'Could not load this album.');
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
        Alert.alert('Some photos stayed in review',
          `${r.duplicates.length} photo${r.duplicates.length === 1 ? ' was' : 's were'} already published by another photographer, so ${r.duplicates.length === 1 ? 'it' : 'they'} could not be added. You can reject ${r.duplicates.length === 1 ? 'it' : 'them'} instead.`);
      }
      await load();
    } catch (e) {
      Alert.alert('Could not save your decision', isApiError(e) ? e.message : 'Please try again.');
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
        message: `Join my album "${data.album.title}" on Connekyt and submit your photos: ${created.link}`,
      });
    } catch (e) {
      if (isApiError(e)) Alert.alert('Could not create the invite link', e.message);
    } finally {
      setBusy(false);
    }
  };

  const shareLink = (link: string) => {
    Share.share({ message: `Join my album "${data?.album.title}" on Connekyt and submit your photos: ${link}` });
  };

  const confirmThen = (title: string, message: string, confirm: string, action: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: 'Keep', style: 'cancel' },
      {
        text: confirm,
        style: 'destructive',
        onPress: async () => {
          try { await action(); await load(); } catch (e) {
            Alert.alert('Could not update collaborators', isApiError(e) ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const askRemove = (c: Collaborator) => confirmThen(`Remove ${c.name}?`,
    'They will no longer be able to submit photos to this album. Photos they already submitted stay in your review queue. To bring them back, send them a new link.',
    'Remove', () => removeCollaborator(c.membershipId));

  if (!data) {
    return (
      <Screen padded={false}>
        {error ? (
          <EmptyState icon="alert-circle-outline" title="Could not open this album" message={error} action={{ label: 'Try again', onPress: load }} />
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
            <Text style={styles.eyebrow}>YOUR ALBUM</Text>
            <Text style={styles.title} numberOfLines={2}>{album.title}</Text>
            <Text style={styles.muted}>{album.imageCount} photos · {collaborators.length} collaborator{collaborators.length === 1 ? '' : 's'}</Text>
          </View>
        </View>

        <Button title="Invite a photographer" onPress={invite} loading={busy && !rejecting && !preview} />

        <Segmented<Tab>
          value={tab}
          onChange={(t) => { setTab(t); setSelected(new Set()); }}
          options={[
            { value: 'review', label: `Review (${pending.length})` },
            { value: 'people', label: `People (${collaborators.length})` },
            { value: 'history', label: 'History' },
          ]}
        />

        {tab === 'review' && (pending.length === 0 ? (
          <EmptyState icon="file-tray-outline" title="Nothing to review"
            message={collaborators.length === 0
              ? 'Invite a photographer. Photos they submit will wait here for your decision.'
              : 'You are all caught up. New photos from your collaborators will appear here.'} />
        ) : (
          <>
            <View style={styles.reviewBar}>
              <Text style={styles.muted}>{selecting ? `${selected.size} selected` : 'Tap to review · long press to select'}</Text>
              <Pressable hitSlop={8} onPress={() => setSelected(selecting ? new Set() : new Set(pending.map((s) => s.id)))}
                accessibilityRole="button">
                <Text style={styles.link}>{selecting ? 'Clear' : 'Select all'}</Text>
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
            <Text style={styles.sectionTitle}>Collaborators</Text>
            {collaborators.length === 0 ? (
              <Text style={styles.muted}>No one yet. Create an invite link and send it to a photographer you work with.</Text>
            ) : collaborators.map((c) => (
              <View key={c.membershipId} style={styles.row}>
                <View style={styles.flex}>
                  <PersonRow person={c} caption={`Joined ${timeAgo(c.joinedAt)} · ${submittedBy.get(c.id) ?? 0} photos`} />
                </View>
                <Pressable onPress={() => askRemove(c)} hitSlop={8} accessibilityRole="button"
                  accessibilityLabel={`Remove ${c.name}`}>
                  <Text style={styles.danger}>Remove</Text>
                </Pressable>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Open invite links</Text>
            {invites.length === 0 ? (
              <Text style={styles.muted}>None. One link can bring in as many photographers as you send it to.</Text>
            ) : invites.map((inv) => (
              <View key={inv.id} style={styles.row}>
                <Ionicons name="link-outline" size={20} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{inv.note || 'Invite link'}</Text>
                  <Text style={styles.muted}>
                    {inv.joinedCount} joined · {daysLeft(inv.expiresAt)}
                  </Text>
                </View>
                <Pressable onPress={() => shareLink(inv.link)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share invite link">
                  <Text style={styles.link}>Share</Text>
                </Pressable>
                <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel invite link"
                  onPress={() => confirmThen('Cancel this link?',
                    'Nobody else can join with it. Photographers who already joined stay.', 'Cancel link', () => cancelInvite(inv.id))}>
                  <Text style={styles.danger}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {tab === 'history' && (decided.length === 0 ? (
          <EmptyState icon="time-outline" title="No decisions yet" message="Photos you approve or reject are listed here." />
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
          <Button title="Reject" variant="outline" style={styles.flex} disabled={busy}
            onPress={() => { setNote(''); setRejecting(Array.from(selected)); }} />
          <Button title={`Add ${selected.size}`} style={styles.flex} loading={busy}
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
              <PersonRow person={preview.collaborator} caption={`Submitted ${timeAgo(preview.submittedAt)}`} />
              {preview.status === 'PENDING' ? (
                <View style={styles.previewActions}>
                  <Button title="Reject" variant="outline" style={styles.flex}
                    onPress={() => { setNote(''); setRejecting([preview.id]); }} />
                  <Button title="Add to album" style={styles.flex} loading={busy} onPress={() => decide([preview.id], 'APPROVE')} />
                </View>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  <StatusChip status={preview.status} />
                  {preview.reviewNote ? <Text style={styles.muted}>Your note: {preview.reviewNote}</Text> : null}
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
  return (
    <View style={styles.sheetBackdrop}>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Reject {count} photo{count === 1 ? '' : 's'}?</Text>
        <Text style={styles.muted}>They stay out of the album. The photographer is told, with your note if you add one.</Text>
        <TextInput
          value={note}
          onChangeText={onNote}
          placeholder="Note for the photographer (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          style={styles.noteInput}
          accessibilityLabel="Note for the photographer"
        />
        <View style={styles.previewActions}>
          <Button title="Cancel" variant="ghost" style={styles.flex} onPress={onCancel} />
          <Button title="Reject" variant="danger" style={styles.flex} loading={busy} onPress={onConfirm} />
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
