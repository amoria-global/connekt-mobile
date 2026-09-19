import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BrandPill } from '@/components/topbar/BrandPill';
import { NotificationButton } from '@/components/topbar/NotificationButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { listNotifications } from '@/features/notifications/api';
import { ensureKycConsent } from '@/features/privacy/consent';
import { useAsync } from '@/hooks/useAsync';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  pickFromLibrary,
  takeDocumentPhoto,
  type PickedImage,
} from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';
import { LiveSelfieVerification } from './LiveSelfieVerification';
import {
  validateDocType,
  validateDocSide,
  type DocumentTypeOption,
  type KycState,
  type KycSubmissionPayload,
  type KycSubmitResult,
} from './api';

/**
 * Identity verification as one flat, full-page flow — the same visual language
 * as login and signup: a bare back button, a centred title, the content itself,
 * and one primary action pinned at the bottom. No cards, no boxed sections.
 *
 * The component is presentational: status and the two network calls come in as
 * props, so the route owns data and a design preview can drive every state with
 * mocks (including approved/rejected, which are hard to reach with a real
 * account).
 *
 *   overview  → decided by the server status (intro, in review, verified,
 *               needs attention), plus loading and load-error states
 *   1 … 4     → details, selfie, ID, review
 *   submitted → confirmation after a successful submit
 */
export type KycVerifyFlowProps = {
  /** Latest status from the server; null until the first load resolves. */
  kyc: KycState | null;
  loading: boolean;
  error: string | null;
  /** Prefills the legal name when the server has none on file. */
  defaultName?: string;
  onRefresh: () => void | Promise<void>;
  onExit: () => void;
  onOpenWeb?: () => Promise<void>;
  getChallengeToken: () => Promise<string>;
  submit: (payload: KycSubmissionPayload) => Promise<KycSubmitResult>;
};

import {
  STEPS,
  TOTAL_STEPS,
  isConnectorPassed,
  type Step,
} from './stepperConfig';

export { STEPS, TOTAL_STEPS, type Step };

type Stage = 'overview' | Step | 'submitted';
type Slot = 'front' | 'back';

export type DocValidation = {
  validating: boolean;
  status?:
    | 'MATCH'
    | 'MISMATCH'
    | 'NOT_A_DOCUMENT'
    | 'SIDE_WRONG'
    | 'SIDE_MATCH'
    | 'UNCERTAIN'
    | 'SKIPPED'
    | 'VALID'
    | 'ERROR';
  message?: string;
};

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  1: {
    title: 'Your details',
    subtitle: 'Enter your name exactly as it appears on your ID.',
  },
  2: {
    title: 'Take a selfie',
    subtitle: 'We match it to the photo on your ID, so face the camera in good light.',
  },
  3: {
    title: 'Photograph your ID',
    subtitle: 'Choose your document, then capture it flat, in focus and without glare.',
  },
  4: {
    title: 'Review and submit',
    subtitle: 'Make sure everything is correct before you send it for review.',
  },
};

const DOCUMENT_TYPES: {
  id: DocumentTypeOption;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'NATIONAL_ID', label: 'National ID', icon: 'card-outline' },
  { id: 'PASSPORT', label: 'Passport', icon: 'book-outline' },
  { id: 'DRIVER_LICENSE', label: "Driver's licence", icon: 'car-outline' },
];

const DOCUMENT_LABEL: Record<DocumentTypeOption, string> = {
  NATIONAL_ID: 'National ID',
  PASSPORT: 'Passport',
  DRIVER_LICENSE: "Driver's licence",
};

const GENDERS = ['Male', 'Female', 'Other'] as const;

