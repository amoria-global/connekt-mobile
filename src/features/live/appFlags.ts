/**
 * A remote switch for the guest wishes tab, read from a small static file the website serves (public/app-flags.json in
 * the landing repo). Changing it takes a website deploy, not an app update, so it is the kill switch for a change that
 * is already installed on phones.
 *
 *   { "liveGuestWishes": { "mode": "off" | "allowlist" | "all", "allowlist": ["qa@example.com"] } }
 *
 * Anything unknown is off: a missing file, a timeout, bad JSON or an unrecognised mode never turns the tab on.
 */
import { useEffect, useState } from 'react';
import { env } from '@/config/env';

export type FlagMode = 'off' | 'allowlist' | 'all';
export type AppFlags = { liveGuestWishes?: { mode?: unknown; allowlist?: unknown } };

export function parseMode(raw: unknown): FlagMode {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return v === 'allowlist' || v === 'all' ? v : 'off';
}

/** Whether this viewer gets the guest wishes tab. A guest has no email, so only `all` reaches them. */
export function guestWishesOn(flags: AppFlags | null | undefined, email?: string | null): boolean {
  const f = flags?.liveGuestWishes;
  if (!f) return false;
  const mode = parseMode(f.mode);
  if (mode === 'all') return true;
  if (mode !== 'allowlist') return false;
  const who = (email ?? '').trim().toLowerCase();
  if (!who || !Array.isArray(f.allowlist)) return false;
  return f.allowlist.some((e) => typeof e === 'string' && e.trim().toLowerCase() === who);
}

const TIMEOUT_MS = 4000;
let cached: AppFlags | null | undefined;

export async function fetchAppFlags(): Promise<AppFlags | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${env.webBaseUrl.replace(/\/+$/, '')}/app-flags.json`, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return json && typeof json === 'object' ? (json as AppFlags) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The tab shows only after the flag has been read; until then, and on any failure, it stays off. */
export function useGuestWishesFlag(email?: string | null): boolean {
  const [flags, setFlags] = useState<AppFlags | null>(cached ?? null);
  useEffect(() => {
    if (cached !== undefined) return;
    let alive = true;
    fetchAppFlags().then((f) => {
      cached = f;
      if (alive) setFlags(f);
    });
    return () => {
      alive = false;
    };
  }, []);
  return guestWishesOn(flags, email);
}
