import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import ClientsScreen from '@/app/(app)/clients';
import ClientDetailScreen from '@/app/(app)/client/[id]';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * RENDERED screens (react-test-renderer, not a device): the coordinator's Clients list and Client detail
 * over a faked transport. A refused read is an error with a retry, never "no clients" or a blank client.
 */
const mockGet = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'k1' }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/moderation/ReportSheet', () => ({ ReportSheet: () => null }));
jest.mock('@/features/moderation/useModeration', () => {
  const state = { blockedIds: new Set<string>(), block: jest.fn(), unblock: jest.fn(), load: jest.fn() };
  return { useModeration: (sel: (s: typeof state) => unknown) => sel(state) };
});
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Marie', customerId: 'k9', customerType: 'Coordinator' }, status: 'authenticated' });
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

const mount = async (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
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
});

describe('coordinator clients as rendered', () => {
  it('lists clients from the coordinator endpoint with bookings and spend', async () => {
    mockGet.mockImplementation(async () => ok([{ id: 'k1', firstName: 'Aline', lastName: 'U', email: 'a@x.test', bookings: 3, totalSpent: 450, currency: 'USD' }]));
    const r = await mount(<ClientsScreen />);
    expect(mockGet.mock.calls[0][0]).toBe('/coordinator/clients');
    const text = flat(r.root);
    expect(text).toContain('Aline U');
    expect(text).toContain('$450.00');
    expect(text).toContain('1 client');
    await tap(r, 'Aline U');
    expect(mockPush).toHaveBeenCalledWith('/client/k1');
  });

  it('a refused read is an error with a retry, not "no clients"', async () => {
    mockGet.mockImplementation(async () => refused('Could not load clients'));
    const r = await mount(<ClientsScreen />);
    const text = flat(r.root);
    expect(text).toContain('Could not load clients');
    expect(text).toContain('Try again');
    expect(text).not.toMatch(/No clients/i);
  });

  it('derives clients from events when the clients endpoint is refused but events read fine', async () => {
    mockGet.mockImplementation(async (path: string) =>
      path.startsWith('/coordinator/events') ? ok({ content: [{ id: 'e1', clientName: 'Aline U', clientId: 'k1' }] }) : refused('nope'),
    );
    const r = await mount(<ClientsScreen />);
    expect(flat(r.root)).toContain('Aline U');
  });

  it('a genuinely empty list says so', async () => {
    mockGet.mockImplementation(async () => ok([]));
    const r = await mount(<ClientsScreen />);
    expect(flat(r.root)).not.toContain('Try again');
  });
});

describe('coordinator client detail as rendered', () => {
  it('shows the client, bookings and events, and opens an event', async () => {
    mockGet.mockImplementation(async (path: string) =>
      path.startsWith('/coordinator/clients/')
        ? ok({ id: 'k1', firstName: 'Aline', lastName: 'U', bookings: 1, totalSpent: 120, currency: 'USD', events: [{ id: 'e1', title: 'Gala', eventDate: '2026-11-01', status: 'PUBLISHED' }] })
        : ok([]),
    );
    const r = await mount(<ClientDetailScreen />);
    const text = flat(r.root);
    expect(text).toContain('Aline U');
    expect(text).toContain('$120.00');
    expect(text).toContain('Gala');
    await tap(r, 'Gala');
    expect(mockPush).toHaveBeenCalledWith('/event/e1');
  });

  it('a refused read is an error with a retry, not a blank "Client"', async () => {
    mockGet.mockImplementation(async () => refused('Could not load this client'));
    const r = await mount(<ClientDetailScreen />);
    const text = flat(r.root);
    expect(text).toContain('Could not load this client');
    expect(text).toContain('Try again');
  });
});
