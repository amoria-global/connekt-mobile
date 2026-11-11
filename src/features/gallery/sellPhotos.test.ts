import { LISTED_HEADLINE, LISTING_NOTE, notVisibleBadge, publishOutcome, sellPhotosError, SELL_PHOTOS_HREF } from './sellPhotos';

describe('sell photos rules', () => {
  it('opens the existing album form with the sell preset', () => {
    expect(SELL_PHOTOS_HREF).toBe('/album/new?sell=1');
  });

  it('needs at least one photo, and names the field problem in plain words', () => {
    expect(sellPhotosError(0)).toBe('Add at least one photo so buyers have something to find.');
    expect(sellPhotosError(1)).toBeNull();
  });

  it('says how long photos stay listed', () => {
    expect(LISTING_NOTE).toContain('60 days');
  });

  describe('publishOutcome', () => {
    it('a published album says the photos are being prepared and how many faces are ready', () => {
      const o = publishOutcome({ published: true, facesIndexed: 3 });
      expect(o).toMatchObject({ state: 'listed', headline: LISTED_HEADLINE, warn: false, facesIndexed: 3 });
      expect(o.status).toBe('Ready: 3 faces indexed. Buyers can find these photos now.');
      expect(publishOutcome({ published: true, facesIndexed: 1 }).status).toContain('1 face indexed');
    });
    it('published with no faces is a warning, not a silent success', () => {
      const o = publishOutcome({ published: true, facesIndexed: 0 });
      expect(o).toMatchObject({ state: 'listed', warn: true });
      expect(o.status).toMatch(/no faces were detected/);
    });
    it('an older server that does not report faces is treated as no faces, not as a failure', () => {
      expect(publishOutcome({ published: true })).toMatchObject({ state: 'listed', warn: true });
    });
    it('an unpublished album is a failure that carries the friendly reason', () => {
      const f = { kind: 'timeout' as const, message: 'Preparing the photos is taking longer than usual.' };
      expect(publishOutcome({ publishFailure: f })).toMatchObject({ state: 'failed', status: f.message, failure: f });
    });
    it('an unpublished album with no reason still never reads as success', () => {
      const o = publishOutcome({});
      expect(o.state).toBe('failed');
      expect(o.status).toMatch(/Retry publishing/);
    });
  });

  describe('notVisibleBadge', () => {
    it('flags a standalone PAID album that is not live on Find my photos', () => {
      expect(notVisibleBadge({ isStandalone: true, faceRecognitionEnabled: false })).toBe('Not visible on Find my photos');
    });
    it('says nothing for a live one, a FREE one, a content one or an event album', () => {
      expect(notVisibleBadge({ isStandalone: true, faceRecognitionEnabled: true })).toBeNull();
      expect(notVisibleBadge({ isStandalone: true, isFreeAlbum: true })).toBeNull();
      expect(notVisibleBadge({ isStandalone: true, isContent: true })).toBeNull();
      expect(notVisibleBadge({ isStandalone: false })).toBeNull();
    });
  });
});
