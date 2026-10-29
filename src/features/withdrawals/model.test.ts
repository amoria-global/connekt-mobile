import {
  amountError,
  applyRates,
  displayToUsd,
  FALLBACK_CURRENCIES,
  KNOWN_CURRENCIES,
  formatDisplay,
  mapSource,
  readInitiate,
  readVerify,
  rwfPresetToDisplay,
  usdToDisplay,
  withdrawNamespace,
  type DisplayCurrency,
} from './model';

/**
 * The withdraw flow, mirrored from the web's WithdrawModal. These pin what
 * decides how much money moves and what the user is told about it.
 */
const RWF: DisplayCurrency = { code: 'RWF', symbol: 'RF', rate: 1460, decimals: 0 };
const USD: DisplayCurrency = { code: 'USD', symbol: '$', rate: 1, decimals: 2 };
const balance = mapSource({ source: 'BALANCE', label: 'Available balance', availableBalance: 10, isGiftWithdrawal: false });

describe('withdrawNamespace', () => {
  it('uses the role’s own namespace, as the web WithdrawModal does', () => {
    expect(withdrawNamespace('Photographer')).toBe('photographer');
    expect(withdrawNamespace('Coordinator')).toBe('coordinator');
    expect(withdrawNamespace('Client')).toBe('customer');
    expect(withdrawNamespace(undefined)).toBe('customer');
  });
});

describe('currency', () => {
  it('sends USD: typed RWF is divided by the RWF rate', () => {
    expect(displayToUsd(14600, RWF)).toBeCloseTo(10);
    expect(usdToDisplay(10, RWF)).toBe(14600);
    expect(displayToUsd(25, USD)).toBe(25);
  });

  // Changed 2026-10-13: there is no built-in RWF rate. Without a usable backend rate
  // RWF is left out (USD only) instead of being converted at an invented 1460.
  it('takes live rates when present and leaves RWF out otherwise', () => {
    const live = applyRates(KNOWN_CURRENCIES, { RWF: { rateToUsd: 1455.5, symbol: 'RF' } });
    expect(live.find((c) => c.code === 'RWF')?.rate).toBe(1455.5);
    expect(live.find((c) => c.code === 'USD')?.rate).toBe(1);
    expect(applyRates(KNOWN_CURRENCIES, null)).toEqual(FALLBACK_CURRENCIES);
    expect(applyRates(KNOWN_CURRENCIES, { RWF: { rateToUsd: 0 } }).map((c) => c.code)).toEqual(['USD']);
  });

  it('formats letter symbols spaced and sign symbols tight', () => {
    expect(formatDisplay(5000, RWF)).toBe('RF 5,000');
    expect(formatDisplay(25, USD)).toBe('$25.00');
  });

  it('shows the web’s RWF donation presets in the chosen currency', () => {
    expect(rwfPresetToDisplay(1000, 1460, RWF)).toBe(1000);
    expect(rwfPresetToDisplay(1460, 1460, USD)).toBe(1);
  });
});

describe('amountError', () => {
  it('accepts up to the balance, including Max rounded down in RWF', () => {
    expect(amountError('14600', balance, RWF)).toBeNull();
    expect(amountError('10', balance, USD)).toBeNull();
    expect(amountError('', balance, RWF)).toBeNull();
  });

  it('refuses more than the balance, zero and garbage', () => {
    expect(amountError('14700', balance, RWF)).toMatch(/more than your booking earnings of RF 14,600/);
    expect(amountError('10.02', balance, USD)).toMatch(/more than/);
    expect(amountError('0', balance, RWF)).toMatch(/greater than zero/);
    expect(amountError('abc', balance, RWF)).toMatch(/greater than zero/);
  });
});

describe('readInitiate', () => {
  it('reads the verification and fee preview', () => {
    const out = readInitiate({
      action: 1,
      data: {
        verificationId: 'v1',
        method: 'SMS_OTP',
        maskedDestination: '+250***456',
        requiresOtp: true,
        requiresFaceScan: false,
        feePreview: { totalFee: 0.5, percentageFee: 0.3, additionalCharge: 0.2, netAmount: 9.5, feePercentage: 3 },
      },
    });
    expect(out).toEqual({
      kind: 'verify',
      verification: {
        verificationId: 'v1',
        method: 'SMS_OTP',
        maskedDestination: '+250***456',
        requiresOtp: true,
        requiresFaceScan: false,
        fee: { totalFee: 0.5, percentageFee: 0.3, additionalCharge: 0.2, netAmount: 9.5, feePercentage: 3 },
      },
    });
  });

  it('routes a KYC refusal to KYC and keeps other refusals’ own message', () => {
    expect(readInitiate({ action: 0, kycRequired: true, message: 'x' }).kind).toBe('kyc');
    expect(readInitiate({ action: 0, message: 'Insufficient balance. Available: 3' })).toEqual({
      kind: 'error',
      message: 'Insufficient balance. Available: 3',
    });
  });

  it('treats a 200 without a verification id as a failure', () => {
    expect(readInitiate({ action: 1, data: {} }).kind).toBe('error');
  });
});

describe('readVerify', () => {
  it('ends at submitted on success: the request waits for admin approval, no payout call', () => {
    expect(readVerify({ action: 1, data: { transactionId: 't1', status: 'PENDING' } })).toEqual({
      kind: 'submitted',
      transactionId: 't1',
    });
  });

  it('restarts on expiry or too many attempts', () => {
    expect(readVerify({ action: 0, expired: true }).kind).toBe('restart');
    expect(readVerify({ action: 0, maxAttemptsReached: true, remainingAttempts: 0 }).kind).toBe('restart');
  });

  it('lets the user retry a wrong code, with the attempts left', () => {
    expect(readVerify({ action: 0, message: 'Invalid OTP code', remainingAttempts: 2 })).toEqual({
      kind: 'retry',
      message: 'Invalid OTP code',
      remainingAttempts: 2,
    });
  });
});

import { orderSources, totalWithdrawable } from './model';

describe('withdraw sources', () => {
  const src = (source: string, availableBalance: number) => ({ source, label: source, availableBalance, isGiftWithdrawal: false });

  it('calls the BALANCE source booking earnings, not the available balance', () => {
    expect(mapSource({ source: 'BALANCE', label: 'Available balance', availableBalance: 0 }).label).toBe('Booking earnings');
    expect(mapSource({ source: 'STREAM_FEES', label: 'Stream revenue', availableBalance: 6.62 }).label).toBe('Stream revenue');
  });

  it('drops an empty source when another has money, and keeps the list when none does', () => {
    expect(orderSources([src('BALANCE', 0), src('STREAM_FEES', 6.62)]).map((s) => s.source)).toEqual(['STREAM_FEES']);
    expect(orderSources([src('BALANCE', 0)]).map((s) => s.source)).toEqual(['BALANCE']);
  });

  it('totals every source, the figure the wallet calls available to withdraw', () => {
    expect(totalWithdrawable([src('BALANCE', 0), src('STREAM_FEES', 6.62), src('TIPS', 1)])).toBeCloseTo(7.62);
  });
});
