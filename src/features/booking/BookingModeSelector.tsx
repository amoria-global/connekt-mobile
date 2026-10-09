/**
 * BookingModeSelector: the fork at the top of booking, and the Post My Event
 * wizard behind it.
 *
 *   Find a Photographer (Direct)  browse and book directly.
 *   Post My Event (Matched)       describe the event, available photographers
 *                                 who fit say yes, pick one.
 *
 * Mirrors the web dashboard: the same names, colours, steps and choices, all
 * from GET /public/hybrid/options. Every answer is a choice from a list except
 * the event name, the venue and optional notes. The live count is the
 * server's, from the same engine that sends the alerts.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { createMatchRequest, getHybridOptions, getMatchPreview } from '@/features/hybrid/api';
import type { HybridOptions, LocationCoverage, MatchPreviewResult, PhotographerType } from '@/features/hybrid/types';
import {
  Chip, MODE_META, OptionCard, budgetLabel, durationBetween, durationText,
} from '@/features/hybrid/hybridUi';
import { createEvent } from '@/features/events/api';
import { useRole } from '@/features/auth/role';
import { useAuth, isApiError } from '@/store/auth';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

export type BookingStep = 'select' | 1 | 2 | 3;

export type ExistingHybridEvent = {
  id: string;
  title?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  city?: string;
  venue?: string;
};

export type BookingModeSelectorProps = {
  visible: boolean;
  onClose: () => void;
  /** Optional custom navigation callback */
  onSelectDirect?: () => void;
  onSelectHybrid?: () => void;
  /** Initial step when sheet mounts (defaults to 'select') */
  initialStep?: BookingStep;
  /** Post an existing event (a Direct one, or one whose matching ended) instead of creating one. */
  existingEvent?: ExistingHybridEvent | null;
  /** Called after posting, before navigating to the answers screen. */
  onPosted?: (eventId: string) => void;
};

