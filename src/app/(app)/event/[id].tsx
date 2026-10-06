import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { StarInput } from '@/components/ui/Stars';
import { useRole } from '@/features/auth/role';
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
import { SatisfactionSurveySheet } from '@/features/events/SatisfactionSurveySheet';
import { submitSatisfactionSurvey, type SatisfactionSurvey } from '@/features/events/survey';
import { submitReview } from '@/features/reviews/api';
import { convertToHybridRescue, convertToDirectRescue } from '@/features/hybrid/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import type { EventItem } from '@/features/events/types';
import { useCurrency } from '@/store/currency';

const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';

export default function EventDetailScreen() {
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
  const [completionOpen, setCompletionOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
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
        'Add a cover photo first',
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
        'Assign a photographer first',
        'Events are published once a photographer is attached, so guests know who is covering it.',
      );
      return;
    }
    if (booking && booking !== 'ACCEPTED' && booking !== 'UNASSIGNED') {
      Alert.alert(
        'Waiting on the photographer',
        'This booking has not been accepted yet. Once the photographer accepts, you can publish the event.',
      );
      return;
    }
    Alert.alert(
      'Publish this event?',
      'It becomes visible to everyone on connekyt.com, and guests can find and join it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', onPress: () => run('publish', () => publishEvent(id, isCoordinator)) },
      ],
    );
  };

  const onUnpublish = () => {
    if (s === 'ONGOING' || isStreamLive) {
      Alert.alert(
        'The event is live',
        'Ask the photographer to end the stream before taking this event off connekyt.com.',
      );
      return;
    }
    Alert.alert(
      'Unpublish this event?',
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
            // Web takes a published event offline before deleting so it can't
            // linger on the public site.
            if (ev?.published) {
              await unpublishEvent(id, isCoordinator).catch(() => {});
            }
            await deleteEvent(id, isCoordinator);
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
      Alert.alert('Could not decline', isApiError(e) ? e.message : 'Please try again.');
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
        "The event hasn't started yet",
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
      'Event not published yet',
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
      Alert.alert('Changes requested', 'The photographer has been notified.');
    } catch (e) {
      Alert.alert('Could not submit', isApiError(e) ? e.message : 'Please try again.');
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
      Alert.alert('Could not submit', isApiError(e) ? e.message : 'Please try again.');
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
          <Text style={styles.eyebrow}>EVENT DETAILS</Text>
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
                <Text style={[styles.heroPillText, { color: '#fff' }]}>LIVE STREAM</Text>
              </View>
            ) : null}
          </View>
        </View>

        {ev?.description ? <Text style={styles.desc}>{ev.description}</Text> : null}

        {/* Detail grid */}
        <View style={styles.grid}>
          {ev?.eventDate ? <DetailCard icon="calendar" label="DATE" value={fmtShortDate(ev.eventDate)} /> : null}
          {ev?.startTime ? (
            <DetailCard
              icon="time"
              label="TIME"
              value={[fmtTime(ev.startTime), fmtTime(ev.endTime)].filter(Boolean).join(' - ')}
            />
          ) : null}
          {ev?.location ? <DetailCard icon="location" label="LOCATION" value={ev.location} /> : null}
          {ev?.clientName ? <DetailCard icon="person" label="CLIENT" value={ev.clientName} /> : null}
          {ev?.photographerName && !ev?.clientName ? (
            <DetailCard icon="camera" label="PHOTOGRAPHER" value={ev.photographerName} />
          ) : null}
          {ev?.packageName ? <DetailCard icon="cube" label="PACKAGE" value={ev.packageName} /> : null}
          {ev?.category ? <DetailCard icon="pricetag" label="EVENT TYPE" value={ev.category} /> : null}
          {ev?.maxGuests != null ? (
            <DetailCard icon="people" label="GUESTS" value={`${ev.guestCount ?? 0} / ${ev.maxGuests}`} />
          ) : null}
          {money ? <DetailCard icon="wallet" label="AMOUNT" value={money} /> : null}
        </View>

        {/* Primary actions — photographer */}
        {isPhotog && isPending ? (
          <View style={styles.btnRow}>
            <PrimaryBtn icon="checkmark-circle" label="Accept" variant="success" full onPress={onAcceptBooking} loading={busy === 'accept'} />
            <PrimaryBtn icon="close-circle" label="Decline" variant="danger" full onPress={() => setDeclineOpen(true)} loading={busy === 'decline'} />
          </View>
        ) : null}
        {isPhotog && !isPending ? (
          <View style={styles.btnRow}>
            {canCreateAlbum ? (
              <PrimaryBtn icon="add-circle" label="Create Album" variant="primary" onPress={onPhotographerCreateAlbum} />
            ) : null}
            {canGoLive ? (
              <PrimaryBtn icon="radio" label="Live Stream" variant="accent" onPress={onPhotographerGoLive} />
            ) : null}
            <PrimaryBtn icon="share-social" label="Share" variant="outline" onPress={onShare} />
            {canMarkComplete ? (
              <PrimaryBtn icon="checkmark-done" label="Mark Complete" variant="success" onPress={onPhotographerMarkCompleted} loading={busy === 'photog-complete'} />
            ) : null}
          </View>
        ) : null}

        {/* Booking progress */}
        {(isPhotog || ownsEvents) && !ev?.status?.toUpperCase().includes('CANCEL') ? (
          <InfoCard icon="git-commit-outline" title="Booking Progress">
            <ProgressStepper currentIndex={bookingStepIndex(ev)} />
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
            </View>
          </InfoCard>
        ) : ev?.status?.toUpperCase() === 'HYBRID_TIMEOUT' ? (
          <InfoCard icon="warning-outline" title="Matching Concluded — Direct Booking Rescue">
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#D97706', fontWeight: fontWeight.bold }}>
                  MATCH WINDOW EXPIRED (0 CONFIRMED CREATORS)
                </Text>
              </View>
              <Text style={styles.desc}>
                The matching window concluded without an accepted photographer. You can instantly switch to Direct Booking to browse and select available creators nearby on our interactive map.
              </Text>
              <View style={{ gap: 8 }}>
                <PrimaryBtn
                  icon="map-outline"
                  label="Browse Nearby on Map"
                  variant="primary"
                  onPress={() => {
                    const lat = ev.latitude ?? -1.9536;
                    const lng = ev.longitude ?? 30.0606;
                    const date = ev.eventDate ? `&eventDate=${encodeURIComponent(ev.eventDate)}` : '';
                    router.push(`/map?lat=${lat}&lng=${lng}${date}&radiusKm=25` as never);
                  }}
                />
                <PrimaryBtn
                  icon="list-outline"
                  label="Browse All Photographers"
                  variant="outline"
                  onPress={() => router.push('/(app)/(tabs)/photographers' as never)}
                />
                <PrimaryBtn
                  icon="refresh-outline"
                  label="Retry Hybrid Matching"
                  variant="outline"
                  loading={busy === 'retry-hybrid'}
                  onPress={() => run('retry-hybrid', async () => {
                    await convertToHybridRescue(id);
                    Alert.alert('Matching Reactivated! 🚀', 'Your event brief has been broadcast to local photographers.');
                  })}
                />
              </View>
            </View>
          </InfoCard>
        ) : ev?.status?.toUpperCase() === 'MATCHES_AWAITING_SELECTION' && ownsEvents ? (
          <InfoCard icon="people-outline" title="Candidates Ready for Selection! 🎯">
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#6D28D9', fontWeight: fontWeight.bold }}>
                  CREATORS ACCEPTED YOUR BRIEF
                </Text>
              </View>
              <Text style={styles.desc}>
                Verified local creators have accepted your brief. Compare their ratings, verified badges, and packages to select your photographer and lock your date.
              </Text>
              <PrimaryBtn
                icon="checkmark-circle-outline"
                label="Review & Select Photographer"
                variant="primary"
                onPress={() => router.push(`/event/candidates?id=${id}` as never)}
              />
            </View>
          </InfoCard>
        ) : ownsEvents ? (
          <InfoCard icon="people-outline" title="Photographer Matching Active">
            <View style={{ gap: 10 }}>
              <Text style={styles.desc}>
                Matching is active. Verified local photographers are reviewing your brief.
              </Text>
              <PrimaryBtn
                icon="list-outline"
                label="View Candidates & Select"
                variant="primary"
                onPress={() => router.push(`/event/candidates?id=${id}` as never)}
              />
            </View>
          </InfoCard>
        ) : null}

        {(ev?.packageName || money) ? (
          <InfoCard icon="cube-outline" title="Booking Details">
            {ev?.packageName ? <KeyValue label="Package" value={ev.packageName} /> : null}
            {money ? <KeyValue label="Price" value={money} accent /> : null}
          </InfoCard>
        ) : null}

        {/* Completion status */}
        {ev?.completionStatus ? (
          <InfoCard icon="checkmark-circle-outline" title="Completion Status">
            <Chip
              label={ev.completionStatus.replace(/_/g, ' ')}
              tone={ev.completionStatus.toUpperCase() === 'COMPLETED' ? 'success' : 'muted'}
            />
          </InfoCard>
        ) : null}

        {/* Event information */}
        {ev?.eventVisibility ? (
          <InfoCard icon="information-circle-outline" title="Event Information">
            <Text style={styles.infoLabel}>VISIBILITY</Text>
            <Text style={styles.infoValue}>
              {ev.eventVisibility.charAt(0).toUpperCase() + ev.eventVisibility.slice(1).toLowerCase()}
            </Text>
          </InfoCard>
        ) : null}

        {/* Manage (owner only) */}
        {ownsEvents ? (
          <InfoCard icon="settings-outline" title="Manage">
            <View style={styles.btnRow}>
              <PrimaryBtn
                icon={ev?.published ? 'eye-off-outline' : 'megaphone-outline'}
                label={ev?.published ? 'Unpublish' : 'Publish'}
                variant={ev?.published ? 'outline' : 'primary'}
                onPress={ev?.published ? onUnpublish : onPublish}
                loading={busy === 'publish'}
              />
              <PrimaryBtn icon="create-outline" label="Edit" variant="outline" onPress={() => router.push(`/event/new?editId=${id}`)} />
              <PrimaryBtn icon="earth-outline" label="Geo pricing" variant="outline" onPress={() => router.push(`/event/geo-pricing?eventId=${id}` as never)} />
              <PrimaryBtn icon="share-social-outline" label="Share" variant="outline" onPress={onShare} />
              {ownerCanGoLive ? (
                <PrimaryBtn icon="radio" label="Go Live" variant="accent" onPress={openStreamControl} />
              ) : null}
              {s === 'PAUSED' ? (
                <PrimaryBtn icon="play-circle-outline" label="Resume" variant="outline" onPress={onResume} loading={busy === 'resume'} />
              ) : ev?.streamStatus === 'ended' ? (
                <PrimaryBtn icon="refresh-circle-outline" label="Reset Stream" variant="outline" onPress={openStreamControl} />
              ) : canPause ? (
                <PrimaryBtn icon="pause-circle-outline" label="Pause" variant="outline" onPress={onPause} loading={busy === 'pause'} />
              ) : null}
              {canConfirmDone ? (
                <PrimaryBtn
                  icon="checkmark-done"
                  label="Confirm Done"
                  variant="success"
                  onPress={() => setCompletionOpen(true)}
                />
              ) : awaitingConfirmation ? (
                <PrimaryBtn
                  icon="hourglass-outline"
                  label="Awaiting album"
                  variant="outline"
                  onPress={() =>
                    Alert.alert(
                      'Waiting for album delivery',
                      'Once the photographer delivers your album you can confirm the event and release their final payment.',
                    )
                  }
                />
              ) : null}
              {ev?.photographerName ? (
                <PrimaryBtn icon="star-outline" label="Rate" variant="outline" onPress={() => setReviewOpen(true)} />
              ) : null}
              {canDelete ? (
                <PrimaryBtn icon="trash-outline" label="Delete" variant="danger" onPress={onDelete} loading={busy === 'delete'} />
              ) : null}
            </View>
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
              Confirm the event went ahead, or request changes if something needs fixing. Confirming
              asks you a few quick questions, and that is what releases the photographer&apos;s final
              payment.
            </Text>
            <Input
              placeholder="Add a comment (optional)"
              value={comment}
              onChangeText={setComment}
              multiline
              style={styles.commentInput}
            />
            <Button title="Continue to questions" onPress={() => submitCompletion('COMPLETED')} loading={busy === 'completion'} />
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

      {/* Satisfaction survey — releases the photographer's survey-held fee */}
      <SatisfactionSurveySheet
        visible={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        onSubmit={submitSurvey}
        submitting={busy === 'completion'}
      />

      {/* Decline-booking reason sheet — Photographer side */}
      <Modal
        visible={declineOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDeclineOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setDeclineOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Decline booking</Text>
            <Text style={styles.sheetHint}>
              Share a short reason so the client knows why you're not taking this on.
            </Text>
            <Input
              placeholder="e.g. Schedule conflict, location too far, etc."
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              style={styles.commentInput}
            />
            <Button title="Submit decline" onPress={submitDecline} loading={busy === 'decline'} />
          </Pressable>
        </Pressable>
      </Modal>

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

type BtnVariant = 'primary' | 'accent' | 'success' | 'outline' | 'danger';
const BTN_STYLES: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: '#fff' },
  accent: { bg: colors.accent, fg: '#fff' },
  success: { bg: '#10B981', fg: '#fff' },
  danger: { bg: '#EF4444', fg: '#fff' },
  outline: { bg: colors.surface, fg: colors.text, border: colors.border },
};

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
  const v = BTN_STYLES[variant];
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
    success: { bg: '#D1FAE5', fg: '#047857' },
    warning: { bg: '#FEF3C7', fg: '#92400E' },
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
  detailLabel: { fontFamily: fonts.bold, fontSize: 10, color: c.accent, letterSpacing: 0.6 },
  detailValue: { fontFamily: fonts.bold, fontSize: 15, color: c.text, marginTop: 1 },

  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