export function KycVerifyFlow({
  kyc,
  loading,
  error,
  defaultName,
  onRefresh,
  onExit,
  onOpenWeb: _onOpenWeb,
  getChallengeToken,
  submit,
}: KycVerifyFlowProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { role } = useRole();

  const { data: notifications } = useAsync(useCallback(() => listNotifications(role), [role]));
  const hasUnread = !!notifications?.some((n) => !n.read);

  const [stage, setStage] = useState<Stage>(() => {
    if (kyc?.status === 'APPROVED' || kyc?.status === 'PENDING') return 'overview';
    return 1;
  });

  // Step 1
  const [fullLegalName, setFullLegalName] = useState(
    kyc?.fullLegalName ?? defaultName ?? '',
  );
  const [gender, setGender] = useState('');
  const [locationAddress, setLocationAddress] = useState('');

  useEffect(() => {
    if (kyc?.status === 'APPROVED' || kyc?.status === 'PENDING') {
      setStage('overview');
    } else if (stage === 'overview') {
      setStage(1);
    }
  }, [kyc?.status, stage]);

  useEffect(() => {
    if (!fullLegalName && (kyc?.fullLegalName || defaultName)) {
      setFullLegalName(kyc?.fullLegalName ?? defaultName ?? '');
    }
  }, [kyc?.fullLegalName, defaultName, fullLegalName]);

  // Step 2 — live camera & real-person liveness verification
  const [selfie, setSelfie] = useState<PickedImage | null>(null);
  const [livenessFrames, setLivenessFrames] = useState<PickedImage[]>([]);
  const [challengeOrder, setChallengeOrder] = useState<string>('');
  const [challengeTimingsMs, setChallengeTimingsMs] = useState<string>('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Step 3
  const [documentType, setDocumentType] = useState<DocumentTypeOption>('NATIONAL_ID');
  const [front, setFront] = useState<PickedImage | null>(null);
  const [back, setBack] = useState<PickedImage | null>(null);
  const [frontValidation, setFrontValidation] = useState<DocValidation | null>(null);
  const [backValidation, setBackValidation] = useState<DocValidation | null>(null);

  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Inline validation message for the current step, shown on Continue. */
  const [stepError, setStepError] = useState<string | null>(null);

  const status = kyc?.status ?? 'NONE';
  const inWizard = typeof stage === 'number';
  const needsBack = documentType !== 'PASSPORT';

  const handleSelectDocumentType = (newType: DocumentTypeOption) => {
    if (newType === documentType) return;
    if (front || back) {
      Alert.alert(
        'Switch document type?',
        `Switching to ${DOCUMENT_LABEL[newType]} will clear the photos you added for ${DOCUMENT_LABEL[documentType]}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch',
            style: 'destructive',
            onPress: () => {
              setDocumentType(newType);
              setFront(null);
              setBack(null);
              setFrontValidation(null);
              setBackValidation(null);
              setStepError(null);
            },
          },
        ],
      );
    } else {
      setDocumentType(newType);
      setFrontValidation(null);
      setBackValidation(null);
      setStepError(null);
    }
  };

  const runFrontValidation = async (photo: PickedImage, docType: DocumentTypeOption) => {
    setFrontValidation({ validating: true });
    try {
      const typeRes = await validateDocType(docType, photo);
      if (typeRes.status === 'MISMATCH' || typeRes.status === 'NOT_A_DOCUMENT') {
        setFrontValidation({
          validating: false,
          status: typeRes.status,
          message: typeRes.message,
        });
        return;
      }

      const sideRes = await validateDocSide('FRONT', photo);
      if (sideRes.status === 'SIDE_WRONG') {
        setFrontValidation({
          validating: false,
          status: 'SIDE_WRONG',
          message: sideRes.message,
        });
        return;
      }

      setFrontValidation({
        validating: false,
        status: typeRes.status === 'MATCH' ? 'MATCH' : 'VALID',
        message: typeRes.status === 'MATCH' ? typeRes.message : undefined,
      });
    } catch {
      setFrontValidation({ validating: false, status: 'VALID' });
    }
  };

  const runBackValidation = async (photo: PickedImage) => {
    setBackValidation({ validating: true });
    try {
      const sideRes = await validateDocSide('BACK', photo);
      if (sideRes.status === 'SIDE_WRONG') {
        setBackValidation({
          validating: false,
          status: 'SIDE_WRONG',
          message: sideRes.message,
        });
        return;
      }

      setBackValidation({
        validating: false,
        status: sideRes.status === 'SIDE_MATCH' ? 'SIDE_MATCH' : 'VALID',
        message: sideRes.status === 'SIDE_MATCH' ? sideRes.message : undefined,
      });
    } catch {
      setBackValidation({ validating: false, status: 'VALID' });
    }
  };

  const swapSides = () => {
    if (!front || !back) return;
    const oldFront = front;
    const oldBack = back;
    setFront(oldBack);
    setBack(oldFront);
    setFrontValidation(null);
    setBackValidation(null);
    setStepError(null);
    void runFrontValidation(oldBack, documentType);
    void runBackValidation(oldFront);
  };

  const go = useCallback(
    (next: Stage) => {
      if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStepError(null);
      setStage(next);
    },
    [reducedMotion],
  );

  const fetchChallenge = useCallback(async () => {
    setLoadingToken(true);
    setTokenError(null);
    try {
      setChallengeToken(await getChallengeToken());
    } catch {
      setTokenError("We couldn't start a secure session.");
    } finally {
      setLoadingToken(false);
    }
  }, [getChallengeToken]);

  const goBack = useCallback(() => {
    if (submitting) return;
    if (typeof stage === 'number') {
      if (stage === 1) {
        onExit();
      } else {
        go((stage - 1) as Step);
      }
    } else {
      onExit();
    }
  }, [go, onExit, stage, submitting]);

  // Android hardware back steps through the wizard instead of leaving it.
  useFocusEffect(
    useCallback(() => {
      if (!inWizard) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack, inWizard]),
  );

  const capture = async (slot: Slot, source: 'camera' | 'library') => {
    try {
      let photo: PickedImage | null;
      if (source === 'library') photo = await pickFromLibrary();
      else photo = await takeDocumentPhoto();
      if (!photo) return;

      // Duplicate checks: cannot be selfie
      if (selfie && photo.uri === selfie.uri) {
        Alert.alert(
          'Invalid document photo',
          'Your ID document photo cannot be the same photo as your selfie. Please capture your actual ID card.',
        );
        return;
      }

      // Duplicate checks: front and back cannot be the exact same photo
      if (slot === 'front' && back && photo.uri === back.uri) {
        Alert.alert(
          'Duplicate photo',
          'The front and back of your ID cannot be the same photo. Please capture the front side of your document.',
        );
        return;
      }
      if (slot === 'back' && front && photo.uri === front.uri) {
        Alert.alert(
          'Duplicate photo',
          'The back of your ID cannot be the same photo as the front side. Please capture the back side of your document.',
        );
        return;
      }

      if (slot === 'front') {
        setFront(photo);
        setStepError(null);
        void runFrontValidation(photo, documentType);
      } else {
        setBack(photo);
        setStepError(null);
        void runBackValidation(photo);
      }
    } catch {
      Alert.alert(
        source === 'camera' ? 'Camera unavailable' : 'Photo library unavailable',
        'Check the permission in your device settings and try again.',
      );
    }
  };

  const continueFrom = async (step: Step) => {
    if (step === 1) {
      if (fullLegalName.trim().length < 2) return setStepError('Enter your full legal name.');
      if (!gender) return setStepError('Select your gender.');
      if (!(await ensureKycConsent())) return;
      go(2);
      // Mint the token as the selfie step opens. An earlier failure is not
      // retried automatically, so a dead endpoint cannot spin in a loop.
      if (!challengeToken && !loadingToken) void fetchChallenge();
      return;
    }
    if (step === 2) {
      if (!selfie) return setStepError('Take a selfie to continue.');
      if (!challengeToken && !loadingToken) {
        void fetchChallenge();
      }
      return go(3);
    }
    if (step === 3) {
      if (!front) return setStepError('Add a photo of the front of your ID.');
      if (needsBack && !back) return setStepError('Add a photo of the back of your ID.');

      // Check for duplicate photos
      if (needsBack && front && back && front.uri === back.uri) {
        return setStepError('The front and back of your ID cannot be the same photo. Please provide both sides.');
      }
      if (selfie && front.uri === selfie.uri) {
        return setStepError('Your ID front photo cannot be the same photo as your selfie.');
      }
      if (selfie && back && back.uri === selfie.uri) {
        return setStepError('Your ID back photo cannot be the same photo as your selfie.');
      }

      // Check if validation is currently in-flight
      if (frontValidation?.validating || backValidation?.validating) {
        return setStepError('Checking your documents. Please wait a moment...');
      }

      // Check validation warnings — warn the user with an option to proceed if confident
      if (frontValidation?.status === 'MISMATCH') {
        const warnMsg = frontValidation.message || 'The front photo does not match the selected document type.';
        setStepError(warnMsg);
        if (Platform.OS === 'web') {
          const ok = typeof window !== 'undefined' ? window.confirm(`${warnMsg}\n\nDo you want to proceed to review anyway?`) : true;
          if (ok) return go(4);
          return;
        }
        Alert.alert(
          'Document Check',
          `${warnMsg}\n\nDo you want to proceed to review anyway, or select a different document type?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed anyway', onPress: () => go(4) },
          ],
        );
        return;
      }
      if (frontValidation?.status === 'NOT_A_DOCUMENT') {
        const warnMsg = frontValidation.message || 'The front photo could not be verified automatically as an ID.';
        setStepError(warnMsg);
        if (Platform.OS === 'web') {
          const ok = typeof window !== 'undefined' ? window.confirm(`${warnMsg}\n\nEnsure your ID details are clear. Do you want to proceed anyway?`) : true;
          if (ok) return go(4);
          return;
        }
        Alert.alert(
          'Document Check',
          `${warnMsg}\n\nEnsure all details on your ID are clear and legible. Do you want to proceed anyway?`,
          [
            { text: 'Retake photo', style: 'cancel' },
            { text: 'Proceed anyway', onPress: () => go(4) },
          ],
        );
        return;
      }
      if (frontValidation?.status === 'SIDE_WRONG') {
        return setStepError(frontValidation.message || 'The front slot contains the back of your ID. Please upload the front or tap Swap.');
      }
      if (needsBack && backValidation?.status === 'SIDE_WRONG') {
        return setStepError(backValidation.message || 'The back slot contains the front of your ID. Please upload the back or tap Swap.');
      }

      return go(4);
    }
  };

  const handleSubmit = async () => {
    // 1. Specific field validations
    if (!selfie) {
      const msg = 'Selfie photo is missing. Please return to Step 2 to take your selfie.';
      setSubmitError(msg);
      Alert.alert('Missing Selfie', msg);
      return;
    }
    if (!front) {
      const msg = 'Government ID front photo is missing. Please return to Step 3.';
      setSubmitError(msg);
      Alert.alert('Missing ID Front', msg);
      return;
    }
    if (needsBack && !back) {
      const msg = 'Government ID back photo is missing. Please return to Step 3.';
      setSubmitError(msg);
      Alert.alert('Missing ID Back', msg);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // 2. Token acquisition (ensure we have a valid token)
    let token = challengeToken;
    if (!token) {
      try {
        token = await getChallengeToken();
        setChallengeToken(token);
      } catch {
        setSubmitting(false);
        const errMsg = "We couldn't start a secure verification session. Please check your connection and try again.";
        setSubmitError(errMsg);
        Alert.alert('Connection Error', errMsg);
        return;
      }
    }

    // 3. Submit payload
    try {
      const result = await submit({
        fullLegalName: fullLegalName.trim(),
        gender,
        locationAddress: locationAddress.trim() || undefined,
        documentType,
        challengeToken: token,
        challengeOrder: challengeOrder || 'LOOK_STRAIGHT',
        challengeTimingsMs: challengeTimingsMs || '[1200]',
        selfiePhoto: selfie,
        livenessFrames: livenessFrames.length > 0 ? livenessFrames : undefined,
        governmentIdDocument: front,
        governmentIdDocumentBack: needsBack ? back ?? undefined : undefined,
      });

      // The API answers failures with HTTP 200 and action 0.
      if (result.action !== 1) {
        // Backend consumed or rejected the token — clear it so a retry will obtain a fresh one
        setChallengeToken(null);
        const errMsg = result.message || 'Your verification could not be processed. Please check your details.';
        setSubmitError(errMsg);
        Alert.alert('Verification Refused', errMsg);
        return;
      }

      setSelfie(null);
      setLivenessFrames([]);
      setChallengeOrder('');
      setChallengeTimingsMs('');
      setFront(null);
      setBack(null);
      setChallengeToken(null);
      go('submitted');
      void onRefresh();
    } catch (err) {
      // Clear token so subsequent attempt gets a fresh session
      setChallengeToken(null);
      const errMsg = isApiError(err)
        ? err.message
        : 'We could not send your documents. Check your connection and try again.';
      setSubmitError(errMsg);
      Alert.alert('Submission Error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stage content ─────────────────────────────────────────────────────

  let header: ReactNode = null;
  let body: ReactNode = null;
  let footer: ReactNode = null;
  let centered = false;

  if (stage === 'overview' && !kyc && loading) {
    centered = true;
    body = <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading" />;
  } else if (stage === 'overview' && !kyc) {
    centered = true;
    header = (
      <Header
        icon="cloud-offline-outline"
        iconColor={colors.textMuted}
        title="Couldn't load your status"
        subtitle={error ?? 'Check your connection and try again.'}
      />
    );
    footer = <Button title="Try again" onPress={() => void onRefresh()} loading={loading} />;
  } else if (stage === 'overview' && status === 'APPROVED') {
    centered = true;
    header = (
      <Header
        icon="shield-checkmark"
        iconColor={colors.success}
        title="You're verified"
        subtitle="Your identity has been confirmed. There's nothing else you need to do."
      />
    );
    footer = <Button title="Done" onPress={onExit} />;
  } else if (stage === 'overview' && status === 'PENDING') {
    centered = true;
    const submitted = formatDate(kyc?.submittedAt);
    header = (
      <Header
        icon="time-outline"
        iconColor={colors.primary}
        title="We're reviewing your details"
        subtitle="This usually takes a few hours. We'll let you know as soon as it's done."
      />
    );
    body = (
      <View style={{ alignItems: 'center', width: '100%', gap: spacing.sm }}>
        {submitted ? <Text style={styles.meta}>Submitted {submitted}</Text> : null}
        {kyc?.fullLegalName ? (
          <View style={{ width: '100%', marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <ReviewRow label="Legal name" value={kyc.fullLegalName} />
            {kyc.documentType ? (
              <ReviewRow
                label="Document"
                value={DOCUMENT_LABEL[kyc.documentType as DocumentTypeOption] ?? kyc.documentType}
              />
            ) : null}
            <ReviewRow label="Status" value="Pending Admin Review" />
          </View>
        ) : null}
      </View>
    );
    footer = (
      <>
        <Button title="Check status" variant="outline" onPress={() => void onRefresh()} loading={loading} />
        <TextLink label="Back to home" onPress={onExit} />
      </>
    );
  } else if (stage === 'submitted') {
    centered = true;
    header = (
      <Header
        icon="checkmark-circle"
        iconColor={colors.success}
        title="Submitted for review"
        subtitle="We'll let you know once your identity is confirmed, usually within a few hours."
      />
    );
    footer = <Button title="Done" onPress={onExit} />;
  } else if (stage === 1 || stage === 'overview') {
    header = <Header title={STEP_COPY[1].title} subtitle={STEP_COPY[1].subtitle} />;
    body = (
      <>
        {status === 'REJECTED' && kyc?.rejectionReason ? (
          <ReviewerNote text={kyc.rejectionReason} />
        ) : null}
        <View>
          <Input
            label="Full legal name"
            placeholder="As printed on your ID"
            value={fullLegalName}
            onChangeText={(v) => {
              setFullLegalName(v);
              setStepError(null);
            }}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
          <Text style={styles.helper}>No nicknames or initials unless they're on your ID.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Gender">
            {GENDERS.map((g) => (
              <Chip
                key={g}
                label={g}
                selected={gender === g}
                onPress={() => {
                  setGender(g);
                  setStepError(null);
                }}
              />
            ))}
          </View>
        </View>

        <Input
          label="Home address (optional)"
          placeholder="Street, city, country"
          value={locationAddress}
          onChangeText={setLocationAddress}
          autoCapitalize="words"
          autoComplete="street-address"
          textContentType="fullStreetAddress"
        />
      </>
    );
    footer = <Button title="Continue" onPress={() => continueFrom(1)} />;
  } else if (stage === 2) {
    header = <Header title={STEP_COPY[2].title} subtitle={STEP_COPY[2].subtitle} />;
    body = (
      <>
        <LiveSelfieVerification
          challengeToken={challengeToken ?? ''}
          initialSelfie={selfie}
          initialLivenessFrames={livenessFrames}
          initialChallengeOrder={challengeOrder}
          initialChallengeTimingsMs={challengeTimingsMs}
          onComplete={({
            selfie: captured,
            livenessFrames: frames,
            challengeOrder: order,
            challengeTimingsMs: timings,
          }) => {
            setSelfie(captured);
            setLivenessFrames(frames);
            setChallengeOrder(order);
            setChallengeTimingsMs(timings);
            setStepError(null);
            go(3);
          }}
          onCancel={() => goBack()}
        />

        {tokenError ? (
          <Text style={styles.errorText}>
            {tokenError}{' '}
            <Text style={styles.inlineLink} onPress={() => void fetchChallenge()} accessibilityRole="link">
              Try again
            </Text>
          </Text>
        ) : null}
      </>
    );
    footer = null;
  } else if (stage === 3) {
    header = <Header title={STEP_COPY[3].title} subtitle={STEP_COPY[3].subtitle} />;
    body = (
      <>
        <View style={styles.field}>
          <Text style={styles.label}>Document type</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Document type">
            {DOCUMENT_TYPES.map((d) => (
              <Chip
                key={d.id}
                label={d.label}
                icon={d.icon}
                selected={documentType === d.id}
                onPress={() => handleSelectDocumentType(d.id)}
              />
            ))}
          </View>
        </View>

        <DocumentSlot
          label={needsBack ? 'Front' : 'Photo page'}
          hint="Name, photo and ID number clearly readable"
          photo={front}
          validation={frontValidation}
          onCamera={() => void capture('front', 'camera')}
          onLibrary={() => void capture('front', 'library')}
        />
        {needsBack ? (
          <>
            <DocumentSlot
              label="Back"
              hint="Barcode and issue date fully in frame"
              photo={back}
              validation={backValidation}
              onCamera={() => void capture('back', 'camera')}
              onLibrary={() => void capture('back', 'library')}
            />
            {front && back ? (
              <Pressable
                onPress={swapSides}
                style={styles.swapSidesBtn}
                accessibilityRole="button"
                accessibilityLabel="Swap front and back photos"
              >
                <Ionicons name="swap-vertical" size={16} color={colors.primary} />
                <Text style={styles.swapSidesText}>Swap front and back</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </>
    );
    footer = (
      <Button
        title="Continue"
        onPress={() => continueFrom(3)}
        loading={frontValidation?.validating || backValidation?.validating}
      />
    );
  } else if (stage === 4) {
    header = <Header title={STEP_COPY[4].title} subtitle={STEP_COPY[4].subtitle} />;
    body = (
      <>
        <View>
          <SectionHead title="Details" onEdit={() => go(1)} disabled={submitting} />
          <ReviewRow label="Legal name" value={fullLegalName.trim()} />
          <ReviewRow label="Gender" value={gender} />
          {locationAddress.trim() ? <ReviewRow label="Address" value={locationAddress.trim()} /> : null}
          <ReviewRow label="Document" value={DOCUMENT_LABEL[documentType]} />
        </View>

        <View>
          <SectionHead title="Photos" onEdit={() => go(2)} disabled={submitting} />
          <View style={styles.thumbs}>
            {selfie ? <Thumb uri={selfie.uri} label="Selfie" round /> : null}
            {front ? <Thumb uri={front.uri} label={needsBack ? 'ID front' : 'Photo page'} /> : null}
            {needsBack && back ? <Thumb uri={back.uri} label="ID back" /> : null}
          </View>
        </View>

        <Text style={styles.legal}>
          By submitting, you confirm these documents are genuine and belong to you.
        </Text>
        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
      </>
    );
    footer = (
      <>
        {submitError ? (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {submitError}
          </Text>
        ) : null}
        <Button title="Submit for review" onPress={() => void handleSubmit()} loading={submitting} />
      </>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ gestureEnabled: !inWizard }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            disabled={submitting}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={inWizard && stage !== 1 ? 'Previous step' : 'Go back'}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <BrandPill />

          {!inWizard ? (
            <NotificationButton
              hasUnread={hasUnread}
              onPress={() => router.push('/notifications')}
            />
          ) : null}
        </View>

        {inWizard ? (
          <KycStepper
            currentStep={stage}
            onSelectStep={(s) => go(s)}
            disabled={submitting}
          />
        ) : null}

        <ScrollView
          key={String(stage)}
          contentContainerStyle={[styles.scroll, centered && styles.scrollCentered]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {header}
          {body ? <View style={[styles.body, centered && styles.bodyCentered]}>{body}</View> : null}
        </ScrollView>

        {footer ? (
          <View style={styles.footer}>
            {stepError && inWizard ? (
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {stepError}
              </Text>
            ) : null}
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────

export function KycStepper({
  currentStep,
  onSelectStep,
  disabled,
}: {
  currentStep: Step;
  onSelectStep?: (step: Step) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();

  return (
    <View
      style={styles.stepperContainer}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentStep} of ${TOTAL_STEPS}: ${STEPS[currentStep - 1]?.label}`}
    >
      {STEPS.map((step, index) => {
        const isPassed = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isRemaining = step.id > currentStep;
        const canPress = isPassed && !disabled && !!onSelectStep;

        return (
          <Pressable
            key={step.id}
            style={styles.stepItem}
            disabled={!canPress}
            onPress={() => onSelectStep?.(step.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: !canPress }}
            accessibilityLabel={`Step ${step.id}: ${step.label}, ${
              isPassed ? 'completed, tap to return' : isActive ? 'current step' : 'upcoming'
            }`}
          >
            <View style={styles.nodeRow}>
              {index > 0 ? (
                <View
                  style={[
                    styles.connectorLine,
                    styles.connectorLeft,
                    isConnectorPassed(index, true, currentStep)
                      ? styles.connectorPassed
                      : styles.connectorRemaining,
                  ]}
                />
              ) : null}
              {index < STEPS.length - 1 ? (
                <View
                  style={[
                    styles.connectorLine,
                    styles.connectorRight,
                    isConnectorPassed(index, false, currentStep)
                      ? styles.connectorPassed
                      : styles.connectorRemaining,
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.stepNode,
                  isPassed && styles.stepNodePassed,
                  isActive && styles.stepNodeActive,
                  isRemaining && styles.stepNodeRemaining,
                ]}
              >
                {isPassed ? (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.stepNodeText,
                      isActive && styles.stepNodeTextActive,
                      isRemaining && styles.stepNodeTextRemaining,
                    ]}
                  >
                    {step.id}
                  </Text>
                )}
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.stepLabel,
                isPassed && styles.stepLabelPassed,
                isActive && styles.stepLabelActive,
                isRemaining && styles.stepLabelRemaining,
              ]}
            >
              {step.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Header({
  icon,
  iconColor,
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      {icon ? (
        <View style={styles.headerIconWrap}>
          <Ionicons name={icon} size={36} color={iconColor} accessible={false} />
        </View>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function ReviewerNote({ text }: { text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.note}>
      <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.error} />
      <View style={styles.noteContent}>
        <Text style={styles.noteTitle}>Note from our reviewer</Text>
        <Text style={styles.noteText}>{text}</Text>
      </View>
    </View>
  );
}

function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={22} color={selected ? colors.primary : colors.textMuted} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function DocumentSlot({
  label,
  hint,
  photo,
  onCamera,
  onLibrary,
  validation,
}: {
  label: string;
  hint: string;
  photo: PickedImage | null;
  validation?: DocValidation | null;
  onCamera: () => void;
  onLibrary: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const isInvalid = Boolean(
    photo &&
      validation &&
      (validation.status === 'MISMATCH' ||
        validation.status === 'NOT_A_DOCUMENT' ||
        validation.status === 'SIDE_WRONG'),
  );

  return (
    <View style={styles.field}>
      <View style={styles.slotHead}>
        <Text style={styles.label}>{label}</Text>
        {photo && validation?.validating ? (
          <View style={styles.validatingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.validatingText}>Checking photo...</Text>
          </View>
        ) : isInvalid ? (
          <View style={styles.badgeError}>
            <Ionicons name="alert-circle" size={14} color={colors.error} />
            <Text style={styles.badgeErrorText}>Issue detected</Text>
          </View>
        ) : photo ? (
          <View style={styles.added}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.addedText}>
              {validation?.status === 'MATCH' || validation?.status === 'SIDE_MATCH'
                ? 'Verified'
                : 'Added'}
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onCamera}
        style={({ pressed }) => [
          styles.docFrame,
          photo && styles.docFrameFilled,
          isInvalid && styles.docFrameError,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={photo ? `Retake ${label.toLowerCase()} of ID` : `Photograph ${label.toLowerCase()} of ID`}
        accessibilityHint={hint}
      >
        {photo ? (
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <>
            <View style={styles.docIconWrap}>
              <Ionicons name="scan-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.framePrompt}>Tap to take a photo</Text>
            <Text style={styles.frameHint}>{hint}</Text>
          </>
        )}
      </Pressable>

      {isInvalid && validation?.message ? (
        <View style={styles.slotWarningCard}>
          <Ionicons name="information-circle-outline" size={16} color={colors.error} />
          <Text style={styles.slotWarningText}>{validation.message}</Text>
        </View>
      ) : null}

      <View style={styles.slotActions}>
        <Pressable onPress={onCamera} hitSlop={8} accessibilityRole="button">
          <Text style={styles.link}>{photo ? 'Retake photo' : 'Take photo'}</Text>
        </Pressable>
        <Text style={styles.slotActionDivider}>·</Text>
        <Pressable onPress={onLibrary} hitSlop={8} accessibilityRole="button">
          <Text style={styles.link}>{photo ? 'Choose other' : 'Upload from library'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SectionHead({ title, onEdit, disabled }: { title: string; onEdit: () => void; disabled?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <Pressable
        onPress={onEdit}
        disabled={disabled}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title.toLowerCase()}`}
      >
        <Text style={styles.link}>Edit</Text>
      </Pressable>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Thumb({ uri, label, round }: { uri: string; label: string; round?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.thumb}>
      <Image
        source={{ uri }}
        style={[styles.thumbImg, round ? styles.thumbRound : styles.thumbRect]}
        contentFit="cover"
        accessibilityLabel={label}
      />
      <Text style={styles.thumbLabel}>{label}</Text>
    </View>
  );
}

function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={[styles.link, disabled && styles.linkDisabled]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c, e) => ({
  flex: { flex: 1 },

  // Top bar — chevron back + full-width branded pill (+ notification on landing).
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 54,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    ...e(2),
  },
  backBtnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  // Stepper — multi-step indicator with passed (green), active (blue), remaining (grey)
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  nodeRow: {
    width: '100%',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    top: '50%',
    marginTop: -1.5,
    height: 3,
  },
  connectorLeft: {
    left: 0,
    right: '50%',
  },
  connectorRight: {
    left: '50%',
    right: 0,
  },
  connectorPassed: {
    backgroundColor: '#10B981',
  },
  connectorRemaining: {
    backgroundColor: c.borderSoft,
  },
  stepNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepNodePassed: {
    backgroundColor: '#10B981',
  },
  stepNodeActive: {
    backgroundColor: c.primary,
  },
  stepNodeRemaining: {
    backgroundColor: c.surfaceMuted,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  stepNodeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  stepNodeTextActive: {
    color: '#FFFFFF',
  },
  stepNodeTextRemaining: {
    color: c.textMuted,
  },
  stepLabel: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  stepLabelPassed: {
    color: '#10B981',
    fontWeight: fontWeight.semibold,
  },
  stepLabelActive: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  stepLabelRemaining: {
    color: c.textMuted,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  scrollCentered: { justifyContent: 'center' },

  header: { alignItems: 'center', gap: spacing.xs },
  headerIconWrap: {
    width: 68,
    height: 68,
    borderRadius: radii.full,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  headerIcon: { marginBottom: spacing.sm },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 340,
  },

  body: { gap: spacing.lg },
  bodyCentered: { alignItems: 'center' },

  field: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  helper: { fontSize: fontSize.xs, lineHeight: 16, color: c.textMuted, marginTop: spacing.xs },
  meta: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center' },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  noteContent: { flex: 1, gap: 2 },
  noteTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.error },
  noteText: { fontSize: fontSize.sm, lineHeight: 20, color: c.textSoft },

  // Radio chips — share the Input field's border and radius.
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: { borderColor: c.primary, backgroundColor: c.tint },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
    textAlign: 'center',
  },
  chipTextOn: { color: c.primary, fontWeight: fontWeight.bold },

  // ID capture — the frame is the content, sized to a real ID card (ISO/IEC 7810).
  slotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  added: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addedText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: c.success },
  validatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  validatingText: {
    fontSize: fontSize.xs,
    color: c.primary,
    fontWeight: fontWeight.medium,
  },
  badgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgeErrorText: {
    fontSize: fontSize.xs,
    color: c.error,
    fontWeight: fontWeight.semibold,
  },
  docFrameError: {
    borderColor: c.error,
    borderWidth: 2,
  },
  slotWarningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  slotWarningText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: c.error,
    lineHeight: 16,
  },
  swapSidesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: c.tint,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  swapSidesText: {
    fontSize: fontSize.xs,
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  docIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  docFrame: {
    width: '100%',
    aspectRatio: 1.586,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.border,
  },
  docFrameFilled: { borderStyle: 'solid', borderColor: c.borderSoft },
  framePrompt: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.primary },
  frameHint: { fontSize: fontSize.xs, color: c.textMuted, textAlign: 'center' },
  slotActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    minHeight: 32,
    paddingTop: spacing.xs,
  },
  slotActionDivider: { fontSize: fontSize.sm, color: c.textMuted },
  slotLink: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },

  // Review — hairline rows, no card.
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowLabel: { fontSize: fontSize.sm, color: c.textMuted },
  rowValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: c.text,
    textAlign: 'right',
  },
  thumbs: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
  thumb: { flex: 1, gap: spacing.xs, alignItems: 'center', maxWidth: 110 },
  thumbImg: { width: '100%', borderRadius: radii.md, backgroundColor: c.surfaceMuted },
  thumbRound: { aspectRatio: 1, borderRadius: radii.full },
  thumbRect: { aspectRatio: 1.586, borderRadius: radii.md },
  thumbLabel: { fontSize: fontSize.xs, color: c.textMuted },
  legal: { fontSize: fontSize.xs, lineHeight: 18, color: c.textMuted, textAlign: 'center' },

  // Footer — pinned, flat, matching page background.
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
    backgroundColor: c.background,
  },
  textLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.primary },
  linkDisabled: { color: c.textMuted },
  inlineLink: { fontWeight: fontWeight.bold, color: c.primary },
  errorText: { fontSize: fontSize.sm, color: c.error, textAlign: 'center' },
  pressed: { opacity: 0.8 },
}));
