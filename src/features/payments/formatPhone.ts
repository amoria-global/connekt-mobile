/**
 * Phone helpers — mobile port of knockout/lib/payments/formatPhone.ts.
 *
 * Mirrors the backend PawapayApiService.formatPhone(phone, iso2) so the
 * UI shows what will actually be sent to the gateway, and gives a
 * country-aware placeholder so the phone input never shows a stale
 * Rwanda "078…" example after the user's country is detected as, say,
 * Kenya. Unknown ISO-2 codes fall back to Rwanda ("250"), same as the
 * backend default, preserving pre-multi-country behavior.
 */

export const DIAL_CODES: Record<string, string> = {
  RW: '250',
  KE: '254',
  UG: '256',
  TZ: '255',
  ZM: '260',
  GH: '233',
  NG: '234',
  MW: '265',
  BJ: '229',
  BF: '226',
  CM: '237',
  CD: '243',
  CG: '242',
  CI: '225',
  ET: '251',
  GA: '241',
  LS: '266',
  MZ: '258',
  SN: '221',
  SL: '232',
  ZW: '263',
};

export function dialCodeFor(iso2: string | null | undefined): string {
  if (!iso2) return '250';
  return DIAL_CODES[iso2.toUpperCase().trim()] ?? '250';
}

export function formatPhoneE164(phone: string, iso2: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  const dial = dialCodeFor(iso2);
  if (cleaned.startsWith(dial)) return cleaned;
  if (cleaned.startsWith('0')) return dial + cleaned.slice(1);
  return dial + cleaned;
}

/**
 * Quick validity check. Mobile-money numbers are typically 9 digits
 * after the country code; we accept 8–12 to be generous (Nigeria's are
 * 10, etc.). Not strict — the server is authoritative.
 */
export function isPlausibleMobile(phone: string, iso2: string | null | undefined): boolean {
  const e164 = formatPhoneE164(phone, iso2);
  const dial = dialCodeFor(iso2);
  const national = e164.startsWith(dial) ? e164.slice(dial.length) : e164;
  return national.length >= 8 && national.length <= 12;
}

const PHONE_HINTS: Record<string, string> = {
  RW: '078XXXXXXX',
  KE: '7XXXXXXXX',
  UG: '07XXXXXXXX',
  TZ: '06XXXXXXXX',
  ZM: '09XXXXXXXX',
  GH: '02XXXXXXXX',
  NG: '080XXXXXXXX',
  MW: '08XXXXXXXX',
  CI: '07XXXXXXXX',
  SN: '7XXXXXXXX',
  CM: '06XXXXXXXX',
  CD: '08XXXXXXXXX',
};

/**
 * Human placeholder for the phone input, country-aware so it never shows
 * a stale example after the user switches country. Returns just the
 * digits pattern (no "e.g." prefix — the caller styles it as a
 * placeholder).
 */
export function phoneHintForCountry(iso2: string | null | undefined): string {
  const code = (iso2 || '').toUpperCase().trim();
  if (PHONE_HINTS[code]) return PHONE_HINTS[code];
  return `+${dialCodeFor(iso2)} 7XXXXXXXX`;
}
