/**
 * Pure rules for chat album sharing and the conversation timeline. No React and no network, so every rule here is
 * pinned by a unit test (albumShare.test.ts).
 */

export const MAX_ALBUMS_PER_SHARE = 5;

export type ShareBadge = 'PAID' | 'PRIVATE' | 'FREE';
export type ShareTab = 'project' | 'personal';
export type DisabledReason = 'archived' | 'empty';

export type ShareableAlbum = {
  id: string;
  title: string;
  cover?: string;
  photoCount: number;
  /** ISO date for the card line (event day, else created). */
  date?: string;
  badge: ShareBadge;
  tab: ShareTab;
  /** Why the album cannot be sent. Absent means it can. */
  disabledReason?: DisabledReason;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Same mapping the server uses for the card badge: a per-photo price means Paid, an access-code album is Private,
 * everything else is Free. Internal type names are never shown.
 */
export function badgeFor(raw: Raw): ShareBadge {
  if (raw.freeAlbum === true || raw.isFreeAlbum === true) return 'PRIVATE';
  const price = Number(raw.pricePerImage ?? 0);
  return price > 0 ? 'PAID' : 'FREE';
}

/**
 * One row of GET /photographer/albums as a picker row, or null when the album is not a shareable kind. Content-library
 * albums are stock for sale, not client deliveries, so they stay out of the picker.
 */
export function mapShareable(raw: Raw, normalizeImage: (u?: string | null) => string | undefined): ShareableAlbum | null {
  const id = str(raw.id);
  if (!id) return null;
  if (str(raw.contentApprovalStatus)) return null;
  const photoCount = Number(raw.imageCount ?? raw.photoCount ?? 0) || 0;
  const archived = raw.isLocked === true || raw.locked === true;
  const disabledReason: DisabledReason | undefined = archived ? 'archived' : photoCount === 0 ? 'empty' : undefined;
  return {
    id,
    title: str(raw.title) ?? 'Album',
    cover: normalizeImage(str(raw.coverImage) ?? str(raw.thumbnail)),
    photoCount,
    date: str(raw.albumDate) ?? str(raw.eventDate) ?? str(raw.createdAt),
    badge: badgeFor(raw),
    // Project vs personal follows the server: an album tied to an event is a project album.
    tab: str(raw.eventId) ? 'project' : 'personal',
    disabledReason,
  };
}

export function filterAlbums(list: ShareableAlbum[], tab: ShareTab, query: string): ShareableAlbum[] {
  const q = query.trim().toLowerCase();
  return list.filter((a) => a.tab === tab && (!q || a.title.toLowerCase().includes(q)));
}

/**
 * Toggles an album in the selection. A disabled album never joins, and the selection stops at the limit; `limited`
 * tells the caller to say why nothing happened.
 */
export function toggleSelection(
  selected: string[],
  album: ShareableAlbum,
  max = MAX_ALBUMS_PER_SHARE,
): { next: string[]; limited: boolean } {
  if (album.disabledReason) return { next: selected, limited: false };
  if (selected.includes(album.id)) return { next: selected.filter((x) => x !== album.id), limited: false };
  if (selected.length >= max) return { next: selected, limited: true };
  return { next: [...selected, album.id], limited: false };
}

// ---- timeline ----

export type TimelineItem<M> = { kind: 'date'; key: string; label: string } | { kind: 'message'; key: string; message: M };

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Today", "Yesterday", else "Tue 10 Nov" in the given locale. */
export function dayLabel(
  date: Date,
  now: Date,
  words: { today: string; yesterday: string },
  locale?: string,
): string {
  if (dayKey(date) === dayKey(now)) return words.today;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (dayKey(date) === dayKey(y)) return words.yesterday;
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/**
 * Messages oldest first, with a date separator before the first message of each day. A message with no usable
 * timestamp never gets a separator and does not break the day it sits in.
 */
export function buildTimeline<M extends { id: string | number; timestamp?: string }>(
  messages: M[],
  now: Date,
  words: { today: string; yesterday: string },
  locale?: string,
): TimelineItem<M>[] {
  const out: TimelineItem<M>[] = [];
  let lastDay = '';
  for (const m of messages) {
    const d = m.timestamp ? new Date(m.timestamp) : null;
    if (d && !Number.isNaN(d.getTime())) {
      const k = dayKey(d);
      if (k !== lastDay) {
        lastDay = k;
        out.push({ kind: 'date', key: `d-${k}`, label: dayLabel(d, now, words, locale) });
      }
    }
    out.push({ kind: 'message', key: `m-${m.id}`, message: m });
  }
  return out;
}

// ---- chat list preview ----

/**
 * The inbox row for an album share. The server sends the plain-text fallback ("Shared an album: Title (link)") as the
 * message content, so the title is read from it. Returns undefined for any other message.
 */
export function albumSharePreview(
  type: string | undefined,
  content: string | undefined,
  fmt: { one: (title: string) => string; many: (n: number) => string },
): string | undefined {
  if (type !== 'album_share' || !content) return undefined;
  const many = /^Shared (\d+) albums?:/i.exec(content);
  if (many && Number(many[1]) > 1) return fmt.many(Number(many[1]));
  const one = /^Shared an album:\s*(.+?)\s*\(https?:\/\/[^)]*\)/i.exec(content);
  return fmt.one(one ? one[1] : content.replace(/^Shared an album:\s*/i, ''));
}
