import { readFileSync } from 'fs';
import path from 'path';
import { paymentBucket, statusTone } from '@/features/payments/statusBucket';
import { requireOk } from '@/api/client';

/**
 * 2026-10-11 financial audit, P1-J (mobile): screens showed invented or wrong
 * money. Each case below was live in the app.
 */
const src = (p: string) => readFileSync(path.join(__dirname, '../../..', p), 'utf8').replace(/\r\n/g, '\n');

describe('payment status buckets', () => {
  it('never counts an unpaid or partial booking as paid', () => {
    for (const s of ['unpaid', 'UNPAID', 'partially_paid', 'PARTIAL', 'incomplete', 'PENDING', 'PENDING_APPROVAL']) {
      expect(paymentBucket(s)).toBe('pending');
    }
    for (const s of ['COMPLETED', 'paid', 'SUCCESS', 'APPROVED']) expect(paymentBucket(s)).toBe('paid');
    for (const s of ['FAILED', 'CANCELLED', 'REJECTED', 'declined']) expect(paymentBucket(s)).toBe('failed');
  });

  it('shows a withdrawal awaiting approval as pending, not green', () => {
    expect(statusTone('PENDING_APPROVAL')).toBe('warning');
    expect(statusTone('LOCKED')).toBe('error');
    expect(statusTone('UNLOCKED')).not.toBe('error');
  });
});

describe('envelope check', () => {
  it('throws on action 0 and passes action 1 or a raw page through', () => {
    expect(() => requireOk({ action: 0, message: 'nope' })).toThrow();
    expect(requireOk({ action: 1, data: 5 })).toEqual({ action: 1, data: 5 });
    expect(requireOk({ content: [] })).toEqual({ content: [] });
  });

  it('money and analytics reads use it', () => {
    for (const f of ['src/features/payments/api.ts', 'src/features/analytics/api.ts', 'src/features/wallet/api.ts']) {
      expect(src(f)).not.toContain('await api.get<ApiEnvelope<');
    }
  });
});

describe('no invented money', () => {
  it('the map never fabricates photographers or packages', () => {
    const map = src('src/features/photographers/mapApi.ts');
    expect(map).not.toContain('pkg-${p.id}');
    expect(map).not.toContain('120000');
    expect(map).not.toContain('DEMO_OFFSETS');
  });

  it('no assumed 65% shares or 65/35 splits', () => {
    expect(src('src/features/payments/api.ts')).not.toMatch(/\* 0\.65/);
    expect(src('src/features/dashboard/MultipleDonutOverviewCard.tsx')).not.toMatch(/coreRevenue \* 0\.65/);
  });

  it('stream revenue is never rebuilt from gross rows', () => {
    expect(src('src/features/payments/api.ts')).toContain(
      "typeof res?.totalStreamingRevenue === 'number' ? res.totalStreamingRevenue : 0;",
    );
  });

  it('the booking sheet converts with live rates, not a private table', () => {
    expect(src('src/features/booking/BookingBottomSheet.tsx')).not.toContain('1 / 1350');
  });

  it('the performance wave draws no curve without real data', () => {
    expect(src('src/features/dashboard/PerformanceWaveCard.tsx')).not.toContain('[0, 0.38, 0.82, 0.62, 0.45, 0.2]');
  });
});

describe('withdrawal outcome', () => {
  it('a timeout is not a wrong code and a lost connection never replays a POST', () => {
    expect(src('src/features/withdrawals/api.ts')).toContain('err.status !== 408');
    expect(src('src/api/client.ts')).toContain("(rest.method ?? 'GET') === 'GET'");
    expect(src('src/app/(app)/withdraw.tsx')).toContain('Check your withdrawal history before trying again.');
  });

  it('without live rates only USD is offered', () => {
    expect(src('src/features/withdrawals/api.ts')).toContain('return USD_ONLY;');
  });
});
