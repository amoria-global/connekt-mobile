/**
 * Search-as-you-type location service for the booking flow.
 *
 * Rules:
 *   - Results 1 to 3 (indices 0..2): Curated recommendations of like places
 *     (matching venues, hotels, event centers, and neighborhoods).
 *   - Results 4+ (indices 3+): Live Google Maps API search results using the
 *     configured Google Maps API key.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { env } from '@/config/env';

export type LocationSuggestion = {
  id: string;
  /** Primary display name, e.g. "Kigali Convention Centre" */
  title: string;
  /** Secondary context, e.g. "Kimihurura, Kigali, Rwanda" */
  subtitle: string;
  /** Full string written into the venue / location field when selected */
  fullText: string;
  /** City name if known */
  city?: string;
  /** 'recommended' for slots 1–3, 'google' for slots 4+ */
  source: 'recommended' | 'google';
};

type CuratedPlace = {
  id: string;
  title: string;
  subtitle: string;
  city: string;
  category: 'hotel' | 'convention' | 'arena' | 'garden' | 'neighborhood' | 'resort';
  keywords: string[];
};

export const CURATED_PLACES: readonly CuratedPlace[] = [
  // Kigali venues & areas
  {
    id: 'rec-kcc',
    title: 'Kigali Convention Centre',
    subtitle: 'Kimihurura, Kigali',
    city: 'Kigali',
    category: 'convention',
    keywords: ['kcc', 'convention', 'conference', 'hall', 'kimihurura', 'radisson', 'wedding', 'corporate'],
  },
  {
    id: 'rec-bk-arena',
    title: 'BK Arena',
    subtitle: 'Remera, Kigali',
    city: 'Kigali',
    category: 'arena',
    keywords: ['arena', 'stadium', 'remera', 'amaho', 'amahoro', 'concert', 'sports', 'large'],
  },
  {
    id: 'rec-marriott',
    title: 'Kigali Marriott Hotel',
    subtitle: 'KN 3 Ave, Nyarugenge, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['marriott', 'hotel', 'serena', 'nyarugenge', 'downtown', 'kiyovu', 'wedding', 'ballroom'],
  },
  {
    id: 'rec-radisson',
    title: 'Radisson Blu Hotel Kigali',
    subtitle: 'Convention Centre Roundabout, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['radisson', 'blu', 'hotel', 'kimihurura', 'convention', 'wedding', 'banquet'],
  },
  {
    id: 'rec-serena-kigali',
    title: 'Kigali Serena Hotel',
    subtitle: 'KN 3 Ave, Kiyovu, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['serena', 'hotel', 'kiyovu', 'ballroom', 'conference', 'wedding'],
  },
  {
    id: 'rec-intare',
    title: 'Intare Conference Arena',
    subtitle: 'Rusororo, Kigali',
    city: 'Kigali',
    category: 'convention',
    keywords: ['intare', 'arena', 'conference', 'rusororo', 'kabuga', 'hall', 'wedding'],
  },
  {
    id: 'rec-norrsken',
    title: 'Norrsken House Kigali',
    subtitle: 'KN 78 St, Nyarugenge, Kigali',
    city: 'Kigali',
    category: 'convention',
    keywords: ['norrsken', 'hub', 'corporate', 'office', 'conference', 'town'],
  },
  {
    id: 'rec-heaven',
    title: 'Heaven Restaurant & Boutique Hotel',
    subtitle: 'KN 29 St, Kiyovu, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['heaven', 'retreat', 'boutique', 'restaurant', 'kiyovu', 'garden', 'reception'],
  },
  {
    id: 'rec-canal-olympia',
    title: 'CanalOlympia Rebero',
    subtitle: 'Rebero, Kigali',
    city: 'Kigali',
    category: 'garden',
    keywords: ['canal', 'olympia', 'rebero', 'outdoor', 'garden', 'wedding', 'festival'],
  },
  {
    id: 'rec-fazenda',
    title: 'Fazenda Sengha Mount Kigali',
    subtitle: 'Mount Kigali, Nyamirambo',
    city: 'Kigali',
    category: 'garden',
    keywords: ['fazenda', 'sengha', 'mount', 'outdoor', 'garden', 'photoshoot', 'wedding'],
  },
  {
    id: 'rec-nyarutarama',
    title: 'Nyarutarama Golf & Gardens',
    subtitle: 'Nyarutarama, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['nyarutarama', 'golf', 'garden', 'lover', 'lake', 'kg 9', 'home'],
  },
  {
    id: 'rec-kimihurura',
    title: 'Kimihurura',
    subtitle: 'Gasabo, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['kimihurura', 'gasabo', 'kigali', 'home', 'street', 'avenue'],
  },
  {
    id: 'rec-kacyiru',
    title: 'Kacyiru',
    subtitle: 'Gasabo, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['kacyiru', 'gasabo', 'kigali', 'home', 'ministry'],
  },
  {
    id: 'rec-remera',
    title: 'Remera & Gisimenti',
    subtitle: 'Gasabo, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['remera', 'gisimenti', 'kibagabaga', 'gacuriro', 'kanombe', 'home'],
  },
  // Musanze
  {
    id: 'rec-one-only',
    title: 'One&Only Gorilla’s Nest',
    subtitle: 'Kinigi, Musanze',
    city: 'Musanze',
    category: 'resort',
    keywords: ['one', 'only', 'gorilla', 'nest', 'kinigi', 'musanze', 'lodge', 'resort'],
  },
  {
    id: 'rec-tiloreza',
    title: 'Tiloreza Volcanoes Ecolodge',
    subtitle: 'Musanze',
    city: 'Musanze',
    category: 'resort',
    keywords: ['tiloreza', 'volcanoes', 'ecolodge', 'musanze', 'lodge', 'hotel'],
  },
  {
    id: 'rec-fatima',
    title: 'Fatima Hotel Musanze',
    subtitle: 'Muhoza, Musanze',
    city: 'Musanze',
    category: 'hotel',
    keywords: ['fatima', 'hotel', 'muhoza', 'musanze', 'cyuve'],
  },
  // Rubavu
  {
    id: 'rec-kivu-serena',
    title: 'Lake Kivu Serena Hotel',
    subtitle: 'Gisenyi beachfront, Rubavu',
    city: 'Rubavu',
    category: 'resort',
    keywords: ['kivu', 'serena', 'lake', 'beach', 'gisenyi', 'rubavu', 'hotel', 'wedding'],
  },
  {
    id: 'rec-kivu-marina',
    title: 'Kivu Marina Bay',
    subtitle: 'Rubavu',
    city: 'Rubavu',
    category: 'resort',
    keywords: ['kivu', 'marina', 'bay', 'rubavu', 'gisenyi', 'resort'],
  },
  {
    id: 'rec-gorillas-kivu',
    title: 'Gorillas Lake Kivu Hotel',
    subtitle: 'Gisenyi, Rubavu',
    city: 'Rubavu',
    category: 'hotel',
    keywords: ['gorillas', 'lake', 'kivu', 'hotel', 'rubavu', 'gisenyi'],
  },
  // Huye
  {
    id: 'rec-credo-huye',
    title: 'Credo Hotel Huye',
    subtitle: 'Ngoma, Huye',
    city: 'Huye',
    category: 'hotel',
    keywords: ['credo', 'hotel', 'huye', 'butare', 'ngoma'],
  },
  {
    id: 'rec-galileo-huye',
    title: 'Galileo Hotel',
    subtitle: 'Huye',
    city: 'Huye',
    category: 'hotel',
    keywords: ['galileo', 'hotel', 'huye', 'butare', 'tumba'],
  },
  {
    id: 'rec-huye-stadium',
    title: 'Huye Stadium',
    subtitle: 'Huye Center',
    city: 'Huye',
    category: 'arena',
    keywords: ['huye', 'stadium', 'arena', 'butare'],
  },
];

