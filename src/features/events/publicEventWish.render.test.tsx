import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import PublicEventScreen from '@/app/(public)/event/[id]';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The guest event screen as a scanner meets it. Three things are pinned: a scan from a QR code opens the short version first
 * (what, when, where, one action) with the rest one tap away; an upcoming event takes a text or a 1-minute video wish; and a
 * signed-in user is sent as their account, never asked for a name and an email again.
 */
const mockSendWish = jest.fn();
const mockSendVideoWish = jest.fn();
const mockPick = jest.fn();
let mockParams: Record<string, string> = { id: 'e1' };
let mockUser: Record<string, string> | null = null;
let mockEventExtra: Record<string, unknown> = {};

jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children?: React.ReactNode }) => children ?? null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/live', () => {
  const { Text: T, Pressable } = require('react-native');
  return { LiveButton: ({ label }: { label: string }) => <Pressable><T>{label}</T></Pressable>, LivePill: ({ label }: { label: string }) => <T>{label}</T> };
});
jest.mock('@/features/notifications/push', () => ({ registerForPushNotifications: jest.fn() }));
jest.mock('@/features/events/reminder', () => ({
  clearReminder: jest.fn(),
  getReminder: jest.fn(async () => null),
  isValidReminderEmail: () => true,
  setReminder: jest.fn(),
}));
jest.mock('@/utils/deviceId', () => ({ getDeviceId: jest.fn(async () => 'device-1') }));
jest.mock('@/services/storage', () => ({ storage: { get: jest.fn(async () => null), set: jest.fn(async () => {}), remove: jest.fn(async () => {}) } }));
jest.mock('@/features/streams/pickShortVideo', () => ({ pickShortVideo: (...a: unknown[]) => mockPick(...a) }));
jest.mock('@/features/streams/api', () => ({
  checkAnonymousAccessStatus: jest.fn(),
  redeemGroupCode: jest.fn(),
  registerAnonymousViewer: jest.fn(),
  retryAnonymousDeviceAccess: jest.fn(),
  sendEventWish: (...a: unknown[]) => mockSendWish(...a),
  sendEventVideoWish: (...a: unknown[]) => mockSendVideoWish(...a),
}));
jest.mock('@/features/events/api', () => ({
  getPublicEventDetailed: jest.fn(async () => ({
    id: 'e1',
    title: 'Yubire Wedding',
    description: 'A long and lovely description of the day, with every detail a guest might want.',
    eventDate: '2999-01-02',
    startTime: '12:00',
    location: 'Kigali Convention Centre',
    eventStatus: 'PUBLISHED',
    eventTags: 'wedding,kigali',
    eventOrganizer: 'The Mugisha family',
    photographerName: 'Eric Mugisha',
    isPaid: false,
    ...mockEventExtra,
  })),
}));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: mockUser, status: mockUser ? 'authenticated' : 'unauthenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');
const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PublicEventScreen />);
  });
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
  }
  return r;
};
const press = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  const all = r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.accessibilityLabel === label || n.props.title === label || n.findAllByType(Text).some((t) => [t.props.children].flat().join('') === label)));
  const node = all.filter((n) => !(n.parent && all.includes(n.parent)))[0];
  if (!node) throw new Error(`nothing to press: ${label}`);
  await act(async () => {
    await node.props.onPress();
  });
};
const type = async (r: TestRenderer.ReactTestRenderer, placeholder: RegExp, value: string) => {
  const input = r.root.findAll((n) => typeof n.props?.onChangeText === 'function' && placeholder.test(String(n.props.placeholder ?? '')))[0];
  await act(async () => {
    input.props.onChangeText(value);
  });
};

beforeEach(() => {
  mockSendWish.mockReset().mockResolvedValue(undefined);
  mockSendVideoWish.mockReset().mockResolvedValue(undefined);
  mockPick.mockReset();
  mockParams = { id: 'e1' };
  mockUser = null;
  mockEventExtra = {};
});

