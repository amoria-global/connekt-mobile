/**
 * Secure key-value storage, backed by expo-secure-store (Keychain on iOS,
 * Keystore on Android). Used for auth tokens. SecureStore is unavailable on
 * web, so we fall back to localStorage there.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export const storage = {
  async get(key: string): Promise<string | null> {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (isWeb) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (isWeb) {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const StorageKeys = {
  authToken: 'auth.token',
  refreshToken: 'auth.refreshToken',
  session: 'auth.session',
  onboardingSeen: 'onboarding.seen',
  /** Persisted once the user accepts the Terms & Conditions on first install. */
  termsAccepted: 'terms.accepted',
  /** Display currency chosen in the top-bar selector (see store/currency.ts). */
  displayCurrency: 'display.currency',
  /** Selected app language ('en' | 'fr' | 'es'). */
  language: 'app.language',
  /**
   * Anonymous live-chat participants this device has hidden. Anonymous viewers
   * have no account to block server-side, so the block is device-local —
   * keyed by "<eventId>:<viewerName>". Reports still go to the server.
   */
  hiddenChatters: 'moderation.hiddenChatters',
  /**
   * Prefix for the name/email Apple delivers on the FIRST Sign in with Apple
   * handshake only. Cached per Apple user id until the backend has the account,
   * so a failed first POST does not lose the only copy. See features/auth/apple.ts.
   */
  appleFirstHandshake: 'auth.apple.firstHandshake',
  /**
   * The photographer workspace the user is working in, when it is not their own (store/workspace.ts). Cleared on
   * every sign-in and sign-out, so one account's selection never carries into another's.
   */
  activeWorkspace: 'workspace.active',
  /** Light or dark, from the Profile header's appearance button. Absent means Midnight Glass (dark). */
  themePreference: 'app.themePreference',
} as const;
