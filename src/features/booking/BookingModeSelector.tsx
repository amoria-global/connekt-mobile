/**
 * BookingModeSelector — Component per Figma Slide 02/03 & Hybrid Wizard Flow.
 *
 * Prompts the client with the dual-entry booking fork:
 *   01. Find a Photographer (DIRECT): Browse, filter, and book directly.
 *   02. Post My Event (HYBRID): Transition directly inside the bottom sheet to
 *       Step 1 (Event Details), Step 2 (Requirements & Live Talent Count), and
 *       Step 3 (Review & Post Brief).
 *
 * Converges downstream into the shared booking + escrow service.
 * Redesigned to pro-grade standards with BlurView backdrop, spring physics,
 * tactile drag handle, explicit solid Connekyt brand action buttons, and live matching.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Button } from '@/components/ui/Button';
import { getMatchPreview, createMatchRequest } from '@/features/hybrid/api';
import type { PhotographerType, LocationCoverage, MatchPreviewResult } from '@/features/hybrid/types';
import { createEvent } from '@/features/events/api';
import { useRole } from '@/features/auth/role';
import { useCurrency } from '@/store/currency';
import { formatPrice } from '@/utils/format';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

export type BookingStep = 'select' | 1 | 2 | 3;

export type BookingModeSelectorProps = {
  visible: boolean;
  onClose: () => void;
  /** Optional custom navigation callback */
  onSelectDirect?: () => void;
  onSelectHybrid?: () => void;
  /** Initial step when sheet mounts (defaults to 'select') */
  initialStep?: BookingStep;
};

const STEPS = [
  { id: 1, title: 'Event Details' },
  { id: 2, title: 'Photographer Needs' },
  { id: 3, title: 'Review & Post' },
];

