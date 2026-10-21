import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import StreamsScreen from '@/app/(app)/streams';
import { listStreams, mapStream, streamPhase } from '@/features/streams/api';
import { countByPhase, filterStreams, sortStreams, viewersLabel, whenLabel } from '@/features/streams/streamsModel';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The payload shapes below are copied from the backend: CoordinatorController.getStreams (stream record `id`, `eventId`,
 * `eventTitle`, `streamStatus`, `photographerName` string, `totalViewers`) and CompletedStreamResponseDTO for the client
 * (`id`, `eventId`, `streamTitle`, `photographerName`, `coverImage`, `streamDate`, `duration`, `peakViewers`, `replayUrl`).
 */
const mockGet = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a) } };
});
const mockPush = jest.fn();
let mockRole = 'Coordinator';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/live', () => {
  const { Text, View } = require('react-native');
  return {
    LivePill: ({ label = 'LIVE' }: { label?: string }) => <Text>{label}</Text>,
    LiveTwinkle: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Marie', customerId: 'k9', customerType: mockRole }, status: 'authenticated' });
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

const coordinatorRows = [
  { id: 's1', eventId: 'e1', eventTitle: 'Friday Night Concert', eventType: 'Concert', eventDate: '2026-10-21', eventTime: '20:00:00', streamStatus: 'connected', startedAt: '2026-10-21T20:00:00', endedAt: null, photographerName: 'Eric Mugisha', creatorName: 'Marie K', totalMessages: 12, totalViewers: 47 },
  { id: 's2', eventId: 'e2', eventTitle: 'Corporate Launch', eventDate: '2026-11-02', eventTime: '14:30:00', streamStatus: 'disconnected', startedAt: null, endedAt: null, photographerName: 'Grace Uwase', totalMessages: 0, totalViewers: 0 },
  { id: 's3', eventId: 'e3', eventTitle: 'Amina Birthday', eventDate: '2026-10-09', eventTime: '16:00:00', streamStatus: 'ended', startedAt: '2026-10-09T16:00:00', endedAt: '2026-10-09T18:00:00', photographerName: 'Jean Habimana', totalMessages: 4, totalViewers: 9 },
];
const clientRows = [
  { id: 'r1', eventId: 'e9', eventTitle: 'Yubire Wedding', streamTitle: 'Yubire Wedding, full day', photographerName: 'Eric Mugisha', coverImage: 'https://img.test/c.jpg', streamDate: '2026-09-12', streamTime: '10:00:00', duration: '2:14:09', totalViewers: 80, peakViewers: 61, totalMessages: 33, replayUrl: 'https://cdn.test/r.m3u8' },
];

const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<StreamsScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
};
const tap = async (r: TestRenderer.ReactTestRenderer, text: string) => {
  const node = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === text))[0];
  if (!node) throw new Error(`nothing to press: ${text}`);
  await act(async () => {
    node.props.onPress();
  });
};

beforeEach(() => {
  mockGet.mockReset();
  mockPush.mockReset();
  mockRole = 'Coordinator';
});

describe('stream mapping from the real feeds', () => {
  it('routes on the event id and keeps the stream record id apart', () => {
    const s = mapStream(coordinatorRows[0]);
    expect(s.id).toBe('e1');
    expect(s.streamId).toBe('s1');
  });

  it('reads the coordinator feed: title, photographer string, audience, date, phase', () => {
    const s = mapStream(coordinatorRows[0]);
    expect(s.title).toBe('Friday Night Concert');
    expect(s.photographerName).toBe('Eric Mugisha');
    expect(s.viewerCount).toBe(47);
    expect(s.messageCount).toBe(12);
    expect(s.date).toBe('2026-10-21');
    expect(s.time).toBe('20:00');
    expect(s.phase).toBe('live');
    expect(s.isLive).toBe(true);
  });

  it('reads the client history: stream title, cover, peak viewers, duration, and calls it a replay', () => {
    const s = mapStream(clientRows[0]);
    expect(s.title).toBe('Yubire Wedding, full day');
    expect(s.thumbnail).toBe('https://img.test/c.jpg');
    expect(s.viewerCount).toBe(61);
    expect(s.duration).toBe('2:14:09');
    expect(s.phase).toBe('ended');
    expect(s.isLive).toBe(false);
  });

  it('phases: ended wins, a connected stream is live, a configured one that has not started is upcoming', () => {
    expect(streamPhase({ streamStatus: 'ended', startedAt: 'x' })).toBe('ended');
    expect(streamPhase({ streamStatus: 'connected' })).toBe('live');
    expect(streamPhase({ streamStatus: 'disconnected' })).toBe('upcoming');
    expect(streamPhase({ startedAt: 'x', endedAt: null })).toBe('live');
    expect(streamPhase({ startedAt: 'x', endedAt: 'y' })).toBe('ended');
  });

  it('a zero audience is shown as a real zero, a missing one is not shown', () => {
    expect(mapStream(coordinatorRows[1]).viewerCount).toBe(0);
    expect(viewersLabel(0, 'upcoming')).toBe('0 viewers');
    expect(viewersLabel(undefined, 'ended')).toBeUndefined();
    expect(viewersLabel(1, 'ended')).toBe('1 viewer');
    expect(viewersLabel(12, 'live')).toBe('12 watching');
  });
});

