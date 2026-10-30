import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';

import { useWalletSync, WALLET_MIN_LOADING_MS, WALLET_POLL_MS } from './useLiveWallet';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => {
  const R = require('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]) };
});

const seen: boolean[] = [];

function mount(refresh: () => Promise<void>) {
  function Probe() {
    seen.push(useWalletSync(refresh));
    return null;
  }
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<Probe />);
  });
  return r;
}

beforeEach(() => {
  seen.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((() => ({ remove: () => undefined })) as never);
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => 'active' });
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('wallet sync', () => {
  it('refreshes every 10 seconds, forever, and shows loading while each refresh runs', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mount(refresh);
    expect(refresh).not.toHaveBeenCalled();
    expect(seen[seen.length - 1]).toBe(false);

    for (let round = 1; round <= 3; round++) {
      // The first refresh is 10s after mount; after that, 10s apart, counted from the previous one's start.
      const step = round === 1 ? WALLET_POLL_MS : WALLET_POLL_MS - WALLET_MIN_LOADING_MS;
      await act(async () => {
        jest.advanceTimersByTime(step);
      });
      expect(refresh).toHaveBeenCalledTimes(round);
      expect(seen[seen.length - 1]).toBe(true); // loading is on screen
      await act(async () => {
        jest.advanceTimersByTime(WALLET_MIN_LOADING_MS);
      });
      expect(seen[seen.length - 1]).toBe(false); // the new balance is back
    }
  });

  it('keeps going after a refresh fails, and never stays stuck on loading', async () => {
    const refresh = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    mount(refresh);
    await act(async () => {
      jest.advanceTimersByTime(WALLET_POLL_MS);
    });
    await act(async () => {
      jest.advanceTimersByTime(WALLET_MIN_LOADING_MS);
    });
    expect(seen[seen.length - 1]).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(WALLET_POLL_MS);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
