/**
 * Drives the Get started sheet on an Events screen: reads "Don't show this again" (device cache first, then the
 * account), opens the sheet when it should, and saves the checkbox to both. A reopen key is for Help.
 *
 * The sheet is for accounts that have created nothing at all: no events, hosted events, albums or photobooks. The
 * extra lists are read only when the events list is empty and the sheet would otherwise open; a failed read counts as
 * "unknown" and keeps the sheet closed.
 */
import { useCallback, useEffect, useState } from 'react';
import { listAlbums } from '@/features/gallery/api';
import { listHostedEvents } from '@/features/hosting/api';
import { listPhotobooks } from '@/features/photobooks/api';
import { useRole } from '@/features/auth/role';
import { getPreferences, preferencesBase } from '@/features/preferences/api';
import { api } from '@/api/client';
import { storage } from '@/services/storage';
import { useAuth } from '@/store/auth';
import { GET_STARTED_PREF_KEY, getStartedActions, session, shouldAutoOpen } from './getStarted';

export function useGetStarted({ listLoaded, hasItems, reopenKey }: { listLoaded: boolean; hasItems: boolean; reopenKey?: string }) {
  const role = useRole();
  const userId = useAuth((s) => s.user?.customerId);
  const actions = getStartedActions(role.role, role.isCollaboratorWorkspace);
  const base = preferencesBase(role);
  const cacheKey = `${GET_STARTED_PREF_KEY}.${userId ?? 'anon'}`;
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<boolean | null>(null);
  const wantCheck = listLoaded && !hasItems && dismissed === false && actions.length > 0 && !session.shown;

  useEffect(() => {
    if (!wantCheck) return;
    let live = true;
    const checks: Promise<unknown[]>[] = [listPhotobooks()];
    if (role.isPhotographer) checks.push(listHostedEvents(), listAlbums(true));
    Promise.all(checks)
      .then((lists) => live && setCreated(lists.some((l) => l.length > 0)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wantCheck, role.isPhotographer]);

  // The device cache answers at once; the account is the source of truth and wins when it says "true".
  useEffect(() => {
    let live = true;
    (async () => {
      const cached = await storage.get(cacheKey).catch(() => null);
      if (live && cached === 'true') setDismissed(true);
      try {
        const prefs = await getPreferences(base);
        const remote = prefs[GET_STARTED_PREF_KEY] === 'true';
        if (remote) storage.set(cacheKey, 'true').catch(() => {});
        if (live) setDismissed(remote || cached === 'true');
      } catch {
        if (live) setDismissed(cached === 'true');
      }
    })();
    return () => {
      live = false;
    };
  }, [base, cacheKey]);

  // State is adjusted while rendering (React's pattern for "open when this becomes true"), so no effect sets it.
  if (!open && shouldAutoOpen({ actions: actions.length, listLoaded: listLoaded && created !== null, hasItems: hasItems || created === true, dismissed, shownThisSession: session.shown })) {
    session.shown = true;
    setOpen(true);
  }

  // Help brings it back, whatever the checkbox says. Each Help tap carries a new key.
  const [seenKey, setSeenKey] = useState<string | undefined>(undefined);
  if (reopenKey && reopenKey !== seenKey && actions.length > 0) {
    setSeenKey(reopenKey);
    setOpen(true);
  }

  const close = useCallback(() => setOpen(false), []);

  const setForever = useCallback(
    (forever: boolean) => {
      setDismissed(forever);
      (forever ? storage.set(cacheKey, 'true') : storage.remove(cacheKey)).catch(() => {});
      api.put(`${base}/${encodeURIComponent(GET_STARTED_PREF_KEY)}`, { value: String(forever) }).catch(() => {});
    },
    [base, cacheKey],
  );

  return { actions, open, dismissed: dismissed === true, close, setForever };
}
