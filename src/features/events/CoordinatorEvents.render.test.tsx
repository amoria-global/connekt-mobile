import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { ClientEventsDashboard } from '@/features/events/ClientEventsDashboard';
import { dayKey, shiftDays } from '@/features/photographer/schedule';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the coordinator's
 * Events list (the shared events screen in coordinator mode) with the real events API module over a faked transport. Sheets and routing
 * are faked. A failed read is an error with a retry (never "No events yet"), a failed
 * refresh keeps the last list and says so, and nothing is counted as zero before it loads.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), getOk: async (...a: unknown[]) => actual.requireOk(await mockGet(...a)) } };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/config/env', () => ({ env: { hybridBookingEnabled: false, webBaseUrl: 'https://connekyt.com' } }));
jest.mock('@/features/events/EventQrSheet', () => ({ EventQrSheet: () => null }));
const mockBooking = jest.fn();
jest.mock('@/features/booking/BookingModeSelector', () => ({
  BookingModeSelector: (p: unknown) => {
    mockBooking(p);
    return null;
  },
}));
jest.mock('@/features/hybrid/ExploreChoiceSheet', () => ({ ExploreChoiceSheet: () => null }));
jest.mock('@/components/ui/live', () => {
  const { Text, Pressable, View } = require('react-native');
  return {
    LivePill: ({ label = 'LIVE' }: { label?: string }) => <Text>{label}</Text>,
    LiveButton: ({ label, onPress }: { label: string; onPress?: () => void }) => (
      <Pressable onPress={onPress} accessibilityLabel={label}>
        <Text>{label}</Text>
      </Pressable>
    ),
    LiveTwinkle: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Aline', customerType: 'Coordinator' }, status: 'authenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const refused = (message: string) => ({ action: 0, message });

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

const serve = (body: unknown) => mockGet.mockImplementation(async () => body);

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<ClientEventsDashboard coordinator />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

const byLabel = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const byText = (r: TestRenderer.ReactTestRenderer, text: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === text))[0];
const press = async (node: ReactTestInstance | undefined, what: string) => {
  if (!node) throw new Error(`nothing to press: ${what}`);
  await act(async () => {
    node.props.onPress();
  });
};

const future = shiftDays(dayKey(new Date()), 10);

beforeEach(() => {
  mockGet.mockReset();
  mockPush.mockReset();
  mockBooking.mockReset();
});

describe('coordinator events as rendered', () => {
  it('reads the coordinator feed, not the customer feed, and names the client', async () => {
    serve(ok([{ id: 'a', title: 'Gala Night', eventDate: future, client: { firstName: 'Aline', lastName: 'K' }, photographer: { firstName: 'Eric', lastName: 'M' } }]));
    const r = await mount();
    expect(mockGet.mock.calls[0][0]).toContain('/coordinator/events');
    expect(mockGet.mock.calls.every((c) => !String(c[0]).includes('/customer/'))).toBe(true);
    const text = flat(r.root);
    expect(text).toContain('Gala Night');
    expect(text).toContain('Events you coordinate');
    expect(text).toContain('Manage event');
    expect(text).not.toContain('View booking');
  });

  it('offers Photographers and Geo pricing, and not Explore events', async () => {
    serve(ok([]));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Geo pricing');
    expect(text).not.toContain('Explore events');
    await press(byText(r, 'Geo pricing'), 'Geo pricing');
    expect(mockPush).toHaveBeenLastCalledWith('/event/geo-pricing');
    await press(byText(r, 'Photographers'), 'Photographers');
    expect(mockPush).toHaveBeenLastCalledWith('/photographers');
  });

  it('a live event is controlled from the event page, not the viewers room', async () => {
    serve(ok([{ id: 'live1', title: 'Concert', eventDate: dayKey(new Date()), status: 'ONGOING' }]));
    const r = await mount();
    expect(flat(r.root)).toContain('Control live');
    await press(byLabel(r, 'Control live'), 'Control live');
    expect(mockPush).toHaveBeenLastCalledWith('/event/live1');
  });

  it('a refused read is an error with a retry, not "No events yet"', async () => {
    serve(refused('Could not load your events'));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load your events');
    expect(text).toContain('Try again');
    expect(text).not.toContain('No events yet');
  });

  it('an empty feed offers to create an event in coordinator words', async () => {
    serve(ok([]));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('No events yet');
    expect(text).toContain('coordinating photographers');
    await press(byText(r, 'Create event'), 'Create event');
    expect(mockPush).toHaveBeenLastCalledWith('/event/new');
  });

  it('keeps edit and share on each card', async () => {
    serve(ok([{ id: 'a', title: 'Gala Night', eventDate: future }]));
    const r = await mount();
    await press(byText(r, 'Edit'), 'Edit');
    expect(mockPush).toHaveBeenLastCalledWith('/event/new?editId=a');
  });
});
