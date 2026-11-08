/**
 * Search-as-you-type location service for the booking flow.
 *
 * Rules:
 *   - Result 1 (index 0): A single "Suggestion" tailored to what the user is typing.
 *   - Results 2+ (indices 1+): Live Google Maps API search results using the
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
  /** 'recommended' for the 1st Suggestion slot, 'google' for slots 2+ */
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
    keywords: ['bk', 'arena', 'stadium', 'remera', 'amahoro', 'concert', 'sports', 'large'],
  },
  {
    id: 'rec-amahoro',
    title: 'Amahoro National Stadium',
    subtitle: 'Remera, Kigali',
    city: 'Kigali',
    category: 'arena',
    keywords: ['amahoro', 'stadium', 'remera', 'sports', 'concert'],
  },
  {
    id: 'rec-marriott',
    title: 'Kigali Marriott Hotel',
    subtitle: 'KN 3 Ave, Nyarugenge, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['marriott', 'hotel', 'nyarugenge', 'downtown', 'kiyovu', 'wedding', 'ballroom'],
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
    id: 'rec-mille-collines',
    title: 'Hôtel des Mille Collines',
    subtitle: 'KN 2 Ave, Kiyovu, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['mille', 'collines', 'hotel', 'kiyovu', 'pool', 'garden', 'wedding'],
  },
  {
    id: 'rec-four-points',
    title: 'Four Points by Sheraton Kigali',
    subtitle: 'KN 3 Ave, Kiyovu, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['four', 'points', 'sheraton', 'hotel', 'kiyovu'],
  },
  {
    id: 'rec-lemigo',
    title: 'Lemigo Hotel',
    subtitle: 'KG 624 St, Kimihurura, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['lemigo', 'hotel', 'kimihurura', 'conference', 'wedding'],
  },
  {
    id: 'rec-grand-legacy',
    title: 'Grand Legacy Hotel',
    subtitle: 'KN 3 Rd, Remera, Kigali',
    city: 'Kigali',
    category: 'hotel',
    keywords: ['grand', 'legacy', 'hotel', 'remera', 'airport'],
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
    keywords: ['fazenda', 'sengha', 'mount', 'outdoor', 'garden', 'photoshoot', 'wedding', 'nyamirambo'],
  },
  {
    id: 'rec-juru-park',
    title: 'Juru Park Rebero',
    subtitle: 'Rebero, Kicukiro, Kigali',
    city: 'Kigali',
    category: 'garden',
    keywords: ['juru', 'park', 'rebero', 'kicukiro', 'garden', 'wedding'],
  },
  {
    id: 'rec-nyarutarama',
    title: 'Nyarutarama',
    subtitle: 'Gasabo, Kigali',
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
    title: 'Remera',
    subtitle: 'Gasabo, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['remera', 'gisimenti', 'amahoro', 'home'],
  },
  {
    id: 'rec-kibagabaga',
    title: 'Kibagabaga',
    subtitle: 'Gasabo, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['kibagabaga', 'kimironko', 'gasabo', 'kigali'],
  },
  {
    id: 'rec-kimironko',
    title: 'Kimironko',
    subtitle: 'Gasabo, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['kimironko', 'zindiro', 'kigali'],
  },
  {
    id: 'rec-gacuriro',
    title: 'Gacuriro',
    subtitle: 'Vision City, Gasabo, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['gacuriro', 'vision', 'city', 'umucyo', 'kigali'],
  },
  {
    id: 'rec-kicukiro',
    title: 'Kicukiro',
    subtitle: 'Kicukiro, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['kicukiro', 'sonatubes', 'niboye', 'kagarama', 'gikondo', 'kanombe'],
  },
  {
    id: 'rec-kanombe',
    title: 'Kanombe',
    subtitle: 'Kicukiro, Kigali',
    city: 'Kigali',
    category: 'neighborhood',
    keywords: ['kanombe', 'airport', 'busanza', 'kigali'],
  },
  {
    id: 'rec-nyamata',
    title: 'La Palisse Hotel Nyamata',
    subtitle: 'Nyamata, Bugesera',
    city: 'Kigali',
    category: 'resort',
    keywords: ['nyamata', 'bugesera', 'palisse', 'hotel', 'garden', 'wedding'],
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
  if (/hotel|marriott|radisson|serena|hilton|mille|boutique|inn|lodge|sheraton|lemigo/.test(q)) return 'hotel';
  if (/convention|conference|hall|centre|center|hub|corporate/.test(q)) return 'convention';
  if (/arena|stadium|amahoro|concert|dome/.test(q)) return 'arena';
  if (/garden|outdoor|park|beach|lake|rebero|fazenda|golf|juru/.test(q)) return 'garden';
  if (/resort|kivu|volcano|nest|safari|palisse/.test(q)) return 'resort';
  if (/street|ave|kg|kn|kk|road|house|home|sector|nyarutarama|kimihurura|kacyiru|remera|kimironko|kicukiro|gacuriro|kibagabaga/.test(q)) {
    return 'neighborhood';
  }
  return null;
}

