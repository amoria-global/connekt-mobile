/**
 * What an archived album tells its owner, in plain language. An album is archived when it is locked after its year of
 * access ran out; restoring it takes a payment of the archive fee.
 */

/** "30 October 2026", in Kigali time, or null when the date is missing or unreadable. */
export function archivedOn(lockedAt?: string | null): string | null {
  if (!lockedAt) return null;
  const d = new Date(lockedAt);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kigali' }).format(d);
}

/** The sentence under "This album is archived". `price` is the formatted fee, when one is configured. */
export function archivedMessage(opts: { lockedAt?: string | null; price?: string | null; canRestoreInApp: boolean }): string {
  const date = archivedOn(opts.lockedAt);
  const lead = date ? `This album was archived on ${date}.` : 'This album was archived.';
  if (!opts.canRestoreInApp) {
    return `${lead} Restoring it takes a payment, which the app does not offer yet. Contact support and we will help you restore it.`;
  }
  return opts.price
    ? `${lead} Restore it for ${opts.price} to view and download again.`
    : `${lead} Restore it to view and download again.`;
}

/**
 * What the photographer who owns an archived album sees. They keep read-only access to their own photos; clients, buyers
 * and the public do not, until it is restored. Restoring is paid on the Connekyt website.
 */
export function ownerArchivedMessage(lockedAt?: string | null): string {
  const date = archivedOn(lockedAt);
  const lead = date ? `This album was archived on ${date}.` : 'This album was archived.';
  return `${lead} You can still see your photos, but clients and buyers cannot. Restore it on the Connekyt website to open it again.`;
}

/** The confirmation shown before the owner is taken to pay. */
export function restoreConfirmMessage(title: string, price?: string | null): string {
  const cost = price ? `You will pay ${price}` : 'You will pay the archive fee';
  return `${cost} to restore "${title}". You will have access to it again for 1 year.`;
}
