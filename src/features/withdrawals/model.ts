/**
 * Withdrawals: the pure half, free of the RN api client so jest can pin it.
 *
 * Mirrors the web dashboard's WithdrawModal (connekt-dashboard
 * app/components/WithdrawModal.tsx) on the same backend contract,
 * WithdrawalController:
 *
 *   GET  /{ns}/withdrawable-sources      balances per source, in USD
 *   POST /{ns}/withdraw/initiate         { amount, withdrawalMethodId, donationAmount,
 *                                          isGiftWithdrawal, source } -> verification
 *   POST /{ns}/withdraw/verify           { verificationId, otp?, selfie? } -> request
 *   POST /{ns}/withdraw/resend-otp       { verificationId }
 *
 * Every amount on the wire is USD. The user types in a display currency and
 * the client divides by that currency's rateToUsd, as the web does.
 *
 * Deliberately NOT mirrored: after verify the web also calls
 * POST /withdrawals/xentripay/process. A verified withdrawal is created as
 * PENDING_APPROVAL (WithdrawalVerificationService.processVerifiedWithdrawal),
 * the funds are held and finance is emailed; an admin's approval fires the
 * payout. processWithdrawal() refuses anything not PENDING, so that call can
 * only fail, and the web then shows "Withdrawal failed" for a request that
 * went through. Here a successful verify is the end of the client's part.
 */
import type { Role } from '@/features/auth/role';

/** Namespace for the withdraw routes. The web uses the role's own. */
export function withdrawNamespace(role: Role | undefined): 'photographer' | 'coordinator' | 'customer' {
  return role === 'Photographer' ? 'photographer' : role === 'Coordinator' ? 'coordinator' : 'customer';
}

export type WithdrawSource = {
  source: string;
  label: string;
  /** USD. */
  availableBalance: number;
  isGiftWithdrawal: boolean;
};

type Raw = Record<string, unknown>;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function mapSource(r: Raw): WithdrawSource {
  return {
    source: String(r.source ?? 'BALANCE'),
    label: typeof r.label === 'string' && r.label ? r.label : 'Available balance',
    availableBalance: num(r.availableBalance),
    isGiftWithdrawal: r.isGiftWithdrawal === true,
  };
}

/** A display currency: `rate` is units per USD (the backend's rateToUsd). */
export type DisplayCurrency = { code: string; symbol: string; rate: number; decimals: number };

/**
 * Currencies we can show, with no rate except USD's. A rate of 0 means "not
 * supplied by the backend"; such a currency is dropped by applyRates and never
 * offered, because converting with an invented rate changes the amount that is
 * submitted for a withdrawal or donation.
 */
export const KNOWN_CURRENCIES: DisplayCurrency[] = [
  { code: 'RWF', symbol: 'RF', rate: 0, decimals: 0 },
  { code: 'USD', symbol: '$', rate: 1, decimals: 2 },
];

/** Used until /public/currencies/rates answers: USD only. */
export const FALLBACK_CURRENCIES: DisplayCurrency[] = KNOWN_CURRENCIES.filter((c) => c.rate > 0);

/** The base currencies that have a usable backend rate; the rest are left out, not defaulted. */
export function applyRates(
  base: DisplayCurrency[],
  rates: Record<string, { rateToUsd?: unknown; symbol?: unknown }> | null | undefined,
): DisplayCurrency[] {
  return base
    .map((c) => {
      const r = rates?.[c.code];
      const rate = num(r?.rateToUsd);
      return rate > 0
        ? { ...c, rate, symbol: typeof r?.symbol === 'string' && r.symbol ? r.symbol : c.symbol }
        : c;
    })
    .filter((c) => c.rate > 0);
}

/**
 * Donation presets are fixed RWF amounts shown in the display currency, so they
 * need a live RWF rate. Without one there are no presets (the donor can still
 * type an amount), rather than presets converted at a guess.
 */
export function donationPresets(rwfRate: number, c: DisplayCurrency): number[] {
  return rwfRate > 0 ? DONATION_PRESETS_RWF.map((rwf) => rwfPresetToDisplay(rwf, rwfRate, c)) : [];
}

export function usdToDisplay(usd: number, c: DisplayCurrency): number {
  return usd * c.rate;
}

export function displayToUsd(amount: number, c: DisplayCurrency): number {
  return c.rate > 0 ? amount / c.rate : 0;
}

export function formatDisplay(amount: number, c: DisplayCurrency): string {
  const fixed = amount.toLocaleString('en-US', {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  });
  // Letter symbols read better spaced ("RF 5,000"), sign symbols tight ("$25.00").
  const gap = /^[A-Za-z]+$/.test(c.symbol) ? ' ' : '';
  return `${c.symbol}${gap}${fixed}`;
}

