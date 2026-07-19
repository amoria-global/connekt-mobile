import React, { forwardRef, useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Alert, Platform } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { Input } from '@/components/ui/Input';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { bookingsApi } from '@/api/endpoints/bookings';
import { useAuth, isApiError } from '@/store/auth';
import { logoBase64 } from '@/utils/logoBase64';
import { mintHandoffUrl, openWebCheckout } from '@/features/payments/webCheckout';

export type BookingBottomSheetProps = {
  photographerId?: string;
  photographerName?: string;
  photographerImage?: string;
  packages?: any[];
  onClose?: () => void;
};

const STEPS = [
  { id: 1, label: 'BASICS' },
  { id: 2, label: 'SERVICES' },
  { id: 3, label: 'DETAILS' },
  { id: 4, label: 'PAYMENT' },
];

const BookingBottomSheetComponent: React.ForwardRefRenderFunction<BottomSheet, BookingBottomSheetProps> = (
  { photographerId, photographerName, photographerImage, packages = [], onClose }, ref
) => {
    const user = useAuth((s) => s.user);
    const snapPoints = useMemo(() => ['65%', '90%'], []);
    const [currentStep, setCurrentStep] = useState(1);
    
    // Step 1 State
    const [serviceType, setServiceType] = useState<'OUTDOOR' | 'STUDIO'>('OUTDOOR');
    const [date, setDate] = useState<Date | null>(null);
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

    // ── Web payment handoff (step 4) ─────────────────────────────────────
    // The app no longer collects payment details (phone / telecom / card
    // pickers). After the booking is created we keep the declaration (or
    // event) id and offer a single "Complete payment on connekyt.com"
    // button that opens the web checkout.
    const [payHandoff, setPayHandoff] = useState<{ declarationId?: string; eventId?: string } | null>(null);
    const [openingCheckout, setOpeningCheckout] = useState(false);

    useEffect(() => {
      if (selectedPackage?.currency) {
        setDisplayCurrency(selectedPackage.currency as any);
      }
    }, [selectedPackage?.currency]);

    const toggleTag = (tag: string) => {
      setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    };

    const renderBackdrop = (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
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

    // Mint the BOOKING_DECLARATION handoff for the booking we just created
    // and open the connekyt.com checkout in the in-app browser.
    const handleCompletePaymentOnWeb = async () => {
      if (!payHandoff || openingCheckout) return;
      setOpeningCheckout(true);
      try {
        const url = await mintHandoffUrl('BOOKING_DECLARATION', payHandoff);
        await openWebCheckout(url);
      } catch (error) {
        Alert.alert(
          'Could not open checkout',
          isApiError(error) ? error.message : 'Something went wrong. Please try again from Payments.',
        );
      } finally {
        setOpeningCheckout(false);
      }
    };

    const handleDownloadProof = async () => {
      try {
        const clientName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Client';
        const clientEmail = user?.email || 'No email provided';
        const clientImage = user?.profilePicture || 'https://ui-avatars.com/api/?name=C&background=random';
        
        const photogName = photographerName || 'Photographer';
        const photogImage = photographerImage || 'https://ui-avatars.com/api/?name=P&background=random';

        const formatTime = (t: Date | null) => {
          if (!t) return 'N/A';
          return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const html = `
          <html>
            <head>
              <style>
                body { 
                  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                  padding: 40px; 
                  color: #333; 
                  background-color: #fff;
                  position: relative;
                }
                .watermark {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  opacity: 0.15;
                  width: 400px;
                  height: auto;
                  z-index: -1;
                }
                .card { background: rgba(249, 250, 251, 0.85); padding: 30px; border-radius: 16px; border: 1px solid #e5e7eb; position: relative; z-index: 1; }
                h1 { color: #1e3a8a; margin-top: 0; }
                .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }
                
                .profiles-container {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 30px;
                  gap: 20px;
                }
                .profile-card {
                  flex: 1;
                  background: #fff;
                  border: 1px solid #e5e7eb;
                  border-radius: 12px;
                  padding: 15px;
                  display: flex;
                  align-items: center;
                  gap: 15px;
                }
                .profile-img {
                  width: 60px;
                  height: 60px;
                  border-radius: 30px;
                  object-fit: cover;
                }
                .profile-info h3 { margin: 0 0 4px 0; font-size: 16px; color: #111827; }
                .profile-info p { margin: 0; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; }
                .profile-info span { font-size: 14px; color: #4b5563; }

                .section-title {
                  font-size: 18px;
                  color: #1e3a8a;
                  border-bottom: 1px solid #e5e7eb;
                  padding-bottom: 8px;
                  margin-top: 25px;
                  margin-bottom: 15px;
                }

                .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }
                .label { font-weight: 600; color: #6b7280; width: 40%; }
                .value { font-weight: 700; color: #111827; width: 60%; text-align: right; }
                .total { font-size: 24px; color: #16a34a; margin-top: 20px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
                .tags { font-size: 13px; color: #111827; background: #e5e7eb; padding: 4px 8px; border-radius: 4px; margin-left: 4px; display: inline-block; }
              </style>
            </head>
            <body>
              <img src="${logoBase64}" class="watermark" />
              <div class="card">
                <div class="header">
                  <h1>Connekyt Booking Proof</h1>
                  <p style="color: #4b5563; font-size: 16px;">Thank you for your booking request! Here is your complete receipt.</p>
                </div>

                <div class="profiles-container">
                  <div class="profile-card">
                    <img src="${clientImage}" class="profile-img" />
                    <div class="profile-info">
                      <p>Client</p>
                      <h3>${clientName}</h3>
                      <span>${clientEmail}</span>
                    </div>
                  </div>
                  <div class="profile-card">
                    <img src="${photogImage}" class="profile-img" />
                    <div class="profile-info">
                      <p>Photographer</p>
                      <h3>${photogName}</h3>
                      <span>Requested Talent</span>
                    </div>
                  </div>
                </div>

                <div class="section-title">1. Brief</div>
                <div class="row">
                  <span class="label">Service Type:</span>
                  <span class="value">${serviceType}</span>
                </div>
                <div class="row">
                  <span class="label">Date:</span>
                  <span class="value">${date ? date.toDateString() : 'N/A'}</span>
                </div>
                <div class="row">
                  <span class="label">Location:</span>
                  <span class="value">${location || 'N/A'}</span>
                </div>
                <div class="row">
                  <span class="label">Budget:</span>
                  <span class="value">${minBudget || '0'} - ${maxBudget || '0'}</span>
                </div>
                <div class="row">
                  <span class="label">Tags:</span>
                  <span class="value">${selectedTags.length > 0 ? selectedTags.map(t => '<span class="tags">' + t + '</span>').join(' ') : 'None'}</span>
                </div>

                <div class="section-title">2. Package</div>
                <div class="row">
                  <span class="label">Selected Package:</span>
                  <span class="value">${selectedPackage?.name || 'N/A'}</span>
                </div>
                <div class="row">
                  <span class="label">Base Price:</span>
                  <span class="value">${selectedPackage?.price} ${selectedPackage?.currency}</span>
                </div>

                <div class="section-title">3. Details</div>
                <div class="row">
                  <span class="label">Event Title:</span>
                  <span class="value">${eventName || 'N/A'}</span>
                </div>
                <div class="row">
                  <span class="label">Start Time:</span>
                  <span class="value">${formatTime(startTime)}</span>
                </div>
                <div class="row">
                  <span class="label">End Time:</span>
                  <span class="value">${formatTime(endTime)}</span>
                </div>
                <div class="row">
                  <span class="label">Total Guests:</span>
                  <span class="value">${guests || 'N/A'}</span>
                </div>
                <div class="row">
                  <span class="label">Notes:</span>
                  <span class="value">${notes || 'None'}</span>
                </div>

                <div class="section-title">4. Payment</div>
                <div class="row">
                  <span class="label">Milestone Plan:</span>
                  <span class="value">${milestoneOption === 'full' ? '100% Upfront' : milestoneOption === 'half' ? '50% Deposit' : '70% Deposit'}</span>
                </div>
                <div class="row total">
                  <span class="label">Total Amount:</span>
                  <span class="value">${selectedPackage?.price} ${displayCurrency}</span>
                </div>
              </div>
            </body>
          </html>
        `;

        const { uri } = await Print.printToFileAsync({ html, base64: false });
        
        // Rename the file to "Contract between X and Y.pdf"
        const customFilename = `Contract_between_${clientName}_and_${photogName}_${Date.now()}.pdf`.replace(/\s+/g, '_');
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
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onClose={onClose}
        handleIndicatorStyle={{ backgroundColor: colors.borderSoft, width: 40 }}
        backgroundStyle={{ backgroundColor: 'white', borderRadius: radii.xl * 2 }}
      >
        {/* Header */}
        <View style={styles.header}>
          {currentStep > 1 && !bookingSuccess && (
            <Pressable onPress={handleBack} style={styles.backButton} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          <View style={styles.headerTitleContainer}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={styles.headerTitle}>CONNEKYT BOOKING</Text>
          </View>
          <Pressable onPress={() => {
              if (ref && typeof ref !== 'function' && 'current' in ref) ref.current?.close();
            }} 
            style={styles.closeButton}
            hitSlop={10}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Stepper */}
        {!bookingSuccess && (
          <View style={styles.stepperContainer}>
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, currentStep >= step.id && styles.stepCircleActive]}>
                    <Text style={[styles.stepNumber, currentStep >= step.id && styles.stepNumberActive]}>
                      {step.id}
                    </Text>
                  </View>
                  <Text style={[styles.stepLabel, currentStep >= step.id && styles.stepLabelActive]}>
                    {step.label}
                  </Text>
                </View>
                {index < STEPS.length - 1 && (
                  <View style={[styles.stepLine, currentStep > step.id && styles.stepLineActive]} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        <BottomSheetScrollView contentContainerStyle={styles.content}>
          
          {/* STEP 1: BRIEF */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Let's start with the basics</Text>
              <Text style={styles.subtitle}>Where and when is your event taking place?</Text>

              <View style={styles.serviceTypes}>
                <Pressable 
                  style={[styles.serviceCard, serviceType === 'OUTDOOR' && styles.serviceCardActive]}
                  onPress={() => setServiceType('OUTDOOR')}
                >
                  <View style={styles.serviceIconContainer}>
                    <Ionicons name="location" size={20} color={serviceType === 'OUTDOOR' ? colors.primary : colors.textMuted} />
                  </View>
                  <View style={styles.serviceTextContainer}>
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle}>Outdoor</Text>
                      {serviceType === 'OUTDOOR' && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                    </View>
                    <Text style={styles.serviceDesc}>The photographer comes to your venue or event location.</Text>
                  </View>
                </Pressable>

                <Pressable 
                  style={[styles.serviceCard, serviceType === 'STUDIO' && styles.serviceCardActive]}
                  onPress={() => setServiceType('STUDIO')}
                >
                  <View style={styles.serviceIconContainer}>
                    <Ionicons name="camera" size={20} color={serviceType === 'STUDIO' ? colors.primary : colors.textMuted} />
                  </View>
                  <View style={styles.serviceTextContainer}>
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle}>Indoor</Text>
                      {serviceType === 'STUDIO' && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                    </View>
                    <Text style={styles.serviceDesc}>A photo / video shoot at the photographer's own studio.</Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>When is your event? *</Text>
                <Pressable onPress={() => setShowDatePicker(true)} style={styles.inputWithIcon}>
                  <View pointerEvents="none" style={{ width: '100%' }}>
                    <Input 
                      placeholder="" 
                      value={date ? date.toLocaleDateString() : ''} 
                      editable={false} 
                      style={styles.inputField} 
                    />
                  </View>
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                </Pressable>
                <DateTimePickerModal
                  isVisible={showDatePicker}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant="light"
                  isDarkModeEnabled={false}
                  textColor="black"
                  minimumDate={new Date()}
                  onConfirm={(selectedDate) => {
                    setShowDatePicker(false);
                    setDate(selectedDate);
                  }}
                  onCancel={() => setShowDatePicker(false)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Where is it taking place? *</Text>
                <BottomSheetTextInput 
                  style={styles.bottomSheetInput} 
                  placeholderTextColor={colors.textMuted} 
                  placeholder="e.g. Kigali Convention Center" 
                  value={location} 
                  onChangeText={setLocation} 
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Estimated Budget</Text>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <BottomSheetTextInput 
                    style={[styles.bottomSheetInput, { flex: 1 }]} 
                    placeholder="Min Amount" 
                    placeholderTextColor={colors.textMuted} 
                    value={minBudget} 
                    onChangeText={setMinBudget} 
                    keyboardType="numeric" 
                  />
                  <BottomSheetTextInput 
                    style={[styles.bottomSheetInput, { flex: 1 }]} 
                    placeholder="Max Amount" 
                    placeholderTextColor={colors.textMuted} 
                    value={maxBudget} 
                    onChangeText={setMaxBudget} 
                    keyboardType="numeric" 
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>What kind of coverage do you need?</Text>
                <View style={styles.tagsContainer}>
                  {TAGS.map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Pressable 
                        key={tag} 
                        style={[styles.tagBadge, isSelected && [styles.tagBadge, { backgroundColor: "#083A85", borderColor: "#083A85" }]]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter(t => t !== tag));
                          } else {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                      >
                        <Text style={[styles.tagText, isSelected && [styles.tagText, { color: "#FFFFFF" }]]}>{tag}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.continueButton} onPress={handleContinueStep1}>
                  <Text style={styles.continueButtonText}>Continue</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 2: PACKAGE */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Select a Package</Text>
              <Text style={styles.subtitle}>Choose the photography package that fits your needs.</Text>
              
              <View style={{ marginTop: spacing.lg }}>
                {packages.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                    <Ionicons name="pricetags-outline" size={32} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.md }}>
                      This photographer hasn't published any packages yet. Reach out to them directly to arrange a shoot.
                    </Text>
                  </View>
                ) : null}
                {(() => {
                  // Only ever offer the photographer's REAL packages — a booking
                  // needs a valid package id the backend can resolve.
                  const displayPackages = packages;
                  return displayPackages.map(pkg => {
                  const isActive = selectedPackage?.id === pkg.id;
                  
                  const badgeColor = pkg.name?.toLowerCase().includes('gold') ? '#EAB308' : 
                                     pkg.name?.toLowerCase().includes('silver') ? '#94A3B8' : 
                                     pkg.name?.toLowerCase().includes('bronze') ? '#B45309' : colors.primary;

                  return (
                    <Pressable 
                      key={pkg.id} 
                      style={[styles.packageCard, isActive && styles.packageCardActive]}
                      onPress={() => setSelectedPackage(pkg)}
                    >
                      <View style={styles.packageCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.packageBadge, { backgroundColor: badgeColor }]}>
                            <Text style={styles.packageBadgeText}>{pkg.name}</Text>
                          </View>
                          {pkg.name?.toLowerCase().includes('live') && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="radio" size={12} color="#ef4444" />
                              <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '600' }}>Live</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.packagePrice}>
                          {pkg.currency} {pkg.price?.toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.packageStatsRow}>
                        <View style={styles.packageStat}>
                          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.packageStatText}>{Math.floor(Math.random() * 5) + 2}h</Text>
                        </View>
                        <View style={styles.packageStat}>
                          <Ionicons name="image-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.packageStatText}>{Math.floor(Math.random() * 200) + 50} photos</Text>
                        </View>
                        <View style={styles.packageStat}>
                          <Ionicons name="videocam-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.packageStatText}>{Math.floor(Math.random() * 5) + 1} videos</Text>
                        </View>
                      </View>
                      
                      <View style={styles.packageFeaturesRow}>
                        {['High Res Editing', 'Online Gallery', 'Print Rights'].map((feature, idx) => (
                          <View key={idx} style={styles.packageFeature}>
                            <Ionicons name="checkmark" size={14} color="#10b981" />
                            <Text style={styles.packageFeatureText}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                    </Pressable>
                  );
                })})()}
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.continueButton} onPress={handleContinueStep2}>
                  <Text style={styles.continueButtonText}>Continue</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 3: DETAILS */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Schedule & Notes</Text>
              <Text style={styles.subtitle}>Help the photographer prepare for your big day.</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>What should we call this event?</Text>
                <BottomSheetTextInput 
                  style={styles.bottomSheetInput} 
                  placeholderTextColor={colors.textMuted} 
                  placeholder="e.g. Sarah's Wedding" 
                  value={eventName} 
                  onChangeText={setEventName} 
                />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>When does it start? *</Text>
                  <Pressable onPress={() => setShowStartTimePicker(true)} style={styles.inputWithIcon}>
                    <View pointerEvents="none" style={{ width: '100%' }}>
                      <Input 
                        placeholder="" 
                        value={startTime ? startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''} 
                        editable={false} 
                        style={[styles.inputField, { paddingLeft: 14 }]} 
                      />
                    </View>
                  </Pressable>
                  <DateTimePickerModal
                    isVisible={showStartTimePicker}
                    mode="time"
                    minuteInterval={15}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="light"
                    isDarkModeEnabled={false}
                    textColor="black"
                    minimumDate={date && new Date().toDateString() === date.toDateString() ? new Date() : undefined}
                    onConfirm={(selectedTime) => {
                      setShowStartTimePicker(false);
                      setStartTime(selectedTime);
                    }}
                    onCancel={() => setShowStartTimePicker(false)}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>When does it end? (Optional)</Text>
                  <Pressable onPress={() => setShowEndTimePicker(true)} style={styles.inputWithIcon}>
                    <View pointerEvents="none" style={{ width: '100%' }}>
                      <Input 
                        placeholder="" 
                        value={endTime ? endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''} 
                        editable={false} 
                        style={[styles.inputField, { paddingLeft: 14 }]} 
                      />
                    </View>
                  </Pressable>
                  <DateTimePickerModal
                    isVisible={showEndTimePicker}
                    mode="time"
                    minuteInterval={15}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="light"
                    isDarkModeEnabled={false}
                    textColor="black"
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
                <Text style={styles.label}>How many people are attending? (Estimated)</Text>
                <BottomSheetTextInput 
                  style={styles.bottomSheetInput} 
                  placeholderTextColor={colors.textMuted} 
                  placeholder="e.g. 150" 
                  value={guests} 
                  onChangeText={setGuests} 
                  keyboardType="numeric" 
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Any special requests for the photographer?</Text>
                <BottomSheetTextInput 
                  style={styles.bottomSheetInputMultiline} 
                  placeholderTextColor={colors.textMuted} 
                  placeholder="Any special requests or details..." 
                  value={notes} 
                  onChangeText={setNotes} 
                  multiline 
                  numberOfLines={4}
                />
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.continueButton} onPress={handleContinueStep3}>
                  <Text style={styles.continueButtonText}>Continue</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 4: PAYMENT */}
          {currentStep === 4 && (
            <View style={styles.stepContent}>
              {bookingSuccess ? (
                <View style={styles.successContainer}>
                  <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                    <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
                    <Text style={styles.successTitle}>Booking Confirmed!</Text>
                    <Text style={styles.successSubtitle}>
                      Your booking is reserved. Payment is completed securely on connekyt.com.
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#f9fafb', borderRadius: radii.xl, padding: 20, width: '100%', marginBottom: spacing.xl, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Booking Summary</Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>Event:</Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{eventName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>Date:</Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{date?.toLocaleDateString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>Package:</Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{selectedPackage?.name}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Total Amount:</Text>
                      <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '800' }}>{selectedPackage?.price} {selectedPackage?.currency}</Text>
                    </View>
                  </View>

                  {payHandoff ? (
                    <>
                      <Pressable
                        style={[styles.continueButton, { marginBottom: 12 }, openingCheckout && { opacity: 0.7 }]}
                        onPress={handleCompletePaymentOnWeb}
                        disabled={openingCheckout}
                      >
                        <Text style={styles.continueButtonText}>
                          {openingCheckout ? 'Opening…' : 'Complete payment on connekyt.com'}
                        </Text>
                      </Pressable>
                      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 16, lineHeight: 18 }}>
                        Your booking is reserved. To secure it, finish the payment on the connekyt.com
                        secure checkout — you can also do this later from Payments.
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 16, lineHeight: 18 }}>
                      Your request was sent to the photographer. Once they accept, you can complete
                      the payment on connekyt.com from the Payments screen.
                    </Text>
                  )}

                  <Pressable style={[styles.continueButton, { backgroundColor: '#f3f4f6', marginBottom: 12 }]} onPress={handleDownloadProof}>
                    <Ionicons name="download-outline" size={20} color={colors.text} style={{ marginRight: 8 }} />
                    <Text style={[styles.continueButtonText, { color: colors.text }]}>Download Booking Proof</Text>
                  </Pressable>

                  <Pressable style={styles.continueButton} onPress={() => {
                    if (ref && typeof ref !== 'function' && 'current' in ref) ref.current?.close();
                    setBookingSuccess(false);
                    setPayHandoff(null);
                    setCurrentStep(1);
                  }}>
                    <Text style={styles.continueButtonText}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={[styles.title, { textAlign: 'center' }]}>How would you like to pay?</Text>
                  
                  {(() => {
                    const basePrice = selectedPackage?.price || 0;
                    const baseCurrency = selectedPackage?.currency || 'RWF';
                    
                    let rate = 1;
                    if (baseCurrency === 'RWF') {
                      if (displayCurrency === 'USD') rate = 1/1350;
                      if (displayCurrency === 'EUR') rate = 1/1450;
                      if (displayCurrency === 'KES') rate = 0.098;
                      if (displayCurrency === 'UGX') rate = 2.85;
                      if (displayCurrency === 'TZS') rate = 1.92;
                    } else if (baseCurrency === 'USD') {
                      if (displayCurrency === 'RWF') rate = 1350;
                    }
                    
                    const formatPrice = (amount: number) => {
                      const val = amount * rate;
                      if (displayCurrency === 'RWF') return `${Math.round(val).toLocaleString()} RWF`;
                      if (displayCurrency === 'KES') return `KSh ${Math.round(val).toLocaleString()}`;
                      if (displayCurrency === 'UGX') return `USh ${Math.round(val).toLocaleString()}`;
                      if (displayCurrency === 'TZS') return `TSh ${Math.round(val).toLocaleString()}`;
                      return `${displayCurrency === 'USD' ? '$' : '€'}${val.toFixed(2)}`;
                    };

                    const totalDisplay = formatPrice(basePrice);

                    const CURRENCIES = [
                      { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
                      { code: 'RWF', name: 'Rwandan franc', flag: '🇷🇼' },
                      { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
                      { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
                      { code: 'UGX', name: 'Ugandan Shilling', flag: '🇺🇬' },
                      { code: 'TZS', name: 'Tanzanian Shilling', flag: '🇹🇿' },
                    ];

                    return (
                      <>
                        <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
                          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>Total Amount</Text>
                          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>
                            {totalDisplay}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end', marginBottom: spacing.lg, zIndex: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: colors.textMuted, fontSize: 13 }}>View in</Text>
                            <Pressable 
                              onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.full }}
                            >
                              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{displayCurrency}</Text>
                              <Ionicons name={showCurrencyDropdown ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
                            </Pressable>
                          </View>
                          
                          {showCurrencyDropdown && (
                            <View style={{ position: 'absolute', top: 35, right: 0, backgroundColor: 'white', borderRadius: radii.md, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, padding: 8, minWidth: 200 }}>
                              {CURRENCIES.map(c => (
                                <Pressable 
                                  key={c.code}
                                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: displayCurrency === c.code ? '#f3f4f6' : 'transparent', borderRadius: radii.sm }}
                                  onPress={() => { setDisplayCurrency(c.code as any); setShowCurrencyDropdown(false); }}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{c.code}</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>{c.name}</Text>
                                  </View>
                                  {displayCurrency === c.code && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>

                        <View style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, zIndex: 1 }}>
                          {[
                            { key: 'half' as const, label: 'Pay 50% Deposit Now', desc: '50% now, 50% before the event date' },
                            { key: 'seventy' as const, label: 'Pay 70% Deposit Now', desc: '70% now, 30% before the event date' },
                            { key: 'full' as const, label: 'Pay Full Amount Now', desc: 'Pay everything securely today' },
                          ].map(opt => {
                            const sel = milestoneOption === opt.key;
                            return (
                              <Pressable 
                                key={opt.key} 
                                onPress={() => setMilestoneOption(opt.key)} 
                                style={{
                                  padding: 16, 
                                  backgroundColor: sel ? '#eff6ff' : '#f9fafb',
                                  borderWidth: 1, 
                                  borderColor: sel ? colors.primary : colors.borderSoft, 
                                  borderRadius: radii.xl,
                                  flexDirection: 'row', 
                                  alignItems: 'center', 
                                  gap: 12
                                }}
                              >
                                <View style={{
                                  width: 20, height: 20, borderRadius: 10,
                                  borderWidth: 2, borderColor: sel ? colors.primary : colors.borderSoft,
                                  alignItems: 'center', justifyContent: 'center'
                                }}>
                                  {sel && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{opt.label}</Text>
                                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{opt.desc}</Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>

                        <View style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: radii.xl, padding: 16, marginBottom: 20, zIndex: 1 }}>
                          {(() => {
                            const splits = {
                              full: [{ label: 'Full payment upfront', pct: 100 }],
                              half: [{ label: 'Deposit (50%)', pct: 50 }, { label: 'Balance before event date (50%)', pct: 50 }],
                              seventy: [{ label: 'Deposit (70%)', pct: 70 }, { label: 'Balance before event date (30%)', pct: 30 }],
                            };
                            return splits[milestoneOption].map((m, i, arr) => (
                              <View key={i} style={{ 
                                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
                                paddingVertical: 8, 
                                borderBottomWidth: i < arr.length - 1 ? 1 : 0, 
                                borderBottomColor: '#e5e7eb' 
                              }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === 0 ? colors.primary : colors.textMuted }} />
                                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{m.label}</Text>
                                </View>
                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                                  {formatPrice(basePrice * m.pct / 100)}
                                </Text>
                              </View>
                            ));
                          })()}
                        </View>
                      </>
                    );
                  })()}

                  {/* No payment collection in-app — after the booking is
                      created the payment is completed on connekyt.com. */}
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#eff6ff', padding: 12, borderRadius: radii.md, marginBottom: 20, zIndex: 1 }}>
                    <Ionicons name="globe-outline" size={16} color={colors.primary} />
                    <Text style={{ flex: 1, color: colors.primary, fontSize: 12, lineHeight: 18 }}>
                      After you confirm, you&apos;ll complete the payment securely on connekyt.com.
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: radii.md, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Ionicons name="shield-checkmark" size={16} color="#16a34a" />
                      <Text style={{ color: '#16a34a', fontSize: 13, fontWeight: '600' }}>Your money is protected.</Text>
                    </View>
                    <Text style={{ color: '#15803d', fontSize: 12, lineHeight: 18 }}>
                      This payment is held securely by Connekyt, not paid to the photographer directly. We release it to them only after your event is delivered, so you're covered if anything goes wrong.
                    </Text>
                  </View>

                  <View style={styles.footer}>
                    <Pressable
                      style={[styles.continueButton, isSubmitting && { opacity: 0.7 }]}
                      onPress={handleConfirmBooking}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.continueButtonText}>{isSubmitting ? 'Processing…' : 'Confirm booking'}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

        </BottomSheetScrollView>
      </BottomSheet>
    );
  };

export const BookingBottomSheet = forwardRef(BookingBottomSheetComponent);

const styles = StyleSheet.create({
  bottomSheetInput: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  bottomSheetInputMultiline: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    fontSize: fontSize.md,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    position: 'relative',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.md,
    backgroundColor: '#F3F4F6',
    borderRadius: radii.full,
    padding: 6,
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    top: spacing.md,
    backgroundColor: '#F3F4F6',
    borderRadius: radii.full,
    padding: 6,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    zIndex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: 'white',
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  stepLabelActive: {
    color: colors.primary,
  },
  stepLine: {
    position: 'absolute',
    top: 12,
    left: '65%',
    width: '70%',
    height: 2,
    backgroundColor: '#F3F4F6',
    zIndex: 0,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xl * 3,
  },
  stepContent: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  serviceTypes: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  serviceCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: 'white',
  },
  serviceCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F5FF',
  },
  serviceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  serviceTextContainer: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  serviceDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  formGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputWithIcon: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputField: {
    paddingLeft: 40,
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  budgetInput: {
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tagBadgeActive: {
    backgroundColor: '#F0F5FF',
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tagTextActive: {
    color: colors.primary,
  },
  footer: {
    marginTop: spacing.xl,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.lg,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  // Step 2 & Step 4 styles
  packageCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: '#F9FAFB',
  },
  packageCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  packageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  packageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  packageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
    textTransform: 'uppercase',
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  packageStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  packageStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  packageStatText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  packageFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  packageFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  packageFeatureText: {
    fontSize: 12,
    color: '#10b981',
  },
  summaryCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  summaryDetail: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  summaryValueBold: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '800',
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  milestoneCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F5FF',
  },
  milestoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  milestoneTextActive: {
    color: colors.primary,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

const extraStyles = StyleSheet.create({
  tagBadgeSelected: { backgroundColor: '#083A85', borderColor: '#083A85' },
  tagTextSelected: { color: '#FFFFFF' },
  successContent: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  successText: { fontSize: 18, fontWeight: 'bold', color: '#000', marginTop: 16 },
});
