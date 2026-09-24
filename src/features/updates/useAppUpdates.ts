/**
 * Over-the-air (OTA) app updates via expo-updates / EAS Update.
 *
 * How updates reach a user:
 *   • JS + asset changes are published with `eas update` and delivered OTA.
 *     The app automatically checks on launch and foreground resume, and
 *     allows users to update directly via an in-app prompt or manual check.
 *   • Native changes still require a store build via Play Store / App Store.
 *
 * This module is defensively built:
 *   - Works smoothly on native release builds (EAS Update).
 *   - Gracefully no-ops in __DEV__, Expo Go, web, and tests without throwing.
 *   - Uses a centralized Zustand store so the root layout modal, floating banner,
 *     and profile settings stay in sync in real time.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { create } from 'zustand';

// Types only — no runtime top-level native import to stay safe across platforms & test runners.
type UpdatesModule = typeof import('expo-updates');

let cached: UpdatesModule | null | undefined;

/** Lazily resolve expo-updates; returns null where it isn't available. */
export function getUpdates(): UpdatesModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-updates') as UpdatesModule;
  } catch {
    cached = null;
  }
  return cached;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error';

export interface CheckUpdateResult {
  available: boolean;
  ready: boolean;
  message?: string;
  error?: string;
}

export interface AppUpdatesState {
  status: UpdateStatus;
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  updateReady: boolean;
  downloadProgress: number; // 0 to 1
  isModalVisible: boolean;
  dismissedInSession: boolean;
  lastCheckedTime: Date | null;
  errorMessage: string | null;
  currentVersion: string;
  updateId: string | null;
  channel: string | null;
  isEmbeddedLaunch: boolean;
  setStatus: (status: UpdateStatus) => void;
  setChecking: (checking: boolean) => void;
  setDownloading: (downloading: boolean, progress?: number) => void;
  setUpdateAvailable: (available: boolean) => void;
  setUpdateReady: (ready: boolean) => void;
  setModalVisible: (visible: boolean) => void;
  setDismissedInSession: (dismissed: boolean) => void;
  setLastCheckedTime: (time: Date) => void;
  setErrorMessage: (msg: string | null) => void;
}

const appVersion =
  Constants.expoConfig?.version ||
  Constants.nativeAppVersion ||
  '2.2.0';

export const useUpdatesStore = create<AppUpdatesState>((set) => ({
  status: 'idle',
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  updateReady: false,
  downloadProgress: 0,
  isModalVisible: false,
  dismissedInSession: false,
  lastCheckedTime: null,
  errorMessage: null,
  currentVersion: appVersion,
  updateId: null,
  channel: null,
  isEmbeddedLaunch: true,

  setStatus: (status) => set({ status }),
  setChecking: (isChecking) => set({ isChecking, status: isChecking ? 'checking' : 'idle' }),
  setDownloading: (isDownloading, progress = 0) =>
    set({
      isDownloading,
      downloadProgress: progress,
      status: isDownloading ? 'downloading' : 'idle',
    }),
  setUpdateAvailable: (isUpdateAvailable) =>
    set({ isUpdateAvailable, status: isUpdateAvailable ? 'available' : 'idle' }),
  setUpdateReady: (updateReady) =>
    set({ updateReady, status: updateReady ? 'ready' : 'idle' }),
  setModalVisible: (isModalVisible) => set({ isModalVisible }),
  setDismissedInSession: (dismissedInSession) => set({ dismissedInSession }),
  setLastCheckedTime: (lastCheckedTime) => set({ lastCheckedTime }),
  setErrorMessage: (errorMessage) =>
    set({ errorMessage, status: errorMessage ? 'error' : 'idle' }),
}));

// Setup listener on native state machine once module loads on native
let listenerAttached = false;

function initNativeListener() {
  if (listenerAttached) return;
  const Updates = getUpdates();
  if (!Updates) return;

  // Sync initial metadata
  useUpdatesStore.setState({
    updateId: Updates.updateId ?? null,
    channel: Updates.channel ?? null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch ?? true,
  });

  // Check if an update is already pending in the native context (e.g. from startup check)
  try {
    const latest = (Updates as any).latestContext;
    if (latest?.isUpdatePending) {
      useUpdatesStore.getState().setUpdateReady(true);
      useUpdatesStore.getState().setModalVisible(true);
    }
  } catch {
    /* ignore */
  }

  // Subscribe to native state transitions
  if (typeof Updates.addUpdatesStateChangeListener === 'function') {
    try {
      Updates.addUpdatesStateChangeListener((event: any) => {
        const ctx = event?.context;
        if (!ctx) return;
        const store = useUpdatesStore.getState();

        if (ctx.isUpdatePending) {
          store.setUpdateReady(true);
          if (!store.dismissedInSession) {
            store.setModalVisible(true);
          }
        } else if (ctx.isDownloading) {
          store.setDownloading(true, ctx.downloadProgress ?? 0);
        } else if (ctx.isChecking) {
          store.setChecking(true);
        }
      });
      listenerAttached = true;
    } catch {
      /* ignore */
    }
  }
}

