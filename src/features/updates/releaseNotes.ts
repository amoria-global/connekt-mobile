/**
 * Release notes: what an update changes, shown to the user before they press "Update now".
 *
 * They live in `app.json` under `expo.extra.releaseNotes`, so they travel inside every published update's manifest. The
 * running app has not installed that update yet, but it has downloaded the manifest, and it reads the notes from there.
 * (The running JavaScript cannot know the new features, which is why the notes cannot live in the bundle.)
 *
 * Shape, newest release first:
 *   { "releases": [ { "id": "2026-10-21", "date": "2026-10-21", "title": "...", "items": [ { "title", "body", "icon?" } ] } ] }
 *
 * A phone that skipped releases is shown every release newer than the one it already runs, not only the last one.
 * The rule for contributors is in docs/RELEASING.md: add an entry before publishing.
 */
import Constants from 'expo-constants';

export type ReleaseItem = {
  title: string;
  body: string;
  /** An Ionicons name. Optional; an unknown name falls back to a default in the UI. */
  icon?: string;
};

export type Release = {
  id: string;
  date?: string;
  title: string;
  items: ReleaseItem[];
};

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Reads the notes defensively: a malformed release or item is dropped, never thrown on, so a bad entry cannot block an update. */
export function parseReleases(raw: unknown): Release[] {
  const list = (raw as { releases?: unknown } | null | undefined)?.releases;
  if (!Array.isArray(list)) return [];
  const out: Release[] = [];
  for (const r of list) {
    const id = text((r as { id?: unknown })?.id, 80);
    const title = text((r as { title?: unknown })?.title, 120);
    const rawItems = (r as { items?: unknown })?.items;
    if (!id || !title || !Array.isArray(rawItems)) continue;
    const items: ReleaseItem[] = [];
    for (const it of rawItems) {
      const t = text((it as { title?: unknown })?.title, 120);
      const b = text((it as { body?: unknown })?.body, 600);
      if (!t || !b) continue;
      items.push({ title: t, body: b, icon: text((it as { icon?: unknown })?.icon, 60) });
    }
    if (items.length === 0) continue;
    out.push({ id, date: text((r as { date?: unknown })?.date, 40), title, items });
  }
  return out;
}

type ManifestLike = { extra?: { expoClient?: { extra?: { releaseNotes?: unknown } } } } | null | undefined;

/** The notes carried by an update manifest (what `checkForUpdateAsync` and the staged update expose). */
export function releasesFromManifest(manifest: unknown): Release[] {
  return parseReleases((manifest as ManifestLike)?.extra?.expoClient?.extra?.releaseNotes);
}

/** The notes of the version running now, from its own config. */
export function installedReleases(): Release[] {
  return parseReleases((Constants.expoConfig?.extra as { releaseNotes?: unknown } | undefined)?.releaseNotes);
}

/**
 * The releases a user has not seen: everything in `incoming` newer than `installedTopId`. With no installed id (an older
 * build that carried no notes), or one `incoming` no longer lists, all of `incoming` is shown.
 */
export function unseenReleases(incoming: readonly Release[], installedTopId: string | undefined): Release[] {
  if (!installedTopId) return [...incoming];
  const at = incoming.findIndex((r) => r.id === installedTopId);
  return at < 0 ? [...incoming] : incoming.slice(0, at);
}

/** What to show for a downloaded update: its notes minus what this phone already runs. Empty when the update carries none. */
export function releasesToShow(manifest: unknown, installed: readonly Release[] = installedReleases()): Release[] {
  return unseenReleases(releasesFromManifest(manifest), installed[0]?.id);
}

/** The total number of items across releases, for the summary line. */
export function countItems(releases: readonly Release[]): number {
  return releases.reduce((n, r) => n + r.items.length, 0);
}
