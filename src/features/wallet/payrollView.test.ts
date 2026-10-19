import { getPayrollReport } from './api';
import { payrollView } from './payrollView';

const mockGetOk = jest.fn();
// Only the transport is faked: getOk keeps the production requireOk, so an HTTP 200 carrying action 0 is an error.
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
  },
}));

beforeEach(() => mockGetOk.mockReset());

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });

describe('payroll report: unknown is never a confirmed zero', () => {
  it('keeps numeric zeros the backend sent as real zeros', async () => {
    mockGetOk.mockResolvedValueOnce(ok({ total: 0, paid: 0, pending: 0, transactions: [] }));
    const r = await getPayrollReport();
    expect(r).toMatchObject({ total: 0, paid: 0, pending: 0, entries: [] });
    const v = payrollView(r);
    expect(v.unavailable).toBe(false);
    expect(v.confirmedEmpty).toBe(true);
    expect(v.stats.map((s) => s.value)).toEqual([0, 0, 0]);
  });

  it('reads an empty data payload as unavailable, not as zeros', async () => {
    mockGetOk.mockResolvedValueOnce(ok([]));
    const r = await getPayrollReport();
    expect(r.total).toBeNull();
    expect(r.entries).toBeNull();
    const v = payrollView(r);
    expect(v.unavailable).toBe(true);
    expect(v.confirmedEmpty).toBe(false);
  });

  it('treats a missing or non numeric figure as null while keeping the others', async () => {
    mockGetOk.mockResolvedValueOnce(ok({ total: 120, paid: 'oops', transactions: [{ id: 't1', amount: 120, status: 'PAID' }] }));
    const r = await getPayrollReport();
    expect(r.total).toBe(120);
    expect(r.paid).toBeNull();
    expect(r.pending).toBeNull();
    const v = payrollView(r);
    expect(v.unavailable).toBe(false);
    expect(v.stats.map((s) => s.value)).toEqual([120, null, null]);
    expect(v.confirmedEmpty).toBe(false);
  });

  it('flags the list as unavailable when figures exist but no transactions array was sent', async () => {
    mockGetOk.mockResolvedValueOnce(ok({ total: 50, paid: 50, pending: 0 }));
    const v = payrollView(await getPayrollReport());
    expect(v.listUnavailable).toBe(true);
    expect(v.confirmedEmpty).toBe(false);
    expect(v.unavailable).toBe(false);
  });

  it('an HTTP 200 with action 0 is a failure, not a report', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 0, message: 'Not allowed', data: null });
    await expect(getPayrollReport()).rejects.toBeTruthy();
  });
});
