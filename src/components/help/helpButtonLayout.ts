/**
 * Where the global Help button sits, and where it must stay out of the way. Pure, so every rule can be tested.
 *
 * The button lives in the root layout, so it is on every screen by default. It steps aside only where a bottom-right
 * thing the person is using would be covered, and each exception is named here with its reason:
 *  - the Help screens themselves (it would open the screen the person is already on);
 *  - first-run onboarding and terms (the next and accept buttons are bottom right, and nothing is signed in yet);
 *  - chat (the send button is bottom right), live streams and the live selfie check (full-screen camera and controls);
 *  - the event, hybrid and album creation wizards (their next and submit buttons are bottom right);
 *  - while the keyboard is open (the same rule the tab bar uses);
 *  - screens that ask it to hide with {@link useHideHelpButton} (a camera, a viewer).
 * It sits above the tab bar where the bar is shown, and above the round add button on the screens that have one.
 */
import { BAR_CONTENT_HEIGHT, FAB_RIGHT, FAB_SIZE, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/components/barMetrics';

export const HELP_BUTTON_SIZE = 52;
/** Space between the button and whatever it sits above. */
export const HELP_GAP = 14;
/** Centres the button over the round add button, which is a little wider. */
export const HELP_RIGHT = FAB_RIGHT + (FAB_SIZE - HELP_BUTTON_SIZE) / 2;

/** Route segments (as expo-router reports them) where the button is not shown, and why: see the file header. */
const HIDDEN_ANYWHERE = ['help-center', 'contact_us', 'feedback', 'conversation', 'stream', 'live-stream', 'kyc'];
const HIDDEN_GROUPS = ['(onboarding)'];
/** Creation wizards: the same word anywhere else is a different screen, so these are matched as a pair. */
const HIDDEN_PAIRS: [string, string][] = [['event', 'new'], ['event', 'hybrid-wizard'], ['album', 'new']];
/** Screens that already draw the round add button at the bottom right (kept in step with the screens that import it, by a test). */
const HAS_FAB = [['(app)', 'packages'], ['(public)', 'gallery']];

const hasPair = (segments: readonly string[], a: string, b: string) => segments.some((s, i) => s === a && segments[i + 1] === b);

export function isHelpButtonHidden(segments: readonly string[]): boolean {
  if (segments.length === 0) return true; // not routed yet
  if (segments.some((s) => HIDDEN_GROUPS.includes(s) || HIDDEN_ANYWHERE.includes(s))) return true;
  return HIDDEN_PAIRS.some(([a, b]) => hasPair(segments, a, b));
}

export interface HelpPlacement {
  visible: boolean;
  /** Distance from the bottom edge of the screen. */
  bottom: number;
}

export function helpButtonPlacement(
  segments: readonly string[],
  insets: { bottom: number },
  { keyboardVisible = false, optedOut = false, ready = true }: { keyboardVisible?: boolean; optedOut?: boolean; ready?: boolean } = {},
): HelpPlacement {
  if (!ready || keyboardVisible || optedOut || isHelpButtonHidden(segments)) return { visible: false, bottom: 0 };

  // The tab bar: its content row, plus its bottom padding (the home indicator, or 8 where there is none).
  if (segments.includes('(tabs)')) {
    return { visible: true, bottom: Math.max(insets.bottom, 8) + BAR_CONTENT_HEIGHT + HELP_GAP };
  }
  const base = Math.max(insets.bottom, 0) + HELP_GAP + 6;
  if (HAS_FAB.some(([group, name]) => segments.includes(group) && segments.includes(name))) {
    // Same position the round add button computes for itself, then one button higher.
    const fabBottom = (insets.bottom > 0 ? insets.bottom : TAB_BAR_MARGIN) + TAB_BAR_HEIGHT + 12;
    return { visible: true, bottom: fabBottom + FAB_SIZE + HELP_GAP };
  }
  return { visible: true, bottom: base };
}
