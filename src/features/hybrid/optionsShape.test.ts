import { hasOptionLists } from './api';
import { DEFAULT_OFFER_DRAFT } from './offerBrief';
import { analyzePackagesForDraft } from './packagePricingAnalyzer';
import {
  LEGACY_STUDIO_INDOOR_TEXT,
  extractPoliciesFromBrochureText,
  normalizePackageAddons,
} from '@/features/packages/api';

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

describe('Policies & Self-Priced Add-ons (Drone Capturing amount toggle)', () => {
  it('toggles Drone Capturing ON when amount > 0 and OFF when amount is 0 or empty', () => {
    const enabledList = normalizePackageAddons([], 150000, 'RWF');
    const droneOn = enabledList.find((a) => a.key === 'drone_capturing');
    expect(droneOn?.enabled).toBe(true);
    expect(droneOn?.price).toBe(150000);

    const disabledList = normalizePackageAddons([], 0, 'RWF');
    const droneOff = disabledList.find((a) => a.key === 'drone_capturing');
    expect(droneOff?.enabled).toBe(false);
    expect(droneOff?.price).toBe(0);
  });

  it('reads delivery policy and advance scheduling policy from menu brochure text', () => {
    const parsed = extractPoliciesFromBrochureText(LEGACY_STUDIO_INDOOR_TEXT);
    expect(parsed.deliveryPolicy).toContain('2,500 RWF per photo');
    expect(parsed.otherPolicies.length).toBeGreaterThan(0);
  });

  it('includes best 3 self-priced Drone Capturing packages in booking pricing recommendation when selected', () => {
    const res = analyzePackagesForDraft(
      { ...DEFAULT_OFFER_DRAFT, droneCapturing: true },
      480,
      [],
      'RWF',
    );
    const droneItem = res.selectedItemsAnalysis.find((i) => i.itemKey === 'DRONE_CAPTURING');
    expect(droneItem).toBeDefined();
    expect(droneItem?.bestThreePackages).toHaveLength(3);
    expect(droneItem?.averagePrice).toBeGreaterThan(0);
  });
});
