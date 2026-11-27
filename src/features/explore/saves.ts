/**
 * Saved items. Kept on the phone for everyone (so a guest can save) and, when signed in, mirrored to the account so
 * saves follow the person across devices. A failed sync never loses the local save.
 */
import { create } from 'zustand';
import { storage } from '@/services/storage';
import { deleteSave, fetchSavedIds, putSave } from './api';

const KEY = 'explore.saves.v1';
const MAX_LOCAL = 40; // SecureStore holds about 2 KB per value: 40 ids of 36 characters fit.

type State = {
  ids: string[];
  ready: boolean;
  load: (signedIn: boolean) => Promise<void>;
  toggle: (id: string, signedIn: boolean) => Promise<void>;
};

async function persist(ids: string[]) {
  try { await storage.set(KEY, ids.slice(0, MAX_LOCAL).join(',')); } catch { /* the in-memory list still works */ }
}

export const useSaves = create<State>((set, get) => ({
  ids: [],
  ready: false,
  async load(signedIn) {
    let ids: string[] = [];
    try {
      const raw = await storage.get(KEY);
      ids = raw ? raw.split(',').filter(Boolean) : [];
    } catch { /* start empty */ }
    set({ ids, ready: true });
    if (!signedIn) return;
    try {
      const remote = await fetchSavedIds();
      const merged = Array.from(new Set([...remote, ...ids]));
      set({ ids: merged });
      await persist(merged);
      for (const id of ids) if (!remote.includes(id)) void putSave(id).catch(() => {});
    } catch { /* offline: keep what is on the phone */ }
  },
  async toggle(id, signedIn) {
    const had = get().ids.includes(id);
    const next = had ? get().ids.filter(x => x !== id) : [id, ...get().ids];
    set({ ids: next });
    await persist(next);
    if (!signedIn) return;
    try { await (had ? deleteSave(id) : putSave(id)); } catch { /* synced the next time the list loads */ }
  },
}));
