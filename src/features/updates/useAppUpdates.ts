/**
 * Over-the-air (OTA) app updates via expo-updates / EAS Update.
 *
 * How updates reach a user:
 *   • JS + asset changes (most of what we ship) are published with
 *     `eas update --channel <production|preview>` and delivered OTA — no
 *     app-store review. The app downloads them here and applies them on the
 *     user's confirmation (or the next cold start).
 *   • Native changes (new native modules, permissions, SDK bumps) still
 *     require a new store build; those arrive through Play Store / App Store.
 *
 * `expo-updates` is a NATIVE module — it's absent on web and in Expo Go /
 * stale dev clients, and importing it there throws. So we load it lazily and
 * defensively (never at module top-level) and no-op when it isn't available.
 * This hook checks on launch AND whenever the app returns to the foreground.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

// Types only — no runtime import.
type UpdatesModule = typeof import('expo-updates');

let cached: UpdatesModule | null | undefined;

/** Lazily resolve expo-updates; returns null where it isn't available. */
function getUpdates(): UpdatesModule | null {
  if (cached !== undefined) return cached;
  // OTA is native-only; expo-updates has no meaningful web runtime.
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

export function useAppUpdates() {
  const [updateReady, setUpdateReady] = useState(false);
  const busy = useRef(false);

  const check = useCallback(async () => {
    const Updates = getUpdates();
    // No-op in dev client / Expo Go / web, or once an update is staged.
    if (!Updates || !Updates.isEnabled || busy.current) return;
    busy.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setUpdateReady(true);
      }
    } catch {
      // Offline, no update server, or a transient error — retry next
      // foreground. Never surface this to the user.
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  const applyUpdate = useCallback(async () => {
    const Updates = getUpdates();
    if (!Updates) return;
    try {
      await Updates.reloadAsync();
    } catch {
      // If reload fails, the update still applies on the next cold start.
    }
  }, []);

  return { updateReady, applyUpdate };
}
