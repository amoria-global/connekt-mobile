/**
 * Countries the payment gateway can serve, mirrored from the web checkout's
 * supported list (knockout lib/payments/supportedCountries) so the country
 * selector offers the same choices on every platform.
 */
export type PaymentCountry = { iso2: string; name: string; dial: string };

export const PAYMENT_COUNTRY_LIST: PaymentCountry[] = [
  { iso2: 'RW', name: 'Rwanda', dial: '250' },
  { iso2: 'KE', name: 'Kenya', dial: '254' },
  { iso2: 'UG', name: 'Uganda', dial: '256' },
  { iso2: 'TZ', name: 'Tanzania', dial: '255' },
  { iso2: 'ZM', name: 'Zambia', dial: '260' },
  { iso2: 'GH', name: 'Ghana', dial: '233' },
  { iso2: 'NG', name: 'Nigeria', dial: '234' },
  { iso2: 'MW', name: 'Malawi', dial: '265' },
  { iso2: 'BJ', name: 'Benin', dial: '229' },
  { iso2: 'BF', name: 'Burkina Faso', dial: '226' },
  { iso2: 'CM', name: 'Cameroon', dial: '237' },
  { iso2: 'CD', name: 'DR Congo', dial: '243' },
  { iso2: 'CG', name: 'Congo', dial: '242' },
  { iso2: 'CI', name: "Côte d'Ivoire", dial: '225' },
  { iso2: 'ET', name: 'Ethiopia', dial: '251' },
  { iso2: 'GA', name: 'Gabon', dial: '241' },
  { iso2: 'LS', name: 'Lesotho', dial: '266' },
  { iso2: 'MZ', name: 'Mozambique', dial: '258' },
  { iso2: 'SN', name: 'Senegal', dial: '221' },
  { iso2: 'SL', name: 'Sierra Leone', dial: '232' },
];

export function paymentCountryName(iso2: string | null | undefined): string {
  const up = (iso2 || '').toUpperCase();
  return PAYMENT_COUNTRY_LIST.find((c) => c.iso2 === up)?.name ?? up;
}
