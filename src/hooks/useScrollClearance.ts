import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme';

/** Height of the docked tab bar: its 56 row plus the home-indicator inset (see PersistentBottomBar). */
export const TAB_BAR_ROW = 56;

/**
 * Bottom padding for a scroll view under the docked tab bar (Home, Events, Wallet, Inbox, Profile, More).
 * The bar floats over the content, so the last row needs exactly the bar's height plus a small gap to
 * clear it. A fixed 110 to 140 left a band of empty screen on every device.
 */
export function useTabBarClearance(): number {
  const { bottom } = useSafeAreaInsets();
  return TAB_BAR_ROW + Math.max(bottom, 8) + spacing.lg;
}

/**
 * Bottom padding for a scroll view on a screen with no bar: the home-indicator inset and a comfortable gap.
 * Screens with their own docked action bar add that bar's height themselves.
 */
export function useStackClearance(): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, spacing.md) + spacing.xl;
}
