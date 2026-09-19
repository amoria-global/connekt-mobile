/**
 * Sensitive-data consent gates (Google Play User Data policy).
 *
 * Facial recognition (selfie → face match) and identity documents (KYC) are
 * sensitive personal data. Google requires a prominent in-app disclosure and
 * affirmative consent BEFORE collecting them. These helpers show that
 * disclosure once, remember the choice, and only proceed if the user agrees.
 */
import { Alert, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const FACE_CONSENT_KEY = 'consent.faceRecognition.v1';
const KYC_CONSENT_KEY = 'consent.identityVerification.v1';

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
    'Connekyt will analyze the selfie you provide using facial recognition to match you to photos ' +
      'in event galleries. Your photo is sent securely to our servers for this match and is used only ' +
      'to find your photos. You can delete this data any time by deleting your account.\n\n' +
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
      'provide. This information is sent securely to our servers and used only to verify your identity. ' +
      'It is retained only as long as required and removed when you delete your account.\n\n' +
      'Do you agree to submit your identity documents for verification?',
  );
  if (ok) await remember(KYC_CONSENT_KEY);
  return ok;
}
