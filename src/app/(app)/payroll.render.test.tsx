import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import PayrollScreen from '@/app/(app)/payroll';

/**
 * RENDERED screen (react-test-renderer under jest-expo, NOT a device): the real payroll screen with the real
 * getPayrollReport, payrollView and formatPrice. Only the transport is faked; getOk keeps the production requireOk.
 * Pins that an unknown figure is never drawn as a confirmed zero.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetOk = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), {
    getState: () => ({ user: { customerType: 'PHOTOGRAPHER' } }),
  }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PayrollScreen />);
  });
  return r;
}

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });

beforeEach(() => mockGetOk.mockReset());

describe('payroll screen states', () => {
  it('draws real zeros and says "No earnings yet" when the backend confirms an empty report', async () => {
    mockGetOk.mockResolvedValueOnce(ok({ total: 0, paid: 0, pending: 0, currency: 'USD', transactions: [] }));
    const t = flat((await mount()).root);
    expect(t).toContain('No earnings yet');
    expect(t).toContain('$0.00');
    expect(t).not.toContain('Unavailable');
  });

  it('never draws $0.00 when the report came back without figures', async () => {
    mockGetOk.mockResolvedValueOnce(ok([]));
    const t = flat((await mount()).root);
    expect(t).not.toContain('$0.00');
    expect(t).not.toContain('No earnings yet');
    expect(t).toContain('Unavailable');
    expect(t).toContain('came back without figures');
    expect(t).toContain('Try again');
  });

  it('marks only the missing figure as unavailable and keeps the real ones', async () => {
    mockGetOk.mockResolvedValueOnce(ok({ total: 120, paid: 120, transactions: [{ id: 't1', description: 'Wedding', amount: 120, status: 'PAID' }] }));
    const t = flat((await mount()).root);
    expect(t).toContain('$120.00');
    expect(t).toContain('Unavailable');
    expect(t).toContain('Wedding');
  });

  it('shows an error with a retry for a failed request, not an empty report', async () => {
    mockGetOk.mockRejectedValueOnce({ status: 500, message: 'Server error' });
    const t = flat((await mount()).root);
    expect(t).toContain('Server error');
    expect(t).toContain('Try again');
    expect(t).not.toContain('No earnings yet');
    expect(t).not.toContain('$0.00');
  });

  it('treats HTTP 200 with action 0 as a failure', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 0, message: 'Not allowed', data: null });
    const t = flat((await mount()).root);
    expect(t).toContain('Not allowed');
    expect(t).not.toContain('$0.00');
  });
});
