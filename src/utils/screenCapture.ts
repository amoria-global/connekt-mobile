/**
 * Safe wrapper around expo-screen-capture to prevent crashes when running
 * in environments (like older development builds, Expo Go, or test runners)
 * where the native ExpoScreenCapture module is not linked in the binary.
 */
let ScreenCaptureModule: typeof import('expo-screen-capture') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ScreenCaptureModule = require('expo-screen-capture');
} catch {
  ScreenCaptureModule = null;
}

export async function preventScreenCapture(key = 'default'): Promise<void> {
  try {
    await ScreenCaptureModule?.preventScreenCaptureAsync(key);
  } catch {
    // no-op if native module is unavailable
  }
}

export async function allowScreenCapture(key = 'default'): Promise<void> {
  try {
    await ScreenCaptureModule?.allowScreenCaptureAsync(key);
  } catch {
    // no-op
  }
}

export async function enableAppSwitcherProtection(opacity = 0.8): Promise<void> {
  try {
    await ScreenCaptureModule?.enableAppSwitcherProtectionAsync?.(opacity);
  } catch {
    // no-op
  }
}

export async function disableAppSwitcherProtection(): Promise<void> {
  try {
    await ScreenCaptureModule?.disableAppSwitcherProtectionAsync?.();
  } catch {
    // no-op
  }
}

export function addScreenshotListener(listener: () => void): { remove: () => void } {
  try {
    if (ScreenCaptureModule?.addScreenshotListener) {
      return ScreenCaptureModule.addScreenshotListener(listener);
    }
  } catch {
    // no-op
  }
  return { remove: () => {} };
}
