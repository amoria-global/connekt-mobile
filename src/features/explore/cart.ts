/** The Explore cart: the items a viewer picked, kept in memory for the session. Priced by the server at checkout. */
import { create } from 'zustand';
import type { ExploreItem } from './api';

type State = {
  items: ExploreItem[];
  has: (id: string) => boolean;
  toggle: (item: ExploreItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useCart = create<State>((set, get) => ({
  items: [],
  has: id => get().items.some(i => i.id === id),
  toggle: item => set(s => ({ items: s.items.some(i => i.id === item.id) ? s.items.filter(i => i.id !== item.id) : [...s.items, item] })),
  remove: id => set(s => ({ items: s.items.filter(i => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
