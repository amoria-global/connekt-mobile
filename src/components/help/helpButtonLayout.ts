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
 *  - screens that ask it to hide with {@link useHideHelpButton} (a camera, a viewer);
 *  - every screen with a header (the app and public stacks), and the tab screens, whose headers and top bar carry
 *    Help instead (see HeaderHelpButton). Floating above the tab bar it sat over whatever scrolled
 *    beneath it (Home's View shoot button), and Midnight Glass allows nothing to float over a button.
 */
import { FAB_RIGHT, FAB_SIZE } from '@/components/barMetrics';

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

/** Stacks whose header carries Help, and the screens in them drawn without that header (kept in step with the layouts by a test). */
const HEADER_HELP_GROUPS = ['(app)', '(public)'];
export const HEADERLESS: Record<string, string[]> = {
  '(app)': ['event/hybrid-wizard', 'stream/[id]', 'stream/control/[id]', 'notifications', 'find-my-photos', 'album/new', 'album/[id]', 'content-album/new', 'photobook/[id]', 'photobook/new', 'analytics', 'connect-to-tv', 'pay-on-tv', 'kyc'],
  '(public)': ['explore-events', 'event/[id]', 'scan/[id]', 'workspace-invite/[id]', 'events/live-stream', 'donate', 'find-photos'],
};

/** Headerless screens whose own header carries Help (HeaderHelpButton), so the floating one steps aside there too. */
export const OWN_HEADER_HELP: Record<string, string[]> = {
  '(app)': ['notifications', 'analytics'],
};

function headerCarriesHelp(segments: readonly string[]): boolean {
  const group = segments[0];
  if (!HEADER_HELP_GROUPS.includes(group) || segments.includes('(tabs)')) return false;
  const route = segments.slice(1).join('/');
  return !HEADERLESS[group].includes(route) || (OWN_HEADER_HELP[group] ?? []).includes(route);
}

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

  // The tab screens carry Help in their top bar (see TopBar).
  if (segments.includes('(tabs)')) return { visible: false, bottom: 0 };
  if (headerCarriesHelp(segments)) return { visible: false, bottom: 0 };
  // What is left has no header and no tab bar: just above the bottom edge. The two screens with a round add button
  // (packages, the public gallery) have headers, so the button never has to clear it.
  return { visible: true, bottom: Math.max(insets.bottom, 0) + HELP_GAP + 6 };
}
