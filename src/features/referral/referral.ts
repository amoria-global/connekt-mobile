/**
 * Photographer Referral Program client. The server decides every rule; this file parses what the user typed,
 * calls the endpoints and turns the answers into what the screens show. A response never carries more than the
 * referrer's display name.
 */
import { api, requireOk } from '@/api/client';
import { REFERRAL_I18N, type ReferralStrings } from './referralI18n';
import { useLanguage } from '@/contexts/LanguageContext';

export type ReferralProblem =
  | 'INVALID' | 'NOT_ELIGIBLE' | 'LIMIT_REACHED' | 'SELF' | 'MUTUAL'
  | 'ALREADY_REFERRED' | 'QA_MISMATCH' | 'NOT_A_PHOTOGRAPHER';

export type ReferralStatus = 'pending' | 'under_review' | 'qualified' | 'revoked';
export interface ReferralRow { name: string; status: ReferralStatus; date: string }
export interface ReferralStats {
  code: string | null;
  link: string | null;
  qualifying: number;
  cap: number;
  feePercent: number | null;
  nextFeePercent: number | null;
  complete: boolean;
  referrals: ReferralRow[];
  hasReferrer: boolean;
  referrerName: string | null;
}
export interface Validation { valid: boolean; referrerName?: string; code?: string; problem?: ReferralProblem }

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const POLICY_PATH = '/referral-program';

/** Same parsing as the server: a bare code or a full link in, the 8 character code (or null) out. */
export function parseReferralCode(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  const ref = s.toLowerCase().indexOf('ref=');
  if (ref >= 0) {
    s = s.slice(ref + 4);
    const amp = s.indexOf('&');
    if (amp >= 0) s = s.slice(0, amp);
  } else if (s.includes('/')) {
    s = s.slice(s.lastIndexOf('/') + 1);
  }
  s = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (s.length !== 8) return null;
  for (const c of s) if (!ALPHABET.includes(c)) return null;
  return s;
}

export function referralLink(code: string): string {
  return `https://connekyt.com/join?ref=${code}`;
}

/** The progress line: how far to the first discount, the current fee, or the finished program. */
export function progressParts(s: Pick<ReferralStats, 'qualifying' | 'feePercent' | 'complete' | 'cap'>):
  { kind: 'unlock' | 'fee' | 'complete'; n: number; fee: number | null; pct: number } {
  const pct = Math.min(100, Math.round((s.qualifying / s.cap) * 100));
  if (s.complete) return { kind: 'complete', n: s.cap, fee: 10, pct: 100 };
  if (s.feePercent == null) return { kind: 'unlock', n: s.qualifying, fee: null, pct };
  return { kind: 'fee', n: s.qualifying, fee: s.feePercent, pct };
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Strings for the current app language, English where a language has none. */
export function referralStrings(language: string): ReferralStrings {
  return REFERRAL_I18N[language] ?? REFERRAL_I18N.en;
}

export function useReferralStrings(): ReferralStrings {
  const { language } = useLanguage();
  return referralStrings(language);
}

/** Field message key for a validation problem. */
export function problemKey(p: ReferralProblem | undefined): keyof ReferralStrings['field'] {
  switch (p) {
    case 'LIMIT_REACHED': return 'limit';
    case 'NOT_ELIGIBLE': return 'notEligible';
    case 'SELF': return 'self';
    case 'MUTUAL': return 'mutual';
    case 'ALREADY_REFERRED': return 'already';
    default: return 'invalid';
  }
}

export type CheckResult =
  | { kind: 'ok'; name: string; code: string }
  | { kind: 'bad'; key: keyof ReferralStrings['field'] };

/** Server validation. `signedIn` runs the full account rules; the public route is used at sign-up. */
export async function checkCode(code: string, signedIn: boolean): Promise<CheckResult> {
  try {
    const path = signedIn ? '/photographer/referral/validate' : '/public/referral/validate';
    const res = await api.get<{ action?: number; data?: Validation }>(`${path}?code=${encodeURIComponent(code)}`, { skipAuth: !signedIn });
    const v = res?.data;
    if (res?.action === 1 && v?.valid) return { kind: 'ok', name: v.referrerName || '', code };
    if (res?.action === 1 && v) return { kind: 'bad', key: problemKey(v.problem) };
    return { kind: 'bad', key: 'error' };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    return { kind: 'bad', key: status === 429 ? 'tooMany' : 'error' };
  }
}

export async function fetchMyReferral(): Promise<ReferralStats> {
  const res = requireOk(await api.get<{ action?: number; data?: ReferralStats }>('/photographer/referral/me'));
  if (!res.data) throw new Error('referral-load-failed');
  return res.data;
}

export async function attachCode(code: string): Promise<{ ok: boolean; referrerName?: string; key?: keyof ReferralStrings['field'] }> {
  try {
    const res = await api.post<{ action?: number; data?: { referrerName?: string; problem?: ReferralProblem } }>(
      '/photographer/referral/attach', { code });
    if (res?.action === 1) return { ok: true, referrerName: res.data?.referrerName };
    return { ok: false, key: problemKey(res?.data?.problem) };
  } catch (e) {
    return { ok: false, key: (e as { status?: number })?.status === 429 ? 'tooMany' : 'error' };
  }
}
