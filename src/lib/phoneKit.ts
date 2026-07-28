/**
 * phoneKit — dependency-free international phone parsing, validation and
 * formatting for the countries Connekyt serves (plus a lenient E.164
 * fallback for everywhere else).
 *
 * Why not libphonenumber-js: the deploy pipeline installs with a frozen
 * lockfile, and this kit covers the platform's actual audience with a
 * curated numbering-plan table at ~3KB instead of ~150KB of metadata.
 *
 * Core behaviors the UI builds on:
 *  - matchDialCode: longest-prefix country detection from typed digits, so
 *    deleting/changing the dial code in an input re-detects the country.
 *  - parsePhone: accepts "+250 788...", "00250788...", "0788..." (trunk),
 *    or bare national digits with a fallback country.
 *  - validatePhone: national-significant-number length per country plan.
 *
 * This file is duplicated (adapted) in connekt-dashboard and connekt-mobile
 * per the cross-repo parity rule — keep the three copies in sync.
 */

export interface PhoneCountry {
  iso2: string;
  name: string;
  /** International dialing code, digits only (no +). */
  dial: string;
  /** Valid national-significant-number lengths (digits after the dial code, trunk 0 removed). */
  nsnLengths: number[];
  /** National trunk prefix users habitually type (stripped when converting to international). */
  trunkPrefix?: string;
  /** Display grouping for the national part, e.g. [3,3,3] → "788 123 456". */
  groups?: number[];
}

