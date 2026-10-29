import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Alert, Text } from 'react-native';

import { PhotographerEventsDashboard } from './PhotographerEventsDashboard';
import { dayKey, shiftDays } from '@/features/photographer/schedule';
import { dayLabel } from './eventsFilter';

/**
 * RENDERED Events screen (react-test-renderer, not a device) over a faked transport. Pins: the four section tabs, the
 * default state (List, All, Any date), chip counts that equal the rows shown, the opt-in calendar and the removable date
 * chip, the empty-result help, creation in the title row, and Remove on finished events.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('./EventQrSheet', () => ({ EventQrSheet: () => null }));
// No signed-in user: the themed dialog then falls back to the native alert, which this test spies on.
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: { user: null }) => unknown) => sel({ user: null }), { getState: () => ({ user: null }) }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const today = dayKey(new Date());
const ev = (o: Record<string, unknown>) => ({ location: 'Kigali', clientName: 'Amina', status: 'UPCOMING', bookingStatus: 'ACCEPTED', published: true, ...o });
const events = [
  ev({ id: 'live', title: 'Kigali Gala', eventDate: today, startTime: '00:01', endTime: '23:59', status: 'ONGOING', streamStatus: 'connected' }),
  ev({ id: 'soon', title: 'Booking Testing', eventDate: shiftDays(today, 10), startTime: '13:00' }),
  ev({ id: 'later', title: 'Bible Revival', eventDate: shiftDays(today, 30), startTime: '16:11' }),
  ev({ id: 'done', title: 'Past engagement', eventDate: shiftDays(today, -4), status: 'COMPLETED' }),
  ev({ id: 'older', title: 'Old summit', eventDate: shiftDays(today, -40), status: 'COMPLETED' }),
];

const flat = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const byLabel = (r: TestRenderer.ReactTestRenderer, label: string) => r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function');
const chip = (r: TestRenderer.ReactTestRenderer, name: string) => r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(`${name}, `) && typeof n.props.onPress === 'function')[0];
const press = async (n: ReactTestInstance) => act(async () => n.props.onPress());
/** Presses a day in the month grid, paging forward when it is in a later month. */
const pickDay = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  for (let i = 0; i < 3 && byLabel(r, label).length === 0; i++) await press(byLabel(r, 'Next month')[0]);
  await press(byLabel(r, label)[0]);
};
const rowTitles = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && /\. (Ongoing|Upcoming|Completed|Awaiting your reply)$/.test(n.props.accessibilityLabel) && typeof n.props.onPress === 'function').map((n) => String(n.props.accessibilityLabel).split('.')[0]);
const counts = (r: TestRenderer.ReactTestRenderer) => Object.fromEntries(['All', 'Upcoming', 'Ongoing', 'Completed'].map((k) => [k, Number(chip(r, k).props.accessibilityLabel.split(', ')[1])]));

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PhotographerEventsDashboard />);
  });
  return r;
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPush.mockReset();
  mockGet.mockResolvedValue({ action: 1, data: events });
});

describe('Events screen: tabs and default state', () => {
  it('has one bar of four tabs, Events active, each with an icon and a label', async () => {
    const r = await mount();
    const tabs = r.root.findAll((n) => n.props?.accessibilityRole === 'tab' && typeof n.props.onPress === 'function');
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(['Events', 'Albums', 'Photobooks', 'Content']);
    expect(tabs.map((t) => t.props.accessibilityState.selected)).toEqual([true, false, false, false]);
  });

  it('opens on List, All, Any date: every event is shown, grouped Ongoing now, Upcoming, Completed', async () => {
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Any date');
    expect(text).not.toContain('Month');
    expect(rowTitles(r)).toEqual(['Kigali Gala', 'Booking Testing', 'Bible Revival', 'Past engagement', 'Old summit']);
    expect(text.indexOf('ONGOING NOW')).toBeLessThan(text.indexOf('UPCOMING'));
    expect(text.indexOf('UPCOMING')).toBeLessThan(text.indexOf('COMPLETED'));
  });

  it('shows all four chips with full labels, and each count equals what its chip lists', async () => {
    const r = await mount();
    expect(counts(r)).toEqual({ All: 5, Upcoming: 2, Ongoing: 1, Completed: 2 });
    expect(flat(r.root)).toContain('Completed');
    await press(chip(r, 'Upcoming'));
    expect(rowTitles(r)).toEqual(['Booking Testing', 'Bible Revival']);
    await press(chip(r, 'Completed'));
    expect(rowTitles(r)).toEqual(['Past engagement', 'Old summit']);
  });

  it('puts creation in the title row and opens an event with one tap', async () => {
    const r = await mount();
    await press(byLabel(r, 'Create new event')[0]);
    expect(mockPush).toHaveBeenCalledWith('/host/new');
    await press(r.root.findAll((n) => String(n.props?.accessibilityLabel).startsWith('Booking Testing.') && typeof n.props.onPress === 'function')[0]);
    expect(mockPush).toHaveBeenCalledWith('/event/soon');
  });
});

