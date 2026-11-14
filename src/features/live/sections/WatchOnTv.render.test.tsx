import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

/**
 * Watch on TV, in the live page header. A signed-out viewer is asked to sign in, a viewer with no TV is led to
 * pairing, and a viewer with a TV can send this event to it. Rendered over fakes; it never talks to a backend.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }) }));
jest.mock('@/components/ui/Sheet', () => ({ Sheet: ({ children }: { children: React.ReactNode }) => children }));

let mockStatus = 'authenticated';
jest.mock('@/store/auth', () => ({
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  useAuth: (sel: (s: unknown) => unknown) => sel({ status: mockStatus }),
}));
const mockList = jest.fn();
const mockSend = jest.fn();
jest.mock('@/features/tv/api', () => ({
  listTvDevices: (...a: unknown[]) => mockList(...a),
  sendEventToTv: (...a: unknown[]) => mockSend(...a),
}));

let mockLastTv: string | null = null;
const mockRemember = jest.fn();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => mockLastTv,
  setItemAsync: async (...a: unknown[]) => mockRemember(...a),
}));

import { WatchOnTv } from './WatchOnTv';
import { isTvOnline, pickDefaultTv } from '@/features/tv/pick';

const text = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const press = async (n: ReactTestInstance) => { await act(async () => { n.props.onPress(); }); };
const pressable = (r: TestRenderer.ReactTestRenderer, match: (n: ReactTestInstance) => boolean) =>
  r.root.findAll((n) => typeof n.props.onPress === 'function' && match(n))[0]!;
const byLabel = (r: TestRenderer.ReactTestRenderer, label: string) => pressable(r, (n) => n.props.accessibilityLabel === label);

async function openSheet() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<WatchOnTv eventId="evt-1" title="Kigali Gala" />); });
  await press(byLabel(r, 'Watch on TV'));
  return r;
}

beforeEach(() => {
  mockPush.mockReset(); mockList.mockReset(); mockSend.mockReset();
  mockStatus = 'authenticated';
  mockLastTv = null;
  mockRemember.mockReset();
});

const tvA = { id: 'tv-1', deviceLabel: 'Living room TV', pairedAt: '2026-10-01' };
const tvB = { id: 'tv-2', deviceLabel: 'Bedroom TV', pairedAt: '2026-10-02' };

describe('Watch on TV', () => {
  it('asks a signed-out viewer to sign in and does not look for TVs', async () => {
    mockStatus = 'unauthenticated';
    const r = await openSheet();
    expect(text(r)).toContain('Sign in to use your TV');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('leads a viewer with no TV to pairing', async () => {
    mockList.mockResolvedValue([]);
    const r = await openSheet();
    expect(text(r)).toContain('No TV connected yet');
    const connect = pressable(r, (n) => n.findAllByType(Text).some((t) => [t.props.children].flat().join('') === 'Connect a TV'));
    await press(connect);
    expect(mockPush).toHaveBeenCalledWith('/connect-to-tv');
  });

  it('sends in one tap to the only TV, says so, and remembers it', async () => {
    mockList.mockResolvedValue([tvA]);
    mockSend.mockResolvedValue(undefined);
    const r = await openSheet();
    expect(mockSend).toHaveBeenCalledWith('tv-1', 'evt-1');
    expect(text(r)).toContain('Sent to Living room TV');
    expect(mockRemember).toHaveBeenCalledWith('connekyt.lastTvId', 'tv-1');
  });

  it('with several TVs sends to the one used last, and otherwise waits for a pick', async () => {
    mockList.mockResolvedValue([tvA, tvB]);
    mockSend.mockResolvedValue(undefined);
    mockLastTv = 'tv-2';
    let r = await openSheet();
    expect(mockSend).toHaveBeenCalledWith('tv-2', 'evt-1');
    expect(text(r)).toContain('Sent to Bedroom TV');

    mockSend.mockReset().mockResolvedValue(undefined);
    mockLastTv = null;
    r = await openSheet();
    expect(mockSend).not.toHaveBeenCalled();
    await press(byLabel(r, 'Send to Living room TV'));
    expect(mockSend).toHaveBeenCalledWith('tv-1', 'evt-1');
  });

  it('marks a TV seen in the last two minutes as on', async () => {
    mockList.mockResolvedValue([{ ...tvA, lastSeenAt: new Date().toISOString() }, tvB]);
    const r = await openSheet();
    expect(text(r)).toContain('On');
    expect(isTvOnline({ lastSeenAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() })).toBe(false);
    expect(pickDefaultTv([tvA, tvB], 'gone')).toBeNull();
  });

  it('shows why when the backend refuses, and a retry only lists', async () => {
    mockList.mockResolvedValue([tvA]);
    mockSend.mockRejectedValue({ status: 400, message: 'This stream has ended.' });
    const r = await openSheet();
    expect(text(r)).toContain('This stream has ended.');
    expect(text(r)).not.toContain('Sent to');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
