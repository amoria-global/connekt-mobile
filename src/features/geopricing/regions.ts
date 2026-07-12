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
];

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}

export function continentLabel(code: string): string {
  return CONTINENTS.find((c) => c.code === code)?.label ?? code;
}
