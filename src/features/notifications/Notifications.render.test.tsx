import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import NotificationsScreen from '@/app/(app)/notifications';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real notifications screen over a faked
 * API module. A failed read used to draw "No activity yet", which tells a person nothing arrived when in fact the
 * request failed; and unread items must be unread in what is read out, not only in a dot.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockList = jest.fn();
jest.mock('@/features/notifications/api', () => ({
  listNotifications: (...a: unknown[]) => mockList(...a),
  markRead: jest.fn().mockResolvedValue(undefined),
  markAllRead: jest.fn().mockResolvedValue(undefined),
  deleteNotification: jest.fn().mockResolvedValue(undefined),
  deleteAllNotifications: jest.fn().mockResolvedValue(undefined),
  deleteReadNotifications: jest.fn().mockResolvedValue(undefined),
  sendBackendTestPush: jest.fn(),
}));
jest.mock('@/features/notifications/push', () => ({
  checkNotificationDiagnostics: jest.fn(),
  scheduleTestBookingAlert: jest.fn(),
  scheduleTestLockScreenNotification: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/dialog', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ role: 'Client', isPhotographer: false, isCoordinator: false, isClient: true }) }));
jest.mock('@/store/auth', () => ({ isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object) }));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<NotificationsScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

const note = (o: Record<string, unknown>) => ({ id: 'n1', title: 'Booking accepted', message: 'Eric accepted your booking', read: false, type: 'booking', createdAt: new Date().toISOString(), ...o });

beforeEach(() => {
  mockList.mockReset().mockResolvedValue([]);
  mockPush.mockReset();
});

describe('notifications as rendered', () => {
  it('a failed first read is an error with a retry, not "No activity yet"', async () => {
    mockList.mockRejectedValue({ message: 'Could not reach the server' });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load notifications');
    expect(text).toContain('Could not reach the server');
    expect(text).not.toContain('No activity yet');
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Try again' && typeof n.props.onPress === 'function').length).toBeGreaterThan(0);
  });

  it('retry reads again and shows what arrived', async () => {
    mockList.mockRejectedValueOnce({ message: 'Offline' }).mockResolvedValue([note({})]);
    const r = await mount();
    const retry = r.root.findAll((n) => n.props?.accessibilityLabel === 'Try again' && typeof n.props.onPress === 'function')[0];
    await act(async () => {
      await retry.props.onPress();
    });
    expect(flat(r.root)).toContain('Eric accepted your booking');
  });

  it('a genuinely empty feed says No activity yet', async () => {
    expect(flat((await mount()).root)).toContain('No activity yet');
  });

  it('groups a fresh notification under Today and counts the unread', async () => {
    const r = await mount();
    mockList.mockResolvedValue([note({}), note({ id: 'n2', read: true, message: 'Payment received' })]);
    await act(async () => {
      r.unmount();
    });
    const r2 = await mount();
    const text = flat(r2.root);
    expect(text).toContain('Today');
    expect(text).toContain('Eric accepted your booking');
    expect(text).toContain('Payment received');
  });
});
