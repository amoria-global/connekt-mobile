import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getMatchPreview, createMatchRequest } from '@/features/hybrid/api';
import type { PhotographerType, LocationCoverage, MatchPreviewResult } from '@/features/hybrid/types';
import { createEvent } from '@/features/events/api';
import { useRole } from '@/features/auth/role';
import { useCurrency } from '@/store/currency';
import { formatPrice } from '@/utils/format';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const STEPS = [
  { id: 1, title: 'Event Details' },
  { id: 2, title: 'Photographer Needs' },
  { id: 3, title: 'Review & Post' },
];

const SPECIALTY_OPTIONS = [
  { id: 'ANY', label: 'Any specialty' },
  { id: 'Wedding', label: 'Wedding / ceremony' },
  { id: 'Portrait', label: 'Portrait / celebration' },
  { id: 'Commercial', label: 'Commercial & events' },
  { id: 'Fashion', label: 'Fashion' },
  { id: 'Product', label: 'Product & brand' },
];

const PHOTOGRAPHER_TYPES: { id: PhotographerType; label: string }[] = [
  { id: 'ANY', label: 'Any type (All pros)' },
  { id: 'FREELANCER', label: 'Freelancer' },
  { id: 'STUDIO', label: 'Company / Studio' },
];

const COVERAGE_OPTIONS: { id: LocationCoverage; label: string }[] = [
  { id: 'ANY', label: 'Any location' },
  { id: 'SAME_CITY', label: 'Same city' },
  { id: 'NEARBY_CITY', label: 'Nearby city' },
];

