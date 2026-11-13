import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getServiceArea, type ServiceArea } from './api';

/**
 * The signed-in photographer's own service area, read again every time the screen comes into focus so the Home prompt and the
 * Profile row follow a save or a removal made on the picker.
 *
 * `failed` is kept apart from "not set": when the read fails nothing is claimed either way, so the Home prompt stays hidden
 * instead of telling someone who is on the map that they are not.
 */
export function useServiceArea() {
  const [area, setArea] = useState<ServiceArea | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setArea(await getServiceArea());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { area, loaded, failed, refresh };
}
