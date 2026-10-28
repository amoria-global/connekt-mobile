/**
 * Host an event: the photographer's fast path to going live. Title, cover, Free or Paid, then
 * "Publish and go live". Description, place and end time are always shown below the date.
 *
 * The server decides who may host (flag, photographer account, verification for paid) and this screen
 * only reads that answer. Success is shown only after the server has confirmed create, cover and publish;
 * a failure part-way keeps the event it already made and retries from the failed step, so a second tap
 * never makes a second event.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button, PrimaryButton } from '@/components/ui/Button';
import { InsetField } from '@/components/ui/Input';
import { DateField } from '@/components/ui/DateField';
import { TimeField } from '@/components/ui/TimeField';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Segmented } from '@/components/ui/Segmented';
import { useAsync } from '@/hooks/useAsync';
import { publishEvent, uploadEventPhoto } from '@/features/events/api';
import { listCurrencies } from '@/features/reference/api';
import { pickFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { useSharedT } from '@/i18n/sharedStrings';
import { WishInvitesField } from '@/features/wishes/WishInvitesField';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import {
  createHostedEvent,
  getEarningsPreview,
  getHostingEligibility,
  type EarningsPreview,
  type HostedEventInput,
  type HostingEligibility,
} from './api';
import { runHostFlow, validateHostForm, type HostFormErrors, type HostProgress } from './hostFlow';

const CURRENCY_ORDER = ['RWF', 'USD', 'EUR', 'KES'];

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function NotAvailable({ eligibility }: { eligibility: HostingEligibility }) {
  const message =
    eligibility.reason === 'NOT_A_PHOTOGRAPHER'
      ? 'Hosting your own events is for photographer accounts.'
      : 'Hosting your own events is not available yet. We will let you know when it is.';
  return <EmptyState icon="videocam-off-outline" title="Hosting is not available" message={message} />;
}

export default function HostEventScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const router = useRouter();

  const eligibility = useAsync(getHostingEligibility);
  const currencies = useAsync(useCallback(() => listCurrencies(), []));

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [currencyCode, setCurrencyCode] = useState('RWF');
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [wishInvites, setWishInvites] = useState<boolean | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const wishInvitesY = useRef(0);

  const [errors, setErrors] = useState<HostFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const progress = useRef<HostProgress>({});

  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<(EarningsPreview & { fee: number }) | null>(null);
  const [previewFailedFor, setPreviewFailedFor] = useState<number | null>(null);

  const currencyList = useMemo(() => {
    const all = currencies.data ?? [];
    const ranked = [...all].sort((a, b) => {
      const ia = CURRENCY_ORDER.indexOf(a.code);
      const ib = CURRENCY_ORDER.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return ranked.slice(0, 4);
  }, [currencies.data]);

  // The commission preview comes from the server, never from the app.
  useEffect(() => {
    const n = Number(price);
    if (!paid || !Number.isFinite(n) || n <= 0) return;
    let cancelled = false;
    const t = setTimeout(() => {
      getEarningsPreview(n)
        .then((p) => {
          if (!cancelled) setPreview({ ...p, fee: n });
        })
        .catch(() => {
          if (!cancelled) setPreviewFailedFor(n);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [paid, price]);

  const pickCover = async () => {
    const img = await pickFromLibrary();
    if (img) {
      setCover(img);
      setErrors((e) => ({ ...e, cover: undefined }));
    }
  };

  const submit = async (goLive: boolean) => {
    if (inFlight.current) return;
    const found = validateHostForm({ title, date, startTime, paid, price, allowWishInvites: wishInvites }, !!cover, todayYmd());
    setErrors(found);
    if (Object.keys(found).length > 0 || !cover) {
      // The choice has no default, so a missing one is the likeliest reason to stop: bring the field into view.
      if (found.wishInvites && !found.cover && !found.title && !found.price) {
        scrollRef.current?.scrollTo({ y: Math.max(wishInvitesY.current - 12, 0), animated: true });
      }
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const currencyId = currencyList.find((c) => c.code === currencyCode)?.id;
      const input: HostedEventInput = {
        title: title.trim(),
        eventDate: date,
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        streamFee: paid ? Number(price) : undefined,
        streamFeeCurrencyId: paid ? currencyId : undefined,
        allowWishInvites: wishInvites === true,
      };
      const result = await runHostFlow(
        {
          create: createHostedEvent,
          uploadCover: (id, image) => uploadEventPhoto(id, image, false),
          publish: (id) => publishEvent(id, false),
        },
        input,
        cover,
        progress.current,
      );
      progress.current = result.progress;
      setSaved(!!result.progress.eventId);
      if (result.status === 'failed') {
        setFailure(
          result.step === 'create'
            ? result.message
            : `${result.message} Your event is saved. Tap again to continue where it stopped.`,
        );
        return;
      }
      router.replace((goLive ? `/stream/control/${result.eventId}` : '/host') as Href);
    } catch (e) {
      setFailure(isApiError(e) ? e.message : 'Something went wrong. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (eligibility.loading && !eligibility.data) {
    return (
      <Screen edges={[]}>
        <SkeletonList rows={4} accessibilityLabel="Checking if you can host" />
      </Screen>
    );
  }
  if (eligibility.error && !eligibility.data) {
    return (
      <Screen edges={[]}>
        <ErrorState message={eligibility.error} onRetry={eligibility.refresh} />
      </Screen>
    );
  }
  const elig = eligibility.data;
  if (!elig || !elig.canHostFree) {
    return (
      <Screen edges={[]}>
        <NotAvailable eligibility={elig ?? { enabled: false, canHostFree: false, canHostPaid: false, reason: 'HOSTING_DISABLED' }} />
      </Screen>
    );
  }

  const paidLocked = !elig.canHostPaid;
  const priceNow = Number(price);
  const livePreview = paid && preview && preview.fee === priceNow ? preview : null;
  const previewFailed = paid && previewFailedFor === priceNow && priceNow > 0;

  return (
    <Screen edges={[]}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>{tr('Create your event, then go live. Viewers can find it on the Events page.')}</Text>

        <Pressable
          onPress={pickCover}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={cover ? 'Change cover photo' : 'Add a cover photo'}
          style={[styles.cover, !!errors.cover && { borderColor: colors.error }]}
        >
          {cover ? (
            <Image source={{ uri: cover.uri }} style={styles.coverImg} contentFit="cover" />
          ) : (
            <View style={styles.coverEmpty}>
              <Ionicons name="image-outline" size={28} color={colors.primary} />
              <Text style={styles.coverHint}>{tr('Add a cover photo')}</Text>
            </View>
          )}
        </Pressable>
        {errors.cover ? <Text style={[styles.err, { color: colors.error }]}>{errors.cover}</Text> : null}

        <InsetField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Friday night live set"
          editable={!busy}
          error={errors.title}
          maxLength={120}
        />

        <View style={styles.group}>
          <Text style={styles.label}>{tr('Ticket')}</Text>
          <Segmented
            value={paid ? 'paid' : 'free'}
            options={[
              { value: 'free', label: 'Free' },
              { value: 'paid', label: 'Paid' },
            ]}
            onChange={(v) => {
              if (v === 'paid' && paidLocked) return;
              setPaid(v === 'paid');
            }}
          />
          {paidLocked ? (
            <View style={styles.notice}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
              <View style={styles.noticeText}>
                <Text style={styles.noticeBody}>
                  {tr('Paid events need your identity verification to be approved first. Free events are open to you now.')}
                </Text>
                <Pressable onPress={() => router.push('/kyc' as Href)} accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.noticeLink}>{tr('Verify my identity')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {paid ? (
          <View style={styles.group}>
            <InsetField
              label="Price"
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 5000"
              keyboardType="decimal-pad"
              editable={!busy}
              error={errors.price}
            />
            {currencyList.length > 0 ? (
              <View style={styles.chips} accessibilityRole="radiogroup">
                {currencyList.map((c) => {
                  const on = c.code === currencyCode;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCurrencyCode(c.code)}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.code}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {livePreview ? (
              <Text style={styles.preview}>
                {`You keep ${livePreview.hostPercent}% of each ticket, about ${currencyCode} ${Math.round(livePreview.hostEarnsPerTicket).toLocaleString()}. The platform keeps ${livePreview.platformPercent}%.`}
              </Text>
            ) : previewFailed ? (
              <Text style={styles.previewMuted}>{tr('Could not load your earnings preview.')}</Text>
            ) : null}
          </View>
        ) : null}

        <WishInvitesField
          value={wishInvites}
          disabled={busy}
          error={errors.wishInvites}
          onLayout={(e: LayoutChangeEvent) => {
            wishInvitesY.current = e.nativeEvent.layout.y;
          }}
          onChange={(v) => {
            setWishInvites(v);
            setErrors((x) => ({ ...x, wishInvites: undefined }));
          }}
        />

        <DateField label="Date" value={date} onChange={setDate} error={errors.date} minimumDate={new Date()} />
        <TimeField label="Start time (optional)" value={startTime} onChange={setStartTime} error={errors.startTime} />

        <TimeField label="End time" value={endTime} onChange={setEndTime} />
        <InsetField label="Where" value={location} onChangeText={setLocation} placeholder="Place or online" editable={!busy} />
        <InsetField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What will you stream?"
          multiline
          editable={!busy}
        />

        <View style={styles.notice}>
          <Ionicons name="videocam-outline" size={18} color={colors.primary} />
          <Text style={styles.noticeBody}>
            {tr('When you go live your phone will ask for camera and microphone access. A steady connection keeps the stream smooth.')}
          </Text>
        </View>

      </ScrollView>
      {/* Pinned, so the main action is always on screen however long the form grows. */}
      <View style={styles.footer}>
        {failure ? (
          <Text style={[styles.err, { color: colors.error }]} accessibilityRole="alert">
            {failure}
          </Text>
        ) : null}
        <PrimaryButton
          title={busy ? 'Working...' : failure && saved ? 'Try again' : 'Publish and go live'}
          loading={busy}
          disabled={busy}
          onPress={() => void submit(true)}
        />
        <Button title="Publish and schedule for later" variant="accent" disabled={busy} onPress={() => void submit(false)} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.md },
  scroll: { flex: 1 },
  lead: { color: c.textSoft, fontSize: 14 },
  group: { gap: spacing.sm },
  label: { color: c.textSoft, fontSize: 13, fontWeight: '600' },
  cover: {
    height: 160,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  coverHint: { color: c.textMuted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: { borderColor: c.primary, backgroundColor: c.tint },
  chipText: { color: c.textSoft, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: c.primary },
  preview: { color: c.text, fontSize: 13, lineHeight: 18 },
  previewMuted: { color: c.textMuted, fontSize: 12 },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  noticeText: { flex: 1, gap: spacing.xs },
  noticeBody: { flex: 1, color: c.textSoft, fontSize: 13, lineHeight: 18 },
  noticeLink: { color: c.primary, fontSize: 13, fontWeight: '700' },
  err: { fontSize: 13 },
}));