function inferDesiredCategory(q: string): CuratedPlace['category'] | null {
  if (/hotel|marriott|radisson|serena|hilton|mille|boutique|inn|lodge/.test(q)) return 'hotel';
  if (/convention|conference|hall|centre|center|hub|corporate/.test(q)) return 'convention';
  if (/arena|stadium|amahoro|concert|dome/.test(q)) return 'arena';
  if (/garden|outdoor|park|beach|lake|rebero|fazenda|golf/.test(q)) return 'garden';
  if (/resort|kivu|volcano|nest|safari/.test(q)) return 'resort';
  if (/street|ave|kg|kn|kk|road|house|home|sector|nyarutarama|kimihurura|kacyiru|remera/.test(q)) {
    return 'neighborhood';
  }
  return null;
}

/**
 * Returns the 1st to 3rd recommended like-places for the user's current search text.
 * Always returns up to `limit` (default 3) curated recommendations so the first 3
 * rows are recommendations of like places before Google Maps API results at 4+.
 */
export function getRecommendedLikePlaces(
  query: string,
  city = 'Kigali',
  limit = 3,
): LocationSuggestion[] {
  const clean = (query || '').trim().toLowerCase();
  const normalizedCity = (city || 'Kigali').trim();
  const desiredCategory = inferDesiredCategory(clean);
  const tokens = clean.split(/\s+/).filter(Boolean);

  const scored = CURATED_PLACES.map((place, index) => {
    let score = 0;
    const titleLower = place.title.toLowerCase();
    const subLower = place.subtitle.toLowerCase();
    const cityLower = place.city.toLowerCase();

    if (cityLower === normalizedCity.toLowerCase()) {
      score += 20;
    }

    if (clean) {
      if (titleLower === clean) {
        score += 150;
      } else if (titleLower.startsWith(clean)) {
        score += 110;
      } else if (titleLower.includes(clean)) {
        score += 80;
      }

      if (subLower.includes(clean)) {
        score += 45;
      }

      for (const token of tokens) {
        if (titleLower.split(/\s+/).some((w) => w.startsWith(token))) {
          score += 35;
        } else if (titleLower.includes(token)) {
          score += 20;
        }
        if (place.keywords.some((k) => k.startsWith(token) || token.startsWith(k))) {
          score += 28;
        }
      }

      if (desiredCategory && place.category === desiredCategory) {
        score += 32;
      }
    }

    return { place, score, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return scored.slice(0, limit).map(({ place }) => ({
    id: place.id,
    title: place.title,
    subtitle: place.subtitle,
    fullText: place.title,
    city: place.city,
    source: 'recommended' as const,
  }));
}

let webMapsScriptPromise: Promise<any> | null = null;

function loadWebGoogleMapsPlaces(apiKey: string): Promise<any> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  const w = window as any;
  if (w.google?.maps?.places?.AutocompleteService) {
    return Promise.resolve(w.google.maps.places);
  }
  if (webMapsScriptPromise) return webMapsScriptPromise;

  webMapsScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve((window as any).google?.maps?.places ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return webMapsScriptPromise;
}

async function fetchWebAutocompletePredictions(
  query: string,
  city: string,
  apiKey: string,
): Promise<LocationSuggestion[]> {
  const placesLib = await loadWebGoogleMapsPlaces(apiKey);
  if (!placesLib?.AutocompleteService) return [];
  return new Promise((resolve) => {
    try {
      const service = new placesLib.AutocompleteService();
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'rw' },
        },
        (predictions: any[] | null) => {
          if (!Array.isArray(predictions) || predictions.length === 0) {
            resolve([]);
            return;
          }
          const parsed: LocationSuggestion[] = predictions
            .map((p: any, idx: number): LocationSuggestion | null => {
              const mainText =
                p?.structured_formatting?.main_text ||
                (typeof p?.description === 'string' ? p.description.split(',')[0] : '');
              const secondaryText =
                p?.structured_formatting?.secondary_text ||
                (typeof p?.description === 'string'
                  ? p.description.split(',').slice(1).join(',').trim()
                  : city || 'Rwanda');
              if (!mainText) return null;
              return {
                id: `google-web-${p.place_id || idx}`,
                title: mainText,
                subtitle: secondaryText,
                fullText: mainText,
                source: 'google',
              };
            })
            .filter((x): x is LocationSuggestion => x !== null);
          resolve(parsed);
        },
      );
    } catch {
      resolve([]);
    }
  });
}

