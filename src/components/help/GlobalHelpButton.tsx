/**
 * The Help button that stays on every screen, in the bottom right corner. Tapping it opens the existing Help Center
 * (`/help-center`, which also leads to Contact us and Feedback), signed in or not.
 *
 * Mounted once in the root layout, so it persists across every screen and dashboard without each one adding it. Where
 * it must not be (and where it must lift) is decided by {@link helpButtonPlacement}; a screen that needs the corner
 * for itself, such as a camera, calls {@link useHideHelpButton}.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable } from 'react-native';
import { useRouter, useSegments, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useLanguage } from '@/store/language';
import { makeStyles } from '@/theme';
import { HelpGlyph } from './HelpGlyph';
import { HELP_BUTTON_SIZE, HELP_RIGHT, helpButtonPlacement } from './helpButtonLayout';

/** How many mounted screens want the corner to themselves right now. A count, so two screens cannot undo each other. */
const useOptOuts = create<{ count: number; add: () => void; remove: () => void }>((set) => ({
  count: 0,
  add: () => set((s) => ({ count: s.count + 1 })),
  remove: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}));

/** Hides the Help button for as long as the calling screen is mounted. */
export function useHideHelpButton(hide: boolean = true): void {
  const add = useOptOuts((s) => s.add);
  const remove = useOptOuts((s) => s.remove);
  useEffect(() => {
    if (!hide) return;
    add();
    return remove;
  }, [hide, add, remove]);
}

export const HELP_HREF = '/help-center';

export function GlobalHelpButton({ ready = true }: { ready?: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const optedOut = useOptOuts((s) => s.count > 0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const placement = helpButtonPlacement(segments, insets, { keyboardVisible, optedOut, ready });
  if (!placement.visible) return null;

  const label = t('navHelpCenter');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="global-help-button"
      hitSlop={6}
      onPress={() => router.push(HELP_HREF as Href)}
      style={({ pressed }) => [styles.button, { bottom: placement.bottom, right: HELP_RIGHT }, pressed && styles.pressed]}
    >
      <HelpGlyph size={30} />
    </Pressable>
  );
}

const useStyles = makeStyles((c, e) => ({
  button: {
    position: 'absolute',
    width: HELP_BUTTON_SIZE,
    height: HELP_BUTTON_SIZE,
    borderRadius: HELP_BUTTON_SIZE / 2,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    // Above the tab bar (99) and any screen content, below modals.
    zIndex: 120,
    ...e(4),
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
}));
