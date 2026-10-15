import { calculateHaversineDistanceKm, fetchDirectBookingMap } from './mapApi';
import { api } from '@/api/client';

jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
  },
}));

jest.mock('./api', () => ({
  listPhotographers: jest.fn().mockResolvedValue([
    {
      id: 'demo-1',
      name: 'Alpha Shots',
      avatar: 'https://example.com/alpha.jpg',
      category: 'Weddings',
      specialties: ['Weddings', 'Portraits'],
      startingPrice: 150000,
      rating: 4.9,
      reviewCount: 30,
      isVerified: true,
      location: 'Kigali',
    },
  ]),
}));

describe('mapApi', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateHaversineDistanceKm', () => {
    it('calculates distance between two coordinate pairs accurately', () => {
      // Kigali center (-1.9441, 30.0619) to near Kigali Convention Centre (-1.9536, 30.0936) ~ 3.67 km
      const dist = calculateHaversineDistanceKm(-1.9441, 30.0619, -1.9536, 30.0936);
      expect(dist).toBeGreaterThan(3);
      expect(dist).toBeLessThan(4.5);
    });

    it('returns 0 for identical coordinates', () => {
      const dist = calculateHaversineDistanceKm(-1.9441, 30.0619, -1.9441, 30.0619);
      expect(dist).toBe(0);
    });
  });

  describe('fetchDirectBookingMap', () => {
    it('passes all query parameters correctly to /direct-booking/map', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        action: 1,
        message: 'Nearby direct booking photographers retrieved successfully',
        data: {
          clientLocation: {
            latitude: -1.9441,
            longitude: 30.0619,
            city: 'Kigali',
            country: 'Rwanda',
            message: 'You are here',
            detectedFrom: 'GPS',
            isCurrentLocation: true,
          },
          radiusKm: 25.0,
          totalNearby: 1,
          photographers: [
            {
              photographerId: 'p-123',
              fullName: 'Jean Mutabazi',
              latitude: -1.945,
              longitude: 30.063,
              distanceKm: 0.16,
              distanceFormatted: '0.2 km away',
              city: 'Kigali',
              country: 'Rwanda',
              specialties: ['WEDDING'],
              rating: 4.9,
              reviewCount: 42,
              verified: true,
              startingPrice: 150000,
              currency: 'RWF',
              directBookingEnabled: true,
              packages: [],
            },
          ],
        },
      });

      const res = await fetchDirectBookingMap({
        lat: -1.9441,
        lng: 30.0619,
        radiusKm: 25,
        specialty: 'WEDDING',
        eventDate: '2026-11-20',
        search: 'Jean',
      });

      expect(api.get).toHaveBeenCalledTimes(1);
      const callPath = (api.get as jest.Mock).mock.calls[0][0];
      expect(callPath).toContain('/direct-booking/map?');
      expect(callPath).toContain('lat=-1.9441');
      expect(callPath).toContain('lng=30.0619');
      expect(callPath).toContain('radiusKm=25');
      expect(callPath).toContain('specialty=WEDDING');
      expect(callPath).toContain('eventDate=2026-11-20');
      expect(callPath).toContain('search=Jean');

      expect(res.clientLocation.message).toBe('You are here');
      expect(res.photographers).toHaveLength(1);
      expect(res.photographers[0].fullName).toBe('Jean Mutabazi');
    });

    // An empty map used to be filled with invented creators, prices and
    // packages that reached the booking sheet.
    it('shows an empty map rather than inventing photographers', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        action: 1,
        message: 'Nearby direct booking photographers retrieved successfully',
        data: {
          clientLocation: {
            latitude: -1.9441,
            longitude: 30.0619,
            city: 'Kigali',
            country: 'Rwanda',
            message: 'You are here',
            detectedFrom: 'DEFAULT_LOCATION',
            currentLocation: true,
          },
          radiusKm: 25.0,
          totalFound: 0,
          photographers: [],
        },
      });

      const res = await fetchDirectBookingMap({ radiusKm: 25 });

      expect(res.clientLocation.message).toBe('You are here');
      expect(res.clientLocation.isCurrentLocation).toBe(true);
      expect(res.photographers).toEqual([]);
      expect(res.totalNearby).toBe(0);
    });
  });
});
