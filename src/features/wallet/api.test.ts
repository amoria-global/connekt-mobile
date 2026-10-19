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

  it('every ledger amount is labelled USD, including the one that came from a 100,000 RWF payment', async () => {
    // Found by the native emulator run: the booking credit is amountUsd 45.50 with originalCurrency RWF. It was
    // labelled RWF, so the screens converted "45.50 RWF" and showed +$0.04 instead of +$45.50.
    mockGetOk.mockResolvedValueOnce(fixture('wallet-movements-photographer.json'));
    const rows = await listWalletMovements();
    const booking = rows.find((r) => /Booking MS1_UPFRONT/.test(r.description ?? ''))!;
    expect(booking.amount).toBeCloseTo(45.5, 4);
    expect(booking.currency).toBe('USD');
    expect(rows.map((r) => r.currency)).toEqual(['USD', 'USD', 'USD']);
    // The payment's own figure stays available for display, as information.
    expect(booking.originalAmount).toBe(100000);
    expect(booking.originalCurrency).toBe('RWF');
  });

  it('a payload that carries only an original amount keeps that amount in its own currency', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [
      { id: 'm1', direction: 'CREDIT', originalAmount: 5000, originalCurrency: 'RWF', description: 'legacy row' },
    ] } });
    const [row] = await listWalletMovements();
    expect(row.amount).toBe(5000);
    expect(row.currency).toBe('RWF');
  });

  it('a payload that states its own amount and currency is taken as it says', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [
      { id: 'm2', direction: 'DEBIT', amount: 12.5, currency: 'USD', description: 'withdrawal' },
    ] } });
    const [row] = await listWalletMovements();
    expect(row).toMatchObject({ amount: 12.5, currency: 'USD', direction: 'out' });
  });

  it('a history row missing its id, direction or amount makes the history an error, never an invented debit', async () => {
    // Found by the native emulator run: {id:"x1"} was shown as an outgoing "Balance deduction" of an unknown amount, just now.
    for (const bad of [
      { id: 'x1' },
      { id: 'x2', direction: 'CREDIT' },
      { id: 'x3', amountUsd: 5 },
      { direction: 'DEBIT', amountUsd: 5 },
      { id: 'x4', direction: 'DEBIT', amountUsd: 'n/a' },
    ]) {
      mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [bad] } });
      await expect(listWalletMovements()).rejects.toMatchObject({ status: 502, message: expect.stringContaining('incomplete') });
    }
  });

  it('one bad row among good ones fails the whole history instead of silently dropping or inventing it', async () => {
    const good = fixture('wallet-movements-photographer.json').data.content;
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [...good, { id: 'x1' }] } });
    await expect(listWalletMovements()).rejects.toMatchObject({ message: expect.stringContaining('incomplete') });
  });

  it('a genuine zero-amount row is a complete row', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [{ id: 'z1', direction: 'CREDIT', amountUsd: 0, description: 'zero' }] } });
    const [row] = await listWalletMovements();
    expect(row).toMatchObject({ id: 'z1', amount: 0, direction: 'in' });
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
