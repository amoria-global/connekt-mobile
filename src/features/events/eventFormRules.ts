/**
 * The one place that says which event-form fields are required. The new-event wizard reads it for the Create button, the
 * inline errors and the scroll-to-first-error, so the screen cannot drift from these rules.
 *
 * The server asks for little: an event date, and a wish-invites choice. The app asks for more on purpose (title,
 * category, start time, cover, how guests attend), because a half-empty event is not usable on the public site.
 * Everything not listed here is optional and lives under "More options (optional)", never in the main form.
 *
 * "How can guests attend?" has no default. An in-person event needs a venue, because the server downgrades an in-person
 * claim without a real venue to stream-only (AttendanceMode.apply). Asking for venue and city here makes that impossible.
 */
import { wishInvitesError } from '@/features/wishes/wishInvites';

export type AttendanceChoice = 'IN_PERSON' | 'STREAM_ONLY';

/** Main-form fields that can block Create, top to bottom. The first one with an error is where the screen scrolls. */
export const REQUIRED_FIELD_ORDER = [
  'cover',
  'title',
  'category',
  'eventDate',
  'startTime',
  'attendance',
  'venueName',
  'city',
  'price',
  'wishInvites',
] as const;

export type RequiredFieldKey = (typeof REQUIRED_FIELD_ORDER)[number];
export type EventFormErrors = Partial<Record<RequiredFieldKey, string>>;

export type EventFormInput = {
  hasCover: boolean;
  title: string;
  category: string;
  eventDate: string;
  startTime: string;
  attendance: AttendanceChoice | null;
  venueName: string;
  city: string;
  wishInvites: boolean | null | undefined;
};

export type EventFormContext = {
  /**
   * The saved location of an event being edited is one joined string that cannot be split back into venue and city.
   * While that string sits untouched in the venue field, a missing city does not block saving the edit.
   */
  legacyLocation?: boolean;
  /** The fee problem for this role and visibility (below the minimum, missing on a private event), or null. */
  priceError?: string | null;
};

// Same words the server treats as "not a real venue" (AttendanceMode.ONLINE_VENUE), so a name that passes here is kept.
const ONLINE_VENUE = /(^|[^a-z])(online|virtual|livestream|live stream|stream|zoom|meet|teams|webinar|remote|web|tbd|n\/a|none)([^a-z]|$)/i;

export function hasRealVenue(venue: string): boolean {
  const v = venue.trim();
  return v.length >= 3 && !ONLINE_VENUE.test(v);
}

export function validateEventForm(input: EventFormInput, ctx: EventFormContext = {}): EventFormErrors {
  const e: EventFormErrors = {};
  if (!input.hasCover) e.cover = 'A cover photo is required';
  if (!input.title.trim()) e.title = 'Give your event a title';
  if (!input.category.trim()) e.category = 'Pick a category';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) e.eventDate = 'Pick a date';
  if (!/^\d{1,2}:\d{2}$/.test(input.startTime)) e.startTime = 'Pick a start time';
  if (!input.attendance) e.attendance = 'Choose how guests can attend';
  if (input.attendance === 'IN_PERSON') {
    if (!input.venueName.trim()) e.venueName = 'Enter the venue name';
    else if (!hasRealVenue(input.venueName)) e.venueName = 'Enter a real venue name, not "online" or "stream"';
    if (!input.city.trim() && !ctx.legacyLocation) e.city = 'Enter the city';
  }
  if (ctx.priceError) e.price = ctx.priceError;
  const invites = wishInvitesError(input.wishInvites);
  if (invites) e.wishInvites = invites;
  return e;
}

export function firstInvalidField(errors: EventFormErrors): RequiredFieldKey | null {
  return REQUIRED_FIELD_ORDER.find((k) => errors[k]) ?? null;
}

/** Max guests: empty means no limit and sends nothing. A typed 0 is also no limit. */
export function maxGuestsPayload(raw: string | undefined | null): number | undefined {
  const n = Number((raw ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** The choice to preselect when editing: the saved mode, else what the venue implies, as the server does. */
export function attendanceFromSaved(mode: string | null | undefined, location: string | null | undefined): AttendanceChoice {
  const m = (mode ?? '').toUpperCase();
  if (m === 'STREAM_ONLY') return 'STREAM_ONLY';
  if (m === 'IN_PERSON' || m === 'HYBRID') return 'IN_PERSON';
  return hasRealVenue(location ?? '') ? 'IN_PERSON' : 'STREAM_ONLY';
}

/** The location string the API takes. Only an in-person event has one; a stream-only event sends none. */
export function locationPayload(
  attendance: AttendanceChoice | null,
  parts: { venueName: string; address: string; city: string; country: string },
): string | undefined {
  if (attendance !== 'IN_PERSON') return undefined;
  const s = [parts.venueName, parts.address, parts.city, parts.country].map((p) => p.trim()).filter(Boolean).join(', ');
  return s || undefined;
}
