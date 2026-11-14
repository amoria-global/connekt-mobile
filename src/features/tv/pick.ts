import * as SecureStore from 'expo-secure-store';
import type { TvDevice } from './types';

/** A TV that checked in this recently counts as on. The TV app checks every couple of seconds while it is open. */
export const TV_ONLINE_WINDOW_MS = 2 * 60 * 1000;

const LAST_TV_KEY = 'connekyt.lastTvId';

export function isTvOnline(device: Pick<TvDevice, 'lastSeenAt'>, now = Date.now()): boolean {
  if (!device.lastSeenAt) return false;
  const seen = Date.parse(device.lastSeenAt);
  return Number.isFinite(seen) && now - seen <= TV_ONLINE_WINDOW_MS;
}

/**
 * The TV a one-tap send goes to: the only TV, or the one used last time if it is still connected. With several TVs and no
 * remembered choice there is no default and the viewer picks. The web live page uses the same rule.
 */
export function pickDefaultTv(devices: TvDevice[], lastId: string | null | undefined): TvDevice | null {
  if (devices.length === 1) return devices[0];
  if (lastId) return devices.find((d) => d.id === lastId) ?? null;
  return null;
}

export async function readLastTvId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_TV_KEY);
  } catch {
    return null;
  }
}

export async function rememberLastTvId(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_TV_KEY, id);
  } catch {
    // Not remembered: the next send simply asks which TV.
  }
}
