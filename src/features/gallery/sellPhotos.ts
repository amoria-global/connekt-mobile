/**
 * "Sell photos": the photographer's one-tap way to list photos for buyers on Find my photos.
 *
 * It opens the existing album form preset to a standalone PAID album, because that is the only album the public face
 * search lists without a booking behind it (server: type PAID, standalone, published, not archived, faces indexed).
 * The rules here are what the form checks BEFORE saving, so an album never silently fails to appear.
 */
import type { PublishFailure } from './api';

/** The route "Sell photos" opens. The form reads `sell=1` and presets itself. */
export const SELL_PHOTOS_HREF = '/album/new?sell=1';

/** Why a standalone album stays listed for 60 days, in the words the success screen shows. */
export const LISTED_FOR_DAYS = 60;
export const LISTING_NOTE = `Photos stay listed for ${LISTED_FOR_DAYS} days, then the album is archived. Buyers keep what they bought.`;

export const SELL_FORM_NOTE = 'These photos will be searchable on Find my photos after upload.';
export const SELL_SUBTITLE = 'Upload photos for buyers to find';

/** The photos field error, or null. Find my photos needs at least one photo, or there is nothing to find. */
export function sellPhotosError(photoCount: number): string | null {
  return photoCount > 0 ? null : 'Add at least one photo so buyers have something to find.';
}

/** What the screen shows once the album is saved. */
export type PublishOutcome =
  | { state: 'listed'; headline: string; status: string; facesIndexed: number; warn: boolean }
  | { state: 'preparing'; headline: string; status: string; total: number; done: number }
  | { state: 'failed'; headline: string; status: string; failure: PublishFailure };

export const LISTED_HEADLINE = 'Your photos are being prepared for Find my photos';

/** A large album is published at once and indexed in the background: say how far it has got. */
export function preparingOutcome(total: number, done: number): PublishOutcome {
  const status =
    total > 0
      ? `Preparing ${Math.min(done, total)} of ${total} photos. Buyers can already find the ones that are ready.`
      : 'Preparing your photos. Buyers can already find the ones that are ready.';
  return { state: 'preparing', headline: LISTED_HEADLINE, status, total, done };
}

/** What a face-status poll means for the result screen. Null while the status says nothing about background indexing. */
export function outcomeFromIndexing(s: { status: 'INDEXING' | 'DONE' | 'FAILED'; total: number; done: number } | undefined): PublishOutcome | null {
  if (!s) return null;
  if (s.status === 'INDEXING') return preparingOutcome(s.total, s.done);
  if (s.status === 'DONE') return publishOutcome({ published: true, facesIndexed: s.done });
  return publishOutcome({
    publishFailure: { kind: 'other', message: 'Preparing the photos did not finish. Tap Retry publishing and it starts again. Nothing is uploaded twice.' },
  });
}

export function publishOutcome(result: { published?: boolean; facesIndexed?: number; indexing?: { total: number; done: number }; publishFailure?: PublishFailure }): PublishOutcome {
  if (result.published && result.indexing) return preparingOutcome(result.indexing.total, result.indexing.done);
  if (result.published) {
    const n = result.facesIndexed ?? 0;
    return n > 0
      ? { state: 'listed', headline: LISTED_HEADLINE, status: `Ready: ${n} ${n === 1 ? 'face' : 'faces'} indexed. Buyers can find these photos now.`, facesIndexed: n, warn: false }
      : {
          state: 'listed',
          headline: LISTED_HEADLINE,
          status: 'Published, but no faces were detected yet. A selfie search only matches photos with a clear face.',
          facesIndexed: 0,
          warn: true,
        };
  }
  const failure: PublishFailure = result.publishFailure ?? {
    kind: 'other',
    message: 'The album is saved but is not on Find my photos yet. Tap Retry publishing.',
  };
  return { state: 'failed', headline: 'Saved, but not on Find my photos yet', status: failure.message, failure };
}

/** The badge on a photographer's album list for a PAID standalone album that buyers cannot find. Null when nothing is wrong. */
export function notVisibleBadge(a: { isStandalone?: boolean; isFreeAlbum?: boolean; faceRecognitionEnabled?: boolean; isContent?: boolean }): string | null {
  if (!a.isStandalone || a.isFreeAlbum || a.isContent) return null;
  return a.faceRecognitionEnabled ? null : 'Not visible on Find my photos';
}

// Chooser: what "Sell photos" asks first

export type SellChoiceKey = 'event' | 'content';

export const SELL_CHOOSER_TITLE = 'What do you want to sell?';
/** The content album form. No face scanning and no face credits: a stock album is reviewed, then sold per photo. */
export const SELL_CONTENT_HREF = '/content-album/new';

export const SELL_CHOICES: {
  key: SellChoiceKey;
  title: string;
  body: string;
  icon: 'people-outline' | 'images-outline';
  tone: 'primary' | 'accent';
  href: string;
}[] = [
  {
    key: 'event',
    title: 'Event photos',
    body: 'People at an event find and buy their photos with face search on Find my photos.',
    icon: 'people-outline',
    tone: 'primary',
    href: SELL_PHOTOS_HREF,
  },
  {
    key: 'content',
    title: 'Stock & content',
    body: 'Nature, portraits and other work to sell or showcase. Reviewed before going live.',
    icon: 'images-outline',
    tone: 'accent',
    href: SELL_CONTENT_HREF,
  },
];

/** Remembered per device so the last choice is highlighted next time. The chooser itself is never skipped. */
export const SELL_LAST_CHOICE_KEY = 'sell.lastChoice';

export function parseSellChoice(raw: string | null | undefined): SellChoiceKey | null {
  return raw === 'event' || raw === 'content' ? raw : null;
}

// Content album outcomes

export const CONTENT_PHOTOS_ERROR = 'Add at least 1 photo';

export type ContentOutcome = {
  state: 'submitted' | 'draft' | 'draft-submit-failed';
  headline: string;
  status: string;
};

export const CONTENT_SUBMITTED: ContentOutcome = {
  state: 'submitted',
  headline: 'Submitted for review',
  status: "We'll notify you when it's live",
};
export const CONTENT_SAVED_DRAFT: ContentOutcome = {
  state: 'draft',
  headline: 'Saved as draft',
  status: 'Submit it for review when you are ready. It is not visible to buyers until it is approved.',
};
/** Created, but the submit call failed: the album exists, so say so and offer the retry. */
export function contentSubmitFailed(message: string): ContentOutcome {
  return { state: 'draft-submit-failed', headline: 'Saved as draft, not yet submitted', status: message };
}
