import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { StarInput } from '@/components/ui/Stars';
import { Sheet } from '@/components/ui/Sheet';
import { useRole } from '@/features/auth/role';
import { IconTile } from '@/features/photographer/kit';
import { ProgressTrack } from '@/features/client/studio';
import { bookingTrack, progressView } from '@/features/events/bookingTrack';
import {
  acceptEventBooking,
  confirmCompletion,
  declineEventBooking,
  deleteEvent,
  getEvent,
  markEventCompletedByPhotographer,
  pauseEvent,
  publishEvent,
  resumeEvent,
  unpublishEvent,
} from '@/features/events/api';
import { EventQrSheet } from '@/features/events/EventQrSheet';
import { SatisfactionSurveySheet } from '@/features/events/SatisfactionSurveySheet';
import { submitSatisfactionSurvey, type SatisfactionSurvey } from '@/features/events/survey';
import { submitReview } from '@/features/reviews/api';
import { convertToDirectRescue } from '@/features/hybrid/api';
import { friendlyEventStatus, isOpenHybrid } from '@/features/hybrid/hybridUi';
import { BookingModeSelector } from '@/features/booking/BookingModeSelector';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import type { EventItem } from '@/features/events/types';
import { useCurrency } from '@/store/currency';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';

export default function EventDetailScreen() {
  useLanguage();
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ownsEvents, isPhotographer, isCoordinator } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getEvent(id, isCoordinator), [id, isCoordinator]),
  );

  // Seamless fallback: If the customer/creator endpoint rejects the event
  // (e.g. 400 Bad Request because it's a public event, live stream, or not created
  // by this specific account), redirect immediately to the public event screen
  // where the full event details, pricing, tickets, and live stream player live!
  useEffect(() => {
    if (error && !data && id) {
      router.replace(`/(public)/event/${id}` as never);
    }
  }, [error, data, id, router]);

  const [busy, setBusy] = useState<string | null>(null);
  const [repostOpen, setRepostOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrJustPublished, setQrJustPublished] = useState(false);
  const [comment, setComment] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const onSubmitReview = async () => {
    setBusy('review');
    try {
      await submitReview(id, rating, reviewComment.trim() || undefined);
      setReviewOpen(false);
      setReviewComment('');
      Alert.alert(tr('b3_evdet_thank_you'), 'Your review has been submitted.');
    } catch (e) {
      Alert.alert(tr('b3_evdet_could_not_submit'), isApiError(e) ? e.message : 'Please try again.');
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
      Alert.alert(tr('b3_evdet_something_wrong'), isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Publishing is what puts an event on connekyt.com, and the server rejects
   * an incomplete one. Web checks the same three things before calling, so
   * mobile does too — otherwise the owner just gets a raw error and no idea
   * which piece is missing.
   */
  const onPublish = () => {
    const booking = (ev?.bookingStatus ?? '').toUpperCase();
    if (!ev?.coverImage) {
      Alert.alert(
        tr('b3_evdet_add_cover_title'),
        'An event needs a cover photo before it can go live on connekyt.com. Edit the event to add one.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Edit event', onPress: () => router.push(`/event/new?editId=${id}`) },
        ],
      );
      return;
    }
    // Private events are self-streamed and have no photographer, so only public
    // events need one before publishing.
    if (!isPrivate && !ev?.photographerName) {
      Alert.alert(
        tr('b3_evdet_assign_photog_title'),
        'Events are published once a photographer is attached, so guests know who is covering it.',
      );
      return;
    }
    if (booking && booking !== 'ACCEPTED' && booking !== 'UNASSIGNED') {
      Alert.alert(
        tr('b3_evdet_waiting_photog_title'),
        'This booking has not been accepted yet. Once the photographer accepts, you can publish the event.',
      );
      return;
    }
    Alert.alert(
      tr('b3_evdet_publish_title'),
      'It becomes visible to everyone on connekyt.com, and guests can find and join it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: () =>
            run('publish', async () => {
              await publishEvent(id, isCoordinator);
              setQrJustPublished(true);
              setQrOpen(true);
            }),
        },
      ],
    );
  };

  const onUnpublish = () => {
    if (s === 'ONGOING' || isStreamLive) {
      Alert.alert(
        tr('b3_evdet_live_title'),
        'Ask the photographer to end the stream before taking this event off connekyt.com.',
      );
      return;
    }
    Alert.alert(
      tr('b3_evdet_unpublish_title'),
      'It will no longer appear on connekyt.com. You can publish it again at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpublish',
          style: 'destructive',
          onPress: () => run('publish', () => unpublishEvent(id, isCoordinator)),
        },
      ],
    );
  };

  const openQr = () => {
    setQrJustPublished(false);
    setQrOpen(true);
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
    Alert.alert(tr('b3_evdet_delete_title'), 'This cannot be undone. Delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            // Web takes a published event offline before deleting so it can't
            // linger on the public site.
            if (ev?.published) {
              await unpublishEvent(id, isCoordinator).catch(() => {});
            }
            await deleteEvent(id, isCoordinator);
            // Opened from a notification there's nothing to go back to.
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/(tabs)/events' as never);
          } catch (e) {
            Alert.alert(tr('b3_evdet_could_not_delete'), isApiError(e) ? e.message : 'Please try again.');
            setBusy(null);
          }
        },
      },
    ]);
  };

  /**
   * Pause / Resume — owner side. Pause sets status PAUSED on the event,
   * which freezes any open streams and prevents new bookings; Resume
   * restores it to the prior status (UPCOMING / ONGOING). Both endpoints
   * are role-aware: coordinator-owned events route through
   * /coordinator/events/{id}/{pause|resume}, otherwise /customer.
   */
  const onPause = () =>
    run('pause', () => pauseEvent(id, isCoordinator));
  const onResume = () =>
    run('resume', () => resumeEvent(id, isCoordinator));

  /**
   * Photographer accept / decline from the event detail page. Web parity:
   * web shows these buttons on both /photographer/events and on the
   * event-detail page. Mobile previously required the photographer to
   * jump to /bookings — now both screens work.
   */
  const onAcceptBooking = () =>
    run('accept', () => acceptEventBooking(id));

  const submitDecline = async () => {
    setDeclineOpen(false);
    setBusy('decline');
    try {
      await declineEventBooking(id, declineReason);
      setDeclineReason('');
      await refresh();
    } catch (e) {
      Alert.alert(tr('b3_evdet_could_not_decline'), isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Photographer "mark this shoot complete" — kicks the event into
   * the AWAITING_CLIENT_CONFIRMATION state. The client then has 7
   * days to either confirm completion (releases escrow) or request
   * changes (the photographer reshoots / re-edits).
   */
  const onPhotographerMarkCompleted = () => {
    // Non-streaming shoots never reach ONGOING, so gate on "has it started"
    // rather than on an active stream.
    if (s === 'UPCOMING' || s === 'PENDING' || s === 'PROPOSED') {
      Alert.alert(
        tr('b3_evdet_not_started_title'),
        'You can mark a shoot complete once the event day has begun. Come back after it starts.',
      );
      return;
    }
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
                    tr('b3_evdet_marked_completed_title'),
                    'Waiting for the client to confirm. Escrow releases on their confirmation.',
                  );
                } catch (e) {
                  Alert.alert(
                    tr('b3_evdet_could_not_mark_complete'),
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
        tr('b3_evdet_marked_completed_title'),
        'Waiting for the client to confirm. Escrow releases on their confirmation.',
      );
    } catch (e) {
      Alert.alert(
        tr('b3_evdet_could_not_mark_complete'),
        isApiError(e) ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  /**
   * Open the full Stream Control screen — browser camera OR OBS, with
   * viewer count, status, pause / resume / end / reset and a live
   * self-preview. Mobile port of salo-run's StreamPreview. Both "Go live"
   * and "Reset stream" route here; the control screen boots / rotates the
   * Cloudflare live input itself.
   */
  const openStreamControl = () => {
    router.push(`/stream/control/${id}` as never);
  };

  /**
   * Streaming and albums both hang off the public event page, so the backend
   * only accepts them once the event is published. The photographer can't
   * publish it themselves — that's the event creator's call — so say so.
   */
  const requirePublished = (action: string): boolean => {
    if (ev?.published) return true;
    Alert.alert(
      tr('b3_evdet_not_published_title'),
      `${action} is only available for published events. Ask the event creator to publish "${ev?.title ?? 'this event'}" first.`,
    );
    return false;
  };

  const onPhotographerGoLive = () => {
    if (!requirePublished('Live streaming')) return;
    openStreamControl();
  };

  const onPhotographerCreateAlbum = () => {
    if (!requirePublished('Album creation')) return;
    router.push(`/album/new?eventId=${id}`);
  };

  /**
   * "Request changes" goes straight through; confirming completion does not.
   * The survey is what releases the photographer's survey-held fee, and
   * confirm-completion on its own never does — so completing without one left
   * the photographer permanently short. The survey answers also decide whether
   * this ends as COMPLETED or goes back as REQUIRE_CHANGES.
   */
  const submitCompletion = async (status: 'COMPLETED' | 'REQUIRE_CHANGES') => {
    if (status === 'COMPLETED') {
      setCompletionOpen(false);
      setSurveyOpen(true);
      return;
    }
    setBusy('completion');
    try {
      await confirmCompletion(id, status, comment.trim() || undefined, isCoordinator);
      setCompletionOpen(false);
      setComment('');
      await refresh();
      Alert.alert(tr('b3_evdet_changes_requested_title'), 'The photographer has been notified.');
    } catch (e) {
      Alert.alert(tr('b3_evdet_could_not_submit'), isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const submitSurvey = async (answers: SatisfactionSurvey) => {
    setBusy('completion');
    try {
      let disputeFlagged = false;
      try {
        ({ disputeFlagged } = await submitSatisfactionSurvey(id, answers));
      } catch (e) {
        // The survey is one-per-event server-side. If it already landed (a
        // previous attempt whose follow-up call failed), don't dead-end the
        // client behind the duplicate guard — carry on and finish the
        // confirmation that's still outstanding.
        const msg = isApiError(e) ? e.message : '';
        if (!/already submitted/i.test(msg)) throw e;
      }

      // Submitting the survey is the point of no return — it's what released
      // the photographer's held fee. Close up here so a failure in the call
      // below can never look like the feedback itself failed.
      setSurveyOpen(false);
      setComment('');

      const status = disputeFlagged ? 'REQUIRE_CHANGES' : 'COMPLETED';
      try {
        await confirmCompletion(
          id,
          status,
          answers.issuesDescription || comment.trim() || undefined,
          isCoordinator,
        );
      } catch {
        // Recoverable: the survey is persisted and the funds released. The
        // status catches up on a later confirm, so don't alarm the client.
      }

      await refresh();
      Alert.alert(
        disputeFlagged ? 'Thanks, we’ll look into it' : 'All done',
        disputeFlagged
          ? 'We’ve passed your feedback on and asked the photographer to follow up.'
          : 'Thanks for confirming. The photographer has been paid.',
      );
    } catch (e) {
      Alert.alert(tr('b3_evdet_could_not_submit'), isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // The effect above redirects to the public event page, so this is a short transitional state.
  if (error && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const ev = data;
  const s = (ev?.status ?? '').toUpperCase();
  const booking = (ev?.bookingStatus ?? '').toUpperCase();
  const streamStatus = (ev?.streamStatus ?? '').toLowerCase();
  const hero = heroStatus(s, ev?.published);

  // Photographer action gating (web parity).
  const isPhotog = isPhotographer && !ownsEvents;
  const isPending = booking === 'PENDING';
  // A photographer can be attached to an event without a Booking row —
  // /photographer/events merges booked events with ones assigned directly
  // (findByPhotographerIdOrderByEventDateDesc), and those report a null
  // bookingStatus. Treating that as "not accepted" would strip Go Live and
  // Mark Complete from photographers who are legitimately on the job, so the
  // empty case stays permissive for them.
  const isAccepted = booking === 'ACCEPTED' || (!booking && isPhotog);
  const isEventDone = s === 'COMPLETED' || s === 'CANCELLED' || s === 'AWAITING_REVIEW';
  const isStreamLive = streamStatus === 'live' || streamStatus === 'connected';
  // Private events are self-streamed by the owner; public events are streamed
  // by the photographer. So the owner's "Go Live" only exists on private events.
  const isPrivate = (ev?.eventVisibility ?? '').toUpperCase() === 'PRIVATE';
  const canGoLive = isAccepted && !isEventDone && streamStatus !== 'ended' && !isStreamLive;
  const ownerCanGoLive =
    isPrivate && !isEventDone && streamStatus !== 'ended' && !isStreamLive;
  const canMarkComplete = isAccepted && !isEventDone;
  const canCreateAlbum = s === 'COMPLETED' || booking === 'ACCEPTED';

  // Owner action gating (web parity). The server refuses these anyway; hiding
  // them keeps mobile from offering buttons that can only ever error.
  const completion = (ev?.completionStatus ?? '').toUpperCase();
  const canDelete =
    s !== 'COMPLETED' &&
    s !== 'PAUSED' &&
    booking !== 'ACCEPTED' &&
    (completion === '' || completion === 'NOT_COMPLETED');
  const canPause = booking === 'ACCEPTED' && s !== 'COMPLETED' && s !== 'PAUSED';
  // The server rejects confirmation until the album is delivered, and web only
  // offers the button then. Until it is, say what's being waited on.
  const awaitingConfirmation = completion === 'PENDING_CUSTOMER_CONFIRMATION';
  const canConfirmDone = awaitingConfirmation && ev?.albumDelivered === true;
  const money = fmtMoney(ev?.price, ev?.currency);

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Title */}
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>{tr('b3_evdet_eyebrow')}</Text>
          <Text style={styles.title}>{ev?.title}</Text>
        </View>

        {/* Hero image with status pills */}
        <View style={styles.hero}>
          {ev?.coverImage ? (
            <Image source={{ uri: ev.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroFallback]}>
              <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          <View style={styles.heroPills}>
            {ev?.status ? (
              <View style={[styles.heroPill, { backgroundColor: hero.bg }]}>
                <Text style={[styles.heroPillText, { color: hero.fg }]}>{hero.label}</Text>
              </View>
            ) : null}
            {ev?.hasLiveStream ? (
              <View style={[styles.heroPill, styles.heroLive]}>
                <Ionicons name="radio" size={12} color="#fff" />
                <Text style={[styles.heroPillText, { color: '#fff' }]}>{tr('b3_evdet_live_stream_pill')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {ev?.description ? <Text style={styles.desc}>{ev.description}</Text> : null}

        {/* Details. Photographers get one compact list (icon tile, label, value, hairlines) instead of a grid of
            tinted cards; every other role keeps the grid. */}
        {(() => {
          const rows: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [];
          if (ev?.eventDate) rows.push({ key: 'date', icon: 'calendar', label: tr('b3_evdet_lbl_date'), value: fmtShortDate(ev.eventDate) });
          if (ev?.startTime)
            rows.push({ key: 'time', icon: 'time', label: tr('b3_evdet_lbl_time'), value: [fmtTime(ev.startTime), fmtTime(ev.endTime)].filter(Boolean).join(' - ') });
          if (ev?.location) rows.push({ key: 'loc', icon: 'location', label: tr('b3_evdet_lbl_location'), value: ev.location });
          if (ev?.clientName) rows.push({ key: 'client', icon: 'person', label: tr('b3_evdet_lbl_client'), value: ev.clientName });
          if (ev?.photographerName && !ev?.clientName)
            rows.push({ key: 'photog', icon: 'camera', label: tr('b3_evdet_lbl_photographer'), value: ev.photographerName });
          if (ev?.packageName) rows.push({ key: 'pkg', icon: 'cube', label: tr('b3_evdet_lbl_package'), value: ev.packageName });
          if (ev?.category) rows.push({ key: 'cat', icon: 'pricetag', label: tr('b3_evdet_lbl_event_type'), value: ev.category });
          if (ev?.maxGuests != null)
            rows.push({ key: 'guests', icon: 'people', label: tr('b3_evdet_lbl_guests'), value: `${ev.guestCount ?? 0} / ${ev.maxGuests}` });
          if (money) rows.push({ key: 'amount', icon: 'wallet', label: tr('b3_evdet_lbl_amount'), value: money });
          if (isPhotog) {
            return rows.length ? (
              <View style={styles.detailPanel}>
                {rows.map((r, i) => (
                  <View key={r.key} style={[styles.detailRow, i > 0 && styles.detailRowRule]}>
                    <IconTile icon={r.icon} size={32} />
                    <View style={styles.detailRowText}>
                      <Text style={styles.detailRowLabel}>{r.label}</Text>
                      <Text style={styles.detailRowValue}>{r.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null;
          }
          return (
            <View style={styles.grid}>
              {rows.map((r) => (
                <DetailCard key={r.key} icon={r.icon} label={r.label} value={r.value} />
              ))}
            </View>
          );
        })()}

        {/* Primary actions — photographer */}
        {isPhotog && isPending ? (
          <View style={styles.btnRow}>
            <PrimaryBtn icon="checkmark-circle" label={tr('b3_evdet_accept')} variant="success" full onPress={onAcceptBooking} loading={busy === 'accept'} />
            <PrimaryBtn icon="close-circle" label={tr('b3_evdet_decline')} variant="danger" full onPress={() => setDeclineOpen(true)} loading={busy === 'decline'} />
          </View>
        ) : null}
        {isPhotog && !isPending ? (
          <View style={styles.btnRow}>
            {canCreateAlbum ? (
              <PrimaryBtn icon="add-circle" label={tr('b3_evdet_create_album')} variant="primary" onPress={onPhotographerCreateAlbum} />
            ) : null}
            {canGoLive ? (
              <PrimaryBtn icon="radio" label={tr('b3_evdet_live_stream_btn')} variant="accent" onPress={onPhotographerGoLive} />
            ) : null}
            <PrimaryBtn icon="share-social" label={tr('b3_evdet_share')} variant="outline" onPress={onShare} />
            {ev?.published ? (
              <PrimaryBtn icon="qr-code-outline" label={tr('b3_evdet_qr_code')} variant="outline" onPress={openQr} />
            ) : null}
            {canMarkComplete ? (
              <PrimaryBtn icon="checkmark-done" label={tr('b3_evdet_mark_complete')} variant="success" onPress={onPhotographerMarkCompleted} loading={busy === 'photog-complete'} />
            ) : null}
          </View>
        ) : null}

        {/* Booking progress */}
        {/* Owners get the labelled track below; the plain stepper is the photographer's, and the owner's fallback when there is no track. */}
        {progressView(ev, isPhotog, ownsEvents) === 'stepper' ? (
          <InfoCard icon="git-commit-outline" title={tr('b3_evdet_booking_progress')}>
            <ProgressStepper currentIndex={bookingStepIndex(ev)} />
          </InfoCard>
        ) : null}
        {progressView(ev, isPhotog, ownsEvents) === 'track' ? (
          <InfoCard icon="git-commit-outline" title="Booking Progress">
            <ProgressTrack steps={bookingTrack(ev)!} label="Booking progress" />
          </InfoCard>
        ) : null}

        {/* Photographer + booking details */}
        {ev?.photographerName ? (
          <InfoCard icon="camera-outline" title="Photographer">
            <View style={styles.personRow}>
              <View style={styles.personAvatar}>
                <Text style={styles.personInitial}>{ev.photographerName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{ev.photographerName}</Text>
                {booking ? <Chip label={booking} tone={booking === 'ACCEPTED' ? 'success' : booking === 'PENDING' ? 'warning' : 'muted'} /> : null}
              </View>
              {ev.photographerId ? (
                <Pressable
                  style={styles.messagePersonBtn}
                  onPress={() =>
                    router.push(
                      `/conversation/${ev.photographerId}?name=${encodeURIComponent(ev.photographerName ?? 'Photographer')}` as never
                    )
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${ev.photographerName}`}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
                  <Text style={styles.messagePersonBtnText}>Message</Text>
                </Pressable>
              ) : null}
            </View>
          </InfoCard>
        ) : ownsEvents && isOpenHybrid(ev?.bookingMode, ev?.status, false) ? (
          (() => {
            const st = (ev?.status ?? '').toUpperCase();
            const ended = st === 'HYBRID_TIMEOUT' || st === 'MATCHING_FAILED';
            const ready = st === 'CANDIDATES_AVAILABLE' || st === 'MATCHES_AWAITING_SELECTION';
            return (
              <InfoCard icon="radio-outline" title={`Post My Event · ${friendlyEventStatus(st)}`}>
                <View style={{ gap: 10 }}>
                  <Text style={styles.desc}>
                    {ended
                      ? "No photographer said yes this time. Post it again with a wider area or budget, or choose a photographer yourself."
                      : ready
                        ? 'Photographers who are free for your whole event said yes. Compare them and choose one.'
                        : 'Matching photographers near you have been alerted. Only those who say yes are shown to you.'}
                  </Text>
                  {ended ? (
                    <>
                      <PrimaryBtn icon="radio-outline" label={tr('b3_evdet_post_again')} variant="primary"
                        onPress={() => setRepostOpen(true)} />
                      <PrimaryBtn icon="search-outline" label={tr('b3_evdet_find_instead')} variant="outline" loading={busy === 'to-direct'}
                        onPress={() => run('to-direct', async () => {
                          await convertToDirectRescue(id);
                          router.push('/photographers' as never);
                        })} />
                    </>
                  ) : (
                    <PrimaryBtn icon="people-outline" label={ready ? 'Choose your photographer' : 'See the answers'} variant="primary"
                      onPress={() => router.push(`/event/candidates?id=${id}` as never)} />
                  )}
                </View>
              </InfoCard>
            );
          })()
        ) : ownsEvents && !['COMPLETED', 'CANCELLED', 'CANCELED'].includes((ev?.status ?? '').toUpperCase()) ? (
          <InfoCard icon="camera-outline" title={tr('b3_evdet_no_photog_yet')}>
            <View style={{ gap: 10 }}>
              <Text style={styles.desc}>{tr('b3_evdet_choose_how_book')}</Text>
              <PrimaryBtn icon="radio-outline" label={tr('b3_evdet_post_let_say_yes')} variant="primary"
                onPress={() => setRepostOpen(true)} />
              <PrimaryBtn icon="search-outline" label={tr('b3_evdet_find_yourself')} variant="outline"
                onPress={() => router.push('/photographers' as never)} />
            </View>
          </InfoCard>
        ) : null}

        {(ev?.packageName || money) ? (
          <InfoCard icon="cube-outline" title={tr('b3_evdet_booking_details')}>
            {ev?.packageName ? <KeyValue label={tr('b3_evdet_package')} value={ev.packageName} /> : null}
            {money ? <KeyValue label={tr('b3_evdet_price')} value={money} accent /> : null}
          </InfoCard>
        ) : null}

        {/* Completion status */}
        {ev?.completionStatus ? (
          <InfoCard icon="checkmark-circle-outline" title={tr('b3_evdet_completion_status')}>
            <Chip
              label={ev.completionStatus.replace(/_/g, ' ')}
              tone={ev.completionStatus.toUpperCase() === 'COMPLETED' ? 'success' : 'muted'}
            />
          </InfoCard>
        ) : null}

        {/* Event information */}
        {ev?.eventVisibility ? (
          <InfoCard icon="information-circle-outline" title={tr('b3_evdet_event_info')}>
            <Text style={styles.infoLabel}>{tr('b3_evdet_visibility')}</Text>
            <Text style={styles.infoValue}>
              {ev.eventVisibility.charAt(0).toUpperCase() + ev.eventVisibility.slice(1).toLowerCase()}
            </Text>
          </InfoCard>
        ) : null}

        {/* Manage (owner only) */}
        {ownsEvents ? (
          <InfoCard icon="settings-outline" title={tr('b3_evdet_manage')}>
            <View style={styles.btnRow}>
              <PrimaryBtn
                icon={ev?.published ? 'eye-off-outline' : 'megaphone-outline'}
                label={ev?.published ? 'Unpublish' : 'Publish'}
                variant={ev?.published ? 'outline' : 'primary'}
                onPress={ev?.published ? onUnpublish : onPublish}
                loading={busy === 'publish'}
              />
              <PrimaryBtn icon="create-outline" label={tr('b3_evdet_edit')} variant="outline" onPress={() => router.push(`/event/new?editId=${id}`)} />
              <PrimaryBtn icon="earth-outline" label={tr('b3_evdet_geo_pricing')} variant="outline" onPress={() => router.push(`/event/geo-pricing?eventId=${id}` as never)} />
              <PrimaryBtn icon="share-social-outline" label={tr('b3_evdet_share')} variant="outline" onPress={onShare} />
              {ev?.published ? (
                <PrimaryBtn icon="qr-code-outline" label={tr('b3_evdet_qr_code')} variant="outline" onPress={openQr} />
              ) : null}
              {ownerCanGoLive ? (
                <PrimaryBtn icon="radio" label={tr('b3_evdet_go_live')} variant="accent" onPress={openStreamControl} />
              ) : null}
              {s === 'PAUSED' ? (
                <PrimaryBtn icon="play-circle-outline" label={tr('b3_evdet_resume')} variant="outline" onPress={onResume} loading={busy === 'resume'} />
              ) : ev?.streamStatus === 'ended' ? (
                <PrimaryBtn icon="refresh-circle-outline" label={tr('b3_evdet_reset_stream')} variant="outline" onPress={openStreamControl} />
              ) : canPause ? (
                <PrimaryBtn icon="pause-circle-outline" label={tr('b3_evdet_pause')} variant="outline" onPress={onPause} loading={busy === 'pause'} />
              ) : null}
              {canConfirmDone ? (
                <PrimaryBtn
                  icon="checkmark-done"
                  label={tr('b3_evdet_confirm_done')}
                  variant="success"
                  onPress={() => setCompletionOpen(true)}
                />
              ) : awaitingConfirmation ? (
                <PrimaryBtn
                  icon="hourglass-outline"
                  label={tr('b3_evdet_awaiting_album')}
                  variant="outline"
                  onPress={() =>
                    Alert.alert(
                      tr('b3_evdet_waiting_album_title'),
                      'Once the photographer delivers your album you can confirm the event and release their final payment.',
                    )
                  }
                />
              ) : null}
              {ev?.photographerName ? (
                <PrimaryBtn icon="star-outline" label={tr('b3_evdet_rate')} variant="outline" onPress={() => setReviewOpen(true)} />
              ) : null}
            </View>
            {canDelete ? (
              <View style={styles.dangerZone}>
                <Text style={styles.dangerLabel}>{tr('b3_danger_zone')}</Text>
                <PrimaryBtn icon="trash-outline" label={tr('b3_evdet_delete')} variant="dangerOutline" full onPress={onDelete} loading={busy === 'delete'} />
              </View>
            ) : null}
          </InfoCard>
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
              placeholder={tr('b3_evdet_share_exp_ph')}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              style={styles.commentInput}
            />
            <Button title={tr('b3_evdet_submit_review')} onPress={onSubmitReview} loading={busy === 'review'} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm completion sheet */}
      <Modal visible={completionOpen} transparent animationType="slide" onRequestClose={() => setCompletionOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCompletionOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{tr('b3_evdet_confirm_completion')}</Text>
            <Text style={styles.sheetHint}>
              Confirm the event went ahead, or request changes if something needs fixing. Confirming
              asks you a few quick questions, and that is what releases the photographer&apos;s final
              payment.
            </Text>
            <Input
              placeholder={tr('b3_evdet_add_comment_ph')}
              value={comment}
              onChangeText={setComment}
              multiline
              style={styles.commentInput}
            />
            <Button title={tr('b3_evdet_continue_questions')} onPress={() => submitCompletion('COMPLETED')} loading={busy === 'completion'} />
            <Pressable
              style={styles.requestChanges}
              onPress={() => submitCompletion('REQUIRE_CHANGES')}
              disabled={busy === 'completion'}
            >
              <Text style={styles.requestChangesText}>{tr('b3_evdet_request_changes')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <EventQrSheet
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        eventId={id}
        title={ev?.title ?? 'Event'}
        published={!!ev?.published}
        justPublished={qrJustPublished}
      />

      {/* Satisfaction survey — releases the photographer's survey-held fee */}
      <SatisfactionSurveySheet
        visible={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        onSubmit={submitSurvey}
        submitting={busy === 'completion'}
      />

      <Sheet
        visible={declineOpen}
        title={tr('b3_evdet_decline_booking')}
        subtitle={tr('b3_evdet_decline_hint')}
        onClose={() => setDeclineOpen(false)}
        busy={busy === 'decline'}
        footer={<Button title={tr('b3_evdet_submit_decline')} onPress={submitDecline} loading={busy === 'decline'} />}
      >
        <Input
          placeholder={tr('b3_evdet_decline_ph')}
          value={declineReason}
          onChangeText={setDeclineReason}
          multiline
          style={styles.commentInput}
        />
      </Sheet>

      {repostOpen && ev ? (
        <BookingModeSelector
          visible={repostOpen}
          existingEvent={{ id, title: ev.title, eventDate: ev.eventDate, startTime: ev.startTime, endTime: ev.endTime, city: ev.city, venue: ev.location }}
          onClose={() => { setRepostOpen(false); refresh?.(); }}
        />
      ) : null}
    </Screen>
  );
}

// ─── Presentational helpers ──────────────────────────────────────────────

const BOOKING_STEPS = ['Requested', 'Accepted', 'Deposit Paid', 'Event Day', 'Album Delivered', 'Photobook', 'Completed'];

function bookingStepIndex(ev?: EventItem | null): number {
  const s = (ev?.status ?? '').toUpperCase();
  const b = (ev?.bookingStatus ?? '').toUpperCase();
  if (s === 'COMPLETED') return 6;
  if (s === 'AWAITING_REVIEW') return 4;
  if (s === 'ONGOING' || s === 'IN_PROGRESS') return 3;
  if (b === 'ACCEPTED' || s === 'UPCOMING' || s === 'PUBLISHED' || s === 'PAUSED') return 1;
  return 0;
}

/**
 * `published` is a separate flag from the lifecycle status, and the list card
 * already surfaced it — the detail screen didn't, so the same event read
 * "PUBLISHED" in the list and "UPCOMING" on its own page.
 */
function heroStatus(s: string, published?: boolean): { label: string; bg: string; fg: string } {
  switch (s) {
    case 'ONGOING':
    case 'IN_PROGRESS':
      return { label: 'ONGOING', bg: '#DBEAFE', fg: '#1D4ED8' };
    case 'COMPLETED':
    case 'DONE':
      return { label: 'COMPLETED', bg: '#D1FAE5', fg: '#047857' };
    case 'AWAITING_REVIEW':
      return { label: 'AWAITING REVIEW', bg: '#FEF3C7', fg: '#92400E' };
    case 'CANCELLED':
    case 'CANCELED':
      return { label: 'CANCELLED', bg: '#FEE2E2', fg: '#B91C1C' };
    case 'PAUSED':
      return { label: 'PAUSED', bg: '#E5E7EB', fg: '#374151' };
    case 'MATCHES_AWAITING_SELECTION':
      return { label: 'CANDIDATES READY', bg: '#EDE9FE', fg: '#6D28D9' };
    case 'HYBRID_MATCHING':
      return { label: 'MATCHING ACTIVE', bg: '#E0F2FE', fg: '#0284C7' };
    case 'HYBRID_TIMEOUT':
      return { label: 'MATCH TIMEOUT', bg: '#FEF3C7', fg: '#B45309' };
    case 'PENDING':
    case 'PROPOSED':
      return { label: 'PENDING', bg: '#FEF3C7', fg: '#92400E' };
    default:
      return published
        ? { label: 'PUBLISHED', bg: '#CCFBF1', fg: '#0F766E' }
        : { label: 'NOT PUBLISHED', bg: '#FEF3C7', fg: '#92400E' };
  }
}

function fmtTime(t?: string): string {
  if (!t) return '';
  const hm = /^(\d{1,2}):(\d{2})/.exec(t);
  let h: number;
  let m: number;
  if (hm) {
    h = Number(hm[1]);
    m = Number(hm[2]);
  } else {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return '';
    h = d.getHours();
    m = d.getMinutes();
  }
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(amount?: number, currency?: string): string {
  if (amount == null || Number.isNaN(amount)) return '';
  return formatPrice(amount, currency);
}

function DetailCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

type BtnVariant = 'primary' | 'accent' | 'success' | 'outline' | 'danger' | 'dangerOutline';
/** Resolved per render: the module-level `colors` export is the light palette, so an outline button was a solid white slab in dark. */
function btnStyle(c: ReturnType<typeof useTheme>['colors'], variant: BtnVariant): { bg: string; fg: string; border?: string } {
  switch (variant) {
    case 'primary':
      return { bg: c.primary, fg: c.textOnPrimary };
    case 'accent':
      return { bg: c.accent, fg: '#fff' };
    case 'success':
      return { bg: '#047857', fg: '#fff' };
    case 'danger':
      return { bg: '#B91C1C', fg: '#fff' };
    case 'dangerOutline':
      // Quiet until pressed: a destructive action should not be the loudest thing in its card.
      return { bg: 'transparent', fg: c.error, border: c.error };
    default:
      return { bg: c.surface, fg: c.text, border: c.border };
  }
}

function PrimaryBtn({
  icon,
  label,
  variant,
  onPress,
  loading,
  full,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  variant: BtnVariant;
  onPress: () => void;
  loading?: boolean;
  full?: boolean;
}) {
  const styles = useStyles();
  const { colors: themed } = useTheme();
  const v = btnStyle(themed, variant);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg },
        full && { flexBasis: '100%' },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          <Ionicons name={icon} size={16} color={v.fg} />
          <Text style={[styles.btnText, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function InfoCard({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function KeyValue({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, accent && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: 'success' | 'warning' | 'muted' }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const map = {
    success: { bg: colors.successBg, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    muted: { bg: colors.surfaceMuted, fg: colors.textSoft },
  } as const;
  const c = map[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: c.fg }]} />
      <Text style={[styles.chipText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

function ProgressStepper({ currentIndex }: { currentIndex: number }) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepper}>
      {BOOKING_STEPS.map((label, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        return (
          <View key={label} style={styles.step}>
            <View style={styles.stepTop}>
              <View
                style={[
                  styles.stepCircle,
                  done && styles.stepCircleDone,
                  current && styles.stepCircleCurrent,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={styles.stepNum}>{i + 1}</Text>
                )}
              </View>
              {i < BOOKING_STEPS.length - 1 ? (
                <View style={[styles.stepLine, i < currentIndex && styles.stepLineDone]} />
              ) : null}
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]} numberOfLines={2}>
              {label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  titleWrap: { gap: 2 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5 },

  hero: {
    height: 210,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#0B1B34',
  },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroPills: { position: 'absolute', top: spacing.md, left: spacing.md, flexDirection: 'row', gap: 8 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  heroLive: { backgroundColor: '#8B5CF6' },
  heroPillText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.4 },

  desc: { fontFamily: fonts.regular, fontSize: 15, color: c.textSoft, lineHeight: 22 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  detailCard: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: c.surfaceMuted,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(8,58,133,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPanel: {
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 52 },
  detailRowRule: { borderTopWidth: 1, borderTopColor: c.borderSoft },
  detailRowText: { flex: 1, minWidth: 0 },
  detailRowLabel: { fontFamily: fonts.bold, fontSize: 11, color: c.textMuted, letterSpacing: 0.6 },
  detailRowValue: { fontFamily: fonts.bold, fontSize: 15, color: c.text, marginTop: 1 },
  detailLabel: { fontFamily: fonts.bold, fontSize: 10, color: c.accent, letterSpacing: 0.6 },
  detailValue: { fontFamily: fonts.bold, fontSize: 15, color: c.text, marginTop: 1 },

  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dangerZone: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSoft, gap: spacing.sm },
  dangerLabel: { color: c.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  btn: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 14 },

  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: c.text },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: { fontFamily: fonts.bold, fontSize: 18, color: '#fff' },
  personName: { fontFamily: fonts.bold, fontSize: 16, color: c.text, marginBottom: 4 },
  messagePersonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.primary,
  },
  messagePersonBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
    fontWeight: fontWeight.bold,
  },

  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kvLabel: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted },
  kvValue: { fontFamily: fonts.bold, fontSize: 15, color: c.text },

  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4 },

  infoLabel: { fontFamily: fonts.bold, fontSize: 11, color: c.accent, letterSpacing: 0.6 },
  infoValue: { fontFamily: fonts.bold, fontSize: 15, color: c.text, marginTop: 2 },

  // Stepper
  stepper: { paddingVertical: spacing.xs },
  step: { width: 92, alignItems: 'flex-start' },
  stepTop: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  stepCircleCurrent: { borderColor: c.primary },
  stepNum: { fontFamily: fonts.bold, fontSize: 13, color: c.textMuted },
  stepLine: { flex: 1, height: 2, backgroundColor: c.border, marginHorizontal: 2 },
  stepLineDone: { backgroundColor: '#10B981' },
  stepLabel: { fontFamily: fonts.regular, fontSize: 11, color: c.textMuted, marginTop: 6 },
  stepLabelDone: { fontFamily: fonts.bold, color: c.text },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  sheetHint: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
  commentInput: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  starRow: { alignItems: 'center', paddingVertical: spacing.sm },
  requestChanges: { alignItems: 'center', paddingVertical: spacing.md },
  requestChangesText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.accent },
}));
