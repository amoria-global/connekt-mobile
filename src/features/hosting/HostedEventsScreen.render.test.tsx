import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import HostedEventsScreen from './HostedEventsScreen';
import { HostEntry } from './HostEntry';
import { mapEvent } from '@/features/events/api';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'Photographer' } }), {
    getState: () => ({ user: null }),
  }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const elig = (o: Record<string, unknown> = {}) => ok({ enabled: true, canHostFree: true, canHostPaid: false, reason: null, ...o });
const events = [
  { id: 'u1', title: 'Friday set', eventStatus: 'PUBLISHED', eventDate: '2026-11-10', hostedByPhotographer: true },
  { id: 'l1', title: 'Live now show', eventStatus: 'ONGOING', eventDate: '2026-11-01', hostedByPhotographer: true },
  { id: 'e1', title: 'Old set', eventStatus: 'COMPLETED', eventDate: '2026-10-01', hostedByPhotographer: true },
];

const text = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
async function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}
const byLabel = (r: TestRenderer.ReactTestRenderer, label: RegExp) =>
  r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && label.test(n.props.accessibilityLabel) && typeof n.props?.onPress === 'function')[0];

beforeEach(() => jest.clearAllMocks());

describe('HostedEventsScreen', () => {
  it('lists upcoming events first and opens the stream controls from one', async () => {
    mockGet.mockImplementation(async (url: string) => (url.includes('eligibility') ? elig() : ok(events)));
    const r = await mount(<HostedEventsScreen />);
    expect(text(r)).toContain('Friday set');
    expect(text(r)).not.toContain('Old set');
    await act(async () => {
      byLabel(r, /^Go live with Friday set/).props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/stream/control/u1');
  });

  it('shows an empty state with a next step when nothing is hosted', async () => {
    mockGet.mockImplementation(async (url: string) => (url.includes('eligibility') ? elig() : ok([])));
    const r = await mount(<HostedEventsScreen />);
    expect(text(r)).toContain('No upcoming events');
    expect(text(r)).toContain('Host an event');
  });

  it('shows an error with a retry when the list cannot load', async () => {
    mockGet.mockImplementation(async (url: string) => {
      if (url.includes('eligibility')) return elig();
      throw { status: 500, message: 'Server error' };
    });
    const r = await mount(<HostedEventsScreen />);
    expect(text(r)).toContain('Server error');
    expect(text(r)).toContain('Try again');
  });

  it('offers nothing when the server has hosting off', async () => {
    mockGet.mockResolvedValue(elig({ enabled: false, canHostFree: false, reason: 'HOSTING_DISABLED' }));
    const r = await mount(<HostedEventsScreen />);
    expect(text(r)).toContain('Hosting is not available');
  });
});

describe('HostEntry', () => {
  it('renders nothing while hosting is off, so the app looks as it did', async () => {
    mockGet.mockResolvedValue(elig({ enabled: false, canHostFree: false }));
    const r = await mount(<HostEntry />);
    expect(r.toJSON()).toBeNull();
  });

  it('renders nothing when the eligibility call fails', async () => {
    mockGet.mockRejectedValue({ status: 500, message: 'down' });
    const r = await mount(<HostEntry />);
    expect(r.toJSON()).toBeNull();
  });

  it('offers Go live and My hosted events when the server allows hosting', async () => {
    mockGet.mockResolvedValue(elig());
    const r = await mount(<HostEntry />);
    await act(async () => {
      byLabel(r, /^Go live/).props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/host/new');
    await act(async () => {
      byLabel(r, /^My hosted events/).props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/host');
  });
});

describe('mapEvent', () => {
  it('reads the hosted flag, and an older server without it means not hosted', () => {
    expect(mapEvent({ id: 'a', title: 'x', hostedByPhotographer: true }).hostedByPhotographer).toBe(true);
    expect(mapEvent({ id: 'a', title: 'x' }).hostedByPhotographer).toBe(false);
  });
});
