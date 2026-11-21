/**
 * Photographer Referral Program client. The server decides every rule; this file parses what the user typed,
 * calls the endpoints and turns the answers into what the screens show. A response never carries more than the
 * referrer's display name.
 */
import { useEffect, useState } from 'react';
import { api, requireOk } from '@/api/client';
import { REFERRAL_I18N, type ReferralStrings } from './referralI18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { milestoneCopy, type MilestoneCopy } from './referralCopy';

export type ReferralProblem =
  | 'INVALID' | 'NOT_ELIGIBLE' | 'LIMIT_REACHED' | 'SELF' | 'MUTUAL'
  | 'ALREADY_REFERRED' | 'QA_MISMATCH' | 'NOT_A_PHOTOGRAPHER';

export type ReferralStatus = 'pending' | 'under_review' | 'qualified' | 'revoked';
export type ReferralHint = 'waiting_verified_published' | 'waiting_first_sale' | 'under_review' | 'qualified' | 'revoked';
export interface ReferralRow {
  name: string;
  status: ReferralStatus;
  date: string;
  signedUp: boolean;
  verifiedPublished: boolean;
  firstSale: boolean;
  hint: ReferralHint;
}
/** What the referred photographer sees about the referral they came through. */
export interface MyReferral { referrerName: string | null; status: ReferralStatus; verifiedPublished: boolean; firstSale: boolean }
export interface UnlockedMilestone { milestone: number; sharePercent: number }
export interface ReferralStats {
  code: string | null;
  link: string | null;
  qualifying: number;
  cap: number;
  sharePercent: number;
  nextMilestone: number | null;
  nextSharePercent: number | null;
  maxRate: boolean;
  complete: boolean;
  pending: number;
  underReview: number;
  minQualifyingUsd: number;
  referrals: ReferralRow[];
  hasReferrer: boolean;
  referrerName: string | null;
  myReferral: MyReferral | null;
  unlocked: UnlockedMilestone | null;
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

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Strings for the current app language, English where a language has none. */
export function referralStrings(language: string): ReferralStrings {
  return REFERRAL_I18N[language] ?? REFERRAL_I18N.en;
}

/** Program wording from the shared source, in the app language. */
export function useMilestoneCopy(): MilestoneCopy {
  const { language } = useLanguage();
  return milestoneCopy(language);
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
  const d = res.data;
  // A reply without the numbers the screens draw is a failed load, never a card full of NaN.
  if (!d || typeof d.qualifying !== 'number' || typeof d.sharePercent !== 'number') throw new Error('referral-load-failed');
  return { ...d, referrals: Array.isArray(d.referrals) ? d.referrals : [], myReferral: d.myReferral ?? null, unlocked: d.unlocked ?? null, minQualifyingUsd: d.minQualifyingUsd ?? 5 };
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

/** Tells the server the congratulations sheet was shown, so it is not offered again. */
export async function acknowledgeMilestone(): Promise<void> {
  try {
    await api.post('/photographer/referral/milestone/ack', {});
  } catch {
    // Offered again on the next open; harmless.
  }
}

/** Loads the referral stats once and on demand. */
export function useReferralStats(enabled = true): {
  stats: ReferralStats | null;
  status: 'loading' | 'error' | 'ready';
  reload: () => void;
} {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchMyReferral()
      .then((r) => {
        if (!alive) return;
        setStats(r);
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus((cur) => (cur === 'ready' ? cur : 'error'));
      });
    return () => {
      alive = false;
    };
  }, [enabled, tick]);
  return { stats, status, reload: () => setTick((t) => t + 1) };
}
