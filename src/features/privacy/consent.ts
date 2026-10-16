/**
 * Sensitive-data consent gates (Google Play User Data policy).
 *
 * Facial recognition (selfie → face match) and identity documents (KYC) are
 * sensitive personal data. Google requires a prominent in-app disclosure and
 * affirmative consent BEFORE collecting them, and Apple's review of face data
 * (Guideline 2.1 / 5.1.1) checks that each disclosure matches the privacy
 * policy. These helpers show that disclosure once, remember the choice, and
 * only proceed if the user agrees.
 *
 * Every string here must agree with section 8 of the privacy policy
 * (connekyt.com/user/privacy-policy) and with docs/FACE_DATA.md. Bump a key's
 * version whenever its text changes materially, so users see the new notice.
 * faceDataConsent.test.ts fails if a screen captures a face without a gate.
 */
import { Platform } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import * as SecureStore from 'expo-secure-store';

const FACE_CONSENT_KEY = 'consent.faceRecognition.v2';
const KYC_CONSENT_KEY = 'consent.identityVerification.v2';
const WITHDRAWAL_FACE_CONSENT_KEY = 'consent.withdrawalFaceCheck.v1';

async function alreadyConsented(key: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(key)) === 'true';
  } catch {
    return false;
  }
}

async function remember(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, 'true');
  } catch {
    // Non-fatal: worst case we ask again next time.
  }
}

function ask(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'I agree', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Gate before capturing/uploading a selfie for facial recognition.
 * Returns true if the user has consented (now or previously).
 */
export async function ensureFaceConsent(): Promise<boolean> {
  if (await alreadyConsented(FACE_CONSENT_KEY)) return true;
  const ok = await ask(
    'Use your photo to find you',
    'Connekyt will compare the selfie you provide with the faces in the event albums you search, ' +
      'using facial recognition by Amazon Web Services (AWS), to show you photos that include you. ' +
      'Your selfie is used only for this search and is not stored.\n\n' +
      'Do you agree to facial-recognition matching?',
  );
  if (ok) await remember(FACE_CONSENT_KEY);
  return ok;
}

/**
 * Gate before submitting identity documents (KYC).
 * Returns true if the user has consented (now or previously).
 */
export async function ensureKycConsent(): Promise<boolean> {
  if (await alreadyConsented(KYC_CONSENT_KEY)) return true;
  const ok = await ask(
    'Identity verification',
    'To verify your identity, Connekyt collects the ID document images, ID number, and selfie you ' +
      'provide. Our team reviews them to verify you, and your selfie is later compared with the selfie ' +
      'you take to confirm a withdrawal, using facial recognition by Amazon Web Services (AWS). ' +
      'They are stored privately and deleted when you delete your account.\n\n' +
      'Do you agree to submit your identity documents for verification?',
  );
  if (ok) await remember(KYC_CONSENT_KEY);
  return ok;
}

/**
 * Gate before the selfie that confirms a withdrawal.
 * Returns true if the user has consented (now or previously).
 */
export async function ensureWithdrawalFaceConsent(): Promise<boolean> {
  if (await alreadyConsented(WITHDRAWAL_FACE_CONSENT_KEY)) return true;
  const ok = await ask(
    'Confirm it is you',
    'Connekyt will compare this selfie with your verification selfie, using facial recognition by ' +
      'Amazon Web Services (AWS), to confirm the withdrawal is yours. This selfie is used only for ' +
      'this check and is not stored.\n\n' +
      'Do you agree to this face check?',
  );
  if (ok) await remember(WITHDRAWAL_FACE_CONSENT_KEY);
  return ok;
}
