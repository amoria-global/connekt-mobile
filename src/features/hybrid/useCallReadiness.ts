/**
 * Gets a photographer's phone ready to ring like a call for a new offer: full-screen alerts on a locked phone, the app
 * allowed over other apps, and no battery limits. Each missing permission is asked for once, one at a time, with a
 * button straight to the setting. Builds without the native call module do nothing here.
 *
 * The always-on keep-alive foreground service is deliberately NOT started (it is switched off): push delivery
 * does not need it, and it only added start-up risk.
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

/**
 * PLAY-REJECTION-DISABLED (2026-11-04): the full-screen alert step is off because the USE_FULL_SCREEN_INTENT permission
 * was removed from the manifest (plugins/withIncomingCall.js) after Google Play rejected the 2.3.2 submission over the
 * undeclared permission. Without the permission the setting it opens does nothing. The step below is kept intact. Set this
 * to true together with the plugin flag once the Play Console declaration is approved and a new store build ships.
 */
const FULL_SCREEN_INTENT_ENABLED = false;

type Step = {
  key: string;
  title: string;
  body: string;
  /** False only when the app can tell that the permission is missing. */
  missing: () => boolean;
  open: () => void;
};

const ALL_STEPS: Step[] = [
  {
    key: 'fullScreen',
    title: 'Let offers wake your phone',
    body: 'Allow full-screen alerts for Connekyt so a new offer can ring on your lock screen.',
    missing: () => !canShowFullScreenCalls(),
    open: openFullScreenCallSettings,
  },
  {
    key: 'overlay',
    title: 'Show offers over other apps',
    body: 'Allow Connekyt to appear over other apps, so a new offer opens and rings right away, like a call.',
    missing: () => canDrawOverOtherApps() === false,
    open: openOverlaySettings,
  },
  {
    key: 'battery',
    title: 'Keep Connekyt running',
    body: 'Set Connekyt to unrestricted battery use, so offers still ring when your phone has been idle.',
    missing: () => isIgnoringBatteryOptimizations() === false,
    open: openBatterySettings,
  },
];

const STEPS: Step[] = ALL_STEPS.filter((s) => FULL_SCREEN_INTENT_ENABLED || s.key !== 'fullScreen');

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
  // Make sure the old always-on service is off.
  useEffect(() => {
    if (!isIncomingCallAvailable()) return;
    setKeepReady(false);
  }, []);

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
