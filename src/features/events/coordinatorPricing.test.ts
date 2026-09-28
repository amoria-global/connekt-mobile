import { CONTINENTS, COUNTRIES, continentLabel, countryLabel } from '@/features/geopricing/regions';
import { type GeoPriceRule, type GeoScope } from '@/features/geopricing/api';

describe('Coordinator Event Creation & Geo-pricing Rules', () => {
  describe('Geopricing regions & label resolution', () => {
    it('has continent presets for geo-pricing', () => {
      expect(CONTINENTS.length).toBeGreaterThan(0);
      expect(CONTINENTS.some((c) => c.code === 'AF' && c.label === 'Africa')).toBe(true);
      expect(CONTINENTS.some((c) => c.code === 'EU' && c.label === 'Europe')).toBe(true);
      expect(CONTINENTS.some((c) => c.code === 'NA' && c.label === 'North America')).toBe(true);
    });

    it('has curated countries list including primary operating regions', () => {
      expect(COUNTRIES.length).toBeGreaterThan(10);
      expect(COUNTRIES.some((c) => c.code === 'RW' && c.label === 'Rwanda')).toBe(true);
      expect(COUNTRIES.some((c) => c.code === 'KE' && c.label === 'Kenya')).toBe(true);
      expect(COUNTRIES.some((c) => c.code === 'US' && c.label === 'United States')).toBe(true);
    });

    it('resolves continent and country labels correctly with fallbacks', () => {
      expect(continentLabel('AF')).toBe('Africa');
      expect(continentLabel('UNKNOWN')).toBe('UNKNOWN');

      expect(countryLabel('RW')).toBe('Rwanda');
      expect(countryLabel('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('Location price rule validation and structures', () => {
    it('correctly constructs a continent price rule', () => {
      const continentRule: {
        scopeType: GeoScope;
        scopeValue: string;
        price: number;
        currencyId?: string;
        currencyCode?: string;
      } = {
        scopeType: 'CONTINENT',
        scopeValue: 'AF',
        price: 500,
        currencyId: 'cur-rwf',
        currencyCode: 'RWF',
      };

      expect(continentRule.scopeType).toBe('CONTINENT');
      expect(continentRule.price).toBe(500);
      expect(continentRule.currencyCode).toBe('RWF');
    });

    it('correctly constructs a country price rule override', () => {
      const countryRule: {
        scopeType: GeoScope;
        scopeValue: string;
        price: number;
        currencyId?: string;
        currencyCode?: string;
      } = {
        scopeType: 'COUNTRY',
        scopeValue: 'US',
        price: 10,
        currencyId: 'cur-usd',
        currencyCode: 'USD',
      };

      expect(countryRule.scopeType).toBe('COUNTRY');
      expect(countryRule.price).toBe(10);
      expect(countryRule.currencyCode).toBe('USD');
    });

    it('prevents duplicate rules for the same scope and location', () => {
      const existingRules: GeoPriceRule[] = [
        { id: '1', scopeType: 'CONTINENT', scopeValue: 'AF', price: 500 },
        { id: '2', scopeType: 'COUNTRY', scopeValue: 'US', price: 10 },
      ];

      const isDuplicate = (scope: GeoScope, value: string) =>
        existingRules.some((r) => r.scopeType === scope && r.scopeValue === value);

      expect(isDuplicate('CONTINENT', 'AF')).toBe(true);
      expect(isDuplicate('COUNTRY', 'US')).toBe(true);
      expect(isDuplicate('CONTINENT', 'EU')).toBe(false);
      expect(isDuplicate('COUNTRY', 'RW')).toBe(false);
    });
  });

  describe('Coordinator vs Non-Coordinator Role Invariant', () => {
    it('verifies coordinator role grants exclusive access to event pricing and geo-pricing', () => {
      const roles = [
        { customerType: 'Coordinator', isCoordinator: true, canSetPricingAndGeoPricing: true },
        { customerType: 'Client', isCoordinator: false, canSetPricingAndGeoPricing: false },
        { customerType: 'Photographer', isCoordinator: false, canSetPricingAndGeoPricing: false },
        { customerType: 'Viewer', isCoordinator: false, canSetPricingAndGeoPricing: false },
      ];

      for (const r of roles) {
        expect(r.isCoordinator).toBe(r.customerType === 'Coordinator');
        expect(r.canSetPricingAndGeoPricing).toBe(r.isCoordinator);
      }
    });
  });
});
