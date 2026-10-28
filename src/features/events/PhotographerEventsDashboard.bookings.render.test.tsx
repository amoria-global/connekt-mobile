import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Alert, Modal, Text } from 'react-native';

import { PhotographerEventsDashboard } from './PhotographerEventsDashboard';
import { dayKey } from '@/features/photographer/schedule';

/**
 * Accept and decline of a pending booking, rendered with react-test-renderer over a FAKED transport (a fixture, not the
 * real backend). Checks the visible outcome after success, that a failure keeps the booking and says so, how the
 * sheets dismiss, and that a second tap cannot send a second request while one is running.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('./EventQrSheet', () => ({ EventQrSheet: () => null }));
jest.mock('@/store/auth', () => ({
  // The role selector sees a photographer (flat Button); getState sees no user, so dialogs use the native alert spied on below.
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), {
    getState: () => ({ user: null }),
  }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const today = dayKey(new Date());
const pending = {
  id: 'p1',
  title: 'Corporate shoot',
  location: 'Kigali',
  clientName: 'Aline M.',
  status: 'PENDING',
  bookingStatus: 'PENDING',
  published: true,
  eventDate: today,
  startTime: '14:00',
  endTime: '16:00',
};
const accepted = { ...pending, status: 'UPCOMING', bookingStatus: 'ACCEPTED' };

const REASON_PLACEHOLDER = 'e.g. Schedule conflict';
const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('').replace(/[-]/g, '').trim()).filter(Boolean).join(' | ');
const pressables = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).length > 0 && text(n) === label);
const press = async (r: TestRenderer.ReactTestRenderer, label: string, index = 0) =>
  act(async () => {
    await pressables(r, label)[index].props.onPress();
  });
const openModal = (r: TestRenderer.ReactTestRenderer, title: string) =>
  r.root.findAllByType(Modal).find((m) => m.props.visible && text(m).includes(title));
const reasonInput = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => String(n.props?.placeholder ?? '').startsWith(REASON_PLACEHOLDER) && typeof n.props.onChangeText === 'function')[0];

async function mountList() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PhotographerEventsDashboard />);
  });
  return r;
}

let alert: jest.SpyInstance;
beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockResolvedValue({ action: 1, data: [pending] });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

describe('accepting a booking', () => {
  it('posts once, closes the sheet and shows the booking as accepted after the refresh', async () => {
    const r = await mountList();
    expect(pressables(r, 'Accept').length).toBeGreaterThan(0);
    await press(r, 'Accept');
    expect(openModal(r, 'Accept booking')).toBeTruthy();

    mockPost.mockResolvedValueOnce({ action: 1 });
    mockGet.mockResolvedValue({ action: 1, data: [accepted] });
    await press(r, 'Confirm accept');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/photographer/events/p1/accept');
    expect(openModal(r, 'Accept booking')).toBeFalsy();
    expect(pressables(r, 'Accept')).toHaveLength(0);
  });

  it('keeps the booking pending and the sheet open, and says so, when the server refuses (HTTP 200, action 0)', async () => {
    const r = await mountList();
    await press(r, 'Accept');
    mockPost.mockResolvedValueOnce({ action: 0, message: 'Slot taken' });
    mockGet.mockClear();
    await press(r, 'Confirm accept');
    expect(alert).toHaveBeenCalledWith('Could not accept', 'Please try again.');
    expect(openModal(r, 'Accept booking')).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
    expect(pressables(r, 'Accept').length).toBeGreaterThan(0);
  });

  it('cancels without a request, from the Cancel button and from Back', async () => {
    const r = await mountList();
    await press(r, 'Accept');
    await press(r, 'Cancel');
    expect(openModal(r, 'Accept booking')).toBeFalsy();

    await press(r, 'Accept');
    const modal = openModal(r, 'Accept booking')!;
    await act(async () => modal.props.onRequestClose());
    expect(openModal(r, 'Accept booking')).toBeFalsy();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('disables the confirm control while the request runs, so a second tap cannot send another', async () => {
    const r = await mountList();
    await press(r, 'Accept');
    let release!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((res) => (release = res)));
    await act(async () => {
      pressables(r, 'Confirm accept')[0].props.onPress();
    });
    const sheet = openModal(r, 'Accept booking')!;
    const disabled = sheet.findAll((n) => n.props?.disabled === true && typeof n.props.onPress === 'function');
    expect(disabled.length).toBeGreaterThan(0);
    expect(mockPost).toHaveBeenCalledTimes(1);
    await act(async () => release({ action: 1 }));
  });
});

describe('declining a booking', () => {
  it('sends the reason once, closes the sheet and refreshes', async () => {
    const r = await mountList();
    await press(r, 'Deny');
    expect(openModal(r, 'Decline booking')).toBeTruthy();
    await act(async () => reasonInput(r).props.onChangeText('Already booked'));

    mockPost.mockResolvedValueOnce({ action: 1 });
    mockGet.mockResolvedValue({ action: 1, data: [{ ...pending, status: 'CANCELLED', bookingStatus: 'DECLINED' }] });
    await press(r, 'Submit decline');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/photographer/events/p1/decline', { reason: 'Already booked' });
    expect(openModal(r, 'Decline booking')).toBeFalsy();
    expect(pressables(r, 'Deny')).toHaveLength(0);
  });

  it('keeps the booking, the sheet and the typed reason when the server refuses', async () => {
    const r = await mountList();
    await press(r, 'Deny');
    await act(async () => reasonInput(r).props.onChangeText('Away that day'));
    mockPost.mockResolvedValueOnce({ action: 0, message: 'Nope' });
    mockGet.mockClear();
    await press(r, 'Submit decline');
    expect(alert).toHaveBeenCalledWith('Could not decline', 'Please try again.');
    expect(openModal(r, 'Decline booking')).toBeTruthy();
    expect(reasonInput(r).props.value).toBe('Away that day');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('dismisses with Back without a request, but not while one is being sent', async () => {
    const r = await mountList();
    await press(r, 'Deny');
    await act(async () => openModal(r, 'Decline booking')!.props.onRequestClose());
    expect(openModal(r, 'Decline booking')).toBeFalsy();
    expect(mockPost).not.toHaveBeenCalled();

    await press(r, 'Deny');
    let release!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((res) => (release = res)));
    await act(async () => {
      pressables(r, 'Submit decline')[0].props.onPress();
    });
    await act(async () => openModal(r, 'Decline booking')!.props.onRequestClose());
    expect(openModal(r, 'Decline booking')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledTimes(1);
    await act(async () => release({ action: 1 }));
  });
});
