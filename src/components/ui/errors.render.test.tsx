import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/i18n/sharedStrings', () => ({ useSharedT: () => ({ tr: (s: string) => s }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/utils/copyText', () => ({ copyText: jest.fn().mockResolvedValue('copied') }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { Banner, BannerHost } from './Banner';
import { ErrorSheet } from './ErrorSheet';
import { FieldError } from './FieldError';
import { FullScreenError } from './FullScreenError';
import { TOAST_MS, ToastHost } from './Toast';
import { presentError } from '@/features/errors/presentError';
import { clearBanner, getErrorState, resetErrorState, setBanner, showToast } from '@/features/errors/store';
import { showError } from '@/features/errors/useErrors';

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter((s) => /[A-Za-z0-9]/.test(s)); // icon glyphs render as private-use characters
/** Pressable host nodes that act as buttons (Pressable renders a View carrying role and onPress). */
const buttons = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');

beforeEach(() => {
  resetErrorState();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('FieldError', () => {
  it('draws nothing without a message', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<FieldError message={null} />);
    });
    expect(r.toJSON()).toBeNull();
  });

  it('shows icon plus text and is announced as an alert', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<FieldError message="The minimum price is RWF 100." id="price-error" />);
    });
    expect(texts(r)).toContain('The minimum price is RWF 100.');
    const row = r.root.findAll((n) => n.props.accessibilityRole === 'alert')[0];
    expect(row.props.accessibilityLiveRegion).toBe('polite');
    expect(row.props.nativeID).toBe('price-error');
  });
});

describe('toast store and host', () => {
  it('shows one toast at a time and queues the rest', () => {
    showToast({ message: 'first', tone: 'warning' });
    showToast({ message: 'second', tone: 'warning' });
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<ToastHost />);
    });
    expect(texts(r)).toContain('first');
    expect(texts(r)).not.toContain('second');
  });

  it('does not queue the same message twice', () => {
    showToast({ message: 'same', tone: 'danger' });
    showToast({ message: 'same', tone: 'danger' });
    expect(getErrorState().toasts).toHaveLength(1);
  });

  it('dismisses after 5 seconds and then shows the next', () => {
    showToast({ message: 'first', tone: 'warning' });
    showToast({ message: 'second', tone: 'warning' });
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<ToastHost />);
    });
    act(() => {
      jest.advanceTimersByTime(TOAST_MS + 10);
    });
    expect(texts(r)).toContain('second');
    expect(texts(r)).not.toContain('first');
  });

  it('runs Retry once and removes the toast', () => {
    const onAction = jest.fn();
    showToast({ message: 'x', tone: 'danger', actionLabel: 'Try again', onAction });
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<ToastHost />);
    });
    const retry = buttons(r).find((b) => b.findAllByType(Text).some((t) => [t.props.children].flat().join('') === 'Try again'));
    act(() => retry!.props.onPress());
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(getErrorState().toasts).toHaveLength(0);
  });

  it('has a 44 point dismiss control and announces politely', () => {
    showToast({ message: 'x', tone: 'warning' });
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<ToastHost />);
    });
    const live = r.root.findAll((n) => n.props.accessibilityLiveRegion === 'polite');
    expect(live.length).toBeGreaterThan(0);
    const close = buttons(r).find((b) => b.props.accessibilityLabel === 'Dismiss')!;
    const resolved = typeof close.props.style === 'function' ? close.props.style({ pressed: false }) : close.props.style;
    const style = [resolved].flat(3).reduce((a: any, s: any) => ({ ...a, ...(s ?? {}) }), {});
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });
});

describe('Banner', () => {
  it('stays until cleared and replaces a banner with the same key', () => {
    setBanner({ key: 'connectivity', tone: 'warning', title: "You're offline" });
    setBanner({ key: 'connectivity', tone: 'success', title: "You're back online" });
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<BannerHost />);
    });
    expect(texts(r)).toEqual(["You're back online"]);
    act(() => clearBanner('connectivity'));
    expect(r.toJSON()).toBeNull();
  });

  it('shows a close button only when dismissing is safe', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<Banner tone="info" title="Heads up" />);
    });
    expect(buttons(r)).toHaveLength(0);
    act(() => r.update(<Banner tone="info" title="Heads up" onDismiss={() => {}} />));
    expect(buttons(r)).toHaveLength(1);
  });
});

describe('ErrorSheet', () => {
  it('explains, reassures, and puts the raised action first with a plain way out', () => {
    const presentation = presentError({ status: 500, message: 'x' }, { intent: 'pay', reassurance: "You weren't charged." });
    const onAction = jest.fn();
    const onClose = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<ErrorSheet presentation={presentation} onAction={onAction} onClose={onClose} />);
    });
    const all = texts(r).join(' | ');
    expect(all).toContain("You weren't charged.");
    expect(all).toContain('Try again');
    expect(all).toContain('Cancel');
  });
});

describe('FullScreenError', () => {
  it('offers Try again and Home, and a copyable support code', () => {
    const presentation = presentError({ status: 503, message: 'x' }, { intent: 'load', critical: true });
    const onAction = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<FullScreenError presentation={presentation} onAction={onAction} />);
    });
    const all = texts(r).join(' | ');
    expect(all).toContain('Try again');
    expect(all).toContain('Go to Home');
    expect(all).toContain(`Support code ${presentation.supportCode}`);
  });
});

describe('showError dispatch', () => {
  it('toasts a network blip with Retry wired to the handler', () => {
    const onRetry = jest.fn();
    const p = showError({ status: 0, message: 'Network request failed' }, { intent: 'background' }, { onRetry });
    expect(p.kind).toBe('toast');
    const toast = getErrorState().toasts[0];
    expect(toast.actionLabel).toBe('Try again');
    toast.onAction?.();
    expect(onRetry).toHaveBeenCalled();
  });

  it('raises a banner for offline, a sheet for payments, and returns field and fullscreen to the screen', () => {
    expect(showError({ status: 0 }, { offline: true }).kind).toBe('banner');
    expect(getErrorState().banners[0].key).toBe('connectivity');
    expect(showError({ status: 500 }, { intent: 'pay' }).kind).toBe('sheet');
    expect(getErrorState().sheet).not.toBeNull();
    const field = showError({ errorCode: 'WRONG_CODE', attemptsLeft: 2 }, { intent: 'validate' });
    expect(field.kind).toBe('field');
    const full = showError({ status: 503 }, { intent: 'load', critical: true });
    expect(full.kind).toBe('fullscreen');
  });

  it('sends an expired session to the sign-in handler without showing an error', () => {
    const onSignIn = jest.fn();
    showError({ status: 401, message: 'x' }, {}, { onSignIn });
    expect(onSignIn).toHaveBeenCalled();
    expect(getErrorState().toasts).toHaveLength(0);
  });
});
