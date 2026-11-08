import { env } from '@/config/env';
import {
  buildOrderedLocationResults,
  fetchGoogleMapsLocations,
  getRecommendedLikePlaces,
  type LocationSuggestion,
} from './locationSearch';
import { POPULAR_VENUES_BY_CITY } from '@/features/hybrid/offerBrief';

describe('booking location search-as-you-type', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('configures the Google Maps API key', () => {
    expect(env.googleMapsApiKey).toBe('AIzaSyDdbOwGJ0I-WTnZVWvjh8aCjxA5y8FRN6Y');
  });

  it('keeps fewer preset venue options per city (at most 3)', () => {
    for (const venues of Object.values(POPULAR_VENUES_BY_CITY)) {
      expect(venues.length).toBeLessThanOrEqual(3);
    }
  });

  it('returns 1 Suggestion tailored to what the user is typing for position 1', () => {
    const recs = getRecommendedLikePlaces('Marriott', 'Kigali');
    expect(recs).toHaveLength(1);
    expect(recs[0].source).toBe('recommended');
    expect(recs[0].title).toBe('Kigali Marriott Hotel');

    // When typing a custom venue not in curated presets, suggests what the user is typing
    const custom = getRecommendedLikePlaces('Chez Lando', 'Kigali');
    expect(custom).toHaveLength(1);
    expect(custom[0].title).toBe('Chez Lando');
  });

  it('orders result 1 as Suggestion and results 2+ from Google Maps API', () => {
    const googleMock: LocationSuggestion[] = [
      // Duplicate of the 1st suggestion should be deduplicated
      {
        id: 'g-dup',
        title: 'Kigali Marriott Hotel',
        subtitle: 'KN 3 Ave, Kigali',
        fullText: 'Kigali Marriott Hotel',
        source: 'google',
      },
      {
        id: 'g-1',
        title: 'Hotel des Mille Collines',
        subtitle: 'KN 2 Ave, Kigali, Rwanda',
        fullText: 'Hotel des Mille Collines',
        source: 'google',
      },
      {
        id: 'g-2',
        title: 'Grand Legacy Hotel',
        subtitle: 'Remera, Kigali, Rwanda',
        fullText: 'Grand Legacy Hotel',
        source: 'google',
      },
    ];

    const combined = buildOrderedLocationResults('Marriott', 'Kigali', googleMock);
    expect(combined.length).toBe(3);
    // 1st result is the single Suggestion
    expect(combined[0].source).toBe('recommended');
    expect(combined[0].title).toBe('Kigali Marriott Hotel');
    // 2nd+ results are Google Maps API search results
    expect(combined[1].source).toBe('google');
    expect(combined[1].title).toBe('Hotel des Mille Collines');
    expect(combined[2].source).toBe('google');
    expect(combined[2].title).toBe('Grand Legacy Hotel');
  });

  it('fetches Google Maps Places predictions using the configured API key', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        predictions: [
          {
            place_id: 'place-1',
            structured_formatting: {
              main_text: 'Mille Collines Hotel',
              secondary_text: 'Kiyovu, Kigali, Rwanda',
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const results = await fetchGoogleMapsLocations('Mille', 'Kigali');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      ),
      expect.any(Object),
    );
    expect(mockFetch.mock.calls[0][0]).toContain('AIzaSyDdbOwGJ0I-WTnZVWvjh8aCjxA5y8FRN6Y');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Mille Collines Hotel');
    expect(results[0].source).toBe('google');
  });
});
