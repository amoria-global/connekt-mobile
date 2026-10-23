import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { CoordinatorCalendar } from './CoordinatorCalendar';
import { dayKey } from '@/features/photographer/schedule';

/**
 * The coordinator Calendar rendered over faked event and payment feeds: real entries on real days, the filter, the
 * navigation, and a failed read shown as an error with a retry rather than an empty calendar.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isCoordinator: true }) }));
const mockEvents = jest.fn();
const mockPayments = jest.fn();
jest.mock('@/features/events/api', () => ({ listCoordinatorEvents: () => mockEvents() }));
jest.mock('@/features/analytics/api', () => ({ getCoordinatorPendingPayments: () => mockPayments() }));

const today = dayKey(new Date());
const flat = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<CoordinatorCalendar />);
  });
  await act(async () => {});
  return r;
};
const pressWhere = async (r: TestRenderer.ReactTestRenderer, match: (label: string) => boolean) => {
  const n = r.root.find((x) => typeof x.props?.accessibilityLabel === 'string' && match(x.props.accessibilityLabel) && typeof x.props.onPress === 'function');
  await act(async () => {
    n.props.onPress();
  });
};

beforeEach(() => {
  mockPush.mockReset();
  mockEvents.mockReset().mockResolvedValue([
    { id: 'e1', title: 'Product launch', eventDate: today, startTime: '09:00', endTime: '10:00', location: 'Kigali', clientName: 'Kigali Brands' },
    { id: 'e2', title: 'Stream test', eventDate: today, startTime: '11:00', hasLiveStream: true },
  ]);
  mockPayments.mockReset().mockResolvedValue([
    { id: 'p1', eventName: 'Product launch', photographerName: 'Joseph', amount: 150, paidAmount: 0, status: 'pending', paymentType: 'BOOKING', dueDate: today },
  ]);
});

describe('coordinator calendar', () => {
  it('shows the real events of the day and the payment due, with their actions', async () => {
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Calendar');
    expect(text).toContain('Product launch');
    expect(text).toContain('9:00 AM - 10:00 AM · Kigali');
    expect(text).toContain('Stream test');
    expect(text).toContain('Check stream');
    expect(text).toContain('Photographer payment due');
    expect(text).toContain('$150.00 owed');
  });

  it('opens the event and the payments screen from their cards', async () => {
    const r = await mount();
    await pressWhere(r, (l) => l.startsWith('Event: Product launch'));
    expect(mockPush).toHaveBeenCalledWith('/event/e1');
    await pressWhere(r, (l) => l.startsWith('Payment: Photographer payment due'));
    expect(mockPush).toHaveBeenCalledWith('/payments');
  });

  it('filters to live events only', async () => {
    const r = await mount();
    await pressWhere(r, (l) => l === 'Live');
    const text = flat(r.root);
    expect(text).toContain('Stream test');
    expect(text).not.toContain('Product launch');
    expect(text).not.toContain('Photographer payment due');
  });

  it('says a day is empty rather than inventing entries', async () => {
    mockEvents.mockResolvedValue([]);
    mockPayments.mockResolvedValue([]);
    const r = await mount();
    expect(flat(r.root)).toContain('Nothing on this day');
  });

  it('shows an error with a retry, not an empty calendar, when events fail to load', async () => {
    mockEvents.mockRejectedValue({ message: 'Server is down' });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Server is down');
    expect(text).not.toContain('Nothing on this day');
  });

  it('keeps events visible and says so when only the payments fail', async () => {
    mockPayments.mockRejectedValue({ message: 'nope' });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Product launch');
    expect(text).toContain('Payments due could not be loaded');
  });

  it('lists upcoming work in the agenda view', async () => {
    const r = await mount();
    const agenda = r.root.find((x) => x.props?.accessibilityRole === 'tab' && flat(x) === 'Agenda');
    await act(async () => {
      agenda.props.onPress();
    });
    const text = flat(r.root);
    expect(text).toContain('Upcoming');
    expect(text).toContain('Product launch');
  });
});
