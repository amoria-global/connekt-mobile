import { hasOptionLists } from './api';

jest.mock('@/api/client', () => ({ api: { get: jest.fn() }, assertOk: jest.fn() }));

describe('hasOptionLists', () => {
  const full = {
    eventTypes: [],
    cities: [],
    budgetPresets: [],
    photographerTypes: [],
    photographerSpecialties: [],
    coverageOptions: [],
    matchWindowHours: [],
  };
  it('accepts a body that has every list the wizard reads', () => {
    expect(hasOptionLists(full)).toBe(true);
  });
  it('rejects the bodies that used to crash the wizard on the first .find', () => {
    expect(hasOptionLists([])).toBe(false);
    expect(hasOptionLists(null)).toBe(false);
    expect(hasOptionLists(undefined)).toBe(false);
    expect(hasOptionLists({})).toBe(false);
    expect(hasOptionLists({ ...full, cities: undefined })).toBe(false);
    expect(hasOptionLists({ ...full, eventTypes: 'wedding' })).toBe(false);
  });
});
