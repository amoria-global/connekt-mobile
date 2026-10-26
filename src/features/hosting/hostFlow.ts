/**
 * The "Publish and go live" sequence, as one resumable run.
 *
 * Steps: create → cover photo → publish. Each step is skipped once it has succeeded, so a retry after
 * a failed cover upload or publish continues from where it stopped and never creates a second event.
 * The caller keeps the returned `progress` between attempts and goes live (or leaves) only when
 * `status` is 'done', which is after the server has confirmed every step.
 */
import type { PickedImage } from '@/services/imagePicker';
import type { HostedEventInput } from './api';

export type HostProgress = { eventId?: string; coverDone?: boolean };

export type HostDeps = {
  create: (input: HostedEventInput) => Promise<{ id: string }>;
  uploadCover: (eventId: string, image: PickedImage) => Promise<void>;
  publish: (eventId: string) => Promise<void>;
};

export type HostResult =
  | { status: 'done'; eventId: string; progress: HostProgress }
  | { status: 'failed'; step: 'create' | 'cover' | 'publish'; message: string; progress: HostProgress };

function messageOf(e: unknown, fallback: string): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.length > 0 ? m : fallback;
}

export async function runHostFlow(
  deps: HostDeps,
  input: HostedEventInput,
  cover: PickedImage,
  previous: HostProgress = {},
): Promise<HostResult> {
  const progress: HostProgress = { ...previous };

  if (!progress.eventId) {
    try {
      progress.eventId = (await deps.create(input)).id;
    } catch (e) {
      return { status: 'failed', step: 'create', message: messageOf(e, 'Could not create the event.'), progress };
    }
  }

  if (!progress.coverDone) {
    try {
      await deps.uploadCover(progress.eventId, cover);
      progress.coverDone = true;
    } catch (e) {
      return { status: 'failed', step: 'cover', message: messageOf(e, 'The cover photo could not be uploaded.'), progress };
    }
  }

  try {
    await deps.publish(progress.eventId);
  } catch (e) {
    return { status: 'failed', step: 'publish', message: messageOf(e, 'Could not publish the event.'), progress };
  }
  return { status: 'done', eventId: progress.eventId, progress };
}

export type HostForm = {
  title: string;
  date: string;
  startTime: string;
  paid: boolean;
  price: string;
};

export type HostFormErrors = Partial<Record<'title' | 'date' | 'startTime' | 'price' | 'cover', string>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Client-side checks that save a round trip. The server repeats every rule that matters. */
export function validateHostForm(form: HostForm, hasCover: boolean, today: string): HostFormErrors {
  const errors: HostFormErrors = {};
  if (form.title.trim().length < 3) errors.title = 'Give your event a title of at least 3 characters.';
  if (!DATE.test(form.date) || Number.isNaN(Date.parse(form.date))) errors.date = 'Use the format YYYY-MM-DD.';
  else if (form.date < today) errors.date = 'The date cannot be in the past.';
  if (form.startTime.trim() !== '' && !TIME.test(form.startTime.trim())) errors.startTime = 'Use 24-hour time, like 18:30.';
  if (form.paid) {
    const n = Number(form.price);
    if (!Number.isFinite(n) || n <= 0) errors.price = 'Enter a price above zero.';
  }
  if (!hasCover) errors.cover = 'Add a cover photo.';
  return errors;
}

export type HostedBucket = 'upcoming' | 'live' | 'ended';

/** Which tab a hosted event belongs under, from the server's event status. */
export function bucketOf(status?: string): HostedBucket {
  const s = (status ?? '').toUpperCase();
  if (s === 'ONGOING' || s === 'LIVE') return 'live';
  if (s === 'COMPLETED' || s === 'ENDED') return 'ended';
  return 'upcoming';
}
