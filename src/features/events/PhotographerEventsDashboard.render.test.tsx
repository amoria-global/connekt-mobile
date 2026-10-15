import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Alert, Text } from 'react-native';

import { PhotographerEventsDashboard } from './PhotographerEventsDashboard';
import { dayKey } from '@/features/photographer/schedule';

/**
 * RENDERED events workspace (react-test-renderer, not a device). The API module is real over a faked transport; the
 * router, safe area, image and QR sheet are faked. Covers the single view switch, creation reachable without a
 * floating button, and the finished-event Remove action.
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
jest.mock('@/store/auth', () => ({
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const today = dayKey(new Date());
const past = dayKey(new Date(Date.now() - 4 * 86400e3));
const ev = (o: Record<string, unknown>) => ({
  location: 'Kigali',
  clientName: 'Amina',
  status: 'UPCOMING',
  bookingStatus: 'ACCEPTED',
  published: true,
  ...o,
});
const events = [
  ev({ id: 'up', title: 'Uwase wedding', eventDate: today, startTime: '09:00', endTime: '10:00' }),
  ev({ id: 'done', title: 'Past engagement', eventDate: past, status: 'COMPLETED' }),
];

const flat = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const byLabel = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function');

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

describe('photographer events workspace', () => {
  it('opens on the week calendar with ONE switch for Month, Week, Agenda and List', async () => {
    const r = await mount();
    const tabs = r.root.findAll((n) => n.props?.accessibilityRole === 'tab').map((n) => flat(n));
    expect(tabs).toEqual(expect.arrayContaining(['Month', 'Week', 'Agenda', 'List']));
    expect(flat(r.root)).toContain('Uwase wedding');
  });

  it('puts creation in the search row (no floating button over a card) in calendar modes', async () => {
    const r = await mount();
    const create = byLabel(r, 'Create new event');
    expect(create).toHaveLength(1);
    await act(async () => create[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/event/new');
    expect(byLabel(r, 'Sort events')).toHaveLength(0);
  });

  it('brings back Sort in List mode and still has no floating button (create stays in the search row)', async () => {
    const r = await mount();
    const list = r.root.find((n) => n.props?.accessibilityRole === 'tab' && flat(n) === 'List');
    await act(async () => list.props.onPress());
    expect(byLabel(r, 'Sort events')).toHaveLength(1);
    expect(byLabel(r, 'Create new event')).toHaveLength(1);
  });

  it('offers Remove only on finished events, asks first, then calls the dismiss endpoint', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await mount();
    const list = r.root.find((n) => n.props?.accessibilityRole === 'tab' && flat(n) === 'List');
    await act(async () => list.props.onPress());
    expect(byLabel(r, 'Remove Uwase wedding from my list')).toHaveLength(0);
    const remove = byLabel(r, 'Remove Past engagement from my list');
    expect(remove).toHaveLength(1);

    mockPost.mockResolvedValueOnce({ action: 1 });
    await act(async () => remove[0].props.onPress());
    expect(mockPost).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => {
      await buttons.find((b) => b.text === 'Remove')!.onPress!();
    });
    expect(mockPost).toHaveBeenCalledWith('/photographer/events/done/dismiss');
    alert.mockRestore();
  });

  it('keeps the event and says why when the server refuses the removal', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await mount();
    const list = r.root.find((n) => n.props?.accessibilityRole === 'tab' && flat(n) === 'List');
    await act(async () => list.props.onPress());
    await act(async () => byLabel(r, 'Remove Past engagement from my list')[0].props.onPress());
    mockPost.mockResolvedValueOnce({ action: 0, message: 'You are not authorized to dismiss this event' });
    mockGet.mockClear();
    await act(async () => {
      await alert.mock.calls[0][2]!.find((b) => b.text === 'Remove')!.onPress!();
    });
    expect(alert).toHaveBeenLastCalledWith('Could not remove', 'You are not authorized to dismiss this event');
    expect(mockGet).not.toHaveBeenCalled(); // no refresh: nothing changed
    alert.mockRestore();
  });
});