describe('stream list model', () => {
  const streams = coordinatorRows.map(mapStream);
  it('counts and filters by phase, newest date first like the web', () => {
    expect(countByPhase(streams)).toEqual({ all: 3, live: 1, upcoming: 1, ended: 1 });
    expect(sortStreams(streams).map((s) => s.phase)).toEqual(['upcoming', 'live', 'ended']);
    expect(filterStreams(streams, 'ended').map((s) => s.id)).toEqual(['e3']);
  });
  it('labels the date and time, and nothing for a missing date', () => {
    expect(whenLabel({ date: '2026-10-21', time: '20:00' })).toBe('Oct 21, 2026 · 20:00');
    expect(whenLabel({})).toBeUndefined();
  });
});

describe('listStreams', () => {
  it('reads the role endpoint and does not fall back to the customer feed on a failure', async () => {
    mockGet.mockImplementation(async (path: string) => (path === '/coordinator/streams' ? refused('Could not load streams') : ok(clientRows)));
    await expect(listStreams(true)).rejects.toMatchObject({ message: 'Could not load streams' });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe('streams screen as rendered', () => {
  it('shows each stream with its real title, photographer, audience and phase, and opens the viewer on the event id', async () => {
    mockGet.mockImplementation(async () => ok(coordinatorRows));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Friday Night Concert');
    expect(text).toContain('Eric Mugisha');
    expect(text).toContain('47 watching');
    expect(text).toContain('Live now');
    expect(text).toContain('Upcoming');
    expect(text).toContain('Replay');
    expect(text).not.toContain('Live stream');
    const manage = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props?.accessibilityRole === 'button' && n.findAllByType(Text).some((t) => t.props.children === 'Manage event'));
    expect(manage.length).toBe(3); // one per coordinator card
    await act(async () => {
      manage[0].props.onPress();
    });
    expect(mockPush).toHaveBeenLastCalledWith('/event/e2');
    const card = r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Friday Night Concert') && typeof n.props.onPress === 'function')[0];
    await act(async () => {
      card.props.onPress();
    });
    expect(mockPush).toHaveBeenLastCalledWith('/stream/e1');
  });

  it('the client sees replays with duration and no Manage action', async () => {
    mockRole = 'Client';
    mockGet.mockImplementation(async () => ok(clientRows));
    const r = await mount();
    const text = flat(r.root);
    expect(mockGet.mock.calls[0][0]).toBe('/customer/streams');
    expect(text).toContain('Yubire Wedding, full day');
    expect(text).toContain('2:14:09');
    expect(text).toContain('61 viewers');
    expect(text).not.toContain('Manage event');
  });

  it('a client opens a stream in the access-aware viewer (a paid-to-watch stream is not theirs to read as an owner)', async () => {
    mockRole = 'Client';
    mockGet.mockImplementation(async () => ok(clientRows));
    const r = await mount();
    const card = r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Yubire Wedding') && typeof n.props.onPress === 'function')[0];
    await act(async () => {
      card.props.onPress();
    });
    expect(mockPush).toHaveBeenLastCalledWith('/(public)/events/live-stream?id=e9');
  });

  it('filters by phase', async () => {
    mockGet.mockImplementation(async () => ok(coordinatorRows));
    const r = await mount();
    const chip = r.root.findAll((n) => n.props?.accessibilityLabel === 'Replays, 1' && typeof n.props.onPress === 'function')[0];
    await act(async () => {
      chip.props.onPress();
    });
    const text = flat(r.root);
    expect(text).toContain('Amina Birthday');
    expect(text).not.toContain('Friday Night Concert');
  });

  it('a refused read is an error with a retry, not "no streams"', async () => {
    mockGet.mockImplementation(async () => refused('Could not load streams'));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load streams');
    expect(text).toContain('Try again');
    expect(text).not.toContain('No completed streams found');
  });

  it('a genuinely empty list says so', async () => {
    mockGet.mockImplementation(async () => ok([]));
    const r = await mount();
    expect(flat(r.root)).toContain('No completed streams found');
    expect(flat(r.root)).not.toContain('Try again');
  });
});