const POPULAR_CATEGORIES = [
  { id: 'Celebration', label: 'Celebration', icon: 'sparkles-outline' },
  { id: 'Wedding', label: 'Wedding', icon: 'heart-outline' },
  { id: 'Birthday', label: 'Birthday', icon: 'gift-outline' },
  { id: 'Corporate', label: 'Corporate', icon: 'briefcase-outline' },
  { id: 'Portrait', label: 'Portrait', icon: 'person-outline' },
  { id: 'Fashion', label: 'Fashion', icon: 'shirt-outline' },
  { id: 'Concert', label: 'Concert / Festival', icon: 'musical-notes-outline' },
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

export function BookingModeSelector({
  visible,
  onClose,
  onSelectDirect,
  onSelectHybrid,
  initialStep = 'select',
}: BookingModeSelectorProps) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isCoordinator } = useRole();
  const currentCurrency = useCurrency((s) => s.currency);

  const [mounted, setMounted] = useState(visible);
  const [currentStep, setCurrentStep] = useState<BookingStep>(initialStep);
  const [submitting, setSubmitting] = useState(false);

  const animFade = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(450)).current;

  // Defaults for Step 1
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
    if (currentStep === 2 && eventDate && startTime) {
      const timer = setTimeout(fetchMatchCount, 350);
      return () => clearTimeout(timer);
    }
  }, [currentStep, fetchMatchCount, eventDate, startTime]);

  // Animate in and out smoothly
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setCurrentStep(initialStep);
      Animated.parallel([
        Animated.timing(animFade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(animY, {
          toValue: 0,
          tension: 70,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(animFade, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(animY, {
          toValue: 450,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [visible, mounted, initialStep, animFade, animY]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(animFade, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(animY, {
        toValue: 450,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      onClose();
    });
  };

  const handleDirect = () => {
    handleDismiss();
    setTimeout(() => {
      if (onSelectDirect) {
        onSelectDirect();
      } else {
        router.push('/photographers' as never);
      }
    }, 180);
  };

  const handleHybrid = () => {
    if (onSelectHybrid) {
      handleDismiss();
      setTimeout(onSelectHybrid, 180);
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentStep(1);
    }
  };

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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    const min = parseFloat(minBudget) || 0;
    const max = parseFloat(maxBudget) || 0;
    if (max > 0 && min > max) {
      Alert.alert('Budget error', 'Maximum budget must be greater than or equal to minimum budget.');
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
          eventVisibility: 'PRIVATE',
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

      handleDismiss();
      setTimeout(() => {
        router.replace(`/event/candidates?id=${newEvent.id}` as never);
      }, 200);
    } catch (e) {
      const msg = isApiError(e) ? e.message : 'Could not publish event brief. Please try again.';
      Alert.alert('Publish failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Drag down gesture responder on handle area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          animY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.75) {
          handleDismiss();
        } else {
          Animated.spring(animY, {
            toValue: 0,
            tension: 75,
            friction: 11,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!mounted) return null;

  const isWizardMode = currentStep !== 'select';

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Blur + Scrim Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: animFade }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 32 : 45}
            tint={isDark ? 'dark' : 'regular'}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close booking mode selector"
          />
        </Animated.View>

        {/* Animated Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            isWizardMode && styles.sheetExpanded,
            {
              paddingBottom: isWizardMode ? 0 : Math.max(insets.bottom, spacing.md) + spacing.xs,
              transform: [{ translateY: animY }],
            },
          ]}
        >
          {/* Draggable Handle */}
          <View {...panResponder.panHandlers} style={styles.dragArea}>
            <View style={styles.sheetHandle} />
          </View>

          {/* MODE SELECTION SCREEN (Step 'select') */}
          {currentStep === 'select' && (
            <View style={styles.selectContent}>
              {/* Header Row */}
              <View style={styles.header}>
                <View style={styles.badge}>
                  <Ionicons name="sparkles" size={11.5} color={colors.primary} />
                  <Text style={styles.badgeText}>CONNEKYT BOOKING</Text>
                </View>
                <Pressable
                  onPress={handleDismiss}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Close sheet"
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>

              <Text style={styles.title}>How do you want to find your photographer?</Text>
              <Text style={styles.subtitle}>
                Choose direct marketplace discovery or let Connekyt match your brief with nearby vetted talent.
              </Text>

              <View style={styles.optionsList}>
                {/* 01. DIRECT BOOKING */}
                <Pressable
                  style={({ pressed }) => [styles.optionCard, pressed && styles.cardPressed]}
                  onPress={handleDirect}
                  accessibilityRole="button"
                  accessibilityLabel="Find a Photographer via Direct Marketplace"
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.indexPill}>
                      <Text style={styles.indexPillText}>01 · DIRECT</Text>
                    </View>
                    <View style={styles.marketplaceTag}>
                      <Ionicons name="people-outline" size={11} color={colors.primary} />
                      <Text style={styles.marketplaceTagText}>MARKETPLACE</Text>
                    </View>
                  </View>

                  <View style={styles.cardBodyRow}>
                    <View style={styles.directIconBox}>
                      <Ionicons name="camera-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={styles.cardTextWrap}>
                      <Text style={styles.optionTitle}>Find a Photographer</Text>
                      <Text style={styles.optionDesc}>
                        Browse, filter, and book directly from Rwanda&apos;s verified creator profiles.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featurePillsRow}>
                    <View style={styles.featurePill}>
                      <Ionicons name="images-outline" size={11} color={colors.primary} />
                      <Text style={styles.featurePillText}>Instant portfolios</Text>
                    </View>
                    <View style={styles.featurePill}>
                      <Ionicons name="star" size={10} color="#F59E0B" />
                      <Text style={styles.featurePillText}>Verified reviews</Text>
                    </View>
                    <View style={styles.featurePill}>
                      <Ionicons name="chatbubbles-outline" size={10} color={colors.primary} />
                      <Text style={styles.featurePillText}>Direct chat</Text>
                    </View>
                  </View>

                  <View style={styles.directCtaBtn}>
                    <Text style={styles.directCtaText}>Browse Marketplace</Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                  </View>
                </Pressable>

                {/* 02. HYBRID MATCHING (RECOMMENDED) */}
                <Pressable
                  style={({ pressed }) => [
                    styles.optionCard,
                    styles.hybridOptionCard,
                    isDark && styles.hybridOptionCardDark,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={handleHybrid}
                  accessibilityRole="button"
                  accessibilityLabel="Post My Event for Smart Matching"
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.hybridIndexPill, isDark && styles.hybridIndexPillDark]}>
                      <Ionicons name="sparkles" size={11} color={colors.accent} />
                      <Text style={styles.hybridIndexPillText}>02 · RECOMMENDED</Text>
                    </View>
                    <View style={[styles.hybridTag, isDark && styles.hybridTagDark]}>
                      <View style={styles.livePulseDot} />
                      <Text style={styles.hybridTagText}>SMART MATCH</Text>
                    </View>
                  </View>

                  <View style={styles.cardBodyRow}>
                    <View style={styles.hybridIconBox}>
                      <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.cardTextWrap}>
                      <Text style={styles.optionTitle}>Post My Event</Text>
                      <Text style={styles.optionDesc}>
                        Submit your shoot brief once. Nearby vetted creators ring in real-time to match.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featurePillsRow}>
                    <View
                      style={[
                        styles.featurePill,
                        styles.hybridFeaturePill,
                        isDark && styles.hybridFeaturePillDark,
                      ]}
                    >
                      <Ionicons name="call-outline" size={11} color={colors.accent} />
                      <Text
                        style={[
                          styles.featurePillText,
                          styles.hybridFeatureText,
                          isDark && styles.hybridFeatureTextDark,
                        ]}
                      >
                        Live ringing alert
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.featurePill,
                        styles.hybridFeaturePill,
                        isDark && styles.hybridFeaturePillDark,
                      ]}
                    >
                      <Ionicons name="location-outline" size={10} color={colors.accent} />
                      <Text
                        style={[
                          styles.featurePillText,
                          styles.hybridFeatureText,
                          isDark && styles.hybridFeatureTextDark,
                        ]}
                      >
                        Nearest creators
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.featurePill,
                        styles.hybridFeaturePill,
                        isDark && styles.hybridFeaturePillDark,
                      ]}
                    >
                      <Ionicons name="timer-outline" size={10} color={colors.accent} />
                      <Text
                        style={[
                          styles.featurePillText,
                          styles.hybridFeatureText,
                          isDark && styles.hybridFeatureTextDark,
                        ]}
                      >
                        Under 5 mins
                      </Text>
                    </View>
                  </View>

                  <View style={styles.hybridCtaBtn}>
                    <Text style={styles.hybridCtaText}>Post Brief & Match Talent</Text>
                    <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            </View>
          )}

          {/* WIZARD FLOW IN BOTTOM SHEET (Steps 1, 2, 3) */}
          {isWizardMode && (
            <View style={styles.wizardContainer}>
              {/* Wizard Top Navigation Header */}
              <View style={styles.wizardHeader}>
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    if (currentStep === 1) setCurrentStep('select');
                    else if (currentStep === 2) setCurrentStep(1);
                    else if (currentStep === 3) setCurrentStep(2);
                  }}
                  hitSlop={10}
                  style={styles.navCircleBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Back to previous step"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>

                <View style={styles.wizardHeaderCenter}>
                  <Text style={styles.wizardStepBadge}>
                    STEP {currentStep} OF {STEPS.length} • {STEPS[(currentStep as number) - 1]?.title.toUpperCase()}
                  </Text>
                  <Text style={styles.wizardHeaderTitle}>Post Event Brief</Text>
                </View>

                <Pressable
                  onPress={handleDismiss}
                  hitSlop={10}
                  style={styles.navCircleBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close sheet"
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>

              {/* 3-Segment Progress Bar */}
              <View style={styles.progressRow}>
                {STEPS.map((s) => (
                  <View
                    key={s.id}
                    style={[
                      styles.progressSegment,
                      (currentStep as number) >= s.id && styles.progressSegmentFilled,
                    ]}
                  />
                ))}
              </View>

              {/* Scrollable Form Content */}
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
              >
                <ScrollView
                  contentContainerStyle={styles.wizardScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* STEP 1: EVENT INFORMATION */}
                  {currentStep === 1 && (
                    <View style={styles.stepBox}>
                      <View style={styles.stepIntro}>
                        <Text style={styles.stepTitle}>Event Information</Text>
                        <Text style={styles.stepDesc}>
                          Tell local photographers where and when your event takes place.
                        </Text>
                      </View>

                      {/* Event Title */}
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>EVENT TITLE *</Text>
                        <View style={styles.inputContainer}>
                          <Ionicons name="sparkles" size={18} color={colors.primary} style={styles.inputIcon} />
                          <TextInput
                            placeholder="e.g. Sarah's 30th Birthday, Tech Summit"
                            placeholderTextColor={colors.textMuted}
                            value={title}
                            onChangeText={setTitle}
                            style={styles.textInput}
                            autoCapitalize="words"
                          />
                        </View>
                      </View>

                      {/* Category Chips + Custom */}
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>EVENT CATEGORY</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.categoryScroll}
                        >
                          {POPULAR_CATEGORIES.map((cat) => {
                            const isSelected = category.toLowerCase() === cat.id.toLowerCase();
                            return (
                              <Pressable
                                key={cat.id}
                                onPress={() => setCategory(cat.id)}
                                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                              >
                                <Ionicons
                                  name={cat.icon as any}
                                  size={13}
                                  color={isSelected ? colors.primary : colors.textMuted}
                                />
                                <Text
                                  style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}
                                >
                                  {cat.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                        <View style={[styles.inputContainer, { marginTop: 6 }]}>
                          <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                          <TextInput
                            placeholder="Or type custom category..."
                            placeholderTextColor={colors.textMuted}
                            value={category}
                            onChangeText={setCategory}
                            style={styles.textInput}
                          />
                        </View>
                      </View>

                      {/* Event Date Selector Card */}
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>EVENT DATE *</Text>
                        <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateSelectorCard}>
                          <View style={styles.selectorIconBox}>
                            <Ionicons name="calendar" size={19} color={colors.primary} />
                          </View>
                          <View style={styles.selectorTextWrap}>
                            <Text style={styles.selectorMicroLabel}>DATE OF SHOOT</Text>
                            <Text style={styles.selectorMainText}>
                              {eventDate
                                ? eventDate.toLocaleDateString(undefined, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Select event date'}
                            </Text>
                          </View>
                          <View style={styles.changeBadge}>
                            <Text style={styles.changeBadgeText}>Change</Text>
                            <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                          </View>
                        </Pressable>
                      </View>

                      {/* Start Time & End Time */}
                      <View style={styles.twoColumnRow}>
                        <View style={[styles.fieldWrap, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>START TIME *</Text>
                          <Pressable
                            onPress={() => setShowStartTimePicker(true)}
                            style={styles.timeSelectorCard}
                          >
                            <View style={styles.timeIconBox}>
                              <Ionicons name="time" size={16} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.selectorMicroLabel}>STARTS</Text>
                              <Text style={styles.timeMainText}>
                                {startTime
                                  ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Set time'}
                              </Text>
                            </View>
                          </Pressable>
                        </View>

                        <View style={[styles.fieldWrap, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>END TIME</Text>
                          <Pressable
                            onPress={() => setShowEndTimePicker(true)}
                            style={styles.timeSelectorCard}
                          >
                            <View style={styles.timeIconBox}>
                              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.selectorMicroLabel}>ENDS</Text>
                              <Text style={styles.timeMainText}>
                                {endTime
                                  ? endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Optional'}
                              </Text>
                            </View>
                          </Pressable>
                        </View>
                      </View>

                      {/* City & Venue */}
                      <View style={styles.twoColumnRow}>
                        <View style={[styles.fieldWrap, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>CITY *</Text>
                          <View style={styles.inputContainer}>
                            <Ionicons name="location-sharp" size={16} color={colors.primary} style={styles.inputIcon} />
                            <TextInput
                              placeholder="Kigali"
                              placeholderTextColor={colors.textMuted}
                              value={city}
                              onChangeText={setCity}
                              style={styles.textInput}
                            />
                          </View>
                        </View>

                        <View style={[styles.fieldWrap, { flex: 1.4 }]}>
                          <Text style={styles.fieldLabel}>VENUE / LOCATION *</Text>
                          <View style={styles.inputContainer}>
                            <Ionicons name="business-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                              placeholder="Convention Center"
                              placeholderTextColor={colors.textMuted}
                              value={venue}
                              onChangeText={setVenue}
                              style={styles.textInput}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* STEP 2: PHOTOGRAPHER REQUIREMENTS & LIVE COUNT */}
                  {currentStep === 2 && (
                    <View style={styles.stepBox}>
                      <View style={styles.stepIntro}>
                        <Text style={styles.stepTitle}>Who do you want to book?</Text>
                        <Text style={styles.stepDesc}>
                          Define your preferences. Local photographers matching these criteria will receive your brief.
                        </Text>
                      </View>

                      {/* Photographer Type */}
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>PHOTOGRAPHER TYPE</Text>
                        <View style={styles.chipRow}>
                          {PHOTOGRAPHER_TYPES.map((t) => {
                            const isSel = photographerType === t.id;
                            return (
                              <Pressable
                                key={t.id}
                                style={[styles.filterChip, isSel && styles.filterChipSelected]}
                                onPress={() => setPhotographerType(t.id)}
                              >
                                <Text style={[styles.filterChipText, isSel && styles.filterChipTextSelected]}>
                                  {t.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* Budget Range */}
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>BUDGET RANGE ({currentCurrency || 'RWF'})</Text>
                        <View style={styles.twoColumnRow}>
                          <View style={[styles.inputContainer, { flex: 1 }]}>
                            <Text style={styles.budgetPrefix}>{currentCurrency || 'RWF'}</Text>
                            <TextInput
                              placeholder="Min budget"
                              placeholderTextColor={colors.textMuted}
                              value={minBudget}
                              onChangeText={setMinBudget}
                              keyboardType="numeric"
                              style={styles.textInput}
                            />
                          </View>
                          <View style={[styles.inputContainer, { flex: 1 }]}>
                            <Text style={styles.budgetPrefix}>{currentCurrency || 'RWF'}</Text>
                            <TextInput
                              placeholder="Max budget"
                              placeholderTextColor={colors.textMuted}
                              value={maxBudget}
                              onChangeText={setMaxBudget}
                              keyboardType="numeric"
                              style={styles.textInput}
                            />
                          </View>
                        </View>
                      </View>

                      {/* Specialty */}
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>EVENT SPECIALTY</Text>
                        <View style={styles.chipRow}>
                          {SPECIALTY_OPTIONS.map((s) => {
                            const isSel = specialty === s.id;
                            return (
                              <Pressable
                                key={s.id}
                                style={[styles.filterChip, isSel && styles.filterChipSelected]}
                                onPress={() => setSpecialty(s.id)}
                              >
                                <Text style={[styles.filterChipText, isSel && styles.filterChipTextSelected]}>
                                  {s.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* Location Coverage */}
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>LOCATION COVERAGE</Text>
                        <View style={styles.chipRow}>
                          {COVERAGE_OPTIONS.map((c) => {
                            const isSel = locationCoverage === c.id;
                            return (
                              <Pressable
                                key={c.id}
                                style={[styles.filterChip, isSel && styles.filterChipSelected]}
                                onPress={() => setLocationCoverage(c.id)}
                              >
                                <Text style={[styles.filterChipText, isSel && styles.filterChipTextSelected]}>
                                  {c.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* LIVE MATCH COUNT RADAR CARD */}
                      <View style={styles.liveMatchCard}>
                        <View style={styles.liveMatchHeader}>
                          <View style={styles.livePulseDotGreen} />
                          <Text style={styles.liveMatchEyebrow}>LIVE TALENT MATCHING</Text>
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
                            <Text style={styles.checkText}>Available on selected event date</Text>
                          </View>
                          <View style={styles.checkItem}>
                            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                            <Text style={styles.checkText}>Type & location coverage compatible</Text>
                          </View>
                          <View style={styles.checkItem}>
                            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                            <Text style={styles.checkText}>Budget range matched</Text>
                          </View>
                          <View style={styles.checkItem}>
                            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                            <Text style={styles.checkText}>Verified Connekyt portfolio</Text>
                          </View>
                        </View>

                        {matchResult?.matchCount === 0 && !calculatingMatch && (
                          <View style={styles.zeroMatchHint}>
                            <Ionicons name="information-circle-outline" size={16} color="#D97706" />
                            <Text style={styles.zeroMatchText}>
                              0 photographers match these specific filters. Try setting location to &quot;Any location&quot; or widening the budget.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* STEP 3: REVIEW & PUBLISH */}
                  {currentStep === 3 && (
                    <View style={styles.stepBox}>
                      <View style={styles.stepIntro}>
                        <Text style={styles.stepTitle}>Review & Post Brief</Text>
                        <Text style={styles.stepDesc}>
                          Confirm your event details before alerting matching photographers.
                        </Text>
                      </View>

                      <View style={styles.summaryCard}>
                        <View style={styles.summaryTopRow}>
                          <Text style={styles.summaryEventTitle}>{title}</Text>
                          <View style={styles.matchPill}>
                            <Text style={styles.matchPillText}>{matchResult?.matchCount ?? 0} MATCHES</Text>
                          </View>
                        </View>

                        <View style={styles.summaryMetaRow}>
                          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                          <Text style={styles.summaryMetaText}>
                            {eventDate?.toDateString()} • {startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {endTime ? ` – ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </Text>
                        </View>

                        <View style={styles.summaryMetaRow}>
                          <Ionicons name="location-outline" size={15} color={colors.primary} />
                          <Text style={styles.summaryMetaText}>{venue}, {city}</Text>
                        </View>

                        <View style={styles.summaryMetaRow}>
                          <Ionicons name="cash-outline" size={15} color={colors.primary} />
                          <Text style={styles.summaryMetaText}>
                            {formatPrice(parseFloat(minBudget) || 0, currentCurrency)} – {formatPrice(parseFloat(maxBudget) || 0, currentCurrency)}
                          </Text>
                        </View>

                        <View style={styles.summaryDivider} />

                        <Text style={styles.summarySubtitle}>What happens next?</Text>
                        <Text style={styles.summaryBody}>
                          1. Connekyt immediately alerts the nearest matching photographers.
                          {'\n'}2. Available creators respond to your brief.
                          {'\n'}3. You choose from a curated shortlist with zero rejection risk.
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </KeyboardAvoidingView>

              {/* Bottom Sticky Action Button Area */}
              <View
                style={[
                  styles.wizardBottomBar,
                  { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs },
                ]}
              >
                {currentStep === 1 && (
                  <Pressable
                    onPress={handleNextStep1}
                    style={styles.wizardPrimaryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to Requirements"
                  >
                    <Text style={styles.wizardPrimaryBtnText}>Continue to Requirements</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                )}

                {currentStep === 2 && (
                  <Pressable
                    onPress={handleNextStep2}
                    style={styles.wizardPrimaryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to Review"
                  >
                    <Text style={styles.wizardPrimaryBtnText}>Continue to Review</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                )}

                {currentStep === 3 && (
                  <Pressable
                    onPress={handlePublish}
                    disabled={submitting}
                    style={[styles.wizardPrimaryBtn, submitting && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Post Event & Find Matches"
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.wizardPrimaryBtnText}>Post Event & Find Matches</Text>
                        <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Date Picker Modal */}
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

          {/* Start Time Picker Modal */}
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

          {/* End Time Picker Modal */}
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    ...e(4),
  },
  sheetExpanded: {
    height: Math.min(Dimensions.get('window').height * 0.90, 740),
    maxHeight: '92%',
    paddingHorizontal: 0,
  },
  dragArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: c.border,
    opacity: 0.7,
  },
  selectContent: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.full,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
    marginTop: -4,
  },
  optionsList: {
    gap: spacing.sm + 2,
    marginTop: 4,
  },
  optionCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs + 3,
    ...e(1),
  },
  hybridOptionCard: {
    borderColor: 'rgba(242, 12, 143, 0.32)',
    backgroundColor: 'rgba(242, 12, 143, 0.04)',
    ...e(2),
  },
  hybridOptionCardDark: {
    borderColor: 'rgba(242, 12, 143, 0.45)',
    backgroundColor: 'rgba(242, 12, 143, 0.10)',
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indexPill: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.15)',
  },
  indexPillText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.primary,
    letterSpacing: 0.6,
  },
  marketplaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: radii.sm,
    backgroundColor: c.tint,
  },
  marketplaceTagText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.primary,
    letterSpacing: 0.5,
  },
  hybridIndexPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(242, 12, 143, 0.10)',
    paddingHorizontal: 8.5,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  hybridIndexPillDark: {
    backgroundColor: 'rgba(242, 12, 143, 0.22)',
  },
  hybridIndexPillText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.accent,
    letterSpacing: 0.6,
  },
  hybridTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(242, 12, 143, 0.10)',
  },
  hybridTagDark: {
    backgroundColor: 'rgba(242, 12, 143, 0.20)',
  },
  hybridTagText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.accent,
    letterSpacing: 0.5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.accent,
  },
  livePulseDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  directIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hybridIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(2),
  },
  cardTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
    fontWeight: fontWeight.bold,
    color: c.text,
    letterSpacing: -0.2,
  },
  optionDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 16.5,
  },
  featurePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 1,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
  },
  featurePillText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
  },
  hybridFeaturePill: {
    backgroundColor: 'rgba(242, 12, 143, 0.06)',
    borderColor: 'rgba(242, 12, 143, 0.20)',
  },
  hybridFeaturePillDark: {
    backgroundColor: 'rgba(242, 12, 143, 0.16)',
    borderColor: 'rgba(242, 12, 143, 0.30)',
  },
  hybridFeatureText: {
    color: c.accent,
  },
  hybridFeatureTextDark: {
    color: c.accentLight,
  },
  directCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.20)',
    paddingVertical: 8.5,
    borderRadius: radii.full,
    marginTop: 2,
  },
  directCtaText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: c.primary,
  },
  hybridCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingVertical: 9.5,
    borderRadius: radii.full,
    marginTop: 2,
    ...e(2),
  },
  hybridCtaText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // --- Wizard Styles ---
  wizardContainer: {
    flex: 1,
  },
  wizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  navCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardHeaderCenter: {
    alignItems: 'center',
    gap: 2,
  },
  wizardStepBadge: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.primary,
    letterSpacing: 0.6,
  },
  wizardHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
    letterSpacing: -0.2,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
  },
  progressSegmentFilled: {
    backgroundColor: c.primary,
  },
  wizardScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
    gap: spacing.md,
  },
  stepBox: {
    gap: spacing.md,
  },
  stepIntro: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  stepTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: c.text,
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textSoft,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  inputIcon: {
    marginLeft: 2,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.text,
    height: '100%',
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  categoryChipSelected: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  categoryChipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textSoft,
  },
  categoryChipTextSelected: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
  dateSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  selectorIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorTextWrap: {
    flex: 1,
    gap: 1,
  },
  selectorMicroLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.textMuted,
    letterSpacing: 0.4,
  },
  selectorMainText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  changeBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  timeIconBox: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeMainText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: c.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  filterChipSelected: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  filterChipText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textSoft,
  },
  filterChipTextSelected: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
  budgetPrefix: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
    paddingLeft: 2,
  },
  liveMatchCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: c.primary,
    gap: spacing.xs + 3,
    marginTop: spacing.xs,
    ...e(2),
  },
  liveMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveMatchEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.primary,
    letterSpacing: 0.7,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  matchCountNumber: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: c.text,
  },
  matchCountLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  matchChecklist: {
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: spacing.xs + 2,
    gap: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textSoft,
  },
  zeroMatchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  zeroMatchText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  summaryCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    gap: spacing.sm,
    ...e(1),
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryEventTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
    color: c.text,
    flex: 1,
  },
  matchPill: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.20)',
  },
  matchPillText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryMetaText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textSoft,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: c.borderSoft,
    marginVertical: spacing.xs,
  },
  summarySubtitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryBody: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
    lineHeight: 17,
  },
  wizardBottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    backgroundColor: c.elevated,
  },
  wizardPrimaryBtn: {
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...e(2),
  },
  wizardPrimaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
}));
