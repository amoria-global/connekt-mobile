/**
 * Facts shown on album and photobook cards. Everything here is drawn only from what the API sent: a count that is
 * absent is absent (never "0 photos"), a date that does not parse is dropped (never echoed raw), and no generic
 * filler like "Photo Vault" stands in for a missing name.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-30" or a full ISO timestamp becomes "30 Sep 2026". Anything unparseable is undefined. */
export function albumDateText(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

/** "1 photo", "42 photos", or undefined when the API gave no count. */
export function photoCountText(count?: number | null, noun = 'photo'): string | undefined {
  if (typeof count !== 'number' || Number.isNaN(count) || count < 0) return undefined;
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** The line under an album title: when, then who, as far as the data goes (the date survives truncation). */
export function albumSubtitle(a: { photographer?: string; date?: string; receivedDate?: string }, showPhotographer: boolean): string | undefined {
  const parts = [albumDateText(a.date) ?? albumDateText(a.receivedDate), showPhotographer ? a.photographer : undefined].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/** The newest album that has a cover, for the client hero. Order is the API's (newest first); never re-sorted. */
export function featuredAlbum<T extends { coverPhoto?: string; locked?: boolean }>(list: T[]): T | undefined {
  return list.find((a) => a.coverPhoto && !a.locked);
}
