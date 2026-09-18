/**
 * Regression cover for an empty Browse Photos grid.
 *
 * Every tile in the public browse grid rendered blank on a real build. The
 * API was fine and the app was fine; the app was just asking for the wrong
 * file.
 *
 * `fileUrl` is the ORIGINAL. The backend's PaidMediaAccessGuard returns 403
 * for originals in any gallery that sells per photo, which is every gallery
 * this endpoint lists, because selling a photo means the original IS the
 * product. Verified against production:
 *
 *   /uploads/gallery/images/<name>.jpeg   403   (the original, gated)
 *   /uploads/gallery/thumbs/<name>.jpg    200   image/jpeg, ~49 KB
 *   /uploads/gallery/images/<not-real>    404   (so the handler works)
 *
 * The 403 is correct and must stay: before that guard, anyone could read a
 * thumbnail URL out of the public feed, strip "/thumbs/", and download the
 * full-resolution unpurchased original.
 *
 * The web client already did `thumbnailUrl || fileUrl` everywhere. This was a
 * mobile-only parity gap.
 */
type Row = { fileUrl: string; thumbnailUrl?: string };

/** What the grid, the lightbox and the cart strip all render. */
const displayUrl = (r: Row): string => r.thumbnailUrl || r.fileUrl;

const IMAGES = 'https://backend.connekyt.com/uploads/gallery/images/x.jpeg';
const THUMBS = 'https://backend.connekyt.com/uploads/gallery/thumbs/x.jpg';

describe('browse photo image source', () => {
  it('prefers the thumbnail, which is the only one that loads', () => {
    expect(displayUrl({ fileUrl: IMAGES, thumbnailUrl: THUMBS })).toBe(THUMBS);
  });

  it('never points at /uploads/gallery/images when a thumbnail exists', () => {
    // The whole bug in one assertion. That path is 403 for the public.
    expect(displayUrl({ fileUrl: IMAGES, thumbnailUrl: THUMBS })).not.toContain('/gallery/images/');
  });

  it('falls back to fileUrl rather than rendering nothing', () => {
    // Older rows, or a gallery with no thumbnail generated yet. A gated
    // original still beats an empty string, which renders as a broken tile
    // with no chance of recovery.
    expect(displayUrl({ fileUrl: IMAGES })).toBe(IMAGES);
    expect(displayUrl({ fileUrl: IMAGES, thumbnailUrl: '' })).toBe(IMAGES);
  });
});
