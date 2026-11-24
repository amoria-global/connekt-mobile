import { LISTED_HEADLINE, LISTING_NOTE, notVisibleBadge, outcomeFromIndexing, preparingOutcome, publishOutcome, sellPhotosError, SELL_PHOTOS_HREF } from './sellPhotos';

describe('sell photos rules', () => {
  it('opens the existing album form with the sell preset', () => {
    expect(SELL_PHOTOS_HREF).toBe('/album/new?sell=1');
  });

  it('needs at least one photo, and names the field problem in plain words', () => {
    expect(sellPhotosError(0)).toBe('Add at least one photo so buyers have something to find.');
    expect(sellPhotosError(1)).toBeNull();
  });

  it('says how long photos stay listed', () => {
    expect(LISTING_NOTE).toContain('6 months');
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

  describe('a large album indexed in the background', () => {
    it('a published album that is still being indexed says how far it has got, not "no faces"', () => {
      const o = publishOutcome({ published: true, facesIndexed: 0, indexing: { total: 120, done: 15 } });
      expect(o).toMatchObject({ state: 'preparing', headline: LISTED_HEADLINE, total: 120, done: 15 });
      expect(o.status).toBe('Preparing 15 of 120 photos. Buyers can already find the ones that are ready.');
    });
    it('never shows more done than total', () => {
      expect(preparingOutcome(10, 14).status).toContain('Preparing 10 of 10');
    });
    it('an unknown total still reads cleanly', () => {
      expect(preparingOutcome(0, 0).status).toBe('Preparing your photos. Buyers can already find the ones that are ready.');
    });
    it('polling: INDEXING stays preparing, DONE is listed, FAILED is a failure with Retry publishing', () => {
      expect(outcomeFromIndexing({ status: 'INDEXING', total: 40, done: 20 })).toMatchObject({ state: 'preparing', done: 20 });
      expect(outcomeFromIndexing({ status: 'DONE', total: 40, done: 40 })).toMatchObject({ state: 'listed', warn: false, facesIndexed: 40 });
      const failed = outcomeFromIndexing({ status: 'FAILED', total: 40, done: 12 });
      expect(failed).toMatchObject({ state: 'failed' });
      expect(failed?.status).toMatch(/Retry publishing/);
    });
    it('a status that says nothing about background indexing changes nothing', () => {
      expect(outcomeFromIndexing(undefined)).toBeNull();
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
