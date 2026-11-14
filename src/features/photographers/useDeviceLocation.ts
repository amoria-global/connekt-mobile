import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Where the phone is, for the "photographers near you" map.
 *
 * It asks for the foreground permission once, reads one position and stops: no watching, nothing stored, nothing sent
 * anywhere except as the viewer's point in the map request (the server rounds it). If the person says no, location is off
 * or a fix takes too long, `coords` stays null and the map falls back to the server's default for the account, so the
 * screen always has something to show.
 *
 * `status` is 'pending' only until the first answer, so the screen can wait for it before its first request instead of
 * drawing the default area and then jumping.
 */
export type DeviceLocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable';

export type DeviceCoords = { lat: number; lng: number };

/** How long to wait for a first fix before using the default area. */
export const LOCATION_TIMEOUT_MS = 8000;
/** A remembered position older than this is not used; "near you" should follow the person across town or country. */
export const LAST_FIX_MAX_AGE_MS = 5 * 60 * 1000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

export function useDeviceLocation(enabled = true): { coords: DeviceCoords | null; status: DeviceLocationStatus; retry: () => void } {
  const [coords, setCoords] = useState<DeviceCoords | null>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>('pending');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          setStatus('denied');
          return;
        }
        // A cached fix is instant and good enough for "near you"; a fresh one is the fallback.
        const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_FIX_MAX_AGE_MS, requiredAccuracy: 5000 });
        if (cancelled) return;
        if (last) {
          setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
          setStatus('granted');
          return;
        }
        const fresh = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), LOCATION_TIMEOUT_MS);
        if (cancelled) return;
        if (fresh) {
          setCoords({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
          setStatus('granted');
        } else {
          setStatus('unavailable');
        }
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  return {
    coords,
    status,
    retry: () => {
      setStatus('pending');
      setAttempt((n) => n + 1);
    },
  };
}