describe('opened from a scanned QR code', () => {
  it('shows the short version first: title, when, where, and the wish, with the rest one tap away', async () => {
    mockParams = { id: 'e1', src: 'qr' };
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Yubire Wedding');
    expect(text).toContain('Kigali Convention Centre');
    expect(text).toContain('Show full details');
    expect(text).not.toContain('A long and lovely description');
    expect(text).not.toContain('Eric Mugisha');
    expect(text).not.toContain('# wedding');
  });

  it('opens the full page on one tap, and closes it again', async () => {
    mockParams = { id: 'e1', src: 'qr' };
    const r = await mount();
    await press(r, 'Show full details');
    expect(flat(r.root)).toContain('A long and lovely description');
    expect(flat(r.root)).toContain('Show less');
    await press(r, 'Show less');
    expect(flat(r.root)).not.toContain('A long and lovely description');
  });

  it('a visit that did not come from a scan shows the whole page, as before', async () => {
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('A long and lovely description');
    expect(text).not.toContain('Show full details');
  });
});

describe('wishes on an upcoming event', () => {
  it('a guest gives a name once, and the text wish goes out with it and no email', async () => {
    const r = await mount();
    await type(r, /name/i, 'Aline');
    await type(r, /message|wish/i, 'Congratulations!');
    await press(r, 'Send wish');
    expect(mockSendWish).toHaveBeenCalledWith('e1', { name: 'Aline', message: 'Congratulations!' });
  });

  it('refuses a wish with no name, and never asks for an email', async () => {
    const r = await mount();
    expect(r.root.findAll((n) => /email/i.test(String(n.props?.accessibilityLabel ?? n.props?.placeholder ?? ''))).length).toBe(0);
    await type(r, /message|wish/i, 'Hi');
    await press(r, 'Send wish');
    expect(flat(r.root)).toContain('Please enter your name.');
    expect(mockSendWish).not.toHaveBeenCalled();
  });

  it('offers a 1 minute video wish, records it, and sends it with the caption and the identity', async () => {
    const video = { uri: 'file:///wish.mp4', name: 'wish.mp4', mimeType: 'video/mp4' };
    mockPick.mockResolvedValue(video);
    const r = await mount();
    expect(flat(r.root)).toContain('Video · 1 min');
    await type(r, /name/i, 'Aline');
    await type(r, /message|wish/i, 'Best wishes');
    await press(r, 'Record a 1 minute video wish');
    expect(mockSendVideoWish).toHaveBeenCalledWith('e1', { name: 'Aline', message: 'Best wishes', video });
    expect(flat(r.root)).toContain('Your video wish was sent to the event organizer!');
  });

  it('sends nothing when the person backs out of the camera', async () => {
    mockPick.mockResolvedValue(null);
    const r = await mount();
    await type(r, /name/i, 'Aline');
    await press(r, 'Record a 1 minute video wish');
    expect(mockSendVideoWish).not.toHaveBeenCalled();
  });

  it('shows the backend refusal, as an error and not a success', async () => {
    mockPick.mockResolvedValue({ uri: 'file:///w.mp4', name: 'w.mp4', mimeType: 'video/mp4' });
    mockSendVideoWish.mockRejectedValue({ status: 400, message: 'The event is now live. Please join the stream to send messages.' });
    const r = await mount();
    await type(r, /name/i, 'Aline');
    await press(r, 'Record a 1 minute video wish');
    expect(flat(r.root)).toContain('The event is now live.');
    expect(flat(r.root)).not.toContain('Your video wish was sent');
  });
});