export default function HybridWizardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const { isCoordinator } = useRole();
  const currentCurrency = useCurrency((s) => s.currency);

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);
  const defaultStartTime = useMemo(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  }, []);
  const defaultEndTime = useMemo(() => {
    const d = new Date();
    d.setHours(22, 0, 0, 0);
    return d;
  }, []);

  // --- Step 1 State: Event Basics ---
  const [title, setTitle] = useState("Sarah's Celebration");
  const [category, setCategory] = useState('Celebration');
  const [eventDate, setEventDate] = useState<Date | null>(defaultDate);
  const [startTime, setStartTime] = useState<Date | null>(defaultStartTime);
  const [endTime, setEndTime] = useState<Date | null>(defaultEndTime);
  const [city, setCity] = useState('Kigali');
  const [venue, setVenue] = useState('Convention Center');

  // Pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // --- Step 2 State: Photographer Needs ---
  const [photographerType, setPhotographerType] = useState<PhotographerType>('ANY');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [specialty, setSpecialty] = useState('ANY');
  const [locationCoverage, setLocationCoverage] = useState<LocationCoverage>('ANY');

  // Live match counter state
  const [matchResult, setMatchResult] = useState<MatchPreviewResult | null>(null);
  const [calculatingMatch, setCalculatingMatch] = useState(false);

  // Helpers
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  // Live match preview debounced calculation
  const fetchMatchCount = useCallback(async () => {
    if (!eventDate || !startTime) return;
    setCalculatingMatch(true);
    try {
      const minNum = parseFloat(minBudget);
      const maxNum = parseFloat(maxBudget);

      // Default duration: if no endTime selected, default to +4 hours for availability calculation
      let calculatedEndTime = endTime;
      if (!calculatedEndTime && startTime) {
        calculatedEndTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);
      }

      const res = await getMatchPreview({
        eventDate: toDateStr(eventDate),
        startTime: toTimeStr(startTime),
        endTime: calculatedEndTime ? toTimeStr(calculatedEndTime) : undefined,
        city: city.trim() || 'Kigali',
        minBudget: !Number.isNaN(minNum) && minNum > 0 ? minNum : undefined,
        maxBudget: !Number.isNaN(maxNum) && maxNum > 0 ? maxNum : undefined,
        currency: currentCurrency || 'RWF',
        photographerType: photographerType === 'ANY' ? undefined : photographerType,
        specialty: specialty === 'ANY' ? undefined : specialty,
        locationCoverage: locationCoverage === 'ANY' ? undefined : locationCoverage,
      });
      setMatchResult(res);
    } catch {
      setMatchResult({ matchCount: 0 });
    } finally {
      setCalculatingMatch(false);
    }
  }, [eventDate, startTime, endTime, city, minBudget, maxBudget, currentCurrency, photographerType, specialty, locationCoverage]);

  useEffect(() => {
    if (currentStep >= 2 && eventDate && startTime) {
      const timer = setTimeout(fetchMatchCount, 400);
      return () => clearTimeout(timer);
    }
  }, [currentStep, fetchMatchCount, eventDate, startTime]);

  const handleNextStep1 = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an event title.');
      return;
    }
    if (!eventDate) {
      Alert.alert('Required', 'Please choose the event date.');
      return;
    }
    if (!startTime) {
      Alert.alert('Required', 'Please choose the start time.');
      return;
    }
    if (!venue.trim()) {
      Alert.alert('Required', 'Please specify the venue or venue location.');
      return;
    }
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    const min = parseFloat(minBudget) || 0;
    const max = parseFloat(maxBudget) || 0;
    if (max > 0 && min > max) {
      Alert.alert('Budget error', 'Maximum budget must be greater than or equal to minimum budget.');
      return;
    }
    setCurrentStep(3);
  };

  const handlePublish = async () => {
    if (!eventDate || !startTime) return;
    setSubmitting(true);
    try {
      const minNum = parseFloat(minBudget);
      const maxNum = parseFloat(maxBudget);
      const hasMin = !Number.isNaN(minNum) && minNum > 0;
      const hasMax = !Number.isNaN(maxNum) && maxNum > 0;

      // 1. Create the event record
      const locationFull = [venue.trim(), city.trim()].filter(Boolean).join(', ');
      const newEvent = await createEvent(
        {
          title: title.trim(),
          category,
          eventDate: toDateStr(eventDate),
          startTime: toTimeStr(startTime).slice(0, 5),
          endTime: endTime ? toTimeStr(endTime).slice(0, 5) : undefined,
          location: locationFull,
          description: `Hybrid booking match request for ${title.trim()} in ${city.trim()}`,
          organizer: 'Client Event',
          price: hasMax ? maxNum : hasMin ? minNum : undefined,
          currency: currentCurrency || 'RWF',
          eventVisibility: 'PRIVATE', // unassigned hybrid events remain private from public feeds
        },
        isCoordinator,
      );

      // 2. Publish match request brief
      await createMatchRequest(newEvent.id, {
        minBudget: hasMin ? minNum : undefined,
        maxBudget: hasMax ? maxNum : undefined,
        currency: currentCurrency || 'RWF',
        photographerType: photographerType === 'ANY' ? undefined : photographerType,
        specialty: specialty === 'ANY' ? undefined : specialty,
        locationCoverage: locationCoverage === 'ANY' ? undefined : locationCoverage,
        expirationHours: 24,
      });

      // 3. Navigate to candidate shortlist screen
      router.replace(`/event/candidates?id=${newEvent.id}` as never);
    } catch (e) {
      const msg = isApiError(e) ? e.message : 'Could not publish event brief. Please try again.';
      Alert.alert('Publish failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      {/* Header */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => {
            if (currentStep > 1) {
              setCurrentStep(currentStep - 1);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/' as never);
            }
          }}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Post Event Brief</Text>
          <Text style={styles.headerSubtitle}>
            Step {currentStep} of {STEPS.length} • {STEPS[currentStep - 1]?.title}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/' as never);
          }}
          style={styles.closeBtn}
          hitSlop={10}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Progress Line */}
      <View style={styles.progressRow}>
        {STEPS.map((s) => (
          <View
            key={s.id}
            style={[
              styles.progressSegment,
              currentStep >= s.id && styles.progressSegmentFilled,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* STEP 1: EVENT DETAILS */}
        {currentStep === 1 && (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>Event Information</Text>
            <Text style={styles.stepDesc}>
              Tell local photographers where and when your event takes place.
            </Text>

            <Input
              label="Event Name *"
              placeholder="e.g. Sarah's 30th Birthday"
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="Event Category / Type"
              placeholder="e.g. Birthday, Wedding, Corporate"
              value={category}
              onChangeText={setCategory}
            />

            {/* Date Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Date *</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={styles.pickerSelector}>
                <Ionicons name="calendar-outline" size={18} color={eventDate ? colors.primary : colors.textMuted} />
                <Text style={[styles.pickerSelectorText, !eventDate && styles.placeholderText]}>
                  {eventDate
                    ? eventDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Select date'}
                </Text>
              </Pressable>
              <DateTimePickerModal
                isVisible={showDatePicker}
                mode="date"
                minimumDate={new Date()}
                themeVariant={isDark ? 'dark' : 'light'}
                onConfirm={(date) => {
                  setShowDatePicker(false);
                  setEventDate(date);
                }}
                onCancel={() => setShowDatePicker(false)}
              />
            </View>

            {/* Times */}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Start Time *</Text>
                <Pressable onPress={() => setShowStartTimePicker(true)} style={styles.pickerSelector}>
                  <Ionicons name="time-outline" size={18} color={startTime ? colors.primary : colors.textMuted} />
                  <Text style={[styles.pickerSelectorText, !startTime && styles.placeholderText]}>
                    {startTime ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set start'}
                  </Text>
                </Pressable>
                <DateTimePickerModal
                  isVisible={showStartTimePicker}
                  mode="time"
                  minuteInterval={15}
                  themeVariant={isDark ? 'dark' : 'light'}
                  onConfirm={(time) => {
                    setShowStartTimePicker(false);
                    setStartTime(time);
                  }}
                  onCancel={() => setShowStartTimePicker(false)}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>End Time</Text>
                <Pressable onPress={() => setShowEndTimePicker(true)} style={styles.pickerSelector}>
                  <Ionicons name="time-outline" size={18} color={endTime ? colors.primary : colors.textMuted} />
                  <Text style={[styles.pickerSelectorText, !endTime && styles.placeholderText]}>
                    {endTime ? endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set end'}
                  </Text>
                </Pressable>
                <DateTimePickerModal
                  isVisible={showEndTimePicker}
                  mode="time"
                  minuteInterval={15}
                  themeVariant={isDark ? 'dark' : 'light'}
                  onConfirm={(time) => {
                    setShowEndTimePicker(false);
                    setEndTime(time);
                  }}
                  onCancel={() => setShowEndTimePicker(false)}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="City *"
                  placeholder="Kigali"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <Input
                  label="Venue / Location *"
                  placeholder="Convention Center"
                  value={venue}
                  onChangeText={setVenue}
                />
              </View>
            </View>

            <Button title="Continue to Requirements" onPress={handleNextStep1} style={styles.continueBtn} />
          </View>
        )}

        {/* STEP 2: PHOTOGRAPHER REQUIREMENTS & LIVE COUNT */}
        {currentStep === 2 && (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>Who do you want to book?</Text>
            <Text style={styles.stepDesc}>
              Define your preferences. Local photographers matching these criteria will be alerted.
            </Text>

            {/* Photographer Type */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Photographer Type</Text>
              <View style={styles.chipRow}>
                {PHOTOGRAPHER_TYPES.map((t) => {
                  const sel = photographerType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.chip, sel && styles.chipActive]}
                      onPress={() => setPhotographerType(t.id)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextActive]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Budget Range */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Budget Range ({currentCurrency || 'RWF'})</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Min"
                    value={minBudget}
                    onChangeText={setMinBudget}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Max"
                    value={maxBudget}
                    onChangeText={setMaxBudget}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* Specialty */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Specialty</Text>
              <View style={styles.chipRow}>
                {SPECIALTY_OPTIONS.map((s) => {
                  const sel = specialty === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      style={[styles.chip, sel && styles.chipActive]}
                      onPress={() => setSpecialty(s.id)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextActive]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Location Coverage */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Location Coverage</Text>
              <View style={styles.chipRow}>
                {COVERAGE_OPTIONS.map((c) => {
                  const sel = locationCoverage === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.chip, sel && styles.chipActive]}
                      onPress={() => setLocationCoverage(c.id)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextActive]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* LIVE MATCH COUNT CARD (SLIDE 04) */}
            <View style={styles.liveMatchCard}>
              <View style={styles.liveMatchHeader}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveMatchEyebrow}>LIVE MATCH COUNT</Text>
              </View>

              <View style={styles.countRow}>
                {calculatingMatch ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.matchCountNumber}>{matchResult?.matchCount ?? 0}</Text>
                )}
                <Text style={styles.matchCountLabel}>photographers currently match</Text>
              </View>

              <View style={styles.matchChecklist}>
                <View style={styles.checkItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.checkText}>Available on event date</Text>
                </View>
                <View style={styles.checkItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.checkText}>Type & location compatible</Text>
                </View>
                <View style={styles.checkItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.checkText}>Budget range matched</Text>
                </View>
                <View style={styles.checkItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.checkText}>Instagram profile verified</Text>
                </View>
              </View>

              {matchResult?.matchCount === 0 && !calculatingMatch && (
                <View style={styles.zeroMatchHint}>
                  <Ionicons name="information-circle-outline" size={16} color="#D97706" />
                  <Text style={styles.zeroMatchText}>
                    0 photographers currently match these specific filters. Setting location to "Any location" or leaving budget open will match more local creators.
                  </Text>
                </View>
              )}
            </View>

            <Button title="Continue to Review" onPress={handleNextStep2} style={styles.continueBtn} />
          </View>
        )}

        {/* STEP 3: REVIEW & PUBLISH (SLIDE 05) */}
        {currentStep === 3 && (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>Review & Post Brief</Text>
            <Text style={styles.stepDesc}>
              Confirm your requirements before alerting matching photographers.
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <Text style={styles.summaryEventTitle}>{title}</Text>
                <View style={styles.matchPill}>
                  <Text style={styles.matchPillText}>{matchResult?.matchCount ?? 0} MATCHES</Text>
                </View>
              </View>

              <View style={styles.summaryMetaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                <Text style={styles.summaryMetaText}>
                  {eventDate?.toDateString()} • {startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {endTime ? ` – ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              </View>

              <View style={styles.summaryMetaRow}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={styles.summaryMetaText}>{venue}, {city}</Text>
              </View>

              <View style={styles.summaryMetaRow}>
                <Ionicons name="cash-outline" size={14} color={colors.primary} />
                <Text style={styles.summaryMetaText}>
                  {formatPrice(parseFloat(minBudget) || 0, currentCurrency)} – {formatPrice(parseFloat(maxBudget) || 0, currentCurrency)}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <Text style={styles.summarySubtitle}>What happens next?</Text>
              <Text style={styles.summaryBody}>
                1. Connekyt immediately invites the nearest eligible photographers.
                {'\n'}2. Available photographers tap "Approve".
                {'\n'}3. You choose from a curated shortlist with zero rejection risk.
              </Text>
            </View>

            <Button
              title="Post Event & Find Matches"
              loading={submitting}
              onPress={handlePublish}
              style={styles.continueBtn}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
  },
  progressSegmentFilled: {
    backgroundColor: c.primary,
  },
  container: {
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  stepBox: {
    gap: spacing.md,
  },
  stepTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  stepDesc: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
  },
  pickerSelector: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pickerSelectorText: {
    fontSize: fontSize.sm,
    color: c.text,
  },
  placeholderText: {
    color: c.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  chipActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: c.textSoft,
  },
  chipTextActive: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  liveMatchCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: c.primary,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  liveMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  liveMatchEyebrow: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: 0.6,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  matchCountNumber: {
    fontSize: 34,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  matchCountLabel: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  matchChecklist: {
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: spacing.sm,
    gap: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    fontSize: fontSize.xs,
    color: c.textSoft,
  },
  summaryCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    gap: spacing.sm,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryEventTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
    flex: 1,
  },
  matchPill: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  matchPillText: {
    fontSize: 11,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryMetaText: {
    fontSize: fontSize.sm,
    color: c.textSoft,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: c.borderSoft,
    marginVertical: spacing.xs,
  },
  summarySubtitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryBody: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 18,
  },
  zeroMatchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  zeroMatchText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  continueBtn: {
    marginTop: spacing.md,
  },
}));