/**
 * Curated numbering plans. East/Central/West Africa first (payment
 * countries), then the major diaspora/booking origins. Lengths follow the
 * ITU national numbering plans for MOBILE numbers (what this platform
 * collects: MoMo wallets, WhatsApp, OTP).
 */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso2: 'RW', name: 'Rwanda', dial: '250', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'KE', name: 'Kenya', dial: '254', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'UG', name: 'Uganda', dial: '256', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'TZ', name: 'Tanzania', dial: '255', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'BI', name: 'Burundi', dial: '257', nsnLengths: [8], trunkPrefix: '0', groups: [2, 2, 2, 2] },
  { iso2: 'CD', name: 'DR Congo', dial: '243', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'ET', name: 'Ethiopia', dial: '251', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'GH', name: 'Ghana', dial: '233', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'NG', name: 'Nigeria', dial: '234', nsnLengths: [10], trunkPrefix: '0', groups: [3, 3, 4] },
  { iso2: 'ZA', name: 'South Africa', dial: '27', nsnLengths: [9], trunkPrefix: '0', groups: [2, 3, 4] },
  { iso2: 'ZM', name: 'Zambia', dial: '260', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'ZW', name: 'Zimbabwe', dial: '263', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'MW', name: 'Malawi', dial: '265', nsnLengths: [7, 9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'MZ', name: 'Mozambique', dial: '258', nsnLengths: [9], groups: [2, 3, 4] },
  { iso2: 'SN', name: 'Senegal', dial: '221', nsnLengths: [9], groups: [2, 3, 2, 2] },
  { iso2: 'CI', name: "Côte d'Ivoire", dial: '225', nsnLengths: [10], groups: [2, 2, 2, 2, 2] },
  { iso2: 'CM', name: 'Cameroon', dial: '237', nsnLengths: [9], groups: [1, 2, 2, 2, 2] },
  { iso2: 'BJ', name: 'Benin', dial: '229', nsnLengths: [8, 10], groups: [2, 2, 2, 2] },
  { iso2: 'TG', name: 'Togo', dial: '228', nsnLengths: [8], groups: [2, 2, 2, 2] },
  { iso2: 'BF', name: 'Burkina Faso', dial: '226', nsnLengths: [8], groups: [2, 2, 2, 2] },
  { iso2: 'ML', name: 'Mali', dial: '223', nsnLengths: [8], groups: [2, 2, 2, 2] },
  { iso2: 'GN', name: 'Guinea', dial: '224', nsnLengths: [9], groups: [3, 3, 3] },
  { iso2: 'GA', name: 'Gabon', dial: '241', nsnLengths: [7, 8], trunkPrefix: '0', groups: [1, 2, 2, 2] },
  { iso2: 'AO', name: 'Angola', dial: '244', nsnLengths: [9], groups: [3, 3, 3] },
  { iso2: 'EG', name: 'Egypt', dial: '20', nsnLengths: [10], trunkPrefix: '0', groups: [3, 3, 4] },
  { iso2: 'MA', name: 'Morocco', dial: '212', nsnLengths: [9], trunkPrefix: '0', groups: [3, 2, 2, 2] },
  { iso2: 'DZ', name: 'Algeria', dial: '213', nsnLengths: [9], trunkPrefix: '0', groups: [3, 2, 2, 2] },
  { iso2: 'TN', name: 'Tunisia', dial: '216', nsnLengths: [8], groups: [2, 3, 3] },
  // Diaspora / booking origins
  { iso2: 'US', name: 'United States', dial: '1', nsnLengths: [10], groups: [3, 3, 4] },
  { iso2: 'CA', name: 'Canada', dial: '1', nsnLengths: [10], groups: [3, 3, 4] },
  { iso2: 'GB', name: 'United Kingdom', dial: '44', nsnLengths: [10], trunkPrefix: '0', groups: [4, 3, 3] },
  { iso2: 'FR', name: 'France', dial: '33', nsnLengths: [9], trunkPrefix: '0', groups: [1, 2, 2, 2, 2] },
  { iso2: 'BE', name: 'Belgium', dial: '32', nsnLengths: [8, 9], trunkPrefix: '0', groups: [3, 2, 2, 2] },
  { iso2: 'NL', name: 'Netherlands', dial: '31', nsnLengths: [9], trunkPrefix: '0', groups: [1, 4, 4] },
  { iso2: 'DE', name: 'Germany', dial: '49', nsnLengths: [10, 11], trunkPrefix: '0', groups: [3, 4, 4] },
  { iso2: 'CH', name: 'Switzerland', dial: '41', nsnLengths: [9], trunkPrefix: '0', groups: [2, 3, 2, 2] },
  { iso2: 'ES', name: 'Spain', dial: '34', nsnLengths: [9], groups: [3, 3, 3] },
  { iso2: 'IT', name: 'Italy', dial: '39', nsnLengths: [9, 10], groups: [3, 3, 4] },
  { iso2: 'PT', name: 'Portugal', dial: '351', nsnLengths: [9], groups: [3, 3, 3] },
  { iso2: 'SE', name: 'Sweden', dial: '46', nsnLengths: [7, 8, 9], trunkPrefix: '0', groups: [2, 3, 2, 2] },
  { iso2: 'NO', name: 'Norway', dial: '47', nsnLengths: [8], groups: [3, 2, 3] },
  { iso2: 'DK', name: 'Denmark', dial: '45', nsnLengths: [8], groups: [2, 2, 2, 2] },
  { iso2: 'IE', name: 'Ireland', dial: '353', nsnLengths: [9], trunkPrefix: '0', groups: [2, 3, 4] },
  { iso2: 'AU', name: 'Australia', dial: '61', nsnLengths: [9], trunkPrefix: '0', groups: [3, 3, 3] },
  { iso2: 'AE', name: 'United Arab Emirates', dial: '971', nsnLengths: [8, 9], trunkPrefix: '0', groups: [2, 3, 4] },
  { iso2: 'SA', name: 'Saudi Arabia', dial: '966', nsnLengths: [9], trunkPrefix: '0', groups: [2, 3, 4] },
  { iso2: 'QA', name: 'Qatar', dial: '974', nsnLengths: [8], groups: [4, 4] },
  { iso2: 'TR', name: 'Turkey', dial: '90', nsnLengths: [10], trunkPrefix: '0', groups: [3, 3, 2, 2] },
  { iso2: 'IN', name: 'India', dial: '91', nsnLengths: [10], trunkPrefix: '0', groups: [5, 5] },
  { iso2: 'CN', name: 'China', dial: '86', nsnLengths: [11], groups: [3, 4, 4] },
  { iso2: 'JP', name: 'Japan', dial: '81', nsnLengths: [10], trunkPrefix: '0', groups: [2, 4, 4] },
  { iso2: 'BR', name: 'Brazil', dial: '55', nsnLengths: [10, 11], trunkPrefix: '0', groups: [2, 5, 4] },
  // ── Rest of the world: dial codes with lenient (E.164-bounds) validation.
  // nsnLengths: [] means "no curated plan — accept 6-14 national digits".
  ...([
    ['AF', 'Afghanistan', '93'], ['AL', 'Albania', '355'], ['AM', 'Armenia', '374'],
    ['AR', 'Argentina', '54'], ['AT', 'Austria', '43'], ['AZ', 'Azerbaijan', '994'],
    ['BA', 'Bosnia & Herzegovina', '387'], ['BD', 'Bangladesh', '880'], ['BG', 'Bulgaria', '359'],
    ['BH', 'Bahrain', '973'], ['BO', 'Bolivia', '591'], ['BW', 'Botswana', '267'],
    ['BY', 'Belarus', '375'], ['BZ', 'Belize', '501'], ['CF', 'Central African Republic', '236'],
    ['CG', 'Congo-Brazzaville', '242'], ['CL', 'Chile', '56'], ['CO', 'Colombia', '57'],
    ['CR', 'Costa Rica', '506'], ['CU', 'Cuba', '53'], ['CV', 'Cape Verde', '238'],
    ['CY', 'Cyprus', '357'], ['CZ', 'Czechia', '420'], ['DJ', 'Djibouti', '253'],
    ['DO', 'Dominican Republic', '1809'], ['EC', 'Ecuador', '593'], ['EE', 'Estonia', '372'],
    ['ER', 'Eritrea', '291'], ['FI', 'Finland', '358'], ['FJ', 'Fiji', '679'],
    ['GE', 'Georgia', '995'], ['GM', 'Gambia', '220'], ['GQ', 'Equatorial Guinea', '240'],
    ['GR', 'Greece', '30'], ['GT', 'Guatemala', '502'], ['GW', 'Guinea-Bissau', '245'],
    ['GY', 'Guyana', '592'], ['HK', 'Hong Kong', '852'], ['HN', 'Honduras', '504'],
    ['HR', 'Croatia', '385'], ['HT', 'Haiti', '509'], ['HU', 'Hungary', '36'],
    ['ID', 'Indonesia', '62'], ['IL', 'Israel', '972'], ['IQ', 'Iraq', '964'],
    ['IR', 'Iran', '98'], ['IS', 'Iceland', '354'], ['JM', 'Jamaica', '1876'],
    ['JO', 'Jordan', '962'], ['KH', 'Cambodia', '855'], ['KM', 'Comoros', '269'],
    ['KP', 'North Korea', '850'], ['KR', 'South Korea', '82'], ['KW', 'Kuwait', '965'],
    ['KZ', 'Kazakhstan', '7'], ['LA', 'Laos', '856'], ['LB', 'Lebanon', '961'],
    ['LK', 'Sri Lanka', '94'], ['LR', 'Liberia', '231'], ['LS', 'Lesotho', '266'],
    ['LT', 'Lithuania', '370'], ['LU', 'Luxembourg', '352'], ['LV', 'Latvia', '371'],
    ['LY', 'Libya', '218'], ['MC', 'Monaco', '377'], ['MD', 'Moldova', '373'],
    ['ME', 'Montenegro', '382'], ['MG', 'Madagascar', '261'], ['MK', 'North Macedonia', '389'],
    ['MM', 'Myanmar', '95'], ['MN', 'Mongolia', '976'], ['MO', 'Macau', '853'],
    ['MR', 'Mauritania', '222'], ['MT', 'Malta', '356'], ['MU', 'Mauritius', '230'],
    ['MV', 'Maldives', '960'], ['MX', 'Mexico', '52'], ['MY', 'Malaysia', '60'],
    ['NA', 'Namibia', '264'], ['NE', 'Niger', '227'], ['NI', 'Nicaragua', '505'],
    ['NP', 'Nepal', '977'], ['NZ', 'New Zealand', '64'], ['OM', 'Oman', '968'],
    ['PA', 'Panama', '507'], ['PE', 'Peru', '51'], ['PG', 'Papua New Guinea', '675'],
    ['PH', 'Philippines', '63'], ['PK', 'Pakistan', '92'], ['PL', 'Poland', '48'],
    ['PS', 'Palestine', '970'], ['PY', 'Paraguay', '595'], ['RO', 'Romania', '40'],
    ['RS', 'Serbia', '381'], ['RU', 'Russia', '7'], ['SC', 'Seychelles', '248'],
    ['SD', 'Sudan', '249'], ['SG', 'Singapore', '65'], ['SI', 'Slovenia', '386'],
    ['SK', 'Slovakia', '421'], ['SL', 'Sierra Leone', '232'], ['SM', 'San Marino', '378'],
    ['SO', 'Somalia', '252'], ['SR', 'Suriname', '597'], ['SS', 'South Sudan', '211'],
    ['ST', 'São Tomé & Príncipe', '239'], ['SV', 'El Salvador', '503'], ['SY', 'Syria', '963'],
    ['SZ', 'Eswatini', '268'], ['TH', 'Thailand', '66'], ['TJ', 'Tajikistan', '992'],
    ['TL', 'Timor-Leste', '670'], ['TM', 'Turkmenistan', '993'], ['TT', 'Trinidad & Tobago', '1868'],
    ['TW', 'Taiwan', '886'], ['UA', 'Ukraine', '380'], ['UY', 'Uruguay', '598'],
    ['UZ', 'Uzbekistan', '998'], ['VE', 'Venezuela', '58'], ['VN', 'Vietnam', '84'],
    ['VU', 'Vanuatu', '678'], ['WS', 'Samoa', '685'], ['YE', 'Yemen', '967'],
  ] as [string, string, string][]).map(([iso2, name, dial]) => ({
    iso2,
    name,
    dial,
    nsnLengths: [] as number[],
    trunkPrefix: '0',
  })),
];

