import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import WishPageScreen from '@/app/(public)/wish/[id]';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The page a shared wish link opens: cover, title and date, the invited line only when a name was given, and a closed message. */
let mockParams: Record<string, string> = { id: 'e1' };
let mockEvent: Record<string, unknown> | Error = {};

jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/services/storage', () => ({ storage: { get: jest.fn(async () => null), set: jest.fn(async () => {}), remove: jest.fn(async () => {}) } }));
jest.mock('@/features/streams/pickShortVideo', () => ({ pickShortVideo: jest.fn() }));
const mockSend = jest.fn();
jest.mock('@/features/streams/api', () => ({ sendEventWish: (...a: unknown[]) => mockSend(...a), sendEventVideoWish: jest.fn() }));
jest.mock('@/features/events/api', () => ({
  getPublicEventDetailed: jest.fn(async () => {
    if (mockEvent instanceof Error) throw mockEvent;
    return mockEvent;
  }),
}));

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');
const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<WishPageScreen />);
  });
  await act(async () => {});
  return r;
};
const upcoming = { id: 'e1', title: 'Bible Revival Conference', eventDate: '2999-11-27', startTime: '16:11', eventStatus: 'PUBLISHED', eventPhoto: 'https://x/c.jpg' };

beforeEach(() => {
  mockParams = { id: 'e1' };
  mockEvent = { ...upcoming };
});

describe('the wish page and Wish invites', () => {
  it('shows the host-turned-off notice, with the cover, title and a View event link, and no form', async () => {
    mockEvent = { ...upcoming, allowWishInvites: false };
    const text = flat((await mount()).root);
    expect(text).toContain('Bible Revival Conference');
    expect(text).toContain('The host has turned off wish invites for this event');
    expect(text).toContain('View event →');
    expect(text).not.toContain('Send wish');
    expect(text).not.toContain('Invite someone else');
  });

  it('sends the wish with via=invite, the marker the server uses to refuse invite wishes when they are off', async () => {
    mockEvent = { ...upcoming, allowWishInvites: true };
    mockSend.mockResolvedValue(undefined);
    const r = await mount();
    const set = async (re: RegExp, v: string) => {
      const input = r.root.findAll((n) => typeof n.props?.onChangeText === 'function' && re.test(String(n.props.placeholder ?? '')))[0];
      await act(async () => input.props.onChangeText(v));
    };
    await set(/name/i, 'Grace');
    await set(/message/i, 'Congratulations');
    const send = r.root.findAll((n) => n.props?.title === 'Send wish' && typeof n.props?.onPress === 'function')[0];
    await act(async () => send.props.onPress());
    expect(mockSend).toHaveBeenCalledWith('e1', expect.objectContaining({ via: 'invite', message: 'Congratulations' }));
  });
});

describe('the wish page', () => {
  it('shows the title, the date and time and the wish form for an open event', async () => {
    const text = flat((await mount()).root);
    expect(text).toContain('Bible Revival Conference');
    expect(text).toContain('WED, 27 NOV 2999 · 4:11 PM');
    expect(text).toContain('Send wish');
    expect(text).toContain('View event →');
    expect(text).not.toContain('invited you');
  });

  it('says who invited you, from a sanitised name, and hides the line when the name is empty', async () => {
    mockParams = { id: 'e1', from: '<b>Grace</b>' };
    expect(flat((await mount()).root)).toContain('bGraceb invited you to send a wish for this event.');
    mockParams = { id: 'e1', from: '<>' };
    expect(flat((await mount()).root)).not.toContain('invited you');
  });

  it('closes for an ended event: the title stays, the form goes', async () => {
    mockEvent = { ...upcoming, eventDate: '2020-01-01', eventStatus: 'COMPLETED' };
    const text = flat((await mount()).root);
    expect(text).toContain('Bible Revival Conference');
    expect(text).toContain('Wishes for this event are closed');
    expect(text).not.toContain('Send wish');
    expect(text).toContain('View event →');
  });

  it('shows only the closed message when the event is not available (unpublished)', async () => {
    mockEvent = new Error('not available');
    const text = flat((await mount()).root);
    expect(text).toContain('Wishes for this event are closed');
    expect(text).not.toContain('Bible Revival');
  });
});
