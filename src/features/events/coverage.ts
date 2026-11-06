/**
 * "Who covers this event?" on the create event wizard. The wizard is only for an event a photographer covers, so the
 * question is gone for everyone, and so is the "I stream it myself" answer: hosting your own stream goes through
 * Host an event (Go live). The one place it stays is editing an event that was created that way before, so its fee
 * and visibility can still be changed. Older installed builds keep sending it; the server still accepts it.
 */
export function showCoverageChoice(opts: { editing: boolean; visibility: 'PUBLIC' | 'PRIVATE' }): boolean {
  return opts.editing && opts.visibility === 'PRIVATE';
}

/** The short link to Go live under the wizard's photographer section: for anyone creating a new event, never when editing. */
export function showSelfStreamLink(opts: { editing: boolean; isPhotographer: boolean }): boolean {
  return !opts.editing && !opts.isPhotographer;
}