/**
 * Returns the single best "Suggestion" (or up to `limit`, default 1) strictly
 * matching what the user is typing. If no curated venue matches the typed letters,
 * builds a direct suggestion from the user's typed text so the suggestion always
 * reflects what the user is typing.
 */
export function getRecommendedLikePlaces(
  query: string,
  city = 'Kigali',
  limit = 1,
): LocationSuggestion[] {
  const rawTrimmed = (query || '').trim();
  const clean = rawTrimmed.toLowerCase();
  if (!clean) return [];

  const normalizedCity = (city || 'Kigali').trim();
  const desiredCategory = inferDesiredCategory(clean);
  const tokens = clean.split(/\s+/).filter(Boolean);

  const scored = CURATED_PLACES.map((place, index) => {
    let matchScore = 0;
    const titleLower = place.title.toLowerCase();
    const subLower = place.subtitle.toLowerCase();
    const cityLower = place.city.toLowerCase();

    if (titleLower === clean) {
      matchScore += 200;
    } else if (titleLower.startsWith(clean)) {
      matchScore += 140;
    } else if (titleLower.includes(clean)) {
      matchScore += 100;
    }

    if (subLower.includes(clean)) {
      matchScore += 60;
    }

    for (const token of tokens) {
      if (titleLower.split(/\s+/).some((w) => w.startsWith(token))) {
        matchScore += 50;
      } else if (titleLower.includes(token)) {
        matchScore += 30;
      }
      if (place.keywords.some((k) => k.startsWith(token) || token.startsWith(k))) {
        matchScore += 40;
      }
    }

    if (desiredCategory && place.category === desiredCategory) {
      matchScore += 35;
    }

    // Only apply city tie-breaker when the place actually matches what the user typed
    if (matchScore > 0 && cityLower === normalizedCity.toLowerCase()) {
      matchScore += 15;
    }

    return { place, score: matchScore, index };
  }).filter((item) => item.score > 0);

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  if (scored.length > 0) {
    return scored.slice(0, limit).map(({ place }) => ({
      id: place.id,
      title: place.title,
      subtitle: place.subtitle,
      fullText: place.title,
      city: place.city,
      source: 'recommended' as const,
    }));
  }

  // When typing a custom venue/location not in the preset list, suggest what the user is typing
  const capitalized = rawTrimmed.charAt(0).toUpperCase() + rawTrimmed.slice(1);
  return [
    {
      id: `rec-typed-${clean}`,
      title: capitalized,
      subtitle: `${normalizedCity}, Rwanda`,
      fullText: capitalized,
      city: normalizedCity,
      source: 'recommended' as const,
    },
  ].slice(0, limit);
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
    const finish = async () => {
      try {
        if (w.google?.maps?.importLibrary) {
          const lib = await w.google.maps.importLibrary('places');
          if (lib?.AutocompleteService) {
            resolve(lib);
            return;
          }
        }
      } catch {
        // fallback to window.google.maps.places
      }
      resolve(w.google?.maps?.places ?? null);
    };

    if (w.google?.maps) {
      void finish();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => void finish();
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
 *   1. On Web: Google Maps JS SDK Places AutocompleteService
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
 * Combines the 1st "Suggestion" (index 0) with 2nd+ Google Maps API results (indices 1+).
 * Guarantees:
 *   - Result 1 (index 0) is the single Suggestion matching what the user is typing.
 *   - Results 2+ (indices 1+) are Google Maps API search results (deduplicated).
 */
export function buildOrderedLocationResults(
  query: string,
  city: string,
  googleResults: LocationSuggestion[],
): LocationSuggestion[] {
  const suggestion = getRecommendedLikePlaces(query, city, 1);
  const seenTitles = new Set(suggestion.map((r) => r.title.trim().toLowerCase()));

  const deduplicatedGoogle: LocationSuggestion[] = [];
  for (const g of googleResults) {
    const key = g.title.trim().toLowerCase();
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
    deduplicatedGoogle.push({ ...g, source: 'google' });
  }

  return [...suggestion, ...deduplicatedGoogle];
}

/**
 * Hook that drives search-as-you-type location suggestions:
 *   - Immediately provides 1 Suggestion tailored to what the user is typing (position 1)
 *   - Fetches Google Maps API locations and places them at positions 2+
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
