/**
 * Region catalog for the geo-pricing manager: continent presets plus a
 * curated country list. Owners price by continent (Africa, Asia, …) or by
 * specific country; anything not covered falls back to the event's default.
 */
export type Continent = { code: string; label: string };
export type Country = { code: string; label: string };

export const CONTINENTS: Continent[] = [
  { code: 'AF', label: 'Africa' },
  { code: 'AS', label: 'Asia' },
  { code: 'EU', label: 'Europe' },
  { code: 'NA', label: 'North America' },
  { code: 'SA', label: 'South America' },
  { code: 'OC', label: 'Oceania' },
];

// Curated, commonly-relevant countries. Owners can price any of these
// specifically; everyone else gets the matching continent or the default.
export const COUNTRIES: Country[] = [
  { code: 'RW', label: 'Rwanda' },
  { code: 'KE', label: 'Kenya' },
  { code: 'UG', label: 'Uganda' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'BI', label: 'Burundi' },
  { code: 'CD', label: 'DR Congo' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'GH', label: 'Ghana' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'ET', label: 'Ethiopia' },
  { code: 'EG', label: 'Egypt' },
  { code: 'MA', label: 'Morocco' },
  { code: 'SN', label: 'Senegal' },
  { code: 'CI', label: "Côte d'Ivoire" },
  { code: 'CM', label: 'Cameroon' },
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'BE', label: 'Belgium' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'IT', label: 'Italy' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'IE', label: 'Ireland' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'QA', label: 'Qatar' },
  { code: 'IN', label: 'India' },
  { code: 'CN', label: 'China' },
  { code: 'JP', label: 'Japan' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
  { code: 'ZM', label: 'Zambia' },
  { code: 'ZW', label: 'Zimbabwe' },
  { code: 'MW', label: 'Malawi' },
  { code: 'MZ', label: 'Mozambique' },
  { code: 'BJ', label: 'Benin' },
  { code: 'TG', label: 'Togo' },
  { code: 'BF', label: 'Burkina Faso' },
  { code: 'ML', label: 'Mali' },
  { code: 'GN', label: 'Guinea' },
  { code: 'GA', label: 'Gabon' },
  { code: 'AO', label: 'Angola' },
  { code: 'DZ', label: 'Algeria' },
  { code: 'TN', label: 'Tunisia' },
  { code: 'PT', label: 'Portugal' },
  { code: 'NO', label: 'Norway' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'PL', label: 'Poland' },
  { code: 'AT', label: 'Austria' },
  { code: 'TR', label: 'Turkey' },
  { code: 'KR', label: 'South Korea' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
];

export type GeoRegionItem = {
  scopeType: 'CONTINENT' | 'COUNTRY';
  code: string;
  label: string;
};

export const ALL_REGIONS: GeoRegionItem[] = [
  ...CONTINENTS.map((c) => ({ scopeType: 'CONTINENT' as const, code: c.code, label: c.label })),
  ...COUNTRIES.map((c) => ({ scopeType: 'COUNTRY' as const, code: c.code, label: c.label })),
];

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}

export function continentLabel(code: string): string {
  return CONTINENTS.find((c) => c.code === code)?.label ?? code;
}

export function regionLabel(scope: 'CONTINENT' | 'COUNTRY', code: string): string {
  return scope === 'CONTINENT' ? continentLabel(code) : countryLabel(code);
}
