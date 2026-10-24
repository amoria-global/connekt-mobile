import React, { forwardRef, useMemo, useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/store/currency';
import { StyleSheet, View, Text, Pressable, Alert, Platform, Image, ActivityIndicator, Keyboard, InputAccessoryView } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { bookingsApi } from '@/api/endpoints/bookings';
import { useAuth, isApiError } from '@/store/auth';
import { logoBase64 } from '@/utils/logoBase64';
import { formatAmountWithCommas, parseAmountNumber } from '@/utils/amount';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { formatPrice as formatSelectedPrice } from '@/utils/format';
import { useSharedT } from '@/i18n/sharedStrings';

export type BookingBottomSheetProps = {
  photographerId?: string;
  photographerName?: string;
  photographerImage?: string;
  packages?: any[];
  initialDate?: Date | null;
  onClose?: () => void;
};

const STEPS = [
  { id: 1, label: 'Basics' },
  { id: 2, label: 'Packages' },
  { id: 3, label: 'Schedule' },
  { id: 4, label: 'Payment' },
];

const KEYBOARD_ACCESSORY_ID = 'bookingSheetKeyboardDoneAccessory';

const BookingBottomSheetComponent: React.ForwardRefRenderFunction<BottomSheet, BookingBottomSheetProps> = (
  { photographerId, photographerName, photographerImage, packages = [], initialDate, onClose }, ref
) => {
  const { colors, elevation, isDark } = useTheme();
  const styles = useStyles();
  const { tr, t } = useSharedT();
  const user = useAuth((s) => s.user);
  // One tall snap point: the wizard steps and the pay step need the room, so it never opens short and needs a drag.
  const snapPoints = useMemo(() => ['90%'], []);
  const [currentStep, setCurrentStep] = useState(1);

  // Keyboard visibility tracking & input navigation refs
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const locationInputRef = useRef<any>(null);
  const minBudgetInputRef = useRef<any>(null);
  const maxBudgetInputRef = useRef<any>(null);
  const eventNameInputRef = useRef<any>(null);
  const guestInputRef = useRef<any>(null);
  const notesInputRef = useRef<any>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
    
  // Step 1 State
  const [serviceType, setServiceType] = useState<'OUTDOOR' | 'STUDIO'>('OUTDOOR');
  const [date, setDate] = useState<Date | null>(initialDate ?? null);

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
    const TAGS = ['Live Stream', 'Photobook', 'Video Coverage', 'Drone', 'Same-Day Edits', 'Photo Booth'];
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // Step 2 State
    const [selectedPackage, setSelectedPackage] = useState<any | null>(null);

    // Step 3 State
    const [eventName, setEventName] = useState('');
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [endTime, setEndTime] = useState<Date | null>(null);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [guests, setGuests] = useState('');
    const [notes, setNotes] = useState('');

    // Step 4 State
    const [milestoneOption, setMilestoneOption] = useState<'full' | 'half' | 'seventy'>('full');
    const [displayCurrency, setDisplayCurrency] = useState<'RWF' | 'USD' | 'EUR' | 'KES' | 'UGX' | 'TZS'>('RWF');
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── In-app payment (step 4) ──────────────────────────────────────────
    // After the booking is created we keep the declaration (or event) id and
    // offer "Pay now", which completes the payment in HandoffCheckoutSheet.
    const [payHandoff, setPayHandoff] = useState<{ declarationId?: string; eventId?: string } | null>(null);
    const [checkoutOpen, setCheckoutOpen] = useState(false);

    useEffect(() => {
      if (selectedPackage?.currency) {
        setDisplayCurrency(selectedPackage.currency as any);
      }
    }, [selectedPackage?.currency]);

    const toggleTag = (tag: string) => {
      setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    };

    const renderBackdrop = (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    );

    const handleBack = () => {
      if (currentStep > 1) {
        if (bookingSuccess) setBookingSuccess(false);
        else setCurrentStep(currentStep - 1);
      }
    };

    const handleContinueStep1 = () => {
      if (!photographerId) {
        Alert.alert('Error', 'No photographer selected.');
        if (ref && typeof ref !== 'function' && 'current' in ref) ref.current?.close();
        return;
      }
      if (!date) {
        Alert.alert('Required', 'Please select an event date.');
        return;
      }
      if (!location.trim()) {
        Alert.alert('Required', 'Please enter the event location.');
        return;
      }
      setCurrentStep(2);
    };

    const handleContinueStep2 = () => {
      if (!selectedPackage) {
        Alert.alert('Required', 'Please select a package to continue.');
        return;
      }
      setCurrentStep(3);
    };

    const handleContinueStep3 = () => {
      if (!eventName.trim()) {
        Alert.alert('Required', 'Please enter an Event Title.');
        return;
      }
      if (!startTime) {
        Alert.alert('Required', 'Please select a Start Time.');
        return;
      }
      
      const startMins = startTime.getHours() * 60 + startTime.getMinutes();
      
      if (date) {
        const now = new Date();
        const isToday = date.getDate() === now.getDate() && 
                        date.getMonth() === now.getMonth() && 
                        date.getFullYear() === now.getFullYear();
        
        if (isToday) {
          const currentMins = now.getHours() * 60 + now.getMinutes();
          if (startMins < currentMins) {
            Alert.alert('Invalid Time', "Start Time cannot be in the past for today's events.");
            return;
          }
        }
      }

      if (endTime) {
        const endMins = endTime.getHours() * 60 + endTime.getMinutes();
        if (startMins === endMins) {
          Alert.alert('Invalid Time', 'Start Time and End Time cannot be exactly the same.');
          return;
        }
      }

      setCurrentStep(4);
    };

    const handleConfirmBooking = async () => {
      if (!photographerId || !selectedPackage?.id || !date) {
        Alert.alert('Missing details', 'Please complete every step before confirming.');
        return;
      }
      setIsSubmitting(true);
      try {
        // Backend parses LocalDate ("YYYY-MM-DD") and LocalTime ("HH:mm:ss").
        const pad = (n: number) => String(n).padStart(2, '0');
        const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const toLocalTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        // Deposit mode → escrow percentage validated server-side (50/70/100).
        const escrow = milestoneOption === 'full' ? 100 : milestoneOption === 'seventy' ? 70 : 50;

        // 1) Create the event + PENDING booking + first payment declaration.
        const bookingRes = await bookingsApi.create({
          title: eventName,
          eventDate: toLocalDate(date),
          startTime: startTime ? toLocalTime(startTime) : undefined,
          endTime: endTime ? toLocalTime(endTime) : undefined,
          location: location.trim() || undefined,
          maxGuests: parseInt(guests, 10) || undefined,
          notes: notes.trim() || undefined,
          photographerId,
          packageId: selectedPackage.id,
          serviceType,
          escrowPercentage: escrow,
          eventTags: selectedTags.length ? selectedTags.join(',') : undefined,
        });

        // 2) Keep whatever id the web checkout can resolve the payment from.
        //    Payment itself is completed on connekyt.com — the app never
        //    collects phone numbers, telecom choices or card details.
        const declarationId = bookingRes?.data?.declarationId;
        const createdEventId = (bookingRes?.data?.event as { id?: string } | undefined)?.id;
        setPayHandoff(
          declarationId
            ? { declarationId }
            : createdEventId
              ? { eventId: createdEventId }
              : null,
        );
        setBookingSuccess(true);
      } catch (error: any) {
        // Surface the real failure instead of faking success — a booking that
        // didn't persist must not look confirmed to the client.
        const message = isApiError(error)
          ? error.message
          : typeof error?.message === 'string' && error.message
            ? error.message
            : 'We could not complete your booking. Please try again.';
        Alert.alert('Booking failed', message);
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleCompletePayment = () => {
      if (payHandoff) setCheckoutOpen(true);
    };

    const handleDownloadProof = async () => {
      try {
        const clientName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Client';
        const clientEmail = user?.email || 'No email provided';
        const photogName = photographerName || 'Photographer';

        // Everything typed by the user goes into HTML, so escape it.
        const esc = (v: unknown) =>
          String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const money = (n: number | undefined, cur: string | undefined) =>
          n == null || Number.isNaN(n) ? '—' : `${Math.round(n).toLocaleString('en-US')} ${esc(cur || '')}`.trim();
        const formatTime = (t: Date | null) =>
          t ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
        const row = (label: string, value: string) =>
          `<tr><th>${label}</th><td>${value}</td></tr>`;

        const price = selectedPackage?.price;
        const cur = selectedPackage?.currency;
        const depositPct = milestoneOption === 'full' ? 100 : milestoneOption === 'half' ? 50 : 70;
        const deposit = price != null ? (price * depositPct) / 100 : undefined;
        const minB = parseAmountNumber(minBudget);
        const maxB = parseAmountNumber(maxBudget);
        const budget =
          minB || maxB
            ? `${minB ? minB.toLocaleString('en-US') : '—'} – ${maxB ? maxB.toLocaleString('en-US') : '—'} ${esc(displayCurrency)}`
            : 'Not specified';
        const refId = payHandoff?.declarationId || payHandoff?.eventId || '';
        const reference = refId ? refId.slice(0, 8).toUpperCase() : '—';
        const issued = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

        const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { margin: 28px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; font-size: 12.5px; margin: 0; }
  .top { display: table; width: 100%; border-bottom: 3px solid #083A85; padding-bottom: 14px; margin-bottom: 18px; }
  .top > div { display: table-cell; vertical-align: middle; }
  .logo { height: 34px; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 20px; color: #083A85; letter-spacing: 0.2px; }
  .doc p { margin: 3px 0 0; color: #6B7280; }
  .status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px; background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 11px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: #6B7280; margin: 20px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 0; border-bottom: 1px solid #E5E7EB; vertical-align: top; text-align: left; }
  th { width: 38%; color: #6B7280; font-weight: 600; }
  td { font-weight: 600; }
  .parties td { width: 50%; border: 1px solid #E5E7EB; padding: 10px 12px; }
  .parties .role { color: #6B7280; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
  .parties .name { font-size: 14px; font-weight: 700; margin-top: 2px; }
  .parties .sub { color: #6B7280; font-weight: 400; margin-top: 2px; }
  .total th, .total td { font-size: 15px; color: #083A85; font-weight: 800; border-bottom: 0; padding-top: 10px; }
  .foot { margin-top: 26px; color: #6B7280; font-size: 10.5px; line-height: 1.5; border-top: 1px solid #E5E7EB; padding-top: 10px; }
</style></head>
<body>
  <div class="top">
    <div><img class="logo" src="${logoBase64}" /></div>
    <div class="doc">
      <h1>Booking Request</h1>
      <p>Reference ${esc(reference)} · Issued ${esc(issued)}</p>
      <span class="status">Awaiting photographer confirmation</span>
    </div>
  </div>

  <table class="parties"><tr>
    <td><div class="role">Client</div><div class="name">${esc(clientName)}</div><div class="sub">${esc(clientEmail)}</div></td>
    <td><div class="role">Photographer</div><div class="name">${esc(photogName)}</div><div class="sub">Requested photographer</div></td>
  </tr></table>

  <h2>Event</h2>
  <table>
    ${row('Event', esc(eventName || '—'))}
    ${row('Service', esc(serviceType || '—'))}
    ${row('Date', esc(date ? date.toDateString() : '—'))}
    ${row('Time', `${esc(formatTime(startTime))} – ${esc(formatTime(endTime))}`)}
    ${row('Location', esc(location || '—'))}
    ${row('Guests', esc(guests || '—'))}
    ${selectedTags.length > 0 ? row('Tags', selectedTags.map(esc).join(', ')) : ''}
    ${notes ? row('Notes', esc(notes)) : ''}
  </table>

  <h2>Package and payment</h2>
  <table>
    ${row('Package', esc(selectedPackage?.name || 'Not selected'))}
    ${row('Package price', money(price, cur))}
    ${row('Your budget', budget)}
    ${row('Payment plan', depositPct === 100 ? 'Full payment upfront' : `${depositPct}% deposit, balance later`)}
    <tr class="total"><th>${depositPct === 100 ? 'Amount due' : 'Deposit due'}</th><td>${money(deposit, cur)}</td></tr>
  </table>

  <div class="foot">
    This is a record of your booking request, not a payment receipt. The booking is confirmed once the
    photographer accepts it and your ${depositPct === 100 ? 'payment' : 'deposit'} is received; payments are held
    in Connekyt escrow and released to the photographer according to the payment plan.
  </div>
</body></html>`;

        const { uri } = await Print.printToFileAsync({ html, base64: false });
        
        const customFilename = `Connekyt_Booking_Request_${reference !== '—' ? reference : Date.now()}.pdf`;
        const newUri = `${FileSystem.documentDirectory}${customFilename}`;
        
        await FileSystem.copyAsync({ from: uri, to: newUri });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } else {
          Alert.alert('Sharing Unavailable', 'Your device does not support sharing this file.');
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to generate PDF.');
        console.warn(e);
      }
    };

    return (
      <>
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableOverDrag={false}
        backdropComponent={renderBackdrop}
        onClose={onClose}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        handleIndicatorStyle={styles.sheetHandleIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        {/* Compact Sheet Header */}
        <View style={styles.sheetHeader}>
          {currentStep > 1 && !bookingSuccess ? (
            <Pressable onPress={handleBack} style={styles.headerIconButton} hitSlop={10} accessibilityLabel={tr('Back')}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.headerIconSpacer} />
          )}

          <View style={styles.sheetHeaderCenter}>
            <Text style={styles.sheetHeaderTitle} numberOfLines={2}>
              {bookingSuccess ? tr('Booking Confirmed') : photographerName ? `${tr('Book Now')} ${photographerName}` : tr('Booking Request')}
            </Text>
            {!bookingSuccess && (
              <Text style={styles.sheetHeaderSubtitle}>
                Step {currentStep} of {STEPS.length} • {tr(STEPS[currentStep - 1]?.label)}
              </Text>
            )}
          </View>

          {isKeyboardVisible ? (
            <Pressable onPress={() => Keyboard.dismiss()} style={styles.keyboardDismissHeaderBtn} hitSlop={10} accessibilityLabel={tr('Done')}>
              <Ionicons name="checkmark" size={15} color={colors.primary} />
              <Text style={styles.keyboardDismissHeaderText}>{tr('Done')}</Text>
            </Pressable>
          ) : (
            <Pressable 
              onPress={() => {
                if (ref && typeof ref !== 'function' && 'current' in ref) ref.current?.close();
              }} 
              style={styles.headerIconButton}
              hitSlop={10}
              accessibilityLabel={tr('Close')}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          )}
        </View>

        {/* Sleek Segmented Progress Bar */}
        {!bookingSuccess && (
          <View style={styles.progressSegmentsRow}>
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;
              return (
                <Pressable
                  key={step.id}
                  style={[
                    styles.progressSegment,
                    (isCompleted || isActive) && styles.progressSegmentFilled,
                  ]}
                  disabled={step.id >= currentStep}
                  onPress={() => {
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  accessibilityLabel={`Step ${step.id}: ${tr(step.label)}`}
                />
              );
            })}
          </View>
        )}

        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          
          {/* STEP 1: BRIEF */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>{tr('Event Basics')}</Text>
              <Text style={styles.subtitle}>{tr('Where and when is your shoot or event taking place?')}</Text>

              <View style={styles.serviceTypes}>
                <Pressable 
                  style={[styles.serviceCard, serviceType === 'OUTDOOR' && styles.serviceCardActive]}
                  onPress={() => setServiceType('OUTDOOR')}
                >
                  <View style={[styles.serviceIconContainer, serviceType === 'OUTDOOR' && styles.serviceIconContainerActive]}>
                    <Ionicons name="location" size={18} color={serviceType === 'OUTDOOR' ? '#FFFFFF' : colors.primary} />
                  </View>
                  <View style={styles.serviceTextContainer}>
                    <View style={styles.serviceHeader}>
                      <Text style={[styles.serviceTitle, serviceType === 'OUTDOOR' && styles.serviceTitleActive]}>{tr('Outdoor')}</Text>
                      {serviceType === 'OUTDOOR' && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                    </View>
                    <Text style={styles.serviceDesc}>{tr('Photographer travels to your venue or event location.')}</Text>
                  </View>
                </Pressable>

                <Pressable 
                  style={[styles.serviceCard, serviceType === 'STUDIO' && styles.serviceCardActive]}
                  onPress={() => setServiceType('STUDIO')}
                >
                  <View style={[styles.serviceIconContainer, serviceType === 'STUDIO' && styles.serviceIconContainerActive]}>
                    <Ionicons name="camera" size={18} color={serviceType === 'STUDIO' ? '#FFFFFF' : colors.primary} />
                  </View>
                  <View style={styles.serviceTextContainer}>
                    <View style={styles.serviceHeader}>
                      <Text style={[styles.serviceTitle, serviceType === 'STUDIO' && styles.serviceTitleActive]}>{tr('Studio')}</Text>
                      {serviceType === 'STUDIO' && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                    </View>
                    <Text style={styles.serviceDesc}>{tr("Session hosted at the photographer's studio.")}</Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{tr('When is your event? *')}</Text>
                <Pressable onPress={() => setShowDatePicker(true)} style={styles.pickerSelector}>
                  <Ionicons name="calendar-outline" size={18} color={date ? colors.primary : colors.textMuted} />
                  <Text style={[styles.pickerSelectorText, !date && styles.pickerSelectorPlaceholder]}>
                    {date 
                      ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) 
                      : tr('Select event date')}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
                <DateTimePickerModal
                  isVisible={showDatePicker}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant={isDark ? 'dark' : 'light'}
                  isDarkModeEnabled={isDark}
                  textColor={isDark ? '#FFFFFF' : '#000000'}
                  minimumDate={new Date()}
                  onConfirm={(selectedDate) => {
                    setShowDatePicker(false);
                    setDate(selectedDate);
                  }}
                  onCancel={() => setShowDatePicker(false)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{tr('Where is it taking place? *')}</Text>
                <View style={styles.inputWithIconContainer}>
                  <Ionicons name="navigate-outline" size={18} color={colors.textMuted} style={styles.inputLeadingIcon} />
                  <BottomSheetTextInput 
                    ref={locationInputRef}
                    style={styles.bottomSheetInputLeading} 
                    placeholderTextColor={colors.textMuted} 
                    placeholder="e.g. Kigali Convention Center" 
                    value={location} 
                    onChangeText={setLocation}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => minBudgetInputRef.current?.focus()}
                    blurOnSubmit={false}
                    inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{tr('Estimated Budget (Optional)')}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={[styles.inputWithPrefixContainer, { flex: 1 }]}>
                    <Text style={styles.currencyPrefix}>{displayCurrency}</Text>
                    <BottomSheetTextInput 
                      ref={minBudgetInputRef}
                      style={styles.bottomSheetInputPrefix} 
                      placeholder="Min" 
                      placeholderTextColor={colors.textMuted} 
                      value={minBudget} 
                      onChangeText={(t) => setMinBudget(formatAmountWithCommas(t))} 
                      keyboardType="number-pad"
                      returnKeyType="next"
                      onSubmitEditing={() => maxBudgetInputRef.current?.focus()}
                      blurOnSubmit={false}
                      inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                    />
                  </View>
                  <View style={[styles.inputWithPrefixContainer, { flex: 1 }]}>
                    <Text style={styles.currencyPrefix}>{displayCurrency}</Text>
                    <BottomSheetTextInput 
                      ref={maxBudgetInputRef}
                      style={styles.bottomSheetInputPrefix} 
                      placeholder="Max" 
                      placeholderTextColor={colors.textMuted} 
                      value={maxBudget} 
                      onChangeText={(t) => setMaxBudget(formatAmountWithCommas(t))} 
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{tr('What kind of coverage do you need?')}</Text>
                <View style={styles.tagsContainer}>
                  {TAGS.map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Pressable 
                        key={tag} 
                        style={[styles.tagBadge, isSelected && styles.tagBadgeActive]}
                        onPress={() => toggleTag(tag)}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        )}
                        <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>{tr(tag)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.continueButton} onPress={handleContinueStep1}>
                  <Text style={styles.continueButtonText}>{tr('Continue to Packages')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 2: PACKAGE */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>{tr('Select a Package')}</Text>
              <Text style={styles.subtitle}>{tr('Choose the photography package that fits your event.')}</Text>
              
              <View style={{ marginTop: spacing.sm }}>
                {packages.length === 0 ? (
                  <View style={styles.emptyPackagesCard}>
                    <View style={styles.emptyPackagesIconCircle}>
                      <Ionicons name="pricetags-outline" size={32} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyPackagesTitle}>{tr('No Pre-Set Packages')}</Text>
                    <Text style={styles.emptyPackagesDesc}>
                      {tr("This photographer hasn't published pre-set packages yet. Reach out to them directly or proceed with your custom brief.")}
                    </Text>
                  </View>
                ) : null}
                {packages.map(pkg => {
                  const isActive = selectedPackage?.id === pkg.id;
                  
                  const badgeColor = pkg.name?.toLowerCase().includes('gold') ? '#D97706' : 
                                     pkg.name?.toLowerCase().includes('silver') ? '#64748B' : 
                                     pkg.name?.toLowerCase().includes('bronze') ? '#B45309' : colors.primary;

                  return (
                    <Pressable 
                      key={pkg.id} 
                      style={[styles.packageCard, isActive && styles.packageCardActive]}
                      onPress={() => setSelectedPackage(pkg)}
                    >
                      <View style={styles.packageCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={[styles.packageBadge, { backgroundColor: badgeColor }]}>
                            <Text style={styles.packageBadgeText}>{pkg.name}</Text>
                          </View>
                          {pkg.name?.toLowerCase().includes('live') && (
                            <View style={styles.liveIndicator}>
                              <Ionicons name="radio" size={11} color="#EF4444" />
                              <Text style={styles.liveText}>{tr('LIVE')}</Text>
                            </View>
                          )}
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.packagePrice}>
                            {formatSelectedPrice(pkg.price, pkg.currency)}
                          </Text>
                          <View style={[styles.packageRadioCircle, isActive && styles.packageRadioCircleActive]}>
                            {isActive && <View style={styles.packageRadioDot} />}
                          </View>
                        </View>
                      </View>

                      {/* Package includes stats */}
                      <View style={styles.packageStatsRow}>
                        {typeof pkg.durationHours === 'number' && pkg.durationHours > 0 && (
                          <View style={styles.packageStat}>
                            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                            <Text style={styles.packageStatText}>{pkg.durationHours}h {tr('coverage')}</Text>
                          </View>
                        )}
                        {typeof pkg.includedPhotos === 'number' && pkg.includedPhotos > 0 && (
                          <View style={styles.packageStat}>
                            <Ionicons name="image-outline" size={14} color={colors.textMuted} />
                            <Text style={styles.packageStatText}>{pkg.includedPhotos} {tr('photos')}</Text>
                          </View>
                        )}
                        {typeof pkg.includedVideos === 'number' && pkg.includedVideos > 0 && (
                          <View style={styles.packageStat}>
                            <Ionicons name="videocam-outline" size={14} color={colors.textMuted} />
                            <Text style={styles.packageStatText}>{pkg.includedVideos} {tr('videos')}</Text>
                          </View>
                        )}
                      </View>

                      {pkg.hasLiveStream === true && (
                        <View style={styles.packageFeaturesRow}>
                          <View style={styles.packageFeature}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                            <Text style={styles.packageFeatureText}>{tr('Live stream broadcast included')}</Text>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.footer}>
                <Pressable 
                  style={[styles.continueButton, !selectedPackage && packages.length > 0 && { opacity: 0.6 }]} 
                  onPress={handleContinueStep2}
                  disabled={!selectedPackage && packages.length > 0}
                >
                  <Text style={styles.continueButtonText}>{tr('Continue to Schedule')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 3: DETAILS */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>{tr('Schedule & Notes')}</Text>
              <Text style={styles.subtitle}>{tr('Help the photographer prepare for your event.')}</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>{tr('What should we call this event? *')}</Text>
                <View style={styles.inputWithIconContainer}>
                  <Ionicons name="bookmark-outline" size={18} color={colors.textMuted} style={styles.inputLeadingIcon} />
                  <BottomSheetTextInput 
                    ref={eventNameInputRef}
                    style={styles.bottomSheetInputLeading} 
                    placeholderTextColor={colors.textMuted} 
                    placeholder="e.g. Sarah & Michael Wedding" 
                    value={eventName} 
                    onChangeText={setEventName}
                    autoCapitalize="words"
                    autoCorrect={true}
                    returnKeyType="next"
                    onSubmitEditing={() => guestInputRef.current?.focus()}
                    blurOnSubmit={false}
                    inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{tr('Start Time *')}</Text>
                  <Pressable onPress={() => setShowStartTimePicker(true)} style={styles.pickerSelector}>
                    <Ionicons name="time-outline" size={18} color={startTime ? colors.primary : colors.textMuted} />
                    <Text style={[styles.pickerSelectorText, !startTime && styles.pickerSelectorPlaceholder]}>
                      {startTime ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : tr('Set start')}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                  </Pressable>
                  <DateTimePickerModal
                    isVisible={showStartTimePicker}
                    mode="time"
                    minuteInterval={15}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={isDark ? 'dark' : 'light'}
                    isDarkModeEnabled={isDark}
                    textColor={isDark ? '#FFFFFF' : '#000000'}
                    minimumDate={date && new Date().toDateString() === date.toDateString() ? new Date() : undefined}
                    onConfirm={(selectedTime) => {
                      setShowStartTimePicker(false);
                      setStartTime(selectedTime);
                    }}
                    onCancel={() => setShowStartTimePicker(false)}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{tr('End Time (Optional)')}</Text>
                  <Pressable onPress={() => setShowEndTimePicker(true)} style={styles.pickerSelector}>
                    <Ionicons name="time-outline" size={18} color={endTime ? colors.primary : colors.textMuted} />
                    <Text style={[styles.pickerSelectorText, !endTime && styles.pickerSelectorPlaceholder]}>
                      {endTime ? endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : tr('Set end')}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                  </Pressable>
                  <DateTimePickerModal
                    isVisible={showEndTimePicker}
                    mode="time"
                    minuteInterval={15}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={isDark ? 'dark' : 'light'}
                    isDarkModeEnabled={isDark}
                    textColor={isDark ? '#FFFFFF' : '#000000'}
                    date={endTime || (startTime ? new Date(startTime.getTime() + 15 * 60000) : new Date())}
                    onConfirm={(selectedTime) => {
                      setShowEndTimePicker(false);
                      setEndTime(selectedTime);
                    }}
                    onCancel={() => setShowEndTimePicker(false)}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{tr('Estimated Guest Count (Optional)')}</Text>
                <View style={styles.inputWithIconContainer}>
                  <Ionicons name="people-outline" size={18} color={colors.textMuted} style={styles.inputLeadingIcon} />
                  <BottomSheetTextInput 
                    ref={guestInputRef}
                    style={styles.bottomSheetInputLeading} 
                    placeholderTextColor={colors.textMuted} 
                    placeholder="e.g. 150" 
                    value={guests} 
                    onChangeText={setGuests} 
                    keyboardType="number-pad" 
                    returnKeyType="next"
                    onSubmitEditing={() => notesInputRef.current?.focus()}
                    blurOnSubmit={false}
                    inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{tr('Special Requests / Notes')}</Text>
                <BottomSheetTextInput 
                  ref={notesInputRef}
                  style={styles.bottomSheetInputMultiline} 
                  placeholderTextColor={colors.textMuted} 
                  placeholder={tr('Tell the photographer about shot lists, timeline, or special requirements...')} 
                  value={notes} 
                  onChangeText={setNotes} 
                  multiline 
                  numberOfLines={4}
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                  autoCorrect={true}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.continueButton} onPress={handleContinueStep3}>
                  <Text style={styles.continueButtonText}>{tr('Review & Payment')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 4: PAYMENT */}
          {currentStep === 4 && (
            <View style={styles.stepContent}>
              {bookingSuccess ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark" size={44} color="#FFFFFF" />
                  </View>
                  <Text style={styles.successTitle}>{tr('Booking Reserved!')}</Text>
                  <Text style={styles.successSubtitle}>
                    {tr('Your event has been recorded. To secure your date, pay now or later from Payments.')}
                  </Text>

                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>{tr('Booking Summary')}</Text>
                    
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{tr('Event')}</Text>
                      <Text style={styles.summaryValue}>{eventName}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{tr('Date')}</Text>
                      <Text style={styles.summaryValue}>{date?.toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{tr('Package')}</Text>
                      <Text style={styles.summaryValue}>{selectedPackage?.name}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryTotalLabel}>{tr('Total Amount')}</Text>
                      <Text style={styles.summaryTotalValue}>{formatSelectedPrice(selectedPackage?.price, selectedPackage?.currency)}</Text>
                    </View>
                  </View>

                  {payHandoff ? (
                    <>
                      <Pressable
                        style={[styles.continueButton, { marginBottom: 12 }]}
                        onPress={handleCompletePayment}
                      >
                        <Ionicons name="card-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.continueButtonText}>{tr('Pay now')}</Text>
                      </Pressable>
                      <Text style={styles.handoffHint}>
                        {tr('Your booking is held for you. You can also complete your payment later anytime from your Payments tab.')}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.handoffHint}>
                      {tr('Your request has been sent to the photographer. Once accepted, you can pay from Payments.')}
                    </Text>
                  )}

                  <Pressable style={styles.secondaryButton} onPress={handleDownloadProof}>
                    <Ionicons name="download-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryButtonText}>{tr('Download Booking Proof (PDF)')}</Text>
                  </Pressable>

                  <Pressable 
                    style={styles.doneButton} 
                    onPress={() => {
                      if (ref && typeof ref !== 'function' && 'current' in ref) ref.current?.close();
                      setBookingSuccess(false);
                      setPayHandoff(null);
                      setCurrentStep(1);
                    }}
                  >
                    <Text style={styles.doneButtonText}>{tr('Done')}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={[styles.title, { textAlign: 'center' }]}>{tr('Choose Payment Terms')}</Text>
                  <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: spacing.lg }]}>
                    {tr('Choose how you want to schedule your payment.')}
                  </Text>
                  
                  {(() => {
                    const basePrice = selectedPackage?.price || 0;
                    const baseCurrency = selectedPackage?.currency || 'RWF';
                    
                    // Live rates from the currency store (per 1 USD), not a private
                    // table: this one said 1350 RWF while the platform used ~1478.
                    const liveRates = useCurrency.getState().currencies;
                    const src = liveRates.find((c) => c.code === baseCurrency)?.rate;
                    const dst = liveRates.find((c) => c.code === displayCurrency)?.rate;
                    const knownRate =
                      baseCurrency === displayCurrency
                        ? 1
                        : src && dst ? dst / src : undefined;
                    const shownCurrency = knownRate === undefined ? baseCurrency : displayCurrency;
                    const rate = knownRate ?? 1;

                    const formatPrice = (amount: number) => {
                      const val = amount * rate;
                      if (shownCurrency === 'RWF') return `${Math.round(val).toLocaleString()} RWF`;
                      if (shownCurrency === 'KES') return `KSh ${Math.round(val).toLocaleString()}`;
                      if (shownCurrency === 'UGX') return `USh ${Math.round(val).toLocaleString()}`;
                      if (shownCurrency === 'TZS') return `TSh ${Math.round(val).toLocaleString()}`;
                      if (shownCurrency === 'USD') return `$${val.toFixed(2)}`;
                      if (shownCurrency === 'EUR') return `€${val.toFixed(2)}`;
                      return `${shownCurrency} ${val.toFixed(2)}`;
                    };

                    const totalDisplay = formatPrice(basePrice);

                    const CURRENCIES = [
                      { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
                      { code: 'RWF', name: 'Rwandan Franc', flag: '🇷🇼' },
                      { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
                      { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
                      { code: 'UGX', name: 'Ugandan Shilling', flag: '🇺🇬' },
                      { code: 'TZS', name: 'Tanzanian Shilling', flag: '🇹🇿' },
                    ];

                    return (
                      <>
                        <View style={styles.heroAmountCard}>
                          <Text style={styles.heroAmountLabel}>{tr('Total Package Price')}</Text>
                          <Text style={styles.heroAmountValue}>{totalDisplay}</Text>
                        </View>

                        <View style={styles.currencyToggleRow}>
                          <Text style={styles.currencyToggleLabel}>{tr('Display currency')}</Text>
                          <Pressable 
                            onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                            style={styles.currencySelectorPill}
                          >
                            <Text style={styles.currencySelectorPillText}>{displayCurrency}</Text>
                            <Ionicons name={showCurrencyDropdown ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
                          </Pressable>

                          {showCurrencyDropdown && (
                            <View style={[styles.currencyDropdownMenu, elevation(3)]}>
                              {CURRENCIES.map(c => (
                                <Pressable 
                                  key={c.code} 
                                  style={[styles.currencyDropdownItem, displayCurrency === c.code && styles.currencyDropdownItemActive]}
                                  onPress={() => { setDisplayCurrency(c.code as any); setShowCurrencyDropdown(false); }}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                                    <Text style={styles.currencyCodeText}>{c.code}</Text>
                                    <Text style={styles.currencyNameText}>{c.name}</Text>
                                  </View>
                                  {displayCurrency === c.code && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>

                        <View style={styles.milestonesContainer}>
                          {[
                            { key: 'half' as const, label: 'Pay 50% Deposit Now', desc: '50% now, 50% before event date' },
                            { key: 'seventy' as const, label: 'Pay 70% Deposit Now', desc: '70% now, 30% before event date' },
                            { key: 'full' as const, label: 'Pay Full Amount Now', desc: 'Complete entire payment securely today' },
                          ].map(opt => {
                            const sel = milestoneOption === opt.key;
                            return (
                              <Pressable 
                                key={opt.key} 
                                onPress={() => setMilestoneOption(opt.key)} 
                                style={[styles.milestoneCard, sel && styles.milestoneCardActive]}
                              >
                                <View style={[styles.milestoneRadioCircle, sel && styles.milestoneRadioCircleActive]}>
                                  {sel && <View style={styles.milestoneRadioDot} />}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.milestoneTitle, sel && styles.milestoneTitleActive]}>{tr(opt.label)}</Text>
                                  <Text style={styles.milestoneDesc}>{tr(opt.desc)}</Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>

                        <View style={styles.splitCard}>
                          {(() => {
                            const splits = {
                              full: [{ label: 'Full payment upfront', pct: 100 }],
                              half: [{ label: 'Deposit (50%)', pct: 50 }, { label: 'Balance before event (50%)', pct: 50 }],
                              seventy: [{ label: 'Deposit (70%)', pct: 70 }, { label: 'Balance before event (30%)', pct: 30 }],
                            };
                            return splits[milestoneOption].map((m, i, arr) => (
                              <View key={i} style={[styles.splitRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <View style={[styles.splitDot, { backgroundColor: i === 0 ? colors.primary : colors.textMuted }]} />
                                  <Text style={styles.splitLabel}>{tr(m.label)}</Text>
                                </View>
                                <Text style={styles.splitValue}>
                                  {formatPrice(basePrice * m.pct / 100)}
                                </Text>
                              </View>
                            ));
                          })()}
                        </View>
                      </>
                    );
                  })()}

                  <View style={styles.handoffNoticeBanner}>
                    <Ionicons name="globe-outline" size={18} color={colors.primary} />
                    <Text style={styles.handoffNoticeText}>
                      {tr('After you confirm, you can pay securely in the app.')}
                    </Text>
                  </View>

                  <View style={styles.escrowCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
                      <Text style={styles.escrowTitle}>{tr('Connekyt Escrow Protection')}</Text>
                    </View>
                    <Text style={styles.escrowBody}>
                      {tr('Your money is held in escrow by Connekyt, not sent directly to the photographer. We release funds only when your event is delivered.')}
                    </Text>
                  </View>

                  <View style={styles.footer}>
                    <Pressable
                      style={[styles.continueButton, isSubmitting && { opacity: 0.7 }]}
                      onPress={handleConfirmBooking}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Text style={styles.continueButtonText}>{tr('Confirm Booking Request')}</Text>
                          <Ionicons name="lock-closed" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

        </BottomSheetScrollView>

        {/* iOS Keyboard Accessory Toolbar */}
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
            <View style={styles.keyboardToolbar}>
              <View style={styles.keyboardToolbarSpacer} />
              <Pressable
                onPress={() => Keyboard.dismiss()}
                style={styles.keyboardToolbarDoneButton}
                hitSlop={10}
                accessibilityLabel="Done editing"
              >
                <Text style={styles.keyboardToolbarDoneText}>Done</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}
      </BottomSheet>
      <HandoffCheckoutSheet
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        handoff={payHandoff ? { type: 'BOOKING_DECLARATION', ...payHandoff } : null}
        title={eventName || 'Booking'}
        subtitle={photographerName}
        amountLabel={formatSelectedPrice(selectedPackage?.price, selectedPackage?.currency)}
      />
      </>
    );
  };

export const BookingBottomSheet = forwardRef(BookingBottomSheetComponent);

const useStyles = makeStyles((c) => ({
  bottomSheetInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: c.text,
  },
  bottomSheetInputMultiline: {
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    padding: spacing.md,
    fontSize: 14,
    color: c.text,
    textAlignVertical: 'top',
  },
  sheetBackground: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
  },
  sheetHandleIndicator: {
    backgroundColor: c.borderSoft,
    width: 38,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconSpacer: {
    width: 32,
  },
  keyboardDismissHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  keyboardDismissHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
  },
  keyboardToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  keyboardToolbarSpacer: {
    flex: 1,
  },
  keyboardToolbarDoneButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  keyboardToolbarDoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: c.primary,
  },
  sheetHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  sheetHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
  },
  sheetHeaderSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: c.textMuted,
    marginTop: 2,
  },
  progressSegmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 3.5,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  progressSegmentFilled: {
    backgroundColor: c.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: c.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: c.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  serviceTypes: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  serviceCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.md,
    backgroundColor: c.surface,
  },
  serviceCardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  serviceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  serviceIconContainerActive: {
    backgroundColor: c.primary,
  },
  serviceTextContainer: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
  },
  serviceTitleActive: {
    color: c.primary,
  },
  serviceDesc: {
    fontSize: 11,
    color: c.textMuted,
    lineHeight: 15,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.xs,
  },
  pickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: c.surface,
  },
  pickerSelectorText: {
    fontSize: 14,
    color: c.text,
    fontWeight: '500',
    flex: 1,
    marginLeft: spacing.sm,
  },
  pickerSelectorPlaceholder: {
    color: c.textMuted,
  },
  inputWithIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputLeadingIcon: {
    marginRight: spacing.sm,
  },
  bottomSheetInputLeading: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    height: '100%',
    paddingVertical: 0,
  },
  inputWithPrefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  currencyPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    marginRight: 6,
  },
  bottomSheetInputPrefix: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    height: '100%',
    paddingVertical: 0,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  tagBadgeActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text,
  },
  tagTextActive: {
    color: '#FFFFFF',
  },
  emptyPackagesCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    marginTop: spacing.md,
  },
  emptyPackagesIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyPackagesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
  },
  emptyPackagesDesc: {
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  packageCard: {
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: c.surface,
  },
  packageCardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  packageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  packageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  packageBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: c.text,
  },
  packageRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageRadioCircleActive: {
    borderColor: c.primary,
  },
  packageRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.primary,
  },
  packageStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: 4,
  },
  packageStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  packageStatText: {
    fontSize: 12,
    color: c.textMuted,
  },
  packageFeaturesRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  packageFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  packageFeatureText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  heroAmountCard: {
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroAmountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroAmountValue: {
    fontSize: 26,
    fontWeight: '900',
    color: c.text,
    letterSpacing: -0.5,
  },
  currencyToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    position: 'relative',
    zIndex: 10,
  },
  currencyToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textMuted,
  },
  currencySelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  currencySelectorPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.text,
  },
  currencyDropdownMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 220,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingVertical: 4,
    zIndex: 99,
  },
  currencyDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  currencyDropdownItemActive: {
    backgroundColor: c.surfaceMuted,
  },
  currencyCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  currencyNameText: {
    fontSize: 11,
    color: c.textMuted,
  },
  milestonesContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    backgroundColor: c.surface,
  },
  milestoneCardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  milestoneRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneRadioCircleActive: {
    borderColor: c.primary,
  },
  milestoneRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.primary,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  milestoneTitleActive: {
    color: c.primary,
  },
  milestoneDesc: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 1,
  },
  splitCard: {
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  splitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  splitLabel: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '500',
  },
  splitValue: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  handoffNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  handoffNoticeText: {
    flex: 1,
    fontSize: 12,
    color: c.primary,
    lineHeight: 16,
    fontWeight: '500',
  },
  escrowCard: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  escrowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  escrowBody: {
    fontSize: 11,
    color: '#15803D',
    lineHeight: 16,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  continueButton: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: radii.lg,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    marginBottom: spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: c.surfaceMuted,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: c.text,
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: c.text,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: c.textMuted,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: c.borderSoft,
    marginVertical: spacing.xs,
  },
  summaryTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: c.text,
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: '900',
    color: c.primary,
  },
  handoffHint: {
    fontSize: 11,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
}));
