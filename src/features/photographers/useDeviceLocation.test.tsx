import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { LAST_FIX_MAX_AGE_MS, LOCATION_TIMEOUT_MS, useDeviceLocation, type DeviceCoords, type DeviceLocationStatus } from './useDeviceLocation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPerm = jest.fn();
const mockLast = jest.fn();
const mockCurrent = jest.fn();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...a: unknown[]) => mockPerm(...a),
  getLastKnownPositionAsync: (...a: unknown[]) => mockLast(...a),
  getCurrentPositionAsync: (...a: unknown[]) => mockCurrent(...a),
}));

type Seen = { coords: DeviceCoords | null; status: DeviceLocationStatus; retry: () => void };

async function mount(enabled = true) {
  const seen: { value: Seen } = { value: { coords: null, status: 'pending', retry: () => undefined } };
  function Probe() {
    seen.value = useDeviceLocation(enabled);
    return null;
  }
  await act(async () => {
    TestRenderer.create(<Probe />);
  });
  return seen;
}

const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });

beforeEach(() => {
  jest.useFakeTimers();
  mockPerm.mockReset().mockResolvedValue({ status: 'granted' });
  mockLast.mockReset().mockResolvedValue(null);
  mockCurrent.mockReset().mockResolvedValue(fix(-1.67, 29.23));
});
afterEach(() => jest.useRealTimers());

describe('useDeviceLocation', () => {
  it('uses a recent remembered position without asking the GPS again', async () => {
    mockLast.mockResolvedValue(fix(-1.95, 30.06));
    const s = await mount();
    expect(s.value.status).toBe('granted');
    expect(s.value.coords).toEqual({ lat: -1.95, lng: 30.06 });
    expect(mockLast).toHaveBeenCalledWith({ maxAge: LAST_FIX_MAX_AGE_MS, requiredAccuracy: 5000 });
    expect(mockCurrent).not.toHaveBeenCalled();
  });

  it('reads one fresh position when nothing recent is remembered', async () => {
    const s = await mount();
    expect(s.value.status).toBe('granted');
    expect(s.value.coords).toEqual({ lat: -1.67, lng: 29.23 });
    expect(mockCurrent).toHaveBeenCalledTimes(1);
  });

  it('leaves the position empty when the person says no, and never reads the GPS', async () => {
    mockPerm.mockResolvedValue({ status: 'denied' });
    const s = await mount();
    expect(s.value.status).toBe('denied');
    expect(s.value.coords).toBeNull();
    expect(mockLast).not.toHaveBeenCalled();
    expect(mockCurrent).not.toHaveBeenCalled();
  });

  it('gives up on a fix that takes too long, so the screen is not left waiting', async () => {
    mockCurrent.mockReturnValue(new Promise(() => undefined));
    const s = await mount();
    expect(s.value.status).toBe('pending');
    await act(async () => {
      jest.advanceTimersByTime(LOCATION_TIMEOUT_MS + 10);
    });
    expect(s.value.status).toBe('unavailable');
    expect(s.value.coords).toBeNull();
  });

  it('treats a failing location service as unavailable, not as an error', async () => {
    mockPerm.mockRejectedValue(new Error('no provider'));
    const s = await mount();
    expect(s.value.status).toBe('unavailable');
  });

  it('does nothing while disabled', async () => {
    const s = await mount(false);
    expect(s.value.status).toBe('pending');
    expect(mockPerm).not.toHaveBeenCalled();
  });

  it('asks again on retry', async () => {
    mockPerm.mockResolvedValueOnce({ status: 'denied' });
    const s = await mount();
    expect(s.value.status).toBe('denied');
    mockPerm.mockResolvedValue({ status: 'granted' });
    await act(async () => {
      s.value.retry();
    });
    expect(s.value.status).toBe('granted');
    expect(s.value.coords).toEqual({ lat: -1.67, lng: 29.23 });
  });
});
