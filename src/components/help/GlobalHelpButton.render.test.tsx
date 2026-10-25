import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Keyboard, StyleSheet } from 'react-native';

/**
 * The Help button as the person sees it: there on a normal screen, one tap to the Help Center, named for a screen
 * reader, in the person's language, and gone where it would cover something, including while typing.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockSegments: string[] = ['(app)', 'bookings'];
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }),
  useSegments: () => mockSegments,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
const mockLang = { language: 'en' };
const DICT: Record<string, Record<string, string>> = {
  en: { navHelpCenter: 'Help Center' },
  fr: { navHelpCenter: "Centre d'aide" },
  es: { navHelpCenter: 'Centro de ayuda' },
};
jest.mock('@/store/language', () => ({ useLanguage: () => ({ language: mockLang.language, t: (k: string) => DICT[mockLang.language][k] ?? k }) }));

import { GlobalHelpButton, HELP_HREF, useHideHelpButton } from './GlobalHelpButton';

const button = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => n.props?.testID === 'global-help-button' && typeof n.props.onPress === 'function');
async function mount(el: React.ReactElement = <GlobalHelpButton />) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(el); });
  return r;
}
const style = (r: TestRenderer.ReactTestRenderer) => StyleSheet.flatten(button(r)[0].props.style({ pressed: false }));

// Capture what the button listens to on the keyboard, so a test can open and close it.
const keyboard: Record<string, () => void> = {};
beforeEach(() => {
  mockSegments = ['(app)', 'bookings'];
  mockPush.mockReset();
  mockLang.language = 'en';
  Object.keys(keyboard).forEach((k) => delete keyboard[k]);
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
    keyboard[event] = cb;
    return { remove: jest.fn() };
  }) as unknown as typeof Keyboard.addListener);
});
afterEach(() => jest.restoreAllMocks());

describe('the global Help button', () => {
  it('is on a normal screen, named for a screen reader, with the icon', async () => {
    const r = await mount();
    expect(button(r)).toHaveLength(1);
    expect(button(r)[0].props.accessibilityRole).toBe('button');
    expect(button(r)[0].props.accessibilityLabel).toBe('Help Center');
    expect(r.root.findAll((n) => n.props?.testID === 'help-glyph').length).toBeGreaterThan(0);
  });

  it('opens the existing Help Center in one tap', async () => {
    const r = await mount();
    await act(async () => { button(r)[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(HELP_HREF);
    expect(HELP_HREF).toBe('/help-center');
  });

  it('is in the bottom right corner, on top of the screen', async () => {
    const r = await mount();
    const s = style(r);
    expect(s.position).toBe('absolute');
    expect(s.right).toBeGreaterThan(0);
    expect(s.bottom).toBeGreaterThan(0);
    expect(s.zIndex).toBeGreaterThan(99); // above the tab bar
  });

  it('steps aside on a tab screen, whose top bar carries Help', async () => {
    mockSegments = ['(app)', '(tabs)', 'index'];
    expect(button(await mount())).toHaveLength(0);
  });

  it.each([['fr', "Centre d'aide"], ['es', 'Centro de ayuda']])('is named in %s for people using the app in that language', async (lang, label) => {
    mockLang.language = lang;
    expect(button(await mount())[0].props.accessibilityLabel).toBe(label);
  });

  it('shows on sign in too, so help is there when someone cannot get in', async () => {
    mockSegments = ['(auth)', 'login'];
    expect(button(await mount())).toHaveLength(1);
  });

  it.each([
    ['the Help Center', ['(public)', 'help-center']],
    ['a chat', ['(app)', 'conversation', '[id]']],
    ['onboarding', ['(onboarding)', 'welcome']],
    ['a live stream', ['(app)', 'stream', '[id]']],
  ])('is not on %s', async (_n, segments) => {
    mockSegments = segments;
    expect(button(await mount())).toHaveLength(0);
  });

  it('is not shown before the app is ready', async () => {
    expect(button(await mount(<GlobalHelpButton ready={false} />))).toHaveLength(0);
    const r = await mount(<GlobalHelpButton ready />);
    expect(button(r)).toHaveLength(1);
  });

  it('goes while the keyboard is open and comes back when it closes', async () => {
    const r = await mount();
    expect(button(r)).toHaveLength(1);
    const show = keyboard.keyboardDidShow ?? keyboard.keyboardWillShow;
    const hide = keyboard.keyboardDidHide ?? keyboard.keyboardWillHide;
    expect(show).toBeDefined();
    await act(async () => { show(); });
    expect(button(r)).toHaveLength(0);
    await act(async () => { hide(); });
    expect(button(r)).toHaveLength(1);
  });

  it('lets a screen take the corner for itself while it is open, then gives it back', async () => {
    function Camera() {
      useHideHelpButton();
      return null;
    }
    const r = await mount(<><GlobalHelpButton /><Camera /></>);
    expect(button(r)).toHaveLength(0);
    await act(async () => { r.update(<GlobalHelpButton />); });
    expect(button(r)).toHaveLength(1);
  });

  it('two screens asking at once do not undo each other', async () => {
    function A() { useHideHelpButton(); return null; }
    function B() { useHideHelpButton(); return null; }
    const r = await mount(<><GlobalHelpButton /><A /><B /></>);
    expect(button(r)).toHaveLength(0);
    await act(async () => { r.update(<><GlobalHelpButton /><A /></>); });
    expect(button(r)).toHaveLength(0);
    await act(async () => { r.update(<GlobalHelpButton />); });
    expect(button(r)).toHaveLength(1);
  });

  it('a screen that asks with false leaves the button alone', async () => {
    function Maybe() { useHideHelpButton(false); return null; }
    expect(button(await mount(<><GlobalHelpButton /><Maybe /></>))).toHaveLength(1);
  });
});
