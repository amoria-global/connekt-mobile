import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { AppState } from 'react-native';

import { useForegroundPolling } from './useForegroundPolling';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockAppState = 'active';
const mockListeners = new Set<(s: string) => void>();
jest.mock('expo-router', () => {
  const R = require('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]) };
});

const setApp = (s: string) => {
  mockAppState = s;
  act(() => mockListeners.forEach((l) => l(s)));
};

function mount(tick: () => Promise<unknown> | void, enabled = true) {
  function Probe() {
    useForegroundPolling(tick, 1000, enabled);
    return null;
  }
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<Probe />);
  });
  return r;
}

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
    mockListeners.add(cb);
    return { remove: () => mockListeners.delete(cb) };
  }) as never);
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => mockAppState });
  jest.useFakeTimers();
  mockAppState = 'active';
  mockListeners.clear();
});
const originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
afterEach(() => {
  if (originalState) Object.defineProperty(AppState, 'currentState', originalState);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useForegroundPolling', () => {
  it('ticks on the interval while focused and in the foreground, without an extra tick on first focus', () => {
    const tick = jest.fn();
    mount(tick);
    expect(tick).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(3000));
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('stops while the app is backgrounded, then catches up once and resumes when it returns', () => {
    const tick = jest.fn();
    mount(tick);
    setApp('background');
    act(() => void jest.advanceTimersByTime(10000));
    expect(tick).not.toHaveBeenCalled();
    setApp('active');
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => void jest.advanceTimersByTime(2000));
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('never overlaps ticks: a slow tick makes the next one wait', async () => {
    let release!: () => void;
    const tick = jest.fn(() => new Promise<void>((res) => (release = res)));
    mount(tick);
    act(() => void jest.advanceTimersByTime(3000));
    expect(tick).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await Promise.resolve();
    });
    act(() => void jest.advanceTimersByTime(1000));
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('does nothing when disabled, and cleans up on unmount', () => {
    const off = jest.fn();
    mount(off, false);
    act(() => void jest.advanceTimersByTime(5000));
    expect(off).not.toHaveBeenCalled();

    const on = jest.fn();
    const r = mount(on);
    act(() => r.unmount());
    act(() => void jest.advanceTimersByTime(5000));
    expect(on).not.toHaveBeenCalled();
    expect(mockListeners.size).toBe(0);
  });
});