/** Parse what the user typed; commas and spaces are ignored. */
export function parseAmount(text: string): number {
  const n = Number(text.replace(/[\s,]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Check a typed amount against the selected source. Compared in USD, the
 * currency the balance is kept in, with a cent of slack so "Max" in RWF
 * (rounded down to whole francs) is never refused by rounding.
 */
export function amountError(
  text: string,
  source: WithdrawSource | null,
  c: DisplayCurrency,
): string | null {
  if (!text.trim()) return null;
  const typed = parseAmount(text);
  if (!(typed > 0)) return 'Enter an amount greater than zero.';
  if (!source) return 'Choose where to withdraw from.';
  const usd = displayToUsd(typed, c);
  if (usd > source.availableBalance + 0.005) {
    return `That is more than your ${source.label.toLowerCase()} of ${formatDisplay(
      floorTo(usdToDisplay(source.availableBalance, c), c.decimals),
      c,
    )}.`;
  }
  return null;
}

export function floorTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.floor(n * f) / f;
}

/** Donation presets are RWF amounts, shown in the display currency, as on the web. */
export const DONATION_PRESETS_RWF = [500, 1000, 2500, 5000];

export function rwfPresetToDisplay(rwf: number, rwfRate: number, c: DisplayCurrency): number {
  const usd = rwfRate > 0 ? rwf / rwfRate : 0;
  return Number(usdToDisplay(usd, c).toFixed(c.decimals));
}

export type VerificationMethod = 'SMS_OTP' | 'EMAIL_OTP' | 'FACE_SCAN' | 'FACE_SCAN_WITH_OTP' | string;

export type FeePreview = {
  totalFee: number;
  percentageFee: number;
  additionalCharge: number;
  netAmount: number;
  feePercentage: number;
};

export type Verification = {
  verificationId: string;
  method: VerificationMethod;
  maskedDestination: string;
  requiresOtp: boolean;
  requiresFaceScan: boolean;
  fee: FeePreview | null;
};

/** What POST /withdraw/initiate answered. */
export type InitiateOutcome =
  | { kind: 'verify'; verification: Verification }
  | { kind: 'kyc'; message: string }
  | { kind: 'error'; message: string };

export function readInitiate(res: Raw | null | undefined): InitiateOutcome {
  if (!res || res.action !== 1) {
    if (res?.kycRequired === true) {
      return { kind: 'kyc', message: 'Verify your identity before you withdraw funds.' };
    }
    return { kind: 'error', message: str(res?.message) ?? 'Could not start the withdrawal. Please try again.' };
  }
  const d = (res.data ?? {}) as Raw;
  const id = str(d.verificationId);
  if (!id) return { kind: 'error', message: 'Could not start the withdrawal. Please try again.' };
  const f = d.feePreview as Raw | undefined;
  return {
    kind: 'verify',
    verification: {
      verificationId: id,
      method: str(d.method) ?? '',
      maskedDestination: str(d.maskedDestination) ?? '',
      requiresOtp: d.requiresOtp === true,
      requiresFaceScan: d.requiresFaceScan === true,
      fee: f
        ? {
            totalFee: num(f.totalFee),
            percentageFee: num(f.percentageFee),
            additionalCharge: num(f.additionalCharge),
            netAmount: num(f.netAmount),
            feePercentage: num(f.feePercentage),
          }
        : null,
    },
  };
}

/** What POST /withdraw/verify answered. */
export type VerifyOutcome =
  | { kind: 'submitted'; transactionId: string }
  /** Start over: the verification expired or ran out of attempts. */
  | { kind: 'restart'; message: string }
  /** Wrong code or face mismatch; the user can try again. */
  | { kind: 'retry'; message: string; remainingAttempts?: number };

export function readVerify(res: Raw | null | undefined): VerifyOutcome {
  if (res?.action === 1) {
    const d = (res.data ?? {}) as Raw;
    const id = d.transactionId ?? d.id;
    if (id != null && String(id)) return { kind: 'submitted', transactionId: String(id) };
    return { kind: 'restart', message: 'The request has no reference. Please contact support before trying again.' };
  }
  if (res?.maxAttemptsReached === true) {
    return { kind: 'restart', message: 'Too many attempts. Please start a new withdrawal.' };
  }
  if (res?.expired === true) {
    return { kind: 'restart', message: 'This verification expired. Please start a new withdrawal.' };
  }
  const remaining = typeof res?.remainingAttempts === 'number' ? res.remainingAttempts : undefined;
  return { kind: 'retry', message: str(res?.message) ?? 'Verification failed. Please try again.', remainingAttempts: remaining };
}

export function verificationCopy(v: Pick<Verification, 'method' | 'maskedDestination'>): {
  title: string;
  body: string;
} {
  const to = v.maskedDestination || 'you';
  switch (v.method) {
    case 'SMS_OTP':
      return { title: 'Check your phone', body: `Enter the 6-digit code we sent to ${to}.` };
    case 'EMAIL_OTP':
      return { title: 'Check your email', body: `Enter the 6-digit code we sent to ${to}.` };
    case 'FACE_SCAN':
      return { title: 'Confirm it is you', body: 'Take a selfie so we can match it to your verified ID.' };
    case 'FACE_SCAN_WITH_OTP':
      return { title: 'Confirm it is you', body: `Take a selfie and enter the code we sent to ${to}.` };
    default:
      return { title: 'Confirm it is you', body: 'Verify your identity to continue.' };
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}