/** Lenient fallback for countries not in the table (E.164 bounds). */
export const FALLBACK_NSN_MIN = 6;
export const FALLBACK_NSN_MAX = 14;

const byIso2 = new Map(PHONE_COUNTRIES.map((c) => [c.iso2, c]));

export function phoneCountryFor(iso2: string | null | undefined): PhoneCountry | null {
  if (!iso2) return null;
  return byIso2.get(iso2.toUpperCase()) ?? null;
}

/** Digits only. */
export function onlyDigits(raw: string): string {
  return (raw || '').replace(/\D+/g, '');
}

/**
 * Longest-prefix dial-code match. US/CA share "1" — US wins the ambiguity
 * (first in table order); an explicit country pick always overrides.
 * `preferIso2` breaks dial-code ties (so a CA user editing their number
 * doesn't get flipped to US).
 */
export function matchDialCode(digits: string, preferIso2?: string | null): PhoneCountry | null {
  let best: PhoneCountry | null = null;
  for (const c of PHONE_COUNTRIES) {
    if (digits.startsWith(c.dial)) {
      if (!best || c.dial.length > best.dial.length) best = c;
      else if (c.dial.length === best.dial.length && preferIso2 && c.iso2 === preferIso2.toUpperCase()) {
        best = c;
      }
    }
  }
  return best;
}

