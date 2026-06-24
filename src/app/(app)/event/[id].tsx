import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { StarInput } from '@/components/ui/Stars';
import { StatusPill } from '@/components/ui/StatusPill';
import { useRole } from '@/features/auth/role';
import {
  confirmCompletion,
  deleteEvent,
  getEvent,
  markEventCompletedByPhotographer,
  publishEvent,
  resetEventStream,
  startEventStream,
  unpublishEvent,
  type StreamSetup,
} from '@/features/events/api';
import { submitReview } from '@/features/reviews/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ownsEvents, isPhotographer } = useRole();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getEvent(id), [id]));

  const [busy, setBusy] = useState<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [streamSheetOpen, setStreamSheetOpen] = useState(false);
  const [streamSetup, setStreamSetup] = useState<StreamSetup | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const onSubmitReview = async () => {
    setBusy('review');
    try {
      await submitReview(id, rating, reviewComment.trim() || undefined);
      setReviewOpen(false);
      setReviewComment('');
      Alert.alert('Thank you!', 'Your review has been submitted.');
    } catch (e) {
      Alert.alert('Could not submit', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (e) {
      Alert.alert('Something went wrong', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        title: data?.title,
        message: `Check out "${data?.title}" on Connekyt\n${SHARE_BASE}${id}`,
      });
    } catch {
      // user dismissed
    }
  };

  const onDelete = () => {
    Alert.alert('Delete event', 'This cannot be undone. Delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await deleteEvent(id);
            router.back();
          } catch (e) {
            Alert.alert('Could not delete', isApiError(e) ? e.message : 'Please try again.');
            setBusy(null);
          }
        },
      },
    ]);
  };

  /**
   * Photographer "mark this shoot complete" — kicks the event into
   * the AWAITING_CLIENT_CONFIRMATION state. The client then has 7
   * days to either confirm completion (releases escrow) or request
   * changes (the photographer reshoots / re-edits).
   */
  const onPhotographerMarkCompleted = () => {
    Alert.prompt
      ? Alert.prompt(
          'Mark as completed',
          'Add an optional note for the client (delivery details, special instructions, etc).',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Mark completed',
              onPress: async (notes?: string) => {
                setBusy('photog-complete');
                try {
                  await markEventCompletedByPhotographer(id, notes);
                  await refresh();
                  Alert.alert(
                    'Marked completed',
                    'Waiting for the client to confirm. Escrow releases on their confirmation.',
                  );
                } catch (e) {
                  Alert.alert(
                    'Could not mark complete',
                    isApiError(e) ? e.message : 'Please try again.',
                  );
                } finally {
                  setBusy(null);
                }
              },
            },
          ],
          'plain-text',
        )
      : runMarkCompletedWithoutPrompt();
  };

  // Alert.prompt only exists on iOS. Android fallback skips the notes
  // and just submits the action.
  const runMarkCompletedWithoutPrompt = async () => {
    setBusy('photog-complete');
    try {
      await markEventCompletedByPhotographer(id);
      await refresh();
      Alert.alert(
        'Marked completed',
        'Waiting for the client to confirm. Escrow releases on their confirmation.',
      );
    } catch (e) {
      Alert.alert(
        'Could not mark complete',
        isApiError(e) ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  /**
   * Boot a Cloudflare Stream for this event and surface the WHIP URL.
   * The photographer points OBS at that URL on their laptop, then the
   * event goes live for any viewer holding the invite token.
   */
  const onGoLive = async () => {
    setBusy('stream');
    try {
      const setup = await startEventStream(id);
      setStreamSetup(setup);
      setStreamSheetOpen(true);
    } catch (e) {
      Alert.alert('Could not start stream', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onResetStream = async () => {
    setBusy('stream');
    try {
      const setup = await resetEventStream(id);
      setStreamSetup(setup);
    } catch (e) {
      Alert.alert('Could not reset stream', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const submitCompletion = async (status: 'COMPLETED' | 'REQUIRE_CHANGES') => {
    setBusy('completion');
    try {
      await confirmCompletion(id, status, comment.trim() || undefined);
      setCompletionOpen(false);
      setComment('');
      await refresh();
      Alert.alert(
        status === 'COMPLETED' ? 'Marked as completed' : 'Changes requested',
        status === 'COMPLETED' ? 'Thanks for confirming.' : 'The photographer has been notified.',
      );
    } catch (e) {
      Alert.alert('Could not submit', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {data?.coverImage ? (
          <Image source={{ uri: data.coverImage }} style={styles.cover} contentFit="cover" transition={250} />
        ) : null}

        <View style={styles.headerRow}>
          <Text style={styles.title}>{data?.title}</Text>
          <StatusPill status={data?.status} />
        </View>

        <View style={styles.infoCard}>
          {data?.eventDate ? <Row icon="calendar-outline" text={formatDate(data.eventDate)} /> : null}
          {data?.startTime ? (
            <Row icon="time-outline" text={data.endTime ? `${data.startTime} – ${data.endTime}` : data.startTime} />
          ) : null}
          {data?.location ? <Row icon="location-outline" text={data.location} /> : null}
          {data?.photographerName ? <Row icon="camera-outline" text={data.photographerName} /> : null}
          {data?.category ? <Row icon="pricetag-outline" text={data.category} /> : null}
        </View>

        {data?.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this event</Text>
            <Text style={styles.body}>{data.description}</Text>
          </View>
        ) : null}

        {/*
         * Photographer Manage — visible to a photographer working this
         * event so they can mark the shoot complete. The full
         * publish/edit/delete panel below is owner-only.
         */}
        {isPhotographer && !ownsEvents ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photographer actions</Text>
            <View style={styles.actionGrid}>
              <ActionPill
                icon="videocam-outline"
                label="Go live"
                onPress={onGoLive}
                loading={busy === 'stream'}
              />
              <ActionPill
                icon="checkmark-done-outline"
                label="Mark completed"
                onPress={onPhotographerMarkCompleted}
                loading={busy === 'photog-complete'}
              />
            </View>
          </View>
        ) : null}

        {/* Manage (owner only) */}
        {ownsEvents ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage</Text>

            <Button
              title={data?.published ? 'Unpublish' : 'Publish'}
              onPress={() => run('publish', () => (data?.published ? unpublishEvent(id) : publishEvent(id)))}
              loading={busy === 'publish'}
            />

            <View style={styles.actionGrid}>
              <ActionPill icon="create-outline" label="Edit" onPress={() => router.push(`/event/new?editId=${id}`)} />
              <ActionPill icon="share-social-outline" label="Share" onPress={onShare} />
              <ActionPill
                icon="videocam-outline"
                label="Go live"
                onPress={onGoLive}
                loading={busy === 'stream'}
              />
              <ActionPill
                icon="checkmark-done-outline"
                label="Confirm done"
                onPress={() => setCompletionOpen(true)}
              />
              {data?.photographerName ? (
                <ActionPill icon="star-outline" label="Rate" onPress={() => setReviewOpen(true)} />
              ) : null}
              <ActionPill icon="trash-outline" label="Delete" danger onPress={onDelete} loading={busy === 'delete'} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Rate photographer sheet */}
      <Modal visible={reviewOpen} transparent animationType="slide" onRequestClose={() => setReviewOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setReviewOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Rate {data?.photographerName}</Text>
            <View style={styles.starRow}>
              <StarInput value={rating} onChange={setRating} />
            </View>
            <Input
              placeholder="Share your experience (optional)"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              style={styles.commentInput}
            />
            <Button title="Submit review" onPress={onSubmitReview} loading={busy === 'review'} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm completion sheet */}
      <Modal visible={completionOpen} transparent animationType="slide" onRequestClose={() => setCompletionOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCompletionOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Confirm completion</Text>
            <Text style={styles.sheetHint}>
              Mark this event as completed, or request changes if something needs fixing. Funds in escrow are released
              on completion.
            </Text>
            <Input
              placeholder="Add a comment (optional)"
              value={comment}
              onChangeText={setComment}
              multiline
              style={styles.commentInput}
            />
            <Button title="Mark as completed" onPress={() => submitCompletion('COMPLETED')} loading={busy === 'completion'} />
            <Pressable
              style={styles.requestChanges}
              onPress={() => submitCompletion('REQUIRE_CHANGES')}
              disabled={busy === 'completion'}
            >
              <Text style={styles.requestChangesText}>Request changes</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/*
       * Stream setup sheet — opens after a successful Go-Live. Shows the
       * WHIP URL the photographer pastes into OBS, with a "rotate"
       * action that calls /stream/reset to invalidate the previous URL
       * (useful if it accidentally leaked).
       */}
      <Modal
        visible={streamSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStreamSheetOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setStreamSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Stream setup</Text>
            <Text style={styles.sheetHint}>
              Paste this WHIP URL into OBS → Settings → Stream → Service: WHIP. When OBS connects,
              the event goes live for everyone holding your invite link.
            </Text>

            {streamSetup?.whipUrl ? (
              <>
                <Text style={styles.streamLabel}>WHIP URL</Text>
                <View style={styles.streamUrlBox} pointerEvents="box-none">
                  <Text style={styles.streamUrlText} selectable>
                    {streamSetup.whipUrl}
                  </Text>
                </View>
              </>
            ) : null}

            {streamSetup?.hlsManifestUrl ? (
              <>
                <Text style={styles.streamLabel}>HLS manifest (viewer)</Text>
                <View style={styles.streamUrlBox} pointerEvents="box-none">
                  <Text style={styles.streamUrlText} selectable>
                    {streamSetup.hlsManifestUrl}
                  </Text>
                </View>
              </>
            ) : null}

            <Button
              title="Open viewer screen"
              onPress={() => {
                setStreamSheetOpen(false);
                router.push(`/stream/${id}` as never);
              }}
            />

            <Pressable
              style={styles.requestChanges}
              onPress={onResetStream}
              disabled={busy === 'stream'}
            >
              <Text style={styles.requestChangesText}>
                {busy === 'stream' ? 'Resetting…' : 'Rotate WHIP URL'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

function ActionPill({
  icon,
  label,
  onPress,
  danger,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, danger && styles.pillDanger, pressed && styles.pillPressed]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={danger ? colors.error : colors.primary} />
      ) : (
        <>
          <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
          <Text style={[styles.pillLabel, danger && styles.pillLabelDanger]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl },
  cover: { width: '100%', height: 180, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted },
  headerRow: { gap: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, fontSize: fontSize.md, color: colors.textSoft },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.md, color: colors.textSoft, lineHeight: 24 },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pill: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillDanger: { borderColor: colors.error },
  pillPressed: { opacity: 0.6 },
  pillLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.primary },
  pillLabelDanger: { color: colors.error },

  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  sheetHint: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  commentInput: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  streamLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textSoft, marginTop: spacing.sm, letterSpacing: 0.4 },
  streamUrlBox: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSoft },
  streamUrlText: { fontSize: fontSize.sm, color: colors.text, fontFamily: 'monospace' },
  starRow: { alignItems: 'center', paddingVertical: spacing.sm },
  requestChanges: { alignItems: 'center', paddingVertical: spacing.md },
  requestChangesText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.accent },
});
