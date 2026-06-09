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

type OnboardingState = {
  /** null = not yet decided, false = show onboarding, true = finished this run. */
  seen: boolean | null;
  /** Decide whether to show onboarding (call once at startup). */
  load: () => Promise<void>;
  /** Mark onboarding as finished for this run (not persisted). */
  complete: () => Promise<void>;
};

export const useOnboarding = create<OnboardingState>((set) => ({
  seen: null,

  // Always show onboarding on launch — start unseen rather than reading storage.
  load: async () => {
    set({ seen: false });
  },

  // Session-only: lets the current run continue to /login without re-triggering
  // the route guard, but next launch starts fresh and shows onboarding again.
  complete: async () => {
    set({ seen: true });
  },
}));