/**
 * Queries Google Maps APIs using the configured Google Maps API key:
 *   1. On Web: Google Maps JS SDK Places AutocompleteService (avoids browser CORS)
 *   2. Google Places Autocomplete HTTP API (`maps.googleapis.com/maps/api/place/autocomplete/json`)
 *   3. Google Maps Geocoding API (`maps.googleapis.com/maps/api/geocode/json`, CORS-enabled everywhere)
 */
export async function fetchGoogleMapsLocations(
  query: string,
  city = 'Kigali',
  apiKey: string = env.googleMapsApiKey,
  signal?: AbortSignal,
): Promise<LocationSuggestion[]> {
  const trimmed = (query || '').trim();
  if (!trimmed || !apiKey) return [];

  const searchQuery =
    city && !trimmed.toLowerCase().includes(city.toLowerCase())
      ? `${trimmed}, ${city}`
      : trimmed;

  // 1) On Web, try Google Maps JS SDK AutocompleteService first
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const webResults = await fetchWebAutocompletePredictions(searchQuery, city, apiKey);
    if (signal?.aborted) return [];
    if (webResults.length > 0) return webResults;
  }

  // 2) Google Maps Places Autocomplete API (verified active on this API key)
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(searchQuery)}` +
      `&components=country:rw` +
      `&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json();
      const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
      const parsed: LocationSuggestion[] = predictions
        .map((p: any, idx: number): LocationSuggestion | null => {
          const mainText =
            p?.structured_formatting?.main_text ||
            (typeof p?.description === 'string' ? p.description.split(',')[0] : '');
          const secondaryText =
            p?.structured_formatting?.secondary_text ||
            (typeof p?.description === 'string'
              ? p.description.split(',').slice(1).join(',').trim()
              : city || 'Rwanda');
          if (!mainText) return null;
          return {
            id: `google-ac-${p.place_id || idx}`,
            title: mainText,
            subtitle: secondaryText,
            fullText: mainText,
            source: 'google',
          };
        })
        .filter((x: LocationSuggestion | null): x is LocationSuggestion => x !== null);
      if (parsed.length > 0) return parsed;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
  }

  // 3) Fallback to Google Maps Geocoding API (verified active + CORS-enabled)
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(`${searchQuery}, Rwanda`)}` +
      `&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const parsed: LocationSuggestion[] = results
        .map((r: any, idx: number): LocationSuggestion | null => {
          const formatted = typeof r?.formatted_address === 'string' ? r.formatted_address : '';
          const parts = formatted.split(',').map((s: string) => s.trim()).filter(Boolean);
          const mainText = r?.name || parts[0] || '';
          const secondaryText = parts.slice(1).join(', ') || city || 'Rwanda';
          if (!mainText) return null;
          return {
            id: `google-geo-${r.place_id || idx}`,
            title: mainText,
            subtitle: secondaryText,
            fullText: mainText,
            source: 'google',
          };
        })
        .filter((x: LocationSuggestion | null): x is LocationSuggestion => x !== null);
      if (parsed.length > 0) return parsed;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
  }

  return [];
}

