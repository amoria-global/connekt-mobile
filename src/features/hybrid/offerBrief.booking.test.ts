import {
  DEFAULT_OFFER_DRAFT,
  LONG_VIDEO_QTY_PRESETS,
  PHOTO_BOOK_PHOTO_PRESETS,
  PHOTO_QUANTITY_PRESETS,
  estimateOfferPriceRwf,
  formatPhotoBookSummary,
  isExpressMajorEvent,
  paperDimensions,
  type HybridOfferDraft,
} from './offerBrief';
import { durationBetween } from './hybridUi';

const draft = (patch: Partial<HybridOfferDraft> = {}): HybridOfferDraft => ({ ...DEFAULT_OFFER_DRAFT, ...patch });

describe('booking defaults and options', () => {
  it('a new offer covers 16 hours', () => {
    expect(durationBetween(DEFAULT_OFFER_DRAFT.startTime, DEFAULT_OFFER_DRAFT.endTime)).toBe(16 * 60);
  });

  it('offers the quantities that were asked for, and no zero long videos', () => {
    expect([...PHOTO_QUANTITY_PRESETS]).toEqual([0, 300, 400, 600]);
    expect([...LONG_VIDEO_QTY_PRESETS]).toEqual([1, 2]);
    expect([...PHOTO_BOOK_PHOTO_PRESETS]).toEqual([300, 400, 500]);
    expect(DEFAULT_OFFER_DRAFT.editedPhotos).toBe(300);
    expect(DEFAULT_OFFER_DRAFT.longVideosQty).toBe(1);
    expect(DEFAULT_OFFER_DRAFT.photoBookPhotos).toBe(300);
  });

  it('a photo book is described by its photos, not its pages', () => {
    expect(formatPhotoBookSummary(draft({ photoBooksQty: 1, photoBookSize: 'A4 (21 × 29.7 cm)', photoBookPhotos: 400 }))).toBe(
      '1 • A4 • 400 photos',
    );
    expect(Object.keys(DEFAULT_OFFER_DRAFT)).not.toContain('photoBookPages');
  });

  it('reads the width and height out of a paper size', () => {
    expect(paperDimensions('A4 (21 × 29.7 cm)')).toEqual({ w: 21, h: 29.7 });
    expect(paperDimensions('30 × 30 cm Square')).toEqual({ w: 30, h: 30 });
    expect(paperDimensions('60 × 90 cm')).toEqual({ w: 60, h: 90 });
    expect(paperDimensions('Custom')).toBeNull();
  });
});

describe('what moves the estimate', () => {
  it('the hours of the event do not', () => {
    const six = estimateOfferPriceRwf(draft(), 6 * 60, null);
    const sixteen = estimateOfferPriceRwf(draft(), 16 * 60, null);
    expect(sixteen.low).toBe(six.low);
    expect(sixteen.recommended).toBe(six.recommended);
    expect(sixteen.priority).toBe(six.priority);
  });

  it('long videos do not', () => {
    const one = estimateOfferPriceRwf(draft({ longVideosQty: 1 }), 360, null);
    const two = estimateOfferPriceRwf(draft({ longVideosQty: 2, longVideosDuration: '30 min' }), 360, null);
    expect(two.recommended).toBe(one.recommended);
  });

  it('a bigger photo book does cost more', () => {
    const small = estimateOfferPriceRwf(draft({ photoBooksQty: 1, photoBookPhotos: 300 }), 360, null);
    const big = estimateOfferPriceRwf(draft({ photoBooksQty: 1, photoBookPhotos: 600 }), 360, null);
    expect(big.recommended).toBeGreaterThan(small.recommended);
  });
});

describe('the 7,000,000 RWF recommendation', () => {
  const quick = { digitalDeadline: '4 days' } as const;

  it('goes to organisations booking commercial, conference or wedding coverage in 4 days or less', () => {
    for (const eventTypeKey of ['Commercial', 'Conference', 'Wedding']) {
      const d = draft({ clientType: 'ORGANIZATION', eventTypeKey, ...quick });
      expect(isExpressMajorEvent(d, 960)).toBe(true);
      expect(estimateOfferPriceRwf(d, 960, null).low).toBeGreaterThanOrEqual(7_000_000);
    }
  });

  it('is only a recommendation: any budget from RWF 50,000 can be offered', () => {
    const d = draft({ clientType: 'ORGANIZATION', eventTypeKey: 'Wedding', ...quick });
    const est = estimateOfferPriceRwf(d, 960, null);
    expect(est.isExpressMajorFloor).toBe(true);
    expect(est.minimumAllowedBudget).toBe(50000);
  });

  it('is not given to slower delivery, individuals, or smaller kinds of event', () => {
    expect(isExpressMajorEvent(draft({ clientType: 'ORGANIZATION', eventTypeKey: 'Wedding', digitalDeadline: '7 days' }), 960)).toBe(false);
    expect(isExpressMajorEvent(draft({ clientType: 'INDIVIDUAL', eventTypeKey: 'Wedding', ...quick }), 960)).toBe(false);
    expect(isExpressMajorEvent(draft({ clientType: 'ORGANIZATION', eventTypeKey: 'Birthday', ...quick }), 960)).toBe(false);
    // 16 hours alone does not make an event large.
    expect(isExpressMajorEvent(draft({ clientType: 'INDIVIDUAL', eventTypeKey: 'Birthday', ...quick }), 960)).toBe(false);
  });

  it('is given to large events', () => {
    expect(isExpressMajorEvent(draft({ clientType: 'INDIVIDUAL', eventTypeKey: 'Large event', ...quick }), 360)).toBe(true);
  });
});
