/**
 * Remote switches read from a small static file the website serves (public/app-flags.json in the landing repo).
 * Changing it takes a website deploy, not an app update, so it is the kill switch for a change that is already installed
 * on phones.
 *
 *   { "liveGuestWishes": { "mode": "off" | "allowlist" | "all", "allowlist": ["qa@example.com"] },
 *     "liveViewerV2":    { "mode": "off" | "allowlist" | "all", "allowlist": [] } }
 *
 * Anything unknown is off: a missing file, a timeout, bad JSON or an unrecognised mode never turns a switch on.
 */
import { useEffect, useState } from 'react';
import { env } from '@/config/env';

export type FlagMode = 'off' | 'allowlist' | 'all';
type FlagEntry = { mode?: unknown; allowlist?: unknown };
export type AppFlags = { liveGuestWishes?: FlagEntry; liveViewerV2?: FlagEntry };
export type FlagName = keyof AppFlags;

export function parseMode(raw: unknown): FlagMode {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return v === 'allowlist' || v === 'all' ? v : 'off';
}

/** Whether a named switch is on for this viewer. A guest has no email, so only `all` reaches them. */
export function flagOn(flags: AppFlags | null | undefined, name: FlagName, email?: string | null): boolean {
  const f = flags?.[name];
  if (!f) return false;
  const mode = parseMode(f.mode);
  if (mode === 'all') return true;
  if (mode !== 'allowlist') return false;
  const who = (email ?? '').trim().toLowerCase();
  if (!who || !Array.isArray(f.allowlist)) return false;
  return f.allowlist.some((e) => typeof e === 'string' && e.trim().toLowerCase() === who);
}

/** Whether this viewer gets the guest wishes tab. */
export function guestWishesOn(flags: AppFlags | null | undefined, email?: string | null): boolean {
  return flagOn(flags, 'liveGuestWishes', email);
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

/** Any switch in the file. Off until the file has been read, and on any failure. */
export function useAppFlag(name: FlagName, email?: string | null): boolean {
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
  return flagOn(flags, name, email);
}

/** The guest wishes tab shows only after the flag has been read; until then, and on any failure, it stays off. */
export function useGuestWishesFlag(email?: string | null): boolean {
  return useAppFlag('liveGuestWishes', email);
}
