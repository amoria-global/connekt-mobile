/**
 * Search-as-you-type location service for the booking flow.
 *
 * Rules:
 *   - Result 1 (index 0): A single "Suggestion" tailored to what the user is typing.
 *   - Results 2+ (indices 1+): Live Google Maps API search results using the
 *     configured Google Maps API key.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';

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

/** What the backend's place-search routes answer: the fields shown, nothing else. */
type PlacesEnvelope = {
  action?: number;
  data?: {
    predictions?: { placeId?: string | null; description?: string | null; mainText?: string | null; secondaryText?: string | null }[];
    results?: { placeId?: string | null; name?: string | null; formattedAddress?: string | null }[];
  };
};

/**
 * Looks places up through our own backend (`/public/places/autocomplete` and `/geocode`), which holds the Google key.
 * No Google key is in this app: a key inside an app bundle can be unpacked, and the one that used to be here was
 * committed to a public repository and had to be revoked. When the backend has no key, is busy (429) or is down, this
 * returns nothing and the screen keeps its own suggestions.
 */
export async function fetchGoogleMapsLocations(
  query: string,
  city = 'Kigali',
  signal?: AbortSignal,
): Promise<LocationSuggestion[]> {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];

  const searchQuery =
    city && !trimmed.toLowerCase().includes(city.toLowerCase())
      ? `${trimmed}, ${city}`
      : trimmed;

  // 1) Autocomplete: what the person is typing, completed.
  try {
    const res = await api.get<PlacesEnvelope>(
      `/public/places/autocomplete?input=${encodeURIComponent(searchQuery)}`,
      { skipAuth: true },
    );
    if (signal?.aborted) return [];
    const predictions = Array.isArray(res?.data?.predictions) ? res.data.predictions : [];
    const parsed: LocationSuggestion[] = predictions
      .map((p, idx): LocationSuggestion | null => {
        const mainText = p?.mainText || (typeof p?.description === 'string' ? p.description.split(',')[0] : '');
        const secondaryText =
          p?.secondaryText ||
          (typeof p?.description === 'string' ? p.description.split(',').slice(1).join(',').trim() : city || 'Rwanda');
        if (!mainText) return null;
        return {
          id: `google-ac-${p.placeId || idx}`,
          title: mainText,
          subtitle: secondaryText,
          fullText: mainText,
          source: 'google',
        };
      })
      .filter((x): x is LocationSuggestion => x !== null);
    if (parsed.length > 0) return parsed;
  } catch {
    // Busy, unavailable or offline: the geocode route shares the same limits and the same key, so asking again would
    // only fail again. The screen keeps its own suggestions.
    return [];
  }

  // 2) Nothing completed: look the text up as an address.
  try {
    const res = await api.get<PlacesEnvelope>(
      `/public/places/geocode?address=${encodeURIComponent(`${searchQuery}, Rwanda`)}`,
      { skipAuth: true },
    );
    if (signal?.aborted) return [];
    const results = Array.isArray(res?.data?.results) ? res.data.results : [];
    return results
      .map((r, idx): LocationSuggestion | null => {
        const formatted = typeof r?.formattedAddress === 'string' ? r.formattedAddress : '';
        const parts = formatted.split(',').map((x) => x.trim()).filter(Boolean);
        const mainText = r?.name || parts[0] || '';
        const secondaryText = parts.slice(1).join(', ') || city || 'Rwanda';
        if (!mainText) return null;
        return {
          id: `google-geo-${r.placeId || idx}`,
          title: mainText,
          subtitle: secondaryText,
          fullText: mainText,
          source: 'google',
        };
      })
      .filter((x): x is LocationSuggestion => x !== null);
  } catch {
    return [];
  }
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
        const fetched = await fetchGoogleMapsLocations(trimmed, city, controller.signal);
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
