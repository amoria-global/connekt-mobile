import {
  EMPTY_DRAFT,
  describeRule,
  draftProblem,
  hasOpenDraft,
  parsePrice,
  ruleErrorIndex,
  ruleFromDraft,
  ruleKey,
  searchLocations,
  sortRules,
  summarize,
  toPayload,
  type GeoLocation,
  type LocationRule,
} from './locationRules';

const KE: GeoLocation = { scopeType: 'COUNTRY', code: 'KE', name: 'Kenya', continentName: 'Africa' };
const FR: GeoLocation = { scopeType: 'COUNTRY', code: 'FR', name: 'France', continentName: 'Europe' };
const NA_COUNTRY: GeoLocation = { scopeType: 'COUNTRY', code: 'NA', name: 'Namibia', continentName: 'Africa' };
const NA_CONT: GeoLocation = { scopeType: 'CONTINENT', code: 'NA', name: 'North America' };
const EU: GeoLocation = { scopeType: 'CONTINENT', code: 'EU', name: 'Europe', countryCount: 51 };
const ALL = [KE, FR, NA_COUNTRY, NA_CONT, EU];

const priceRule = (loc: GeoLocation, price: number): LocationRule => ({
  key: ruleKey(loc.scopeType, loc.code),
  scopeType: loc.scopeType,
  scopeValue: loc.code,
  label: loc.name,
  action: 'PRICE',
  price,
  currencyId: 'cur-rwf',
  currencyCode: 'RWF',
});
const blockRule = (loc: GeoLocation): LocationRule => ({
  key: ruleKey(loc.scopeType, loc.code),
  scopeType: loc.scopeType,
  scopeValue: loc.code,
  label: loc.name,
  action: 'BLOCK',
});

describe('location rules', () => {
  it('keys a place by type and code, so the same code as a country and a continent are two places', () => {
    expect(ruleKey('COUNTRY', 'NA')).not.toBe(ruleKey('CONTINENT', 'NA'));
    expect(ruleKey('COUNTRY', 'ke')).toBe('COUNTRY:KE');
  });

  it('parses a typed price and refuses nonsense', () => {
    expect(parsePrice('1,500')).toBe(1500);
    expect(parsePrice('0')).toBe(0);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('-3')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
  });

  it('will not add a rule with no place, a missing price or currency, or a place that already has one', () => {
    expect(draftProblem(EMPTY_DRAFT, [])).toMatch(/Choose a country or continent/);
    expect(draftProblem({ ...EMPTY_DRAFT, location: KE, priceText: '' , currencyId: 'c'}, [])).toMatch(/price/);
    expect(draftProblem({ ...EMPTY_DRAFT, location: KE, priceText: '150' }, [])).toMatch(/currency/);
    expect(draftProblem({ ...EMPTY_DRAFT, location: KE, priceText: '150', currencyId: 'c' }, [])).toBeNull();
    expect(draftProblem({ ...EMPTY_DRAFT, location: KE, priceText: '150', currencyId: 'c' }, [priceRule(KE, 100)])).toMatch(
      /already has a rule/,
    );
  });

  it('a block needs no price or currency', () => {
    const draft = { ...EMPTY_DRAFT, location: FR, action: 'BLOCK' as const };
    expect(draftProblem(draft, [])).toBeNull();
    const rule = ruleFromDraft(draft, []);
    expect(rule).toMatchObject({ action: 'BLOCK', scopeValue: 'FR' });
    expect(rule?.price).toBeUndefined();
  });

  it('builds a price rule from a valid draft and none from an invalid one', () => {
    const ok = ruleFromDraft({ location: KE, action: 'PRICE', priceText: '150', currencyId: 'cur-rwf', currencyCode: 'RWF' }, []);
    expect(ok).toMatchObject({ action: 'PRICE', price: 150, currencyCode: 'RWF', label: 'Kenya' });
    expect(ruleFromDraft(EMPTY_DRAFT, [])).toBeNull();
  });

  it('the payload carries a price for a price rule and none for a block', () => {
    expect(toPayload([priceRule(KE, 150), blockRule(FR)])).toEqual([
      { scopeType: 'COUNTRY', scopeValue: 'KE', action: 'PRICE', price: 150, currencyId: 'cur-rwf' },
      { scopeType: 'COUNTRY', scopeValue: 'FR', action: 'BLOCK' },
    ]);
    expect(toPayload([])).toEqual([]);
  });

  it('summarises the field for the collapsed line', () => {
    expect(summarize([])).toBe('Same price everywhere');
    expect(summarize([priceRule(KE, 1)])).toBe('1 price');
    expect(summarize([priceRule(KE, 1), priceRule(EU, 2), blockRule(FR)])).toBe('2 prices, 1 blocked place');
    expect(summarize([blockRule(FR), blockRule(EU)])).toBe('2 blocked places');
  });

  it('describes a row without dashes', () => {
    expect(describeRule(priceRule(KE, 1500))).toBe('Kenya, RWF 1,500');
    expect(describeRule(blockRule(FR))).toBe('France, Blocked');
    expect(describeRule(priceRule(KE, 1500)) + describeRule(blockRule(FR))).not.toMatch(/[–—]/);
  });

  it('lists countries before continents, each A to Z', () => {
    const sorted = sortRules([priceRule(EU, 1), blockRule(KE), priceRule(FR, 3), blockRule(NA_CONT)]);
    expect(sorted.map((r) => r.label)).toEqual(['France', 'Kenya', 'Europe', 'North America']);
  });

  it('knows when the new-rule row is open', () => {
    expect(hasOpenDraft(null)).toBe(false);
    expect(hasOpenDraft(EMPTY_DRAFT)).toBe(false);
    expect(hasOpenDraft({ ...EMPTY_DRAFT, priceText: '5' })).toBe(true);
    expect(hasOpenDraft({ ...EMPTY_DRAFT, location: KE })).toBe(true);
  });

  describe('search', () => {
    it('finds by name or code, countries and continents together, best match first', () => {
      expect(searchLocations(ALL, 'ke', []).map((l) => l.code)).toEqual(['KE']);
      // "na" is the exact code of Namibia and of North America, and starts both names
      expect(searchLocations(ALL, 'na', []).map((l) => l.name)).toEqual(['Namibia', 'North America']);
    });

    it('puts a name that starts with the query before one that only contains it', () => {
      const out = searchLocations(ALL, 'eu', []).map((l) => l.name);
      expect(out[0]).toBe('Europe');
    });

    it('hides places that already have a rule, per type', () => {
      const out = searchLocations(ALL, 'na', [blockRule(NA_CONT)]).map((l) => `${l.scopeType}:${l.code}`);
      expect(out).toContain('COUNTRY:NA');
      expect(out).not.toContain('CONTINENT:NA');
    });

    it('with no query lists what is still open, capped', () => {
      expect(searchLocations(ALL, '', [priceRule(KE, 1)]).map((l) => l.code)).not.toContain('KE');
      expect(searchLocations(ALL, '', [], 2)).toHaveLength(2);
    });
  });

  it('reads a server field error back to the rule it belongs to', () => {
    expect(ruleErrorIndex('geoRules[2].price')).toEqual({ index: 2, part: 'price' });
    expect(ruleErrorIndex('geoRules[0].scopeValue')).toEqual({ index: 0, part: 'scopeValue' });
    expect(ruleErrorIndex('title')).toBeNull();
    expect(ruleErrorIndex(undefined)).toBeNull();
  });
});
