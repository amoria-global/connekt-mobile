import { api } from '@/api/client';
import {
  applyPackageTierNamingPolicy,
  deletePackage,
  extractPackagesFromTextLocally,
  LEGACY_STUDIO_CEREMONY_TEXT,
  LEGACY_STUDIO_INDOOR_TEXT,
  LEGACY_STUDIO_WEDDING_TEXT,
  listPackages,
  POLICY_PACKAGE_TIERS,
  type ExtractedAiPackageDraft,
} from './api';

describe('AI Package Extraction & Tier Naming Policy', () => {
  it('enforces Connekyt Tier Naming Policy so the highest-amount package in each session is always Diamond', () => {
    const drafts: ExtractedAiPackageDraft[] = [
      {
        tempId: 'in-1',
        packageName: 'Starter Studio',
        originalTitle: 'Starter Studio',
        serviceType: 'STUDIO',
        price: 150000,
        currencyCode: 'RWF',
        priceUnit: 'session',
        durationHours: 1,
        includedPhotos: 25,
        includedVideos: 0,
        hasLiveStream: false,
        deliveryDays: 2,
        deliveryPolicy: 'Delivery in 2 days',
        originalDescription: '1 hour studio session',
        enhancedDescription: 'Professional 1 hour studio session',
        ingredients: ['1 hour studio session', '25 edited photos'],
      },
      {
        tempId: 'in-2',
        packageName: 'Executive Portrait',
        originalTitle: 'Executive Portrait',
        serviceType: 'STUDIO',
        price: 450000,
        currencyCode: 'RWF',
        priceUnit: 'session',
        durationHours: 3,
        includedPhotos: 80,
        includedVideos: 1,
        hasLiveStream: false,
        deliveryDays: 3,
        deliveryPolicy: 'Delivery in 3 days',
        originalDescription: '3 hours studio session',
        enhancedDescription: 'Professional 3 hours studio session',
        ingredients: ['3 hours studio session', '80 edited photos', '1 reel video'],
      },
      {
        tempId: 'in-3',
        packageName: 'Middle Studio',
        originalTitle: 'Middle Studio',
        serviceType: 'STUDIO',
        price: 300000,
        currencyCode: 'RWF',
        priceUnit: 'session',
        durationHours: 2,
        includedPhotos: 50,
        includedVideos: 0,
        hasLiveStream: false,
        deliveryDays: 3,
        deliveryPolicy: 'Delivery in 3 days',
        originalDescription: '2 hours studio session',
        enhancedDescription: 'Professional 2 hours studio session',
        ingredients: ['2 hours studio session', '50 edited photos'],
      },
      {
        tempId: 'out-1',
        packageName: 'Garden Event',
        originalTitle: 'Garden Event',
        serviceType: 'OUTDOOR',
        price: 600000,
        currencyCode: 'RWF',
        priceUnit: 'event',
        durationHours: 6,
        includedPhotos: 200,
        includedVideos: 1,
        hasLiveStream: false,
        deliveryDays: 5,
        deliveryPolicy: 'Delivery in 5 days',
        originalDescription: '6 hours outdoor coverage',
        enhancedDescription: 'Professional 6 hours outdoor coverage',
        ingredients: ['6 hours outdoor coverage', '200 edited photos'],
      },
      {
        tempId: 'out-2',
        packageName: 'Royal Wedding Full Day',
        originalTitle: 'Royal Wedding Full Day',
        serviceType: 'OUTDOOR',
        price: 1500000,
        currencyCode: 'RWF',
        priceUnit: 'event',
        durationHours: 10,
        includedPhotos: 500,
        includedVideos: 2,
        hasLiveStream: true,
        deliveryDays: 7,
        deliveryPolicy: 'Delivery within 7 days',
        originalDescription: 'Full wedding coverage',
        enhancedDescription: 'Complete outdoor wedding coverage',
        ingredients: ['10 hours coverage', '500 edited photos', '2 highlight videos', 'Live stream'],
      },
    ];

    const normalized = applyPackageTierNamingPolicy(drafts);

    const studio = normalized.filter((p) => p.serviceType === 'STUDIO');
    const outdoor = normalized.filter((p) => p.serviceType === 'OUTDOOR');

    expect(studio.map((p) => p.price)).toEqual([450000, 300000, 150000]);
    expect(studio.map((p) => p.packageName)).toEqual(['Diamond', 'Gold', 'Silver']);

    expect(outdoor.map((p) => p.price)).toEqual([1500000, 600000]);
    expect(outdoor.map((p) => p.packageName)).toEqual(['Diamond', 'Gold']);
    expect(POLICY_PACKAGE_TIERS).toEqual(['Diamond', 'Gold', 'Silver', 'Premium', 'Basic']);
  });

  it('extracts Indoor (STUDIO) and Outdoor (OUTDOOR) packages, ingredients, delivery policy, and money from brochure text', () => {
    const brochure = `
Studio Portrait Session - 300,000 RWF
- 2 hours studio session
- 1 photographer
- 50 edited photos
- Delivery in 3 days

Studio Mini Portrait - 150,000 RWF
- 1 hour studio backdrop session
- 25 edited photos
- Delivery in 2 days

Wedding Outdoor Package - 900,000 RWF
- Full wedding coverage (up to 8 hours)
- 2 photographers
- 350 edited photos
- 1 highlight video
- Delivery in 7 days

Outdoor Birthday Event - 500,000 RWF
- 4 hours event coverage
- 150 edited photos
- Delivery in 4 days
    `;

    const extracted = extractPackagesFromTextLocally(brochure, 'OUTDOOR');
    const indoor = extracted.filter((p) => p.serviceType === 'STUDIO');
    const outdoor = extracted.filter((p) => p.serviceType === 'OUTDOOR');

    expect(indoor.length).toBe(2);
    expect(outdoor.length).toBe(2);

    // Largest Indoor package (300,000 RWF) must be named Diamond, second Gold
    expect(indoor[0].packageName).toBe('Diamond');
    expect(indoor[0].price).toBe(300000);
    expect(indoor[0].includedPhotos).toBe(50);
    expect(indoor[0].deliveryDays).toBe(3);
    expect(indoor[0].ingredients.length).toBeGreaterThanOrEqual(3);

    expect(indoor[1].packageName).toBe('Gold');
    expect(indoor[1].price).toBe(150000);

    // Largest Outdoor package (900,000 RWF) must be named Diamond, second Gold
    expect(outdoor[0].packageName).toBe('Diamond');
    expect(outdoor[0].price).toBe(900000);
    expect(outdoor[0].includedPhotos).toBe(350);
    expect(outdoor[0].includedVideos).toBe(1);
    expect(outdoor[0].deliveryDays).toBe(7);

    expect(outdoor[1].packageName).toBe('Gold');
    expect(outdoor[1].price).toBe(500000);
  });

  it('extracts all 6 Wedding Plan packages (4.5M, 3.5M, 2.5M, 2M, 1.5M, 700K) and applies the naming policy', () => {
    const extracted = extractPackagesFromTextLocally(LEGACY_STUDIO_WEDDING_TEXT, 'OUTDOOR');
    expect(extracted.length).toBe(6);
    expect(extracted.every((p) => p.serviceType === 'OUTDOOR')).toBe(true);

    expect(extracted.map((p) => p.price)).toEqual([
      4500000,
      3500000,
      2500000,
      2000000,
      1500000,
      700000,
    ]);
    expect(extracted.map((p) => p.packageName)).toEqual([
      'Diamond',
      'Gold',
      'Silver',
      'Premium',
      'Basic',
      'Standard',
    ]);
    expect(extracted[0].originalTitle).toBe('ULTIMATE');
    expect(extracted[0].ingredients).toContain('2 Photobooks');
    expect(extracted[0].ingredients).toContain('Drone in Marriage');
    expect(extracted[0].hasLiveStream).toBe(true);

    expect(extracted[5].originalTitle).toBe('CIVIL WEDDING');
    expect(extracted[5].price).toBe(700000);
  });

  it('extracts all 17 Ceremony Plan packages (Birthdays, Baptism, Bridal Shower, Baby Shower, Proposal, Funeral, Graduation)', () => {
    const extracted = extractPackagesFromTextLocally(LEGACY_STUDIO_CEREMONY_TEXT, 'OUTDOOR');
    expect(extracted.length).toBe(17);
    expect(extracted[0].packageName).toBe('Diamond');
    expect(extracted[0].price).toBe(1000000);
    expect(extracted[1].packageName).toBe('Gold');
    expect(extracted[1].price).toBe(700000);
    expect(extracted[16].price).toBe(100000);
  });

  it('extracts all 13 Indoor Package tiers (Gold, Platinum, Arts Photoshoot, Creative Photos) and express delivery policy', () => {
    const extracted = extractPackagesFromTextLocally(LEGACY_STUDIO_INDOOR_TEXT, 'STUDIO');
    expect(extracted.length).toBe(13);
    expect(extracted.every((p) => p.serviceType === 'STUDIO')).toBe(true);

    // Highest amount is Creative Photos (300k = 300,000 RWF) -> Diamond
    expect(extracted[0].packageName).toBe('Diamond');
    expect(extracted[0].price).toBe(300000);
    expect(extracted[0].originalTitle).toBe('CREATIVE PHOTOS');

    // Second highest is Arts Photoshoot 25 Photos (260k = 260,000 RWF) -> Gold
    expect(extracted[1].packageName).toBe('Gold');
    expect(extracted[1].price).toBe(260000);
    expect(extracted[1].includedPhotos).toBe(25);
    expect(extracted[1].ingredients).toContain('Bonus: 1 A2 Frame');

    // Lowest is Gold 5 Photos (35k = 35,000 RWF)
    expect(extracted[12].price).toBe(35000);
    expect(extracted[12].includedPhotos).toBe(5);
    expect(extracted[0].deliveryPolicy).toContain('2,500 RWF per photo');
  });

  it('deletes a package cleanly via soft-deactivation fallback when hard DELETE fails due to booking/event foreign keys', async () => {
    const delSpy = jest.spyOn(api, 'delete').mockRejectedValueOnce({
      status: 500,
      message: 'violates foreign key constraint fk_bookings_on_package',
    });
    const putSpy = jest.spyOn(api, 'put').mockResolvedValueOnce({ action: 1, data: {} });
    const getSpy = jest.spyOn(api, 'get').mockResolvedValueOnce({
      action: 1,
      data: [
        {
          id: 'pkg-fk-locked',
          packageName: 'Diamond',
          price: 1000000,
          currencyId: 'curr-rwf',
          currencyAbbreviation: 'RWF',
          serviceType: 'OUTDOOR',
          isActive: true,
        },
        {
          id: 'pkg-active-2',
          packageName: 'Gold',
          price: 700000,
          currencyId: 'curr-rwf',
          currencyAbbreviation: 'RWF',
          serviceType: 'OUTDOOR',
          isActive: true,
        },
      ],
    });

    await expect(
      deletePackage('pkg-fk-locked', {
        id: 'pkg-fk-locked',
        name: 'Diamond',
        price: 1000000,
        currencyId: 'curr-rwf',
        serviceType: 'OUTDOOR',
      }),
    ).resolves.toBeUndefined();

    expect(delSpy).toHaveBeenCalledWith('/photographer/packages/pkg-fk-locked');
    expect(putSpy).toHaveBeenCalledWith(
      '/photographer/packages/pkg-fk-locked',
      expect.objectContaining({ isActive: false }),
    );

    const remaining = await listPackages();
    expect(remaining.map((p) => p.id)).toEqual(['pkg-active-2']);

    delSpy.mockRestore();
    putSpy.mockRestore();
    getSpy.mockRestore();
  });
});
