/**
 * Saved payment accounts: the pure half, kept free of the RN api client so a
 * plain jest test can pin it.
 *
 * Mirrors the web dashboard's Preferences > Payment Accounts tab
 * (connekt-dashboard app/pages/preferences.tsx) against the same backend
 * contract, WithdrawalMethodController:
 *
 *   GET    /{ns}/withdrawal-methods
 *   POST   /{ns}/withdrawal-methods?methodType&accountName&accountNumber&bankName&isDefault&country
 *   PUT    /{ns}/withdrawal-methods/{id}?...same fields...&isDefault=true
 *   DELETE /{ns}/withdrawal-methods/{id}
 *
 * The fields travel as query parameters, not a JSON body, because the
 * controller reads them with @RequestParam.
 */
import type { Role } from '@/features/auth/role';

export type AccountKind = 'mtn' | 'airtel' | 'bank';
export type MethodType = 'MOBILE_MONEY' | 'BANK_TRANSFER';

export type PaymentAccount = {
  id: string;
  kind: AccountKind;
  methodType: MethodType;
  /** Provider label: "MTN Mobile Money", "Airtel Money" or the bank's name. */
  label: string;
  accountNumber: string;
  accountName: string;
  /** Stored provider name, sent back unchanged on a set-default PUT. */
  bankName: string;
  isDefault: boolean;
};

type Raw = Record<string, unknown>;

/**
 * Which namespace the withdrawal-methods routes live under. The backend maps
 * all three to one controller scoped by the signed-in user; this follows the
 * web's choice so both clients hit the same path for the same role.
 */
export function withdrawalMethodsPath(role: Role | undefined): string {
  return role === 'Photographer'
    ? '/photographer/withdrawal-methods'
    : '/customer/withdrawal-methods';
}

export function mapAccount(r: Raw): PaymentAccount {
  const methodType: MethodType =
    String(r.methodType ?? '').toUpperCase() === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'MOBILE_MONEY';
  const bankName = typeof r.bankName === 'string' ? r.bankName : '';
  const isAirtel = bankName.toLowerCase().includes('airtel');
  const kind: AccountKind = methodType === 'BANK_TRANSFER' ? 'bank' : isAirtel ? 'airtel' : 'mtn';
  return {
    id: String(r.id ?? ''),
    kind,
    methodType,
    label:
      kind === 'bank' ? bankName || 'Bank transfer' : kind === 'airtel' ? 'Airtel Money' : 'MTN Mobile Money',
    accountNumber: typeof r.accountNumber === 'string' ? r.accountNumber : '',
    accountName: typeof r.accountName === 'string' ? r.accountName : '',
    bankName,
    isDefault: r.isDefault === true,
  };
}

/**
 * XentriPay provider ids for the two mobile money networks. The providers
 * endpoint only lists banks, so the web falls back to these same ids.
 */
export const MOBILE_PROVIDER: Record<'mtn' | 'airtel', { bankId: string; bankName: string }> = {
  mtn: { bankId: '63510', bankName: 'MTN Mobile Money' },
  airtel: { bankId: '63514', bankName: 'Airtel Rwanda' },
};

/**
 * Decide which name to save after XentriPay has looked the number up, the
 * same way the web does:
 *   - no registered name came back: keep what the user typed;
 *   - the user typed nothing, or the same name: save the registered one;
 *   - the names differ: ask first, and on confirm save the registered name,
 *     because that is the name the payout network will pay out to.
 */
export function resolveMobileName(
  entered: string,
  registered: string,
): { name: string; needsConfirm: boolean } {
  const e = entered.trim();
  const r = registered.trim();
  if (!r) return { name: e, needsConfirm: false };
  if (!e || e.toLowerCase() === r.toLowerCase()) return { name: r, needsConfirm: false };
  return { name: r, needsConfirm: true };
}

/** Last four digits for list rows, "•••• 3456". */
export function maskAccountNumber(n: string): string {
  const digits = n.replace(/\s+/g, '');
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
