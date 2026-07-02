/**
 * Tracks whether the user has finished the onboarding flow for the current run.
 *
 * NOTE: onboarding is currently shown on EVERY app launch (by request) — the
 * "seen" flag is session-only and intentionally NOT persisted, so a fresh start
 * always routes through the splash + intro slides again. To make it show only
 * once per install, restore the storage read/write (StorageKeys.onboardingSeen)
 * in load()/complete().
 */
import { create } from 'zustand';
import { storage, StorageKeys } from '@/services/storage';

type OnboardingState = {
  /** null = not yet decided, false = show onboarding, true = finished this run. */
  seen: boolean | null;
  /**
   * Terms & Conditions acceptance — unlike `seen`, this IS persisted, so the
   * T&C screen only shows on first install. null = undecided (still reading
   * storage), false = must accept, true = accepted.
   */
  termsAccepted: boolean | null;
  /** Decide whether to show onboarding + read persisted T&C (call once at startup). */
  load: () => Promise<void>;
  /** Mark onboarding as finished for this run (not persisted). */
  complete: () => Promise<void>;
  /** Persist T&C acceptance (first install only). */
  acceptTerms: () => Promise<void>;
};

export const useOnboarding = create<OnboardingState>((set) => ({
  seen: null,
  termsAccepted: null,

  // Always show onboarding on launch — start unseen rather than reading
  // storage. T&C, however, is read from storage so it only shows once.
  load: async () => {
    const accepted = await storage.get(StorageKeys.termsAccepted).catch(() => null);
    set({ seen: false, termsAccepted: accepted === '1' });
  },

  // Session-only: lets the current run continue to /login without re-triggering
  // the route guard, but next launch starts fresh and shows onboarding again.
  complete: async () => {
    set({ seen: true });
  },

  acceptTerms: async () => {
    await storage.set(StorageKeys.termsAccepted, '1').catch(() => {});
    set({ termsAccepted: true });
  },
}));
