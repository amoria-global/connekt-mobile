import * as fs from 'fs';
import * as path from 'path';
import { api } from '@/api/client';
import {
  buildOrderedLocationResults,
  fetchGoogleMapsLocations,
  getRecommendedLikePlaces,
  type LocationSuggestion,
} from './locationSearch';
import { POPULAR_VENUES_BY_CITY } from '@/features/hybrid/offerBrief';

jest.mock('@/api/client', () => ({ api: { get: jest.fn() } }));
const get = api.get as jest.Mock;

describe('booking location search-as-you-type', () => {
  beforeEach(() => get.mockReset());

  it('ships no Google API key in the app', () => {
    // The old key was committed to a public repository and revoked. Place search now goes through our backend, which
    // holds the key, so nothing in the app source may look like a Google API key (Firebase config files are the only
    // allowed place, and they are not source).
    const root = path.join(__dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|json)$/.test(e.name) && /AIza[0-9A-Za-z_-]{35}/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
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

  it('asks our backend for place suggestions, with no key and no call to Google', async () => {
    get.mockResolvedValueOnce({
      action: 1,
      data: {
        predictions: [
          { placeId: 'place-1', description: 'Mille Collines Hotel, Kiyovu, Kigali, Rwanda', mainText: 'Mille Collines Hotel', secondaryText: 'Kiyovu, Kigali, Rwanda' },
        ],
      },
    });

    const results = await fetchGoogleMapsLocations('Mille', 'Kigali');

    expect(get).toHaveBeenCalledTimes(1);
    const [url, opts] = get.mock.calls[0];
    expect(url).toBe('/public/places/autocomplete?input=Mille%2C%20Kigali');
    expect(url).not.toContain('googleapis');
    expect(url).not.toContain('key=');
    expect(opts).toEqual({ skipAuth: true });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Mille Collines Hotel');
    expect(results[0].subtitle).toBe('Kiyovu, Kigali, Rwanda');
    expect(results[0].source).toBe('google');
  });

  it('falls back to the address lookup when nothing completes', async () => {
    get
      .mockResolvedValueOnce({ action: 1, data: { predictions: [] } })
      .mockResolvedValueOnce({ action: 1, data: { results: [{ placeId: 'g1', name: 'Nyarutarama', formattedAddress: 'Nyarutarama, Kigali, Rwanda' }] } });

    const results = await fetchGoogleMapsLocations('Nyarutarama', 'Kigali');

    expect(get.mock.calls[1][0]).toBe('/public/places/geocode?address=Nyarutarama%2C%20Kigali%2C%20Rwanda');
    expect(results[0]).toMatchObject({ title: 'Nyarutarama', subtitle: 'Kigali, Rwanda', source: 'google' });
  });

  it('returns nothing, without trying again, when the backend is busy or unavailable', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 429 }));
    await expect(fetchGoogleMapsLocations('Kigali Heights', 'Kigali')).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not ask for fewer than two characters', async () => {
    await expect(fetchGoogleMapsLocations('a', 'Kigali')).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});
