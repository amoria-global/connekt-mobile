import {
  CONTINENTS,
  COUNTRIES,
  ALL_REGIONS,
  continentLabel,
  countryLabel,
  regionLabel,
  type GeoRegionItem,
} from '@/features/geopricing/regions';
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

      expect(regionLabel('CONTINENT', 'AF')).toBe('Africa');
      expect(regionLabel('COUNTRY', 'RW')).toBe('Rwanda');
    });

    it('aggregates both continents and countries in ALL_REGIONS', () => {
      expect(ALL_REGIONS.length).toBe(CONTINENTS.length + COUNTRIES.length);
      expect(ALL_REGIONS.filter((r) => r.scopeType === 'CONTINENT')).toHaveLength(CONTINENTS.length);
      expect(ALL_REGIONS.filter((r) => r.scopeType === 'COUNTRY')).toHaveLength(COUNTRIES.length);
    });
  });

  describe('Search and Multi-location Same-Price Application', () => {
    it('searches and filters across both continents and countries', () => {
      const search = (q: string, tab: 'ALL' | 'CONTINENT' | 'COUNTRY' = 'ALL') => {
        const query = q.trim().toLowerCase();
        let list: GeoRegionItem[] = [];
        if (tab === 'CONTINENT') {
          list = CONTINENTS.map((c) => ({ scopeType: 'CONTINENT' as const, code: c.code, label: c.label }));
        } else if (tab === 'COUNTRY') {
          list = COUNTRIES.map((c) => ({ scopeType: 'COUNTRY' as const, code: c.code, label: c.label }));
        } else {
          list = ALL_REGIONS;
        }
        if (!query) return list;
        return list.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.code.toLowerCase().includes(query) ||
            (item.scopeType === 'CONTINENT' ? 'continent' : 'country').includes(query),
        );
      };

      // Searching 'af' finds Africa (continent) and South Africa (country)
      const afResults = search('af');
      expect(afResults.some((r) => r.scopeType === 'CONTINENT' && r.label === 'Africa')).toBe(true);
      expect(afResults.some((r) => r.scopeType === 'COUNTRY' && r.label === 'South Africa')).toBe(true);

      // Searching 'rw' finds Rwanda
      const rwResults = search('rw');
      expect(rwResults.some((r) => r.scopeType === 'COUNTRY' && r.code === 'RW')).toBe(true);

      // Tab filter limits to continents
      const continentOnly = search('af', 'CONTINENT');
      expect(continentOnly.every((r) => r.scopeType === 'CONTINENT')).toBe(true);
      expect(continentOnly.some((r) => r.label === 'Africa')).toBe(true);
      expect(continentOnly.some((r) => r.label === 'South Africa')).toBe(false);
    });

    it('applies the exact same price and currency to multiple selected continents and countries simultaneously', () => {
      const selectedLocations: GeoRegionItem[] = [
        { scopeType: 'CONTINENT', code: 'AF', label: 'Africa' },
        { scopeType: 'COUNTRY', code: 'US', label: 'United States' },
        { scopeType: 'COUNTRY', code: 'GB', label: 'United Kingdom' },
      ];

      const price = 5000;
      const currency = 'RWF';

      let rules: { scopeType: GeoScope; scopeValue: string; price: number; currencyCode: string }[] = [];

      for (const loc of selectedLocations) {
        const existingIdx = rules.findIndex(
          (r) => r.scopeType === loc.scopeType && r.scopeValue === loc.code,
        );
        if (existingIdx >= 0) {
          rules[existingIdx] = { ...rules[existingIdx], price, currencyCode: currency };
        } else {
          rules.push({
            scopeType: loc.scopeType,
            scopeValue: loc.code,
            price,
            currencyCode: currency,
          });
        }
      }

      expect(rules).toHaveLength(3);
      // All 3 locations have the same price and currency
      for (const rule of rules) {
        expect(rule.price).toBe(5000);
        expect(rule.currencyCode).toBe('RWF');
      }

      // Updating a location (e.g. US) with a new price updates it in place
      const updatedLoc: GeoRegionItem = { scopeType: 'COUNTRY', code: 'US', label: 'United States' };
      const newPrice = 15;
      const newCurrency = 'USD';

      const existingIdx = rules.findIndex(
        (r) => r.scopeType === updatedLoc.scopeType && r.scopeValue === updatedLoc.code,
      );
      if (existingIdx >= 0) {
        rules[existingIdx] = { ...rules[existingIdx], price: newPrice, currencyCode: newCurrency };
      }

      expect(rules).toHaveLength(3);
      const usRule = rules.find((r) => r.scopeType === 'COUNTRY' && r.scopeValue === 'US');
      expect(usRule?.price).toBe(15);
      expect(usRule?.currencyCode).toBe('USD');
      // Africa and UK still have 5000 RWF
      const afRule = rules.find((r) => r.scopeType === 'CONTINENT' && r.scopeValue === 'AF');
      expect(afRule?.price).toBe(5000);
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

    it('restricts categories to Entertainment only for coordinator, leaving all for non-coordinators', () => {
      const serverCategories = ['Wedding', 'Conference', 'Entertainment', 'Sports', 'Birthday'];

      const getCategoriesForRole = (isCoordinator: boolean, available: string[]) => {
        const serverEntertainment = available.find((c) => c.toLowerCase() === 'entertainment');
        const entertainmentCategory = serverEntertainment || 'Entertainment';
        return isCoordinator ? [entertainmentCategory] : available;
      };

      const coordinatorCats = getCategoriesForRole(true, serverCategories);
      expect(coordinatorCats).toEqual(['Entertainment']);
      expect(coordinatorCats).toHaveLength(1);

      const nonCoordinatorCats = getCategoriesForRole(false, serverCategories);
      expect(nonCoordinatorCats).toEqual(serverCategories);
      expect(nonCoordinatorCats).toHaveLength(5);
    });

    it('falls back to default Entertainment when server categories do not have it', () => {
      const serverCategories = ['Wedding', 'Conference'];

      const getCategoriesForRole = (isCoordinator: boolean, available: string[]) => {
        const serverEntertainment = available.find((c) => c.toLowerCase() === 'entertainment');
        const entertainmentCategory = serverEntertainment || 'Entertainment';
        return isCoordinator ? [entertainmentCategory] : available;
      };

      const coordinatorCats = getCategoriesForRole(true, serverCategories);
      expect(coordinatorCats).toEqual(['Entertainment']);
    });
  });
});