type Step = BookingStep | 'done';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (iso: string) => {
  const t = Date.parse(`${iso}T00:00:00`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : iso;
};
function nextWeekday(weekday: number, weeksAhead = 0): Date {
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + weeksAhead * 7);
  return d;
}
function timeSlots(step: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

export function BookingModeSelector({
  visible,
  onClose,
  onSelectDirect,
  onSelectHybrid,
  initialStep = 'select',
  existingEvent,
  onPosted,
}: BookingModeSelectorProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isCoordinator } = useRole();
  const user = useAuth((s) => s.user);

  const [step, setStep] = useState<Step>(initialStep);
  const [options, setOptions] = useState<HybridOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Step 1
  const [eventTypeId, setEventTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('22:00');
  const [city, setCity] = useState('Kigali');
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [listSheet, setListSheet] = useState<null | 'start' | 'end' | 'city'>(null);

  // Step 2
  const [photographerType, setPhotographerType] = useState<PhotographerType>('ANY');
  const [budgetIndex, setBudgetIndex] = useState(1);
  const [specialty, setSpecialty] = useState('ANY');
  const [coverage, setCoverage] = useState<LocationCoverage>('SAME_CITY');
  const [windowHours, setWindowHours] = useState(24);

  const [preview, setPreview] = useState<MatchPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; invited: number; status?: string } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep(existingEvent ? 2 : initialStep);
    setError(null);
    setResult(null);
    setCreatedEventId(existingEvent?.id ?? null);
    if (existingEvent) {
      if (existingEvent.title) setTitle(existingEvent.title);
      if (existingEvent.eventDate) setDate(existingEvent.eventDate.slice(0, 10));
      if (existingEvent.startTime) setStartTime(existingEvent.startTime.slice(0, 5));
      if (existingEvent.endTime) setEndTime(existingEvent.endTime.slice(0, 5));
      if (existingEvent.city) setCity(existingEvent.city);
      if (existingEvent.venue) setVenue(existingEvent.venue);
    }
    getHybridOptions()
      .then((o) => { setOptions(o); setWindowHours(o.defaultMatchWindowHours); setOptionsError(null); })
      .catch((e) => setOptionsError(isApiError(e) ? e.message : 'Could not load the event options.'));
  }, [visible, initialStep, existingEvent]);

  const eventType = options?.eventTypes.find((t) => t.id === eventTypeId);
  const cityInfo = options?.cities.find((c) => c.name === city);
  const minutes = durationBetween(startTime, endTime);
  const overnight = endTime <= startTime;
  const slots = useMemo(() => timeSlots(options?.timeStepMinutes || 30), [options]);
  const preset = options?.budgetPresets[budgetIndex];

  const fetchPreview = useCallback(async () => {
    if (!date) return;
    setPreviewLoading(true);
    try {
      const res = await getMatchPreview({
        eventDate: date,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        city,
        latitude: cityInfo?.latitude,
        longitude: cityInfo?.longitude,
        minBudget: preset?.min ?? undefined,
        maxBudget: preset?.max ?? undefined,
        currency: 'RWF',
        photographerType,
        specialty: eventType?.name,
        photographerSpecialty: specialty,
        locationCoverage: coverage,
        eventId: existingEvent?.id,
      });
      setPreview(res);
      setPreviewFailed(false);
    } catch {
      setPreview(null);
      setPreviewFailed(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [date, startTime, endTime, city, cityInfo, preset, photographerType, eventType, specialty, coverage, existingEvent]);

  useEffect(() => {
    if (!visible || (step !== 2 && step !== 3)) return;
    const t = setTimeout(fetchPreview, 400);
    return () => clearTimeout(t);
  }, [visible, step, fetchPreview]);

  const close = () => {
    onClose();
  };

  const goDirect = () => {
    close();
    setTimeout(() => (onSelectDirect ? onSelectDirect() : router.push('/photographers' as never)), 150);
  };

  const goHybrid = () => {
    if (onSelectHybrid) {
      close();
      setTimeout(onSelectHybrid, 150);
    } else {
      setStep(1);
    }
  };

  const validate1 = (): string | null => {
    if (!eventTypeId) return 'Choose the type of event.';
    if (!title.trim()) return 'Give your event a name.';
    if (!date) return 'Choose the event date.';
    const today = isoDate(new Date());
    if (date < today) return 'That date has passed. Choose a future date.';
    if (date === today) {
      const now = new Date();
      if (startTime <= `${pad(now.getHours())}:${pad(now.getMinutes())}`) return 'That start time has passed. Choose a later time.';
    }
    if (!venue.trim()) return 'Add the venue or address so photographers know where to go.';
    return null;
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      const e = validate1();
      if (e) return setError(e);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const back = () => {
    setError(null);
    if (step === 1) setStep('select');
    else if (step === 2 && !existingEvent) setStep(1);
    else if (step === 3) setStep(2);
  };

  const publish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let eventId = createdEventId;
      if (!eventId) {
        const ev = await createEvent(
          {
            title: title.trim(),
            category: eventType?.name || 'Event',
            eventCategoryId: eventTypeId || undefined,
            eventDate: date,
            startTime,
            endTime,
            location: [venue.trim(), city, options?.country].filter(Boolean).join(', '),
            description: notes.trim() || undefined,
            organizer: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.organizationName || 'Organizer',
            // Kept off public listings until a photographer is assigned.
            eventVisibility: 'PRIVATE',
          },
          isCoordinator,
        );
        eventId = ev.id;
        setCreatedEventId(eventId);
      }
      let posted;
      try {
        posted = await createMatchRequest(eventId, {
          minBudget: preset?.min ?? undefined,
          maxBudget: preset?.max ?? undefined,
          currency: 'RWF',
          photographerType,
          specialty: eventType?.name,
          photographerSpecialty: specialty,
          locationCoverage: coverage,
          expirationHours: windowHours,
          instructions: notes.trim() || undefined,
          city,
          country: options?.country,
          venue: venue.trim() || undefined,
          latitude: cityInfo?.latitude,
          longitude: cityInfo?.longitude,
        });
      } catch (e) {
        throw { message: `Your event was saved, but photographers weren't alerted: ${isApiError(e) ? e.message : 'please try again'}. Tap Post again to retry.` };
      }
      setResult({ eventId, invited: posted?.invitedCount ?? 0, status: posted?.status });
      setStep('done');
      onPosted?.(eventId);
    } catch (e: any) {
      setError(e?.message || 'Could not post your event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    const id = result?.eventId;
    close();
    if (id && result?.invited) setTimeout(() => router.push(`/event/candidates?id=${id}` as never), 200);
  };

  const accent = MODE_META.HYBRID.color;
  const count = preview?.matchCount;
  const zero = count === 0 && !previewLoading;

  // ───────── pieces ─────────

  const Label = ({ text, hint, required }: { text: string; hint?: string; required?: boolean }) => (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.label}>{text}{required ? <Text style={{ color: accent }}> *</Text> : null}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );

  const SelectButton = ({ value, onPress, icon, a11y }: { value: string; onPress: () => void; icon: keyof typeof Ionicons.glyphMap; a11y: string }) => (
    <Pressable onPress={onPress} style={styles.select} accessibilityRole="button" accessibilityLabel={a11y}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.selectText} numberOfLines={1}>{value}</Text>
      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
    </Pressable>
  );

  const MatchPanel = (
    <View style={[styles.matchPanel, zero && { borderColor: '#F59E0B', backgroundColor: colors.warningBg }]} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ minWidth: 48, alignItems: 'center' }}>
          {previewLoading ? <ActivityIndicator color={colors.primary} /> : (
            <Text style={[styles.matchCount, zero && { color: '#B45309' }]}>{count ?? '–'}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle}>
            {previewFailed ? "Couldn't count photographers right now" : count === 1 ? 'photographer fits right now' : 'photographers fit right now'}
          </Text>
          <Text style={styles.hint}>
            {previewFailed ? 'You can still continue; we check again when you post.' : `Free for the whole ${durationText(minutes) || 'event'}. Checked again when you post.`}
          </Text>
        </View>
      </View>
      {preview?.breakdown && !previewLoading ? (
        <View style={{ marginTop: spacing.sm, gap: 4 }}>
          {([
            [preview.breakdown.availableForFullEvent, `free for the full ${durationText(minutes) || 'event'}`],
            [preview.breakdown.typeMatched, photographerType === 'ANY' ? 'of any type' : photographerType === 'STUDIO' ? 'are studios' : 'are freelancers'],
            [preview.breakdown.withinBudget, preset?.min == null && preset?.max == null ? 'any budget' : 'fit your budget'],
            [preview.breakdown.inCoverage, coverage === 'ANY' ? 'anywhere in Rwanda' : `around ${city}`],
            ...(specialty !== 'ANY' ? [[preview.breakdown.specialtyMatched, `${specialty} specialists`]] : []),
          ] as [number | undefined, string][]).map(([n, l]) => (
            <Text key={l} style={styles.breakdown}>
              <Ionicons name="checkmark-circle" size={13} color="#10B981" /> <Text style={{ fontWeight: fontWeight.bold, color: colors.text }}>{n ?? 0}</Text> {l}
            </Text>
          ))}
          {preview.breakdown.nearbyFallback ? <Text style={styles.breakdown}>Nobody is free in {city}, so nearby cities are included.</Text> : null}
        </View>
      ) : null}
      {zero && options ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[styles.label, { marginBottom: spacing.sm }]}>Try widening your request:</Text>
          <View style={styles.wrap}>
            {coverage !== 'ANY' && <Chip selected={false} icon="location-outline" label={coverage === 'SAME_CITY' ? 'Include nearby cities' : 'Anywhere in Rwanda'} onPress={() => setCoverage(coverage === 'SAME_CITY' ? 'NEARBY_CITY' : 'ANY')} />}
            {photographerType !== 'ANY' && <Chip selected={false} icon="people-outline" label="Any type" onPress={() => setPhotographerType('ANY')} />}
            {specialty !== 'ANY' && <Chip selected={false} icon="camera-outline" label="Any specialty" onPress={() => setSpecialty('ANY')} />}
            {(preset?.min != null || preset?.max != null) && <Chip selected={false} icon="cash-outline" label="Flexible budget" onPress={() => setBudgetIndex(options.budgetPresets.length - 1)} />}
          </View>
        </View>
      ) : null}
    </View>
  );

  // ───────── body ─────────

  let body: React.ReactNode = null;
  if (step === 'select') {
    body = (
      <View style={{ gap: spacing.md }}>
        <Text style={styles.subtitle}>Two ways in. Both end in the same secure booking and payment.</Text>
        {(['DIRECT', 'HYBRID'] as const).map((mode) => {
          const m = MODE_META[mode];
          const steps = mode === 'DIRECT'
            ? ['Browse photographers and their packages', 'Send a request to the one you like', 'They accept, you pay, you are booked']
            : ['Describe your event, time and budget', 'Matching, available photographers are alerted', 'Pick from the ones who said yes'];
          return (
            <Pressable key={mode} onPress={mode === 'DIRECT' ? goDirect : goHybrid} accessibilityRole="button" accessibilityLabel={`${m.label}. ${m.line}`}
              style={({ pressed }) => [styles.modeCard, { borderColor: `${m.color}55` }, pressed && { borderColor: m.color, opacity: 0.95 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={[styles.modeIcon, { backgroundColor: m.soft }]}><Ionicons name={m.icon} size={22} color={m.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eyebrow, { color: m.color }]}>{m.short.toUpperCase()}</Text>
                  <Text style={styles.modeTitle}>{m.label}</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={28} color={m.color} />
              </View>
              <Text style={styles.modeLine}>{m.line}</Text>
              {steps.map((s, i) => (
                <View key={s} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <View style={[styles.stepDot, { backgroundColor: m.soft }]}><Text style={[styles.stepDotText, { color: m.color }]}>{i + 1}</Text></View>
                  <Text style={styles.modeStep}>{s}</Text>
                </View>
              ))}
              <Text style={styles.hint}>
                <Text style={{ fontWeight: fontWeight.bold }}>Best when: </Text>
                {mode === 'DIRECT' ? 'you already know who you want, or want to compare portfolios yourself.' : 'you want the best available photographer near you without searching.'}
              </Text>
            </Pressable>
          );
        })}
        <Text style={[styles.hint, { textAlign: 'center' }]}>Either way you pay 50%, 70% or 100% upfront, held by Connekyt until your photos are delivered.</Text>
      </View>
    );
  } else if (!options && !optionsError) {
    body = <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  } else if (optionsError) {
    body = <Text style={styles.error}>{optionsError}</Text>;
  } else if (options && !options.enabled) {
    body = <Text style={styles.hint}>Post My Event is paused right now. Use Find a Photographer to book directly.</Text>;
  } else if (step === 1 && options) {
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return isoDate(d); })();
    const sat = isoDate(nextWeekday(6));
    const nextSat = isoDate(nextWeekday(6, 1));
    body = (
      <View style={{ gap: spacing.lg }}>
        <View>
          <Label text="What kind of event is it?" required />
          <View style={styles.wrap}>
            {options.eventTypes.map((t) => <Chip key={t.id} selected={eventTypeId === t.id} label={t.name} onPress={() => setEventTypeId(t.id)} />)}
          </View>
        </View>
        <View>
          <Label text="Event name" hint="What guests and photographers will see." required />
          <TextInput value={title} onChangeText={setTitle} maxLength={120} style={styles.input} placeholderTextColor={colors.textMuted}
            placeholder={eventType ? `e.g. ${eventType.name} celebration` : 'e.g. Birthday Celebration'} returnKeyType="done" />
          {eventType && !title ? (
            <View style={[styles.wrap, { marginTop: spacing.sm }]}>
              {[`${eventType.name} celebration`, `${eventType.name} party`, `Our ${eventType.name.toLowerCase()}`].map((s) => (
                <Chip key={s} selected={false} icon="flash-outline" label={s} onPress={() => setTitle(s)} />
              ))}
            </View>
          ) : null}
        </View>
        <View>
          <Label text="When is it?" required />
          <View style={styles.wrap}>
            <Chip selected={date === tomorrow} label="Tomorrow" onPress={() => setDate(tomorrow)} />
            <Chip selected={date === sat} label="This Saturday" onPress={() => setDate(sat)} />
            <Chip selected={date === nextSat} label="Next Saturday" onPress={() => setDate(nextSat)} />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <SelectButton icon="calendar-outline" value={date ? prettyDate(date) : 'Pick a date'} onPress={() => setDatePickerOpen(true)} a11y="Event date" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Label text="Starts" required />
            <SelectButton icon="time-outline" value={startTime} onPress={() => setListSheet('start')} a11y={`Start time ${startTime}`} />
          </View>
          <View style={{ flex: 1 }}>
            <Label text="Ends" required />
            <SelectButton icon="time-outline" value={`${endTime}${overnight ? ' (+1 day)' : ''}`} onPress={() => setListSheet('end')} a11y={`End time ${endTime}`} />
          </View>
        </View>
        <View style={styles.durationPill}>
          <Ionicons name="hourglass-outline" size={15} color={accent} />
          <Text style={{ color: accent, fontWeight: fontWeight.extrabold }}>{durationText(minutes)}{overnight ? ' · ends next day' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Label text="City" required />
            <SelectButton icon="location-outline" value={city} onPress={() => setListSheet('city')} a11y={`City ${city}`} />
          </View>
          <View style={{ flex: 1 }}>
            <Label text="Country" />
            <View style={[styles.select, { opacity: 0.7 }]}><Ionicons name="flag-outline" size={16} color={colors.primary} /><Text style={styles.selectText}>{options.country}</Text></View>
          </View>
        </View>
        <View>
          <Label text="Venue or address" hint="A venue name, street or landmark." required />
          <TextInput value={venue} onChangeText={setVenue} maxLength={200} style={styles.input} placeholder="e.g. Kigali Convention Centre" placeholderTextColor={colors.textMuted} />
        </View>
        <View>
          <Label text="Notes for photographers" hint="Optional: shots you want, indoor or outdoor, dress code." />
          <TextInput value={notes} onChangeText={setNotes} maxLength={600} multiline style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholderTextColor={colors.textMuted} />
        </View>
      </View>
    );
  } else if (step === 2 && options) {
    body = (
      <View style={{ gap: spacing.lg }}>
        {MatchPanel}
        <View>
          <Label text="Photographer type" />
          <View style={{ gap: spacing.sm }}>
            {options.photographerTypes.map((t) => (
              <OptionCard key={t.value} selected={photographerType === t.value} onPress={() => setPhotographerType(t.value)} title={t.label} description={t.description}
                icon={t.value === 'STUDIO' ? 'business-outline' : t.value === 'FREELANCER' ? 'person-outline' : 'people-outline'} />
            ))}
          </View>
        </View>
        <View>
          <Label text="Budget" hint="Photographers whose packages fit this range are alerted." />
          <View style={styles.wrap}>
            {options.budgetPresets.map((p, i) => <Chip key={p.label} selected={budgetIndex === i} label={p.label} onPress={() => setBudgetIndex(i)} />)}
          </View>
        </View>
        <View>
          <Label text="Photographer specialty" hint="Choose one only if it must be a specialist." />
          <View style={styles.wrap}>
            {options.photographerSpecialties.map((s) => <Chip key={s.value} selected={specialty === s.value} label={s.label} onPress={() => setSpecialty(s.value)} />)}
          </View>
        </View>
        <View>
          <Label text="Where can the photographer come from?" />
          <View style={{ gap: spacing.sm }}>
            {options.coverageOptions.map((c) => (
              <OptionCard key={c.value} selected={coverage === c.value} onPress={() => setCoverage(c.value)}
                title={c.value === 'SAME_CITY' ? `${city} only` : c.label} description={c.description}
                icon={c.value === 'SAME_CITY' ? 'location-outline' : c.value === 'NEARBY_CITY' ? 'git-branch-outline' : 'map-outline'} />
            ))}
          </View>
        </View>
        <View>
          <Label text="Collect answers for" hint="After this, you choose from whoever said yes." />
          <View style={styles.wrap}>
            {options.matchWindowHours.map((h) => <Chip key={h} selected={windowHours === h} label={`${h} hours`} onPress={() => setWindowHours(h)} />)}
          </View>
        </View>
      </View>
    );
  } else if (step === 3 && options) {
    const typeLabel = options.photographerTypes.find((t) => t.value === photographerType)?.label;
    const coverageLabel = options.coverageOptions.find((c) => c.value === coverage)?.label;
    const rows: [keyof typeof Ionicons.glyphMap, string, string][] = [
      ['sparkles-outline', 'EVENT', `${title}${eventType ? ` · ${eventType.name}` : ''}`],
      ['calendar-outline', 'WHEN', `${prettyDate(date)} · ${startTime}–${endTime} · ${durationText(minutes)}${overnight ? ' (ends next day)' : ''}`],
      ['location-outline', 'WHERE', `${venue}, ${city}, ${options.country}`],
      ['person-outline', 'LOOKING FOR', `${typeLabel}${specialty !== 'ANY' ? ` · ${specialty} specialist` : ''} · ${coverageLabel}`],
      ['cash-outline', 'BUDGET', budgetLabel(preset?.min, preset?.max) || 'Flexible'],
      ['time-outline', 'COLLECT ANSWERS FOR', `${windowHours} hours`],
    ];
    body = (
      <View style={{ gap: spacing.lg }}>
        <View style={styles.summary}>
          {rows.map(([icon, k, v]) => (
            <View key={k} style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: 6 }}>
              <Ionicons name={icon} size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryKey}>{k}</Text>
                <Text style={styles.summaryVal}>{v}</Text>
              </View>
            </View>
          ))}
        </View>
        {MatchPanel}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>What happens next</Text>
          {([
            ['radio-outline', `The best-matched photographers (up to ${options.firstBatchSize}) are alerted right away.`],
            ['thumbs-up-outline', `Each has ${options.inviteWindowMinutes} minutes to say yes; anyone who passes is replaced by the next best match.`],
            ['people-outline', 'Only photographers who said yes appear for you, grouped as top, good and possible matches.'],
            ['shield-checkmark-outline', 'You choose one and pay 50%, 70% or 100% upfront. Connekyt holds it until delivery.'],
          ] as [keyof typeof Ionicons.glyphMap, string][]).map(([icon, t]) => (
            <View key={t} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={styles.nextIcon}><Ionicons name={icon} size={14} color={colors.primary} /></View>
              <Text style={[styles.modeStep, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
          <Text style={styles.hint}>Your event stays private. It only appears publicly once a photographer is booked.</Text>
        </View>
      </View>
    );
  } else if (step === 'done' && result) {
    const failed = !result.invited || result.status === 'MATCHING_FAILED';
    body = (
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl }}>
        <View style={[styles.doneIcon, { backgroundColor: failed ? colors.warningBg : MODE_META.HYBRID.soft }]}>
          <Ionicons name={failed ? 'alert' : 'radio-outline'} size={34} color={failed ? '#B45309' : accent} />
        </View>
        <Text style={styles.doneTitle}>{failed ? 'Saved, but nobody fits right now' : `${result.invited} photographer${result.invited === 1 ? ' was' : 's were'} alerted`}</Text>
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          {failed
            ? 'Your event is saved privately. Post it again with a wider area or budget, or use Find a Photographer to book one yourself.'
            : "We'll notify you each time a photographer says yes."}
        </Text>
      </View>
    );
  }

  const headerTitle = step === 'select' ? 'How do you want to book?' : step === 1 ? 'Tell us about your event'
    : step === 2 ? 'Who should we look for?' : step === 3 ? 'Review and post' : 'Your event is posted';
  const canPublish = !submitting && count !== 0 && options?.enabled !== false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={step === 'done' ? finish : close}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? insets.top + spacing.md : spacing.lg }]}>
          <View style={{ flex: 1 }}>
            {step !== 'select' && (
              <Text style={[styles.eyebrow, { color: accent }]}>POST MY EVENT{typeof step === 'number' ? ` · STEP ${step} OF 3` : ''}</Text>
            )}
            <Text style={styles.headerTitle} accessibilityRole="header">{headerTitle}</Text>
          </View>
          <Pressable onPress={step === 'done' ? finish : close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textSoft} />
          </Pressable>
        </View>
        {typeof step === 'number' && (
          <View style={styles.progress}>
            {[1, 2, 3].map((s) => <View key={s} style={[styles.progressBar, { backgroundColor: step >= s ? accent : colors.surfaceMuted }]} />)}
          </View>
        )}
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md }} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {body}
        </ScrollView>
        {step !== 'select' && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {step === 'done' ? (
              <Pressable onPress={finish} style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.primary }]} accessibilityRole="button">
                <Text style={styles.primaryText}>{result?.invited ? 'Follow the answers' : 'Done'}</Text>
              </Pressable>
            ) : (
              <>
                {!(existingEvent && step === 2) && (
                  <Pressable onPress={back} style={styles.secondaryBtn} accessibilityRole="button" accessibilityLabel="Back">
                    <Ionicons name="arrow-back" size={18} color={colors.textSoft} />
                  </Pressable>
                )}
                {step !== 3 ? (
                  <Pressable onPress={next} disabled={!options} style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.primary }]} accessibilityRole="button">
                    <Text style={styles.primaryText}>Continue</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={publish} disabled={!canPublish} accessibilityRole="button" accessibilityState={{ disabled: !canPublish }}
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: canPublish ? accent : colors.surfaceMuted }]}>
                    {submitting ? <ActivityIndicator color="#fff" /> : (
                      <Text style={[styles.primaryText, !canPublish && { color: colors.textMuted }]}>
                        {count === 0 ? 'Widen your request first' : 'Post and alert photographers'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        <DateTimePickerModal
          isVisible={datePickerOpen}
          mode="date"
          minimumDate={new Date()}
          date={date ? new Date(`${date}T12:00:00`) : new Date()}
          onConfirm={(d) => { setDatePickerOpen(false); setDate(isoDate(d)); }}
          onCancel={() => setDatePickerOpen(false)}
        />

        <Modal visible={listSheet !== null} transparent animationType="fade" onRequestClose={() => setListSheet(null)}>
          <Pressable style={styles.scrim} onPress={() => setListSheet(null)}>
            <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
              <Text style={[styles.label, { marginBottom: spacing.sm }]}>
                {listSheet === 'start' ? 'Start time' : listSheet === 'end' ? 'End time' : 'City'}
              </Text>
              <FlatList
                data={listSheet === 'city' ? (options?.cities.map((c) => c.name) ?? []) : listSheet === 'end' ? slots.filter((s) => s !== startTime) : slots}
                keyExtractor={(s) => s}
                initialScrollIndex={undefined}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => {
                  const on = (listSheet === 'start' && item === startTime) || (listSheet === 'end' && item === endTime) || (listSheet === 'city' && item === city);
                  const extra = listSheet === 'end' ? ` · ${durationText(durationBetween(startTime, item))}${item <= startTime ? ' (next day)' : ''}` : '';
                  return (
                    <Pressable
                      onPress={() => {
                        if (listSheet === 'start') setStartTime(item);
                        else if (listSheet === 'end') setEndTime(item);
                        else setCity(item);
                        setListSheet(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.listRow, on && { backgroundColor: colors.tint }]}
                    >
                      <Text style={[styles.listText, on && { color: colors.primary, fontWeight: fontWeight.bold }]}>{item}{extra}</Text>
                      {on && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </Pressable>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text },
  eyebrow: { fontSize: 11, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  subtitle: { fontSize: fontSize.sm, color: c.textMuted },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  hint: { fontSize: fontSize.xs, color: c.textMuted, lineHeight: 17 },
  error: { color: c.error, backgroundColor: c.errorBg, padding: spacing.md, borderRadius: radii.md, fontSize: fontSize.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: c.border, borderRadius: radii.md, paddingHorizontal: spacing.md,
    paddingVertical: 12, fontSize: fontSize.md, color: c.text, backgroundColor: c.card,
  },
  select: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1.5, borderColor: c.border,
    borderRadius: radii.md, paddingHorizontal: spacing.md, minHeight: 48, backgroundColor: c.card,
  },
  selectText: { flex: 1, fontSize: fontSize.md, color: c.text, fontWeight: fontWeight.semibold },
  durationPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(242,12,143,0.10)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full },
  matchPanel: { borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceMuted, borderRadius: radii.lg, padding: spacing.md },
  matchCount: { fontSize: 34, fontWeight: fontWeight.extrabold, color: c.primary, fontVariant: ['tabular-nums'] },
  matchTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: c.text },
  breakdown: { fontSize: fontSize.xs, color: c.textSoft },
  modeCard: { borderWidth: 2, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.sm, backgroundColor: c.card },
  modeIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  modeLine: { fontSize: fontSize.sm, color: c.textSoft, lineHeight: 20 },
  modeStep: { fontSize: fontSize.sm, color: c.textSoft },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontSize: 11, fontWeight: fontWeight.extrabold },
  summary: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, padding: spacing.md, backgroundColor: c.card },
  summaryKey: { fontSize: 10, fontWeight: fontWeight.bold, color: c.textMuted, letterSpacing: 0.6 },
  summaryVal: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },
  nextIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text, textAlign: 'center' },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSoft, backgroundColor: c.surface },
  primaryBtn: { minHeight: 52, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  primaryText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
  secondaryBtn: { width: 52, minHeight: 52, borderRadius: radii.lg, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], padding: spacing.lg },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radii.md },
  listText: { fontSize: fontSize.md, color: c.text },
}));

// Kept for older imports; amount formatting now lives in @/utils/amount.
export { formatAmountWithCommas, parseAmountNumber } from '@/utils/amount';
