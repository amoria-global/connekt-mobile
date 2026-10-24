/**
 * Over-the-air (OTA) app updates via expo-updates / EAS Update.
 *
 * How updates reach a user:
 *   • JS + asset changes are published with `eas update` and delivered OTA.
 *     The app checks on launch and foreground resume. Every update the
 *     check finds is mandatory: it downloads at once and the blocking prompt
 *     offers one action, "Update now". There is no skip or postpone path.
 *   • Native changes still require a store build via Play Store / App Store.
 *     expo-updates never offers an OTA bundle to a binary with a different
 *     runtime version (app.json runtimeVersion policy: appVersion), so an
 *     incompatible bundle is not forced onto an older build.
 *
 * This module is defensively built:
 *   - Works smoothly on native release builds (EAS Update).
 *   - Gracefully no-ops in __DEV__, Expo Go, web, and tests without throwing.
 *   - Uses a centralized Zustand store so the root layout modal, floating banner,
 *     and profile settings stay in sync in real time.
 */
import { useEffect } from 'react';
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
  lastCheckedTime: Date | null;
  errorMessage: string | null;
  currentVersion: string;
  updateId: string | null;
  channel: string | null;
  isEmbeddedLaunch: boolean;
  devPreviewOpen?: boolean;
  setStatus: (status: UpdateStatus) => void;
  setChecking: (checking: boolean) => void;
  setDownloading: (downloading: boolean, progress?: number) => void;
  setUpdateAvailable: (available: boolean) => void;
  setUpdateReady: (ready: boolean) => void;
  setLastCheckedTime: (time: Date) => void;
  setErrorMessage: (msg: string | null) => void;
  setDevPreviewOpen: (open: boolean) => void;
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
  lastCheckedTime: null,
  errorMessage: null,
  currentVersion: appVersion,
  updateId: null,
  channel: null,
  isEmbeddedLaunch: true,
  devPreviewOpen: true,

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
  setLastCheckedTime: (lastCheckedTime) => set({ lastCheckedTime }),
  setErrorMessage: (errorMessage) =>
    set({ errorMessage, status: errorMessage ? 'error' : 'idle' }),
  setDevPreviewOpen: (devPreviewOpen) => set({ devPreviewOpen }),
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
      useUpdatesStore.getState().setUpdateAvailable(true);
      useUpdatesStore.getState().setUpdateReady(true);
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
          store.setUpdateAvailable(true);
          store.setUpdateReady(true);
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

/**
 * True while a known update must be dealt with: downloading, downloaded, or one
 * that failed to download or apply and is being retried. A failed check with no known update does
 * not block anyone.
 */
export function isUpdateBlocking(
  s: Pick<AppUpdatesState, 'updateReady' | 'isDownloading' | 'isUpdateAvailable' | 'isChecking' | 'errorMessage'>,
) {
  return s.updateReady || s.isDownloading || (s.isUpdateAvailable && (!!s.errorMessage || s.isChecking));
}

let checking = false;

/** Checks once and, if an update exists, downloads it. Safe to call repeatedly. */
export async function checkForUpdates(isManual = false): Promise<CheckUpdateResult> {
  const store = useUpdatesStore.getState();
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

  if (store.updateReady) {
    return { available: true, ready: true, message: 'An update is downloaded and ready to install.' };
  }

  if (checking) {
    return {
      available: store.isUpdateAvailable,
      ready: store.updateReady,
      message: 'Update check in progress...',
    };
  }

  checking = true;
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
      return { available: true, ready: true, message: 'A new update was downloaded and is ready to install.' };
    }

    // Already staged by the startup check?
    if ((Updates as any).latestContext?.isUpdatePending) {
      store.setChecking(false);
      store.setUpdateAvailable(true);
      store.setUpdateReady(true);
      return { available: true, ready: true, message: 'Update downloaded and ready to install.' };
    }

    store.setChecking(false);
    store.setLastCheckedTime(new Date());
    store.setStatus('up-to-date');
    return {
      available: false,
      ready: false,
      message: `You're on the latest version of Connekyt (v${store.currentVersion}).`,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Unable to check for updates. Please try again later.';
    store.setChecking(false);
    // Keep isUpdateAvailable: a download that failed is still a required update.
    useUpdatesStore.setState({ isDownloading: false });
    store.setErrorMessage(errorMsg);
    return { available: useUpdatesStore.getState().isUpdateAvailable, ready: false, error: errorMsg, message: errorMsg };
  } finally {
    checking = false;
  }
}

/** Restarts into the downloaded update. Returns false and records why when it cannot. */
export async function applyUpdate(): Promise<boolean> {
  const Updates = getUpdates();
  if (!Updates || __DEV__ || !Updates.isEnabled) return false;
  try {
    await Updates.reloadAsync();
    return true;
  } catch (err: any) {
    useUpdatesStore.getState().setUpdateAvailable(true);
    useUpdatesStore.getState().setErrorMessage(err?.message || 'The update could not be applied.');
    return false;
  }
}

/**
 * The one action of the mandatory prompt. Downloads if needed (a retry after a
 * failure), then restarts into the new version.
 */
export async function updateNow(): Promise<void> {
  const store = useUpdatesStore.getState();
  store.setErrorMessage(null);
  if (!useUpdatesStore.getState().updateReady) {
    const result = await checkForUpdates(false);
    if (!result.ready) return;
  }
  await applyUpdate();
}

export function previewUpdateScreen(open = true) {
  useUpdatesStore.getState().setDevPreviewOpen(open);
}

export function useAppUpdates() {
  const store = useUpdatesStore();

  useEffect(() => {
    initNativeListener();
  }, []);

  return { ...store, checkForUpdates, applyUpdate, updateNow, previewUpdateScreen, blocking: isUpdateBlocking(store) };
}

/**
 * Runs the launch and foreground-resume checks. Mount it exactly once, at the
 * root, so the check is not repeated by every screen that reads update state.
 */
export function useUpdateChecks() {
  useEffect(() => {
    initNativeListener();
    void checkForUpdates(false);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdates(false);
    });
    return () => sub.remove();
  }, []);
}
