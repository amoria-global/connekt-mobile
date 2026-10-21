import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import StreamsScreen from '@/app/(app)/streams';
import { deleteStreamRecord, listStreamHistory, markVideoViewed } from '@/features/streams/api';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The web dashboard's Streams page is the reference (app/pages/client/streams.tsx). Payloads are shaped like the
 * backend's: CoordinatorController.getStreams (no cover, no title), StreamChatMessageDTO for the chat rows (`videoUrl`
 * marks a video message; there is no `viewed` field), and the raw chat page that carries no `action`.
 */
const mockGet = jest.fn();
const mockDelete = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a), patch: (...a: unknown[]) => mockPatch(...a) } };
});
const mockPush = jest.fn();
let mockRole = 'Coordinator';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ title, children }: { title: string; children: React.ReactNode }) => {
    const { Text: T, View } = require('react-native');
    return (
      <View>
        <T>{`SHEET ${title}`}</T>
        {children}
      </View>
    );
  },
}));
jest.mock('@/components/ui/live', () => {
  const { Text: T, View } = require('react-native');
  return {
    LivePill: ({ label = 'LIVE' }: { label?: string }) => <T>{label}</T>,
    LiveTwinkle: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
const mockAlert = jest.fn();
jest.mock('@/components/ui/dialog', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Marie', customerId: 'k9', customerType: mockRole }, status: 'authenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

const feed = [
  { id: 's1', eventId: 'e1', eventTitle: 'Friday Night Concert', eventType: 'Concert', eventDate: '2026-10-09', eventTime: '20:00:00', streamStatus: 'ended', endedAt: '2026-10-09T22:00:00', photographerName: 'Eric Mugisha', totalMessages: 0, totalViewers: 47 },
  { id: 's2', eventId: 'e2', eventTitle: 'Amina Birthday', eventType: 'Birthday', eventDate: '2026-10-05', eventTime: '16:00:00', streamStatus: 'ended', endedAt: '2026-10-05T18:00:00', photographerName: 'Jean Habimana', totalMessages: 0, totalViewers: 9 },
];
const chats: Record<string, unknown[]> = {
  e1: [
    { id: 'c1', viewerUsername: 'Aline', message: 'Beautiful stage', time: '8:01 PM' },
    { id: 'c2', viewerUsername: 'Eric', message: 'Welcome all', time: '8:02 PM' },
    { id: 'v1', viewerUsername: 'Grace', videoUrl: 'https://backend.connekyt.com/uploads/chat/a.mp4', duration: '0:42', time: '8:30 PM' },
    { id: 'v2', viewerUsername: 'Jean', videoUrl: 'https://backend.connekyt.com/uploads/chat/b.mp4', duration: '0:10', time: '8:40 PM' },
  ],
  e2: [],
};

function route(over: Partial<Record<string, () => unknown>> = {}) {
  mockGet.mockImplementation(async (path: string) => {
    for (const [k, fn] of Object.entries(over)) if (path.includes(k)) return fn!();
    if (path === '/coordinator/streams' || path === '/customer/streams') return ok(feed);
    const m = path.match(/\/chats\?page=0&size=500$/);
    if (m) {
      const id = path.includes('/streams/') ? path.split('/streams/')[1].split('/')[0] : path.split('/events/')[1].split('/')[0];
      return { data: chats[id] ?? [], page: 0, size: 500, total: (chats[id] ?? []).length };
    }
    if (path.startsWith('/public/events/')) return ok({ eventPhoto: 'https://backend.connekyt.com/uploads/event/photos/x.jpg', photographerName: 'Eric Mugisha', description: 'd' });
    throw new Error(`unrouted ${path}`);
  });
}

const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<StreamsScreen />);
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
  }
  return r;
};
const press = async (r: TestRenderer.ReactTestRenderer, text: string, nth = 0) => {
  const match = (n: ReactTestInstance) =>
    typeof n.props?.onPress === 'function' &&
    (n.props.label === text || n.props.accessibilityLabel === text);
  const all = r.root.findAll(match);
  // A button is several nested nodes that share onPress; keep the outermost of each.
  const nodes = all.filter((n) => !(n.parent && all.includes(n.parent)));
  if (!nodes[nth]) throw new Error(`nothing to press: ${text}`);
  await act(async () => {
    nodes[nth].props.onPress();
  });
};

beforeEach(() => {
  mockGet.mockReset();
  mockDelete.mockReset();
  mockPatch.mockReset();
  mockPush.mockReset();
  mockAlert.mockReset();
  mockRole = 'Coordinator';
});

describe('headline totals', () => {
  it('shows streams, viewers, then messages and videos once every history is read', async () => {
    route();
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Total streams');
    expect(text).toMatch(/Total streams \| 2/);
    expect(text).toMatch(/Total viewers \| 56/);
    expect(text).toMatch(/Chat messages \| 2/);
    expect(text).toMatch(/Video messages \| 2/);
  });

  it('shows no total for messages or videos while a history cannot be read, never a partial sum', async () => {
    route({ '/coordinator/streams/e2/chats': () => Promise.reject({ message: 'down' }) });
    mockGet.mockImplementationOnce(async () => ok(feed));
    const r = await mount();
    const text = flat(r.root);
    expect(text).toMatch(/Chat messages \| …/);
    expect(text).toMatch(/Video messages \| …/);
  });
});

describe('endpoints, per role (as the web calls them)', () => {
  it('the coordinator reads /coordinator/streams/{eventId}/chats and the client /customer/events/{eventId}/chats', async () => {
    route();
    await listStreamHistory('e1', true);
    await listStreamHistory('e1', false);
    expect(mockGet).toHaveBeenCalledWith('/coordinator/streams/e1/chats?page=0&size=500');
    expect(mockGet).toHaveBeenCalledWith('/customer/events/e1/chats?page=0&size=500');
  });

  it('splits text from video messages on videoUrl and drops a repeated id', async () => {
    mockGet.mockResolvedValue({ data: [...(chats.e1 as object[]), { id: 'c1', viewerUsername: 'Dup', message: 'again' }] });
    const h = await listStreamHistory('e1', true);
    expect(h.messages.map((m) => m.id)).toEqual(['c1', 'c2']);
    expect(h.videos.map((v) => v.id)).toEqual(['v1', 'v2']);
  });

  it('fills the cover and photographer a coordinator feed lacks from the public event', async () => {
    route();
    await mount();
    expect(mockGet).toHaveBeenCalledWith('/public/events/e1', { skipAuth: true });
  });
});

describe('search and event type filter', () => {
  it('narrows by title or type, and explains an empty result', async () => {
    route();
    const r = await mount();
    const input = r.root.find((n) => n.props?.accessibilityLabel === 'Search streams' && typeof n.props.onChangeText === 'function');
    await act(async () => {
      input.props.onChangeText('birth');
    });
    let text = flat(r.root);
    expect(text).toContain('Amina Birthday');
    expect(text).not.toContain('Friday Night Concert');
    await act(async () => {
      input.props.onChangeText('zzz');
    });
    text = flat(r.root);
    expect(text).toContain('No completed streams found');
    await press(r, 'Clear filters');
    expect(flat(r.root)).toContain('Friday Night Concert');
  });

  it('offers the types the list contains, and filters by one', async () => {
    route();
    const r = await mount();
    expect(flat(r.root)).toContain('Concert');
    await press(r, 'Concert');
    const text = flat(r.root);
    expect(text).toContain('Friday Night Concert');
    expect(text).not.toContain('Amina Birthday');
  });
});

describe('chat and video sheets', () => {
  it('View chats lists each message with who sent it and when', async () => {
    route();
    const r = await mount();
    await press(r, 'View chats', 0);
    const text = flat(r.root);
    expect(text).toContain('SHEET Chat messages: Friday Night Concert');
    expect(text).toContain('Total messages:');
    expect(text).toMatch(/Total messages:[^|]*\| 2/);
    expect(text).toContain('@Aline');
    expect(text).toContain('Beautiful stage');
    expect(text).toContain('8:02 PM');
  });

  it('says so, truthfully, for a stream with no messages', async () => {
    route();
    const r = await mount();
    await press(r, 'View chats', 1);
    expect(flat(r.root)).toContain('No messages were sent during this stream.');
  });

  it('a failed history read is an error with a retry, not "no messages"', async () => {
    route({ '/coordinator/streams/e1/chats': () => Promise.reject({ message: 'down' }) });
    const r = await mount();
    await press(r, 'View chats', 0);
    const text = flat(r.root);
    expect(text).toContain('Could not load the messages for this stream.');
    expect(text).not.toContain('No messages were sent');
  });

  it('Videos marks each unopened video NEW and counts them on the card, then clears the badge when one is opened', async () => {
    route();
    const r = await mount();
    expect(flat(r.root)).toContain('2 new');
    await press(r, 'Videos', 0);
    let text = flat(r.root);
    expect(text).toMatch(/Total videos:[^|]*\| 2/);
    expect(text).not.toContain('Max duration');
    expect(text).toContain('NEW');
    const tile = r.root.find((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Video from Grace'));
    await act(async () => {
      tile.props.onPress();
    });
    text = flat(r.root);
    expect(text).toContain('1 new');
  });
});

describe('delete', () => {
  const confirm = async (r: TestRenderer.ReactTestRenderer) => {
    await press(r, 'Delete', 0);
    const [, , buttons] = mockAlert.mock.calls[0] as [string, string, { text: string; onPress?: () => Promise<void> }[]];
    await act(async () => {
      await buttons.find((b) => b.text === 'Delete stream')!.onPress!();
    });
  };

  it('asks first, with the web wording, and deletes the record by its id', async () => {
    route();
    mockDelete.mockResolvedValue({ action: 1, message: 'Stream deleted successfully' });
    const r = await mount();
    await press(r, 'Delete', 0);
    const [title, message] = mockAlert.mock.calls[0] as [string, string];
    expect(title).toBe('Delete stream record?');
    expect(message).toContain('This action cannot be undone.');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('removes the card after a successful delete', async () => {
    route();
    mockDelete.mockResolvedValue({ action: 1 });
    const r = await mount();
    await confirm(r);
    expect(mockDelete).toHaveBeenCalledWith('/coordinator/streams/s1');
    expect(flat(r.root)).not.toContain('Friday Night Concert');
    expect(flat(r.root)).toContain('Amina Birthday');
  });

  it('keeps the card and says why when the backend refuses (a viewer who only paid cannot delete)', async () => {
    mockRole = 'Client';
    route();
    mockDelete.mockResolvedValue({ action: 0, message: 'You are not authorized to delete this stream' });
    const r = await mount();
    await confirm(r);
    expect(flat(r.root)).toContain('Friday Night Concert');
    expect(mockAlert).toHaveBeenLastCalledWith('Could not delete this stream', 'You are not authorized to delete this stream');
  });

  it('tries the event id when the record id fails, as the web does', async () => {
    mockDelete.mockRejectedValueOnce({ message: 'Stream not found' }).mockResolvedValueOnce({ action: 1 });
    await deleteStreamRecord({ id: 'e9', streamId: 'r1' }, false);
    expect(mockDelete).toHaveBeenNthCalledWith(1, '/customer/streams/r1');
    expect(mockDelete).toHaveBeenNthCalledWith(2, '/customer/streams/e9');
  });
});

describe('same as the web, where the web is the reference', () => {
  it('lists newest stream date first whatever the phase (streams.tsx sorts on streamDate descending)', async () => {
    route();
    const r = await mount();
    const text = flat(r.root);
    expect(text.indexOf('Friday Night Concert')).toBeLessThan(text.indexOf('Amina Birthday'));
  });

  it('uses the web wording for an empty library and for a search that finds nothing', async () => {
    route({ '/coordinator/streams': () => ok([]) });
    const r = await mount();
    expect(flat(r.root)).toContain('No completed streams found');
    expect(flat(r.root)).toContain('Your completed event streams will appear here with viewer messages and videos.');
  });

  it('opening a new video makes the call the web makes, with the stream record id, and the screen does not depend on it', async () => {
    route();
    mockPatch.mockRejectedValue({ message: 'Video not found' });
    const r = await mount();
    await press(r, 'Videos', 0);
    const tile = r.root.find((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Video from Grace'));
    await act(async () => {
      tile.props.onPress();
    });
    expect(mockPatch).toHaveBeenCalledWith('/coordinator/streams/s1/videos/v1/viewed');
    expect(flat(r.root)).toContain('1 new');
  });

  it('uses the customer route for a client', async () => {
    mockPatch.mockResolvedValue({ action: 1 });
    await markVideoViewed('r1', 'v9', false);
    expect(mockPatch).toHaveBeenCalledWith('/customer/streams/r1/videos/v9/viewed');
  });
});
