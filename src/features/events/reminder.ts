/**
 * "Get notified" for an upcoming event, held by the backend.
 *
 * Signed in: /customer/events/{id}/reminder. The person is told by an in-app
 *            notification that also reaches their phone as a push.
 * Guest:     /public/events/{id}/reminder with an email. Told by one email.
 *
 * Failures come back as HTTP 200 with action 0, so every call goes through requireOk
 * and a refusal (event ended, bad email) is thrown with the server's message.
 */
import { api, requireOk } from '@/api/client';
import type { ApiEnvelope } from '@/types';

type State = { subscribed: boolean };

export type ReminderWho = { signedIn: boolean; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidReminderEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function base(eventId: string, who: ReminderWho): string {
  return who.signedIn
    ? `/api/remote/customer/events/${eventId}/reminder`
    : `/api/remote/public/events/${eventId}/reminder`;
}

function query(who: ReminderWho): string {
  return who.signedIn ? '' : `?email=${encodeURIComponent((who.email ?? '').trim())}`;
}

/** Is this person already waiting for the event? A guest with no email cannot be. */
export async function getReminder(eventId: string, who: ReminderWho): Promise<boolean> {
  if (!who.signedIn && !who.email) return false;
  const res = requireOk(
    await api.get<ApiEnvelope<State>>(`${base(eventId, who)}${query(who)}`, { skipAuth: !who.signedIn }),
  );
  return !!(res as ApiEnvelope<State>).data?.subscribed;
}

export async function setReminder(eventId: string, who: ReminderWho): Promise<void> {
  if (!who.signedIn && !isValidReminderEmail(who.email ?? '')) {
    throw { status: 400, message: 'Enter a valid email address.' };
  }
  requireOk(
    await api.post<ApiEnvelope<State>>(
      base(eventId, who),
      who.signedIn ? undefined : { email: (who.email ?? '').trim().toLowerCase() },
      { skipAuth: !who.signedIn },
    ),
  );
}

export async function clearReminder(eventId: string, who: ReminderWho): Promise<void> {
  requireOk(
    await api.delete<ApiEnvelope<State>>(`${base(eventId, who)}${query(who)}`, { skipAuth: !who.signedIn }),
  );
}
