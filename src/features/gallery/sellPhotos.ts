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
  | { state: 'failed'; headline: string; status: string; failure: PublishFailure };

export const LISTED_HEADLINE = 'Your photos are being prepared for Find my photos';

export function publishOutcome(result: { published?: boolean; facesIndexed?: number; publishFailure?: PublishFailure }): PublishOutcome {
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
