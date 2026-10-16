import {
  keepSelection,
  normalizeCountry,
  onlyOperators,
  resolveEligibility,
} from './eligibility';
import type { PaymentOptions } from '@/features/reference/api';

const MTN = { id: 'MTN', name: 'MTN Mobile Money', type: 'MOBILE_MONEY' };
const AIRTEL = { id: 'AIRTEL', name: 'Airtel Money', type: 'MOBILE_MONEY' };
const MPESA = { id: 'MPESA', name: 'M-Pesa', type: 'MOBILE_MONEY' };
const rw: PaymentOptions = { country: 'RW', supportsCard: true, operators: [MTN, AIRTEL] };
const ke: PaymentOptions = { country: 'KE', supportsCard: true, operators: [MPESA] };

const ids = (e: ReturnType<typeof resolveEligibility>) => e.operators.map((o) => o.id);

describe('payment eligibility by country', () => {
  it('Rwanda: cards plus the backend operators', () => {
    const e = resolveEligibility('rw', rw);
    expect(e.country).toBe('RW');
    expect(ids(e)).toEqual(['MTN', 'AIRTEL']);
    expect(e.supportsCard).toBe(true);
    expect(e.mobileMoney).toBe('ready');
  });

  it('another supported market keeps only its own operators', () => {
    const e = resolveEligibility('KE', ke);
    expect(ids(e)).toEqual(['MPESA']);
    expect(e.supportsCard).toBe(true);
  });

  it('United States (no coverage, backend answers action 0): cards only, no Rwanda operators', () => {
    const e = resolveEligibility('US', null);
    expect(e.country).toBe('US');
    expect(e.operators).toEqual([]);
    expect(e.supportsCard).toBe(true);
    expect(e.mobileMoney).toBe('unavailable');
  });

  it('unknown country: cards only, never Rwanda', () => {
    for (const c of [null, undefined, '', 'xx1', 'RWA']) {
      const e = resolveEligibility(c, rw);
      expect(e.country).toBeNull();
      expect(e.operators).toEqual([]);
      expect(e.supportsCard).toBe(true);
      expect(e.mobileMoney).toBe('unavailable');
    }
  });

  it('a failed options lookup hides mobile money and keeps cards', () => {
    const e = resolveEligibility('RW', null);
    expect(e.operators).toEqual([]);
    expect(e.supportsCard).toBe(true);
    expect(e.mobileMoney).toBe('unavailable');
  });

  it('options for a different country than the one asked never apply', () => {
    expect(resolveEligibility('US', rw).operators).toEqual([]);
  });

  it('while loading, no operator is offered yet', () => {
    const e = resolveEligibility('RW', rw, true);
    expect(e.operators).toEqual([]);
    expect(e.mobileMoney).toBe('loading');
    expect(e.supportsCard).toBe(true);
  });

  it('a country the backend returns with no operators has no mobile money', () => {
    const e = resolveEligibility('RW', { ...rw, operators: [] });
    expect(e.mobileMoney).toBe('unavailable');
    expect(e.supportsCard).toBe(true);
  });

  it('normalizes ISO codes', () => {
    expect(normalizeCountry(' rw ')).toBe('RW');
    expect(normalizeCountry('Rwanda')).toBeNull();
  });
});

describe('selection stays inside what is offered', () => {
  it('drops a stale operator after the country changes', () => {
    const us = resolveEligibility('US', null);
    expect(keepSelection('mtn', us)).toBeNull();
    expect(keepSelection('card', us)).toBe('card');
    expect(keepSelection('airtel', resolveEligibility('RW', rw))).toBe('airtel');
    expect(keepSelection(null, us)).toBeNull();
  });

  it('host endpoints can narrow the operators', () => {
    expect(onlyOperators([MTN, AIRTEL, MPESA], ['MTN', 'AIRTEL']).map((o) => o.id)).toEqual(['MTN', 'AIRTEL']);
    expect(onlyOperators([MPESA], ['MTN', 'AIRTEL'])).toEqual([]);
  });
});