export function useAppUpdates() {
  const store = useUpdatesStore();
  const busy = useRef(false);

  // Initialize native listener
  useEffect(() => {
    initNativeListener();
  }, []);

  const checkForUpdates = useCallback(
    async (isManual = false): Promise<CheckUpdateResult> => {
      const Updates = getUpdates();

      if (Platform.OS === 'web') {
        const msg = 'Web is always up to date with the latest deployment.';
        if (isManual) {
          store.setLastCheckedTime(new Date());
          store.setStatus('up-to-date');
        }
        return { available: false, ready: false, message: msg };
      }

      if (__DEV__ || !Updates || !Updates.isEnabled) {
        const msg = `Running in development mode (v${store.currentVersion}). OTA updates run on release builds.`;
        if (isManual) {
          store.setLastCheckedTime(new Date());
          store.setStatus('up-to-date');
        }
        return { available: false, ready: false, message: msg };
      }

      // If an update is already ready, open prompt
      if (store.updateReady) {
        if (isManual) {
          store.setModalVisible(true);
        }
        return {
          available: true,
          ready: true,
          message: 'An update is already downloaded and ready to install.',
        };
      }

      if (busy.current) {
        return {
          available: store.isUpdateAvailable,
          ready: store.updateReady,
          message: 'Update check in progress…',
        };
      }

      busy.current = true;
      store.setChecking(true);
      store.setErrorMessage(null);

      try {
        const checkResult = await Updates.checkForUpdateAsync();

        if (checkResult.isAvailable) {
          store.setChecking(false);
          store.setUpdateAvailable(true);
          store.setDownloading(true);

          await Updates.fetchUpdateAsync();

          store.setDownloading(false);
          store.setUpdateReady(true);
          store.setLastCheckedTime(new Date());
          store.setModalVisible(true);

          return {
            available: true,
            ready: true,
            message: 'A new update was downloaded and is ready to install!',
          };
        } else {
          // Check if it was already staged
          const isPending = (Updates as any).latestContext?.isUpdatePending;
          if (isPending) {
            store.setChecking(false);
            store.setUpdateReady(true);
            store.setModalVisible(true);
            return {
              available: true,
              ready: true,
              message: 'Update downloaded and ready to install.',
            };
          }

          store.setChecking(false);
          store.setLastCheckedTime(new Date());
          store.setStatus('up-to-date');

          return {
            available: false,
            ready: false,
            message: `You're on the latest version of Connekyt (v${store.currentVersion}).`,
          };
        }
      } catch (err: any) {
        const errorMsg =
          err?.message || 'Unable to check for updates. Please try again later.';
        store.setChecking(false);
        store.setDownloading(false);
        store.setErrorMessage(errorMsg);

        return {
          available: false,
          ready: false,
          error: errorMsg,
          message: errorMsg,
        };
      } finally {
        busy.current = false;
      }
    },
    [store],
  );

  // Background check on startup and app foreground resume
  useEffect(() => {
    checkForUpdates(false);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkForUpdates(false);
      }
    });

    return () => sub.remove();
  }, [checkForUpdates]);

  const applyUpdate = useCallback(async () => {
    const Updates = getUpdates();
    if (!Updates) return;

    if (__DEV__ || !Updates.isEnabled) {
      console.warn('[useAppUpdates] Cannot reload in development mode.');
      return;
    }

    try {
      await Updates.reloadAsync();
    } catch (err) {
      console.warn('[useAppUpdates] Reload error:', err);
      // Even if immediate reload encounters an issue, update applies on next launch.
    }
  }, []);

  const openModal = useCallback(() => {
    store.setModalVisible(true);
  }, [store]);

  const closeModal = useCallback(() => {
    store.setModalVisible(false);
    store.setDismissedInSession(true);
  }, [store]);

  return {
    ...store,
    checkForUpdates,
    applyUpdate,
    openModal,
    closeModal,
  };
}
