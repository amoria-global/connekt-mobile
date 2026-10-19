import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import { ClientEventsDashboard } from '@/features/events/ClientEventsDashboard';
import { dayKey, shiftDays } from '@/features/photographer/schedule';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real client
 * Events list with the real events API module over a faked transport. Sheets and routing
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
  const state = () => ({ user: { firstName: 'Aline', customerType: 'CLIENT' }, status: 'authenticated' });
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
    r = TestRenderer.create(<ClientEventsDashboard />);
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
const past = shiftDays(dayKey(new Date()), -10);

beforeEach(() => {
  mockGet.mockReset();
  mockPush.mockReset();
  mockBooking.mockReset();
});

describe('client events as rendered', () => {
  it('lists bookings with their status words, dates and photographer, and counts the filters', async () => {
    serve(ok([
      { id: 'a', title: 'Yubire Wedding', eventDate: future, startTime: '10:00', location: 'Kigali', published: true, photographer: { firstName: 'Eric', lastName: 'M' }, createdAt: '2026-10-02T00:00:00Z' },
      { id: 'b', title: 'Old Birthday', eventDate: past, status: 'COMPLETED', createdAt: '2026-09-01T00:00:00Z' },
    ]));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Yubire Wedding');
    expect(text).toContain('Published');
    expect(text).toContain('Eric M');
    expect(text).toContain('Completed');
    expect(text).toContain('Showing 2 of 2 events');
    expect(byLabel(r, 'All, 2')).toBeDefined();
    expect(byLabel(r, 'Past, 1')).toBeDefined();
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('a refused read is an error with a retry, never "No events yet", and no count is shown', async () => {
    serve(refused('Could not load your events'));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load your events');
    expect(text).toContain('Try again');
    expect(text).not.toContain('No events yet');
    expect(byLabel(r, 'All')).toBeDefined(); // chip without a count, not "All, 0"
  });

  it('an empty account offers to create an event, and Create event goes to the direct form', async () => {
    serve(ok([]));
    const r = await mount();
    expect(flat(r.root)).toContain('No events yet');
    await press(byText(r, 'Create event'), 'Create event');
    expect(mockPush).toHaveBeenCalledWith('/event/new');
  });

  it('a failed refresh keeps the last list on screen and says so', async () => {
    serve(ok([{ id: 'a', title: 'Yubire Wedding', eventDate: future }]));
    const r = await mount();
    serve(refused('Server busy'));
    const list = r.root.findAll((n) => n.props?.refreshControl)[0];
    await act(async () => {
      await list.props.refreshControl.props.onRefresh();
    });
    const text = flat(r.root);
    expect(text).toContain('Yubire Wedding');
    expect(text).toContain('Could not refresh');
    expect(text).toContain('Server busy');
  });

  it('filters to past events, and an empty result says no match with a way back', async () => {
    serve(ok([{ id: 'a', title: 'Yubire Wedding', eventDate: future }]));
    const r = await mount();
    await press(byLabel(r, 'Past, 0'), 'Past');
    const text = flat(r.root);
    expect(text).toContain('No matching events');
    expect(text).not.toContain('Yubire Wedding');
    await press(byText(r, 'Clear filters'), 'Clear filters');
    expect(flat(r.root)).toContain('Yubire Wedding');
  });

  it('searches by title and photographer', async () => {
    serve(ok([
      { id: 'a', title: 'Yubire Wedding', eventDate: future },
      { id: 'b', title: 'Corporate', eventDate: future, photographer: { firstName: 'Grace', lastName: 'U' } },
    ]));
    const r = await mount();
    const input = r.root.findByType(TextInput);
    await act(async () => {
      input.props.onChangeText('grace');
    });
    const text = flat(r.root);
    expect(text).toContain('Corporate');
    expect(text).not.toContain('Yubire Wedding');
  });

  it('shows eight at a time and every event stays reachable through Show more', async () => {
    serve(ok(Array.from({ length: 11 }, (_, i) => ({ id: `e${i}`, title: `Event ${i}`, eventDate: future, createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z` }))));
    const r = await mount();
    expect(flat(r.root)).toContain('Showing 8 of 11 events');
    await press(byText(r, 'Show more'), 'Show more');
    expect(flat(r.root)).toContain('Showing 11 of 11 events');
    expect(byText(r, 'Show more')).toBeUndefined();
  });

  it('opens, edits and keeps QR for published events only', async () => {
    serve(ok([
      { id: 'a', title: 'Published one', eventDate: future, published: true },
      { id: 'b', title: 'Draft one', eventDate: future, published: false },
    ]));
    const r = await mount();
    expect(r.root.findAllByType(Text).filter((t) => t.props.children === 'QR').length).toBe(1);
    await press(byLabel(r, 'Open Draft one'), 'open');
    expect(mockPush).toHaveBeenCalledWith('/event/b');
    mockPush.mockReset();
    await press(byText(r, 'Edit'), 'Edit');
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/event\/new\?editId=/));
  });

  it('an open hybrid event offers the candidates step, not Post', async () => {
    serve(ok([{ id: 'h', title: 'Hybrid event', eventDate: future, bookingMode: 'HYBRID', status: 'MATCHES_AWAITING_SELECTION' }]));
    const r = await mount();
    expect(flat(r.root)).toContain('Choose photographer');
    expect(flat(r.root)).not.toContain('Post my event');
    await press(byText(r, 'Choose photographer'), 'Choose');
    expect(mockPush).toHaveBeenCalledWith('/event/candidates?id=h');
  });

  it('a direct booking with no photographer can be posted, which opens the sheet for that event', async () => {
    serve(ok([{ id: 'd', title: 'Direct event', eventDate: future }]));
    const r = await mount();
    await press(byText(r, 'Post my event'), 'Post');
    const last = mockBooking.mock.calls[mockBooking.mock.calls.length - 1][0] as { visible: boolean; existingEvent: { id: string } | null };
    expect(last.visible).toBe(true);
    expect(last.existingEvent?.id).toBe('d');
  });

  it('sorting by title is chosen from a labelled radio list', async () => {
    serve(ok([
      { id: 'a', title: 'Zebra', eventDate: future, createdAt: '2026-10-09T00:00:00Z' },
      { id: 'b', title: 'Apple', eventDate: future, createdAt: '2026-10-01T00:00:00Z' },
    ]));
    const r = await mount();
    const order = () => flat(r.root).indexOf('Zebra') < flat(r.root).indexOf('Apple');
    expect(order()).toBe(true); // newest first
    await press(byLabel(r, 'Sort events, Newest created first'), 'Sort');
    await press(r.root.findAll((n) => n.props?.accessibilityRole === 'radio' && n.props.accessibilityLabel === 'Title (A to Z)')[0], 'title sort');
    expect(order()).toBe(false);
  });

  it('switches from List to Agenda calendar view with client status labels and no photographer actions', async () => {
    serve(ok([
      { id: 'a', title: 'Yubire Wedding', eventDate: future, startTime: '10:00', location: 'Kigali', bookingStatus: 'PENDING', photographer: { firstName: 'Eric', lastName: 'M' } },
    ]));
    const r = await mount();
    const agendaTab = r.root.findAll((n) => n.props?.accessibilityRole === 'tab' && n.findAllByType(Text).some((t) => t.props.children === 'Agenda'))[0];
    await press(agendaTab, 'Agenda tab');
    const text = flat(r.root);
    expect(text).toContain('Yubire Wedding');
    expect(text).toContain('Eric M · Kigali');
    expect(text).not.toContain('Awaiting your reply');
    expect(text).not.toContain('Accept');
    expect(text).not.toContain('Decline');
  });

  it('a live event shows Live now and Watch live, opening the live stream', async () => {
    serve(ok([
      { id: 'live9', title: 'Kigali Gala', eventDate: dayKey(new Date()), status: 'ONGOING' },
    ]));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Kigali Gala');
    expect(text).toContain('Live now');
    await press(byText(r, 'Watch live'), 'Watch live');
    expect(mockPush).toHaveBeenCalledWith('/(public)/events/live-stream?id=live9');
  });
});
