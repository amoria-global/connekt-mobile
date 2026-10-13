/**
 * Safe wrapper around expo-screen-orientation to prevent crashes when running
 * in environments (like older development builds, Expo Go, or test runners)
 * where the native ExpoScreenOrientation module is not linked in the binary.
 */
import type { OrientationLock as OrientationLockType, Orientation as OrientationType } from 'expo-screen-orientation';

let ScreenOrientationModule: typeof import('expo-screen-orientation') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ScreenOrientationModule = require('expo-screen-orientation');
} catch {
  ScreenOrientationModule = null;
}

export const OrientationLock: typeof OrientationLockType = ScreenOrientationModule?.OrientationLock ?? {
  DEFAULT: 0,
  ALL: 1,
  PORTRAIT: 2,
  PORTRAIT_UP: 3,
  PORTRAIT_DOWN: 4,
  LANDSCAPE: 5,
  LANDSCAPE_LEFT: 6,
  LANDSCAPE_RIGHT: 7,
  OTHER: 8,
} as any;

export const Orientation: typeof OrientationType = ScreenOrientationModule?.Orientation ?? {
  UNKNOWN: 0,
  PORTRAIT_UP: 1,
  PORTRAIT_DOWN: 2,
  LANDSCAPE_LEFT: 3,
  LANDSCAPE_RIGHT: 4,
} as any;

export async function lockAsync(orientationLock: OrientationLockType | number): Promise<void> {
  try {
    if (ScreenOrientationModule?.lockAsync) {
      await ScreenOrientationModule.lockAsync(orientationLock as any);
    }
  } catch {
    // Non-fatal if native module is unavailable
  }
}

export async function unlockAsync(): Promise<void> {
  try {
    if (ScreenOrientationModule?.unlockAsync) {
      await ScreenOrientationModule.unlockAsync();
    }
  } catch {
    // Non-fatal
  }
}

export async function getOrientationAsync(): Promise<OrientationType> {
  try {
    if (ScreenOrientationModule?.getOrientationAsync) {
      return await ScreenOrientationModule.getOrientationAsync();
    }
  } catch {
    // Non-fatal
  }
  return 1 as OrientationType; // PORTRAIT_UP
}
