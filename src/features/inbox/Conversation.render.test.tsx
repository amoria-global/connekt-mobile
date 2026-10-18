import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import ConversationScreen from '@/app/(app)/conversation/[id]';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real conversation over a faked inbox API.
 * Sending must go once, a failed send must put the words back and say so, and a failed read is an error with a retry.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockList = jest.fn();
const mockSend = jest.fn();
jest.mock('@/features/inbox/api', () => ({
  listMessages: (...a: unknown[]) => mockList(...a),
  sendMessage: (...a: unknown[]) => mockSend(...a),
  markConversationRead: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/moderation/api', () => ({ reportContent: jest.fn() }));
jest.mock('@/features/moderation/ReportSheet', () => ({ ReportSheet: () => null }));
// Stable function identities: a new `load` on every render would re-run the screen's effect forever.
const mockModeration = { block: jest.fn(), load: jest.fn() };
jest.mock('@/features/moderation/useModeration', () => ({
  useModeration: (sel: (s: unknown) => unknown) => sel(mockModeration),
}));
jest.mock('@/store/auth', () => ({
  useAuth: (sel: (s: unknown) => unknown) => sel({ user: { customerId: 'me' } }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));
const mockAlert = jest.fn();
jest.mock('@/components/ui/dialog', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'ph1', name: 'Eric Mugisha' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<ConversationScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}
const sendBtn = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && /^Send(ing)? message$/.test(n.props.accessibilityLabel) && typeof n.props.onPress === 'function')[0];

beforeEach(() => {
  jest.useRealTimers();
  mockList.mockReset().mockResolvedValue([]);
  mockSend.mockReset().mockResolvedValue(undefined);
  mockAlert.mockReset();
});

describe('conversation as rendered', () => {
  it('shows the messages with who said them in the spoken label', async () => {
    mockList.mockResolvedValue([
      { id: 'm1', text: 'Are you free on the 26th?', senderId: 'me', isMine: true, timestamp: '2026-10-18T09:00:00' },
      { id: 'm2', text: 'Yes, from 10.', senderId: 'ph1', isMine: false, timestamp: '2026-10-18T09:05:00' },
    ]);
    const r = await mount();
    const labels = r.root.findAll((n) => n.props?.accessible === true && typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel as string);
    expect(labels.some((l) => l.startsWith('You: Are you free on the 26th?'))).toBe(true);
    expect(labels.some((l) => l.startsWith('They: Yes, from 10.'))).toBe(true);
  });

  it('an empty conversation says no messages yet', async () => {
    expect(flat((await mount()).root)).toContain('No messages yet');
  });

  it('send is disabled with nothing typed, and sends the trimmed text once', async () => {
    const r = await mount();
    expect(sendBtn(r).props.accessibilityState.disabled).toBe(true);
    await act(async () => r.root.findByType(TextInput).props.onChangeText('  Hello  '));
    await act(async () => {
      await sendBtn(r).props.onPress();
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('ph1', 'Hello');
  });

  it('a second tap while sending does not send again', async () => {
    let release!: () => void;
    mockSend.mockReturnValue(new Promise<void>((res) => (release = res)));
    const r = await mount();
    await act(async () => r.root.findByType(TextInput).props.onChangeText('Hello'));
    await act(async () => {
      sendBtn(r).props.onPress();
    });
    await act(async () => {
      sendBtn(r).props.onPress();
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it('a failed send puts the words back and tells the person, with no phantom bubble', async () => {
    mockSend.mockRejectedValue({ message: 'Network down' });
    const r = await mount();
    await act(async () => r.root.findByType(TextInput).props.onChangeText('Hello there'));
    await act(async () => {
      await sendBtn(r).props.onPress();
    });
    expect(mockAlert).toHaveBeenCalledWith('Message not sent', 'Network down');
    expect(r.root.findByType(TextInput).props.value).toBe('Hello there');
    expect(flat(r.root)).not.toContain('Hello there'); // the optimistic bubble was removed
  });

  it('a failed first read is an error with a retry, not an empty chat', async () => {
    mockList.mockRejectedValue({ message: 'Could not load messages' });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load messages');
    expect(text).not.toContain('Say hello');
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Try again' && typeof n.props.onPress === 'function').length).toBeGreaterThan(0);
  });
});
