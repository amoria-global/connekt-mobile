import { getWallet, listWalletMovements } from './api';
import { selectWalletStats } from './moneyView';

const mockGetOk = jest.fn();
// Only the transport is faked: getOk keeps the production requireOk, which is
// what turns an HTTP 200 carrying action 0 into an error.
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) =>
      jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
  },
}));

/**
 * Behaviour tests on the REAL backend payloads, exported by the backend test
 * BookingMoneyFlowIT (see ../../../../connekyt-backend). SYNTHETIC 100,000 RWF
 * booking at 1,000 RWF per USD. Oracle worked out by hand, not read from the
 * fixtures: photographer 0.91 x 50 + 20 + 30 = 95.50 USD, platform 4.50, client 100.00.
 */
const fixture = (name: string) => require(`./__fixtures__/${name}`);

beforeEach(() => mockGetOk.mockReset());

describe('wallet payload to mobile figures', () => {
  it('photographer sees 95.50 available from the booking bucket', async () => {
    mockGetOk.mockResolvedValueOnce(fixture('wallet-me-photographer.json'));
    const w = await getWallet();
    expect(w.balanceAvailable).toBeCloseTo(95.5, 4);
    expect(w.total).toBeCloseTo(95.5, 4);
    expect(w.pots.map((p) => p.key)).toEqual(['balanceAvailable', 'balanceBooking']);
    expect(selectWalletStats(w, 'photographer').hero.value).toBeCloseTo(95.5, 4);
  });

  it('client sees 100.00 spent', async () => {
    mockGetOk.mockResolvedValueOnce(fixture('wallet-me-client.json'));
    const w = await getWallet();
    expect(w.clientSpent).toBeCloseTo(100, 4);
    expect(selectWalletStats(w, 'client').hero.value).toBeCloseTo(100, 4);
  });

  it('photographer movements are all money in and sum to 95.50', async () => {
    mockGetOk.mockResolvedValueOnce(fixture('wallet-movements-photographer.json'));
    const rows = await listWalletMovements();
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.direction === 'in')).toBe(true);
    expect(rows.reduce((t, r) => t + r.amount, 0)).toBeCloseTo(95.5, 4);
  });

  it('client movements show 100.00 going out', async () => {
    mockGetOk.mockResolvedValueOnce(fixture('wallet-movements-client.json'));
    const rows = await listWalletMovements();
    expect(rows.filter((r) => r.direction === 'out').reduce((t, r) => t + r.amount, 0)).toBeCloseTo(100, 4);
  });
});

describe('failures never become a balance or an empty history', () => {
  it('an HTTP 200 with action 0 is an error for the wallet', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 0, message: 'Wallet unavailable' });
    await expect(getWallet()).rejects.toMatchObject({ message: 'Wallet unavailable' });
  });

  it('success with no data is an error, not a $0 ACTIVE wallet', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, message: 'ok', data: null });
    await expect(getWallet()).rejects.toBeDefined();
  });

  it('success with a missing money field is an error, not a zero', async () => {
    const data = { ...fixture('wallet-me-photographer.json').data };
    delete data.balanceAvailable;
    mockGetOk.mockResolvedValueOnce({ action: 1, message: 'ok', data });
    await expect(getWallet()).rejects.toBeDefined();
  });

  it('a genuine zero wallet is accepted and stays zero', async () => {
    const data = { ...fixture('wallet-me-photographer.json').data };
    for (const k of ['balanceAvailable', 'balanceBooking', 'pendingAmount', 'heldForDelivery', 'totalWithdrawn', 'totalRefunded', 'clientSpent']) {
      data[k] = 0;
    }
    mockGetOk.mockResolvedValueOnce({ action: 1, message: 'ok', data });
    const w = await getWallet();
    expect(w.balanceAvailable).toBe(0);
    expect(w.status).toBe('ACTIVE');
  });

  it('an HTTP 200 with action 0 is an error for the history, not "no transactions"', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 0, message: 'History unavailable' });
    await expect(listWalletMovements()).rejects.toMatchObject({ message: 'History unavailable' });
  });

  it('a genuinely empty history is an empty list', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, message: 'ok', data: { content: [], totalElements: 0 } });
    await expect(listWalletMovements()).resolves.toEqual([]);
  });
});