describe('Events screen: the calendar is opt-in', () => {
  it('shows Month, Week and Agenda only inside Calendar, and switching back to List drops the date filter', async () => {
    const r = await mount();
    await press(byLabel(r, 'Calendar')[0]);
    const modes = r.root.findAll((n) => n.props?.accessibilityRole === 'tab' && ['Month', 'Week', 'Agenda'].includes(flat(n))).map((n) => flat(n));
    expect(modes).toEqual(expect.arrayContaining(['Month', 'Week', 'Agenda']));
    await pickDay(r, `${dayLabel(shiftDays(today, 10))}, 1 event`);
    expect(flat(r.root)).toContain(`${dayLabel(shiftDays(today, 10))}`);
    expect(rowTitles(r)).toEqual(['Booking Testing']);
    await press(byLabel(r, 'List')[0]);
    expect(rowTitles(r)).toHaveLength(5);
    expect(flat(r.root)).toContain('Any date');
  });

  it('a picked day is a removable chip, status chips combine with it, and their counts update', async () => {
    const r = await mount();
    await press(byLabel(r, 'Calendar')[0]);
    const day = shiftDays(today, 10);
    await pickDay(r, `${dayLabel(day)}, 1 event`);
    expect(counts(r)).toEqual({ All: 1, Upcoming: 1, Ongoing: 0, Completed: 0 });
    await press(chip(r, 'Completed'));
    expect(rowTitles(r)).toEqual([]);
    const remove = byLabel(r, `${dayLabel(day)}. Remove the date filter`)[0];
    await press(remove);
    expect(counts(r)).toEqual({ All: 5, Upcoming: 2, Ongoing: 1, Completed: 2 });
    expect(rowTitles(r)).toEqual(['Past engagement', 'Old summit']);
  });

  it('an empty result says what, how many are on other days, and offers Show all dates and Jump to next', async () => {
    const r = await mount();
    await press(byLabel(r, 'Calendar')[0]);
    const day = shiftDays(today, 3);
    await pickDay(r, `${dayLabel(day)}, no events`);
    await press(chip(r, 'All'));
    const text = flat(r.root);
    expect(text).toContain(`No events on ${dayLabel(day)}`);
    expect(text).toContain('5 events on other days.');
    await press(byLabel(r, 'Jump to next')[0]);
    expect(rowTitles(r)).toEqual(['Booking Testing']);
    await press(byLabel(r, `${dayLabel(shiftDays(today, 10))}. Remove the date filter`)[0]);
    expect(rowTitles(r)).toHaveLength(5);
  });
});

describe('Events screen: actions kept from the old cards', () => {
  it('offers Remove on a finished event from the press-and-hold menu, asks first, then calls the dismiss endpoint', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await mount();
    const row = r.root.findAll((n) => String(n.props?.accessibilityLabel).startsWith('Past engagement.') && typeof n.props.onLongPress === 'function')[0];
    await act(async () => row.props.onLongPress());
    const menu = alert.mock.calls[0][2]!;
    expect(menu.map((b) => b.text)).toEqual(expect.arrayContaining(['Open', 'Create album', 'Remove from my list']));

    mockPost.mockResolvedValueOnce({ action: 1 });
    await act(async () => menu.find((b) => b.text === 'Remove from my list')!.onPress!());
    expect(mockPost).not.toHaveBeenCalled();
    await act(async () => {
      await alert.mock.calls[1][2]!.find((b) => b.text === 'Remove')!.onPress!();
    });
    expect(mockPost).toHaveBeenCalledWith('/photographer/events/done/dismiss');
    alert.mockRestore();
  });

  it('does not offer Remove or Live stream the wrong way round: an upcoming event has no Remove', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await mount();
    const row = r.root.findAll((n) => String(n.props?.accessibilityLabel).startsWith('Booking Testing.') && typeof n.props.onLongPress === 'function')[0];
    await act(async () => row.props.onLongPress());
    const names = alert.mock.calls[0][2]!.map((b) => b.text);
    expect(names).toContain('Live stream');
    expect(names).not.toContain('Remove from my list');
    alert.mockRestore();
  });
});
