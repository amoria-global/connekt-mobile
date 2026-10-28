/**
 * The "Wish invites" event setting: whether viewers may share a link or QR so others can send wishes. The copy and the
 * rule live here, and the same words are used on the web, in every role's create and edit form.
 *
 * A new event has no choice made (null). A saved event is true or false. An event from a server that predates the setting
 * has no value (undefined) and keeps the behaviour it always had, which is on.
 */
export const WISH_INVITES_LABEL = 'Wish invites';
export const WISH_INVITES_QUESTION = 'Allow viewers to invite friends and family to send message and video wishes?';
export const WISH_INVITES_HELPER = "When enabled, viewers can share a link or QR code so loved ones who can't attend can send their wishes too.";
export const WISH_INVITES_ERROR = 'Choose whether viewers can invite others';
export const WISH_INVITES_OFF_NOTICE = 'The host has turned off wish invites for this event';

/** Whether invites are on for viewers: only an explicit false turns them off. */
export function invitesOn(value: boolean | null | undefined): boolean {
  return value !== false;
}

/** The form error for a missing choice, or undefined when one is made. */
export function wishInvitesError(value: boolean | null | undefined): string | undefined {
  return typeof value === 'boolean' ? undefined : WISH_INVITES_ERROR;
}

/** "Wish invites: On" for the host's own screens. */
export function wishInvitesStatus(value: boolean | null | undefined): string {
  return `${WISH_INVITES_LABEL}: ${invitesOn(value) ? 'On' : 'Off'}`;
}
