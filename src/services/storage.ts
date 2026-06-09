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
} as const;
