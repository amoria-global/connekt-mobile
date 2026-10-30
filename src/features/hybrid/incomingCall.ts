/**
 * The Android incoming-call alert for a new offer: a full-screen notification that wakes a locked phone and rings
 * until it is answered. It exists only in builds that carry the native module (Android store build 2.3.1 and
 * later); everywhere else every call here is a quiet no-op and the ordinary ringing screen is used.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type IncomingCallNative = {
  show(id: string, title: string, body: string): void;
  cancel(id: string): void;
  cancelAll(): void;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): void;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<IncomingCallNative>('IncomingCall') : null;

/** True only in a build that has the native module. Also what the app reports to the server as its capability. */
export function isIncomingCallAvailable(): boolean {
  return native != null;
}

export function showIncomingCall(id: string, title: string, body: string): boolean {
  if (!native) return false;
  try {
    native.show(id, title, body);
    return true;
  } catch {
    return false;
  }
}

export function cancelIncomingCall(id: string): void {
  try {
    native?.cancel(id);
  } catch {
    // Best effort.
  }
}

/** Stops any ringing call notification, e.g. once the app is open and shows its own ringing screen. */
export function cancelAllIncomingCalls(): void {
  try {
    native?.cancelAll();
  } catch {
    // Best effort.
  }
}

/** False when the user has switched off full-screen alerts for the app (Android 14 and newer). */
export function canShowFullScreenCalls(): boolean {
  try {
    return native ? native.canUseFullScreenIntent() : false;
  } catch {
    return false;
  }
}

export function openFullScreenCallSettings(): void {
  try {
    native?.openFullScreenIntentSettings();
  } catch {
    // Best effort.
  }
}