export interface ParsedPhone {
  /** Detected or assumed country (null = unknown international prefix). */
  country: PhoneCountry | null;
  /** National significant number (digits, trunk prefix removed). */
  nsn: string;
  /** +<dial><nsn> when a country is known, else null. */
  e164: string | null;
  isValid: boolean;
  /** Human-readable validity hint ('' when valid or empty). */
  hint: string;
}

export function validateNsn(country: PhoneCountry | null, nsn: string): { isValid: boolean; hint: string } {
  if (!nsn) return { isValid: false, hint: '' };
  if (!country || country.nsnLengths.length === 0) {
    const ok = nsn.length >= FALLBACK_NSN_MIN && nsn.length <= FALLBACK_NSN_MAX;
    return { isValid: ok, hint: ok ? '' : 'Enter a valid phone number' };
  }
  if (country.nsnLengths.includes(nsn.length)) return { isValid: true, hint: '' };
  const expected = [...country.nsnLengths].sort((a, b) => a - b);
  const max = expected[expected.length - 1];
  if (nsn.length < expected[0]) {
    return { isValid: false, hint: `${country.name} numbers have ${expected.join(' or ')} digits` };
  }
  if (nsn.length > max) {
    return { isValid: false, hint: `Too long for ${country.name} (${expected.join(' or ')} digits)` };
  }
  return { isValid: false, hint: `${country.name} numbers have ${expected.join(' or ')} digits` };
}

