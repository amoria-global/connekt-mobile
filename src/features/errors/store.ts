import { useSyncExternalStore } from 'react';
import type { ActionId, Tone } from './catalogue';
import type { Presentation } from './presentError';

/**
 * Transient state for the error components: the toast queue, the banners, and the one sheet. It lives outside React
 * so a failure caught anywhere (a hook, an API wrapper) can show something without a provider in between, and so the
 * rules are testable without rendering.
 *
 * - Toasts: one is visible, the rest wait their turn.
 * - Banners: keyed, so a state that repeats ("offline") replaces itself instead of stacking, and a state that ends
 *   ("back online") clears it.
 * - Sheet: one decision at a time; a second request replaces the first.
 */

export type ToastItem = { id: number; message: string; tone: Tone; actionLabel?: string; onAction?: () => void };
export type BannerTone = 'warning' | 'info' | 'success';
export type BannerItem = {
  key: string;
  tone: BannerTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Only when dismissing is safe, i.e. the state does not block anything. */
  dismissible?: boolean;
};
export type SheetItem = { presentation: Presentation; onAction: (id: ActionId) => void };

type State = { toasts: ToastItem[]; banners: BannerItem[]; sheet: SheetItem | null };

let state: State = { toasts: [], banners: [], sheet: null };
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function getErrorState(): State {
  return state;
}

export function subscribeErrors(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useErrorState(): State {
  return useSyncExternalStore(subscribeErrors, getErrorState, getErrorState);
}

/** Queues a toast. The same message already waiting or showing is not added twice. */
export function showToast(input: Omit<ToastItem, 'id'>): number {
  const dup = state.toasts.find((t) => t.message === input.message && t.tone === input.tone);
  if (dup) return dup.id;
  const id = nextId++;
  set({ toasts: [...state.toasts, { ...input, id }] });
  return id;
}

export function dismissToast(id: number): void {
  if (state.toasts.some((t) => t.id === id)) set({ toasts: state.toasts.filter((t) => t.id !== id) });
}

export function setBanner(item: BannerItem): void {
  const rest = state.banners.filter((b) => b.key !== item.key);
  set({ banners: [...rest, item] });
}

export function clearBanner(key: string): void {
  if (state.banners.some((b) => b.key === key)) set({ banners: state.banners.filter((b) => b.key !== key) });
}

export function openSheet(item: SheetItem): void {
  set({ sheet: item });
}

export function closeSheet(): void {
  if (state.sheet) set({ sheet: null });
}

/** Test helper: back to a clean slate. */
export function resetErrorState(): void {
  nextId = 1;
  set({ toasts: [], banners: [], sheet: null });
}
