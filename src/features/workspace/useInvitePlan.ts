/**
 * The workspace invitation a sign-in or sign-up screen was opened for, and what it should do about it.
 *
 * The id comes from the route (`?invite=<id>`), from something the person pastes, or from the pending invitation kept
 * by an earlier screen. The first time an id is known it is stored, so the sign-up detour (phone, password, one-time code,
 * two-factor) and an app restart cannot lose it. The public preview then says who invited them, to which address,
 * and whether it already has an account; {@link planForInvite} turns that into the door to open first.
 *
 * Everything that can be worked out from the inputs is worked out in render (the id, whether it is explicit, the plan),
 * and effects only start the two lookups (storage, preview) and hand their answers back asynchronously.
 */
import { useCallback, useEffect, useState } from 'react';
import { getInvitePreview } from './api';
import { inviteIdFromText, planForInvite, type InvitePlan, type InvitePreview } from './invite';
import { peekPendingWorkspaceInvite, setPendingWorkspaceInvite } from './pendingInvite';

export interface InviteJourney {
  /** The invitation this screen is for, if any. */
  id: string | null;
  /** What to do about it, once the preview has loaded. Null until then, and when it could not be read. */
  plan: InvitePlan | null;
  /** The id came from the route or pasted text, not just from storage. */
  explicit: boolean;
  /** Use pasted text (a link or an id). Returns false when it is not an invitation. */
  adopt: (text: string) => boolean;
}

export function useInvitePlan(routeInvite: unknown, { useStored = true }: { useStored?: boolean } = {}): InviteJourney {
  const fromRoute = inviteIdFromText(routeInvite);
  const [adopted, setAdopted] = useState<string | null>(null);
  const [stored, setStored] = useState<string | null>(null);
  // The preview that arrived, and which invitation it is about, so a preview of one id is never shown for another.
  const [loaded, setLoaded] = useState<{ id: string; preview: InvitePreview | null } | null>(null);

  // Pasted text wins, then the route, then what an earlier screen kept.
  const id = adopted ?? fromRoute ?? (useStored ? stored : null);
  const explicit = adopted !== null || fromRoute !== null;

  // Remember an id the first time it is known, so the sign-up detour and a restart cannot lose it.
  useEffect(() => {
    if (id) void setPendingWorkspaceInvite(id).catch(() => {});
  }, [id]);

  // With no id yet, pick up the one an earlier screen kept.
  useEffect(() => {
    if (adopted || fromRoute || !useStored) return;
    let live = true;
    void peekPendingWorkspaceInvite().then((p) => { if (live && p) setStored(p); }).catch(() => {});
    return () => { live = false; };
  }, [adopted, fromRoute, useStored]);

  useEffect(() => {
    if (!id) return;
    let live = true;
    void getInvitePreview(id).then((p) => { if (live) setLoaded({ id, preview: p }); });
    return () => { live = false; };
  }, [id]);

  const adopt = useCallback((text: string) => {
    const next = inviteIdFromText(text);
    if (!next) return false;
    setAdopted(next);
    return true;
  }, []);

  const plan = id && loaded && loaded.id === id ? planForInvite(loaded.preview, id) : null;
  return { id, plan, explicit, adopt };
}