/**
 * Parse anything a user may type or paste:
 *  - "+250 788 123 456" / "00250788123456"  → international, detect country
 *  - "0788 123 456" (with fallback country) → trunk-prefixed national
 *  - "788123456"    (with fallback country) → bare national
 * When international digits are present, detection IGNORES the fallback
 * country except to break dial-code ties — this is what makes deleting or
 * editing the dial code re-detect the country.
 */
export function parsePhone(raw: string, fallbackIso2?: string | null): ParsedPhone {
  const trimmed = (raw || '').trim();
  const fallback = phoneCountryFor(fallbackIso2);
  const hasPlus = trimmed.startsWith('+');
  let digits = onlyDigits(trimmed);
  let international = hasPlus;
  if (!hasPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (international) {
    const country = matchDialCode(digits, fallbackIso2);
    const nsnRaw = country ? digits.slice(country.dial.length) : digits;
    // Users habitually keep the trunk 0 after the dial code (+250 0788…) —
    // strip it so validation/E.164 stay correct.
    const nsn = country?.trunkPrefix && nsnRaw.startsWith(country.trunkPrefix)
      ? nsnRaw.slice(country.trunkPrefix.length)
      : nsnRaw;
    const { isValid, hint } = validateNsn(country, nsn);
    return {
      country,
      nsn,
      e164: country && nsn ? `+${country.dial}${nsn}` : null,
      isValid: !!country && isValid,
      hint: country ? hint : (digits ? 'Unknown country code' : ''),
    };
  }

  // National entry against the fallback country
  const nsn = fallback?.trunkPrefix && digits.startsWith(fallback.trunkPrefix)
    ? digits.slice(fallback.trunkPrefix.length)
    : digits;
  const { isValid, hint } = validateNsn(fallback, nsn);
  return {
    country: fallback,
    nsn,
    e164: fallback && nsn ? `+${fallback.dial}${nsn}` : null,
    isValid: !!fallback && isValid,
    hint,
  };
}

/** "788 123 456" using the country's display grouping. */
export function formatNsn(country: PhoneCountry | null, nsn: string): string {
  if (!nsn) return '';
  const groups = country?.groups;
  if (!groups || groups.length === 0) return nsn.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= nsn.length) break;
    out.push(nsn.slice(i, i + g));
    i += g;
  }
  if (i < nsn.length) out.push(nsn.slice(i));
  return out.join(' ');
}

/** "+250 788 123 456" */
export function formatInternational(country: PhoneCountry, nsn: string): string {
  return `+${country.dial}${nsn ? ' ' + formatNsn(country, nsn) : ''}`;
}

export function nsnMaxLen(country: PhoneCountry | null): number {
  if (!country || country.nsnLengths.length === 0) return FALLBACK_NSN_MAX;
  return Math.max(...country.nsnLengths);
}

/**
 * Submission adapters — call sites keep sending whatever their backend
 * consumer already expects, only the UX layer is new:
 *  - 'national0': trunk-prefixed national digits ("0788123456") — what the
 *    payment gateways' normalizers and existing flows were receiving.
 *  - 'e164':      "+250788123456"
 *  - 'digits':    "250788123456"
 */
export function toSubmitFormat(p: ParsedPhone, mode: 'national0' | 'e164' | 'digits'): string {
  if (!p.country || !p.nsn) return p.nsn;
  switch (mode) {
    case 'national0':
      return `${p.country.trunkPrefix ?? ''}${p.nsn}`;
    case 'e164':
      return `+${p.country.dial}${p.nsn}`;
    case 'digits':
      return `${p.country.dial}${p.nsn}`;
  }
}