/**
 * Combines the 1st–3rd recommended like-places with 4th+ Google Maps API results.
 * Guarantees:
 *   - Results 1..3 (indices 0..2) are recommendations of like places.
 *   - Results 4+ (indices 3+) are Google Maps API search results (deduplicated).
 */
export function buildOrderedLocationResults(
  query: string,
  city: string,
  googleResults: LocationSuggestion[],
): LocationSuggestion[] {
  const recommended = getRecommendedLikePlaces(query, city, 3);
  const seenTitles = new Set(recommended.map((r) => r.title.trim().toLowerCase()));

  const deduplicatedGoogle: LocationSuggestion[] = [];
  for (const g of googleResults) {
    const key = g.title.trim().toLowerCase();
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
    deduplicatedGoogle.push({ ...g, source: 'google' });
  }

  return [...recommended, ...deduplicatedGoogle];
}

/**
 * Hook that drives search-as-you-type location suggestions:
 *   - Immediately provides 3 recommended like-places (positions 1–3)
 *   - Fetches Google Maps API locations and places them at positions 4+
 */
export function useLocationSearch(query: string, city = 'Kigali', active = true) {
  const trimmed = (query || '').trim();
  const [googleResults, setGoogleResults] = useState<LocationSuggestion[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active || !trimmed) {
      setGoogleResults([]);
      setLoadingGoogle(false);
      return;
    }

    setLoadingGoogle(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const fetched = await fetchGoogleMapsLocations(
          trimmed,
          city,
          env.googleMapsApiKey,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setGoogleResults(fetched);
          setLoadingGoogle(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setGoogleResults([]);
          setLoadingGoogle(false);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [trimmed, city, active]);

  const results = useMemo(() => {
    if (!trimmed) return [];
    return buildOrderedLocationResults(trimmed, city, googleResults);
  }, [trimmed, city, googleResults]);

  return {
    results,
    loadingGoogle,
  };
}
