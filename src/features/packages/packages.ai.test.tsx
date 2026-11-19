import { api } from '@/api/client';
import {
  applyPackageTierNamingPolicy,
  deletePackage,
  extractPackagesFromTextLocally,
  listPackages,
  POLICY_PACKAGE_TIERS,
  type ExtractedAiPackageDraft,
} from './api';

const LEGACY_STUDIO_WEDDING_TEXT = `
Pick your Perfect Wedding Plan
ULTIMATE
4.5M
2 Photobooks
1 Album for parents
Civil Wedding (Video Highlight)
Pre-wedding & Video Highlights
Traditional Wedding
Church & Reception
Full video & highlights + Reels
Frames 2 = A0
Drone in Marriage
Live Streaming
Fog (smoke machine)
Full HD video & Photo on Flash disk
Team of 10 (Photographers and videographers)

PREMIUM
3.5M
Photobook + Album
Civil Wedding (Video Highlight)
Pre-wedding & video highlight
Traditional wedding
Church & Reception Wedding
Full video & highlights
2 = A1 Frames
Soft Photos on Flash Disk
Live streaming
Full HD video on Flash disk
Fog (smoke machine)
3 Photographers & 3 videographers

BASIC
2.5M
Photobook
Civil Wedding (No Video)
Pre-wedding & Video Highlights
Full video & highlights
Traditional wedding
Church & Reception Wedding
2 = A2 Frames
All Soft Photos & Video on Flash Disk
2 Photographers & 2 videographers
ONE DAY COVERAGE

CHURCH & RECEPTION WEDDING
2M
Photobook & Album
Pre-wedding Photoshoot
Video Shoot & highlights
Frame 2 = A1
Full Video & Photo on Flash disk
Live Streaming
3 Photographers
3 Videographers

TRADITIONAL WEDDING
1.5M
Photobook
Traditional Photoshoot
Wedding Video Shoot & highlights
Frame 1 = A1
Full Video & Photos soft on flash disk
Live Streaming
2 Photographers
2 Videographers

CIVIL WEDDING
700K
Photobook
1 = A2 Frames
Soft Photos on Flash Disk
Video highlight
1 videographer
1 Photographer
`;

const LEGACY_STUDIO_CEREMONY_TEXT = `
Pick your Perfect Ceremony Plan Outside sessions
BIRTHDAYS
Photoshoot................................100K /12Photos
Birthday Party............................200K
Birthday Photo & Videos highlights..300K

BAPTISM
Baptism only photos....................100K
Baptism Photos + Album.................200K
Baptism Photos + Video Highlights......350K

BRIDAL SHOWER
Bridal Shower Photos...........100K / Per Hour
Bridal Shower Photos & Videos highlights.......350K

BABY SHOWER
Baby Shower Photos.............100K / Per Hour
Baby Shower Photos & Videos highlights ......350K

PROPOSAL
Proposal Photos & Video highlights for only Couple .......300K
Proposal Party Photos & Video highlights ..................400K

FUNERAL
Funeral Photos.............................400K
Funeral Photos & Videos....................700K
Funeral Videos+ Photos + Album.....1M

GRADUATION
Graduation Photos..................100K/ Per Hour
Graduation Photos & Videos Highlights........300K
`;

const LEGACY_STUDIO_INDOOR_TEXT = `
INDOOR PACKAGE
GOLD
5 Photos — 35k
10 Photos — 60k
15 Photos — 90k
20 Photos — 115k
25 Photos — 170k
(Bonus from 20 photos: 1 A3 Frame)

PLATINUM
10 Photos — 100k
15 Photos — 140k
20 Photos — 185k
25 Photos — 220k
Includes: Private Shoot, Makeup for 1 person, Balloons, Small Decoration.
(Bonus from 20 photos: 1 A3 Frame)

ARTS PHOTOSHOOT
5 Photos — 60k
10 Photos — 110k
25 Photos — 260k
Includes: Makeup for 1 Person & a small Decoration.
(Bonus for 25 photos: 1 A2 Frame)

CREATIVE PHOTOS
Private session between 1 & 3 hrs:
New Construction, Materials, Makeup, Decor & Reels.
Prices start from 300k and above.

We would like to inform you that any work expected within 2 days will be considered as express work, which may incur additional charges (2.5k per 1 photo).
`;

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

  it('delete is a plain server delete: it does not quietly deactivate, and a failure is thrown for the caller to show', async () => {
    const delSpy = jest.spyOn(api, 'delete').mockRejectedValueOnce({ status: 500, message: 'Could not delete this package.' });
    const putSpy = jest.spyOn(api, 'put');

    await expect(deletePackage('pkg-1')).rejects.toMatchObject({ message: 'Could not delete this package.' });
    expect(delSpy).toHaveBeenCalledWith('/photographer/packages/pkg-1');
    expect(putSpy).not.toHaveBeenCalled();

    delSpy.mockRestore();
    putSpy.mockRestore();
  });

  it('a delete that answers action 0 is a failure, not a success', async () => {
    const delSpy = jest.spyOn(api, 'delete').mockResolvedValueOnce({ action: 0, message: 'Package not found.' });
    await expect(deletePackage('pkg-2')).rejects.toMatchObject({ status: 400, message: 'Package not found.' });
    delSpy.mockRestore();
  });

  it('a list answered with action 0 is a failed load, never an empty list', async () => {
    const getSpy = jest.spyOn(api, 'get').mockResolvedValueOnce({ action: 0, message: 'Could not load this. Please try again.' });
    await expect(listPackages()).rejects.toMatchObject({ message: 'Could not load this. Please try again.' });
    getSpy.mockRestore();
  });

  it('the list shows what the server holds: a package a phone once hid locally comes back, an inactive one stays hidden', async () => {
    const getSpy = jest.spyOn(api, 'get').mockResolvedValueOnce({
      action: 1,
      data: [
        { id: 'pkg-a', packageName: 'Diamond', price: 1000, currencyAbbreviation: 'RWF', serviceType: 'OUTDOOR', isActive: true },
        { id: 'pkg-b', packageName: 'Gold', price: 900, currencyAbbreviation: 'RWF', serviceType: 'OUTDOOR', isActive: false },
      ],
    });
    const listed = await listPackages();
    expect(listed.map((p) => p.id)).toEqual(['pkg-a']);
    getSpy.mockRestore();
  });
});
