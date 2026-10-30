/**
 * Gets a photographer's phone ready to ring like a call for a new offer: the app may appear over other apps, show
 * full-screen on a locked phone, and run without battery limits, and a quiet service keeps it ready, also after the
 * phone restarts. Each missing permission is asked for once, one at a time, with a button straight to the setting.
 * Builds without the native call module do nothing here.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Alert } from '@/components/ui/dialog';
import {
  canDrawOverOtherApps,
  canShowFullScreenCalls,
  isIgnoringBatteryOptimizations,
  isIncomingCallAvailable,
  openBatterySettings,
  openFullScreenCallSettings,
  openOverlaySettings,
  setKeepReady,
} from './incomingCall';

type Step = {
  key: string;
  title: string;
  body: string;
  /** False only when the app can tell that the permission is missing. */
  missing: () => boolean;
  open: () => void;
};

const STEPS: Step[] = [
  {
    key: 'overlay',
    title: 'Show offers over other apps',
    body: 'Allow Connekyt to appear over other apps, so a new offer opens and rings right away, like a call.',
    missing: () => canDrawOverOtherApps() === false,
    open: openOverlaySettings,
  },
  {
    key: 'fullScreen',
    title: 'Let offers wake your phone',
    body: 'Allow full-screen alerts for Connekyt so a new offer can ring on your lock screen.',
    missing: () => !canShowFullScreenCalls(),
    open: openFullScreenCallSettings,
  },
  {
    key: 'battery',
    title: 'Keep Connekyt running',
    body: 'Set Connekyt to unrestricted battery use, so offers still ring when your phone has been idle or restarted.',
    missing: () => isIgnoringBatteryOptimizations() === false,
    open: openBatterySettings,
  },
];

const askedKey = (key: string) => `callSetupAsked_${key}`;

function ask(step: Step): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(step.title, step.body, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Open settings', onPress: () => resolve(true) },
    ]);
  });
}

/** Resolves when the app is in front again, e.g. after the person came back from system settings. */
function backInFront(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, 120_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') done();
    });
    function done() {
      clearTimeout(timer);
      sub.remove();
      resolve();
    }
  });
}

export function useCallReadiness(enabled: boolean): void {
  // Keep the app ready while a photographer is signed in; switch it off when they sign out.
  useEffect(() => {
    if (!enabled || !isIncomingCallAvailable()) return undefined;
    setKeepReady(true);
    return () => setKeepReady(false);
  }, [enabled]);

  // Ask for what is missing, once each.
  useEffect(() => {
    if (!enabled || !isIncomingCallAvailable()) return undefined;
    let live = true;
    (async () => {
      for (const step of STEPS) {
        if (!live) return;
        if (!step.missing()) continue;
        try {
          if (await SecureStore.getItemAsync(askedKey(step.key))) continue;
          await SecureStore.setItemAsync(askedKey(step.key), '1');
        } catch {
          continue;
        }
        if (!live) return;
        if (await ask(step)) {
          step.open();
          await backInFront();
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled]);
}
