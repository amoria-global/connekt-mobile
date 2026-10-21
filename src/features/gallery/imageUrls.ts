/**
 * URL rules for album photos.
 *
 * The backend stores uploads under their original file names, spaces and brackets included
 * ("1773971384102WhatsApp Image 2026-03-19 at 21.34.35.jpeg"), and builds the URL without encoding
 * it. An unencoded space makes iOS refuse to load the image at all.
 *
 * It also gates `/uploads/gallery/images/**` for albums that sell per photo (PaidMediaAccessGuard):
 * only a buyer, the owner or staff gets the original, and an image request that carries no login is
 * answered 403. The public preview lives at `/uploads/gallery/thumbs/<name without extension>.jpg`
 * (ThumbnailService.thumbFileName), so grids and covers load that and keep the original for the viewer.
 */

const IMAGES = '/uploads/gallery/images/';
const THUMBS = '/uploads/gallery/thumbs/';
const RASTER = /\.(jpe?g|png|bmp|gif)$/i;

/** Percent-encode what a URL cannot carry raw, without double-encoding an already encoded one. */
export function encodeImageUrl(url: string): string {
  try {
    return encodeURI(decodeURI(url));
  } catch {
    return encodeURI(url);
  }
}

/** The public thumbnail for a gallery original, or undefined when the URL is not one. */
export function galleryThumbUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const at = url.indexOf(IMAGES);
  if (at < 0) return undefined;
  let name: string;
  try {
    name = decodeURI(url.slice(at + IMAGES.length));
  } catch {
    name = url.slice(at + IMAGES.length);
  }
  if (!name || name.includes('/') || name.includes('?') || !RASTER.test(name)) return undefined;
  const base = name.slice(0, name.lastIndexOf('.'));
  return encodeImageUrl(`${url.slice(0, at)}${THUMBS}${base}.jpg`);
}

/** True for an original that the backend may refuse without a login. */
export function isGatedOriginal(url?: string): boolean {
  return !!url && url.includes(IMAGES);
}