describe('a signed-in user', () => {
  it('is sent as their account: no name field, and the wish carries the account name only', async () => {
    mockUser = { firstName: 'Joseph', lastName: 'Maranatha', email: 'joseph@example.test', customerId: 'c1' };
    const r = await mount();
    expect(flat(r.root)).toContain('Sending as Joseph Maranatha');
    expect(r.root.findAll((n) => /your name|name/i.test(String(n.props?.placeholder ?? '')) && typeof n.props.onChangeText === 'function')).toHaveLength(0);
    await type(r, /message|wish/i, 'Congratulations!');
    await press(r, 'Send wish');
    expect(mockSendWish).toHaveBeenCalledWith('e1', { name: 'Joseph Maranatha', message: 'Congratulations!' });
  });

  it('can send a video wish without typing anything about themselves', async () => {
    mockUser = { firstName: 'Joseph', lastName: 'Maranatha', email: 'joseph@example.test', customerId: 'c1' };
    const video = { uri: 'file:///wish.mp4', name: 'wish.mp4', mimeType: 'video/mp4' };
    mockPick.mockResolvedValue(video);
    const r = await mount();
    await press(r, 'Record a 1 minute video wish');
    expect(mockSendVideoWish).toHaveBeenCalledWith('e1', { name: 'Joseph Maranatha', message: '', video });
  });
});


describe('Wish invites on the event page', () => {
  it('shows the switch, the Invite loved ones tab and the heartfelt line when enabled, and also for an older server with no value', async () => {
    mockEventExtra = { allowWishInvites: true };
    const on = flat((await mount()).root);
    expect(on).toContain('Invite loved ones');
    expect(on).toContain("Some of the people you love can't be here.");
    mockEventExtra = {};
    expect(flat((await mount()).root)).toContain('Invite loved ones');
  });

  it('hides all of it when disabled: only the send form, no switch, no heartfelt line, no gap', async () => {
    mockEventExtra = { allowWishInvites: false };
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Wishes & memories');
    expect(text).toContain('Video · 1 min');
    expect(text).not.toContain('Invite loved ones');
    expect(text).not.toContain('Send my wish');
    expect(text).not.toContain("Some of the people you love can't be here.");
    expect(text).not.toContain('Save QR');
  });

  it("a viewer's own wish still sends when invites are disabled, with no invite marker", async () => {
    mockEventExtra = { allowWishInvites: false };
    const r = await mount();
    await type(r, /name/i, 'Aline');
    await type(r, /message|wish/i, 'Best wishes');
    await press(r, 'Send wish');
    expect(mockSendWish).toHaveBeenCalledTimes(1);
    expect(mockSendWish.mock.calls[0][1]).not.toHaveProperty('via');
  });
});

describe('the event page cards', () => {
  it('runs in the new order: date and time, wishes and memories, the heartfelt line, hosted by, stream entry, donation', async () => {
    const text = flat((await mount()).root);
    const at = (s: string) => text.indexOf(s);
    const order = ['Starts in', 'Wed, 2 Jan 2999', 'Wishes & memories', "Some of the people you love can't be here", 'Hosted by', 'Event ticket (includes live stream)', 'Support this event with a donation', 'Get notified'];
    order.forEach((s) => expect(at(s)).toBeGreaterThan(-1));
    expect(order.map(at)).toEqual([...order.map(at)].sort((a, b) => a - b));
  });

  it('shows the date and the time with its timezone in one card, with Add to calendar', async () => {
    const text = flat((await mount()).root);
    expect(text).toContain('Wed, 2 Jan 2999 | 12:00 PM · Kigali time (CAT)');
    expect(text).toContain('Add to calendar');
    expect(text).not.toContain('Hosts & crew');
  });

  it('switches the wishes card to Invite loved ones, with the QR, Share link and Save QR', async () => {
    const r = await mount();
    expect(flat(r.root)).not.toContain('Save QR');
    await press(r, 'Invite loved ones');
    const text = flat(r.root);
    expect(text).toContain('Share link');
    expect(text).toContain('Save QR');
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'QR code for wish link').length).toBeGreaterThan(0);
    await press(r, 'Send my wish');
    expect(flat(r.root)).toContain('Video · 1 min');
  });
});
