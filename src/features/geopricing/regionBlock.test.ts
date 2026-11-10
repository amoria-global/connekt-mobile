import {
  BLOCKED_COPY,
  UNKNOWN_COPY,
  regionBlockFromError,
  regionBlockFromEvent,
  regionBlockFromPrice,
} from './regionBlock';

describe('region block', () => {
  describe('a refused purchase, gift, tip or donation (403)', () => {
    it('reads a blocked place', () => {
      const e = { status: 403, message: 'x', body: { errorCode: 'REGION_BLOCKED', message: BLOCKED_COPY, retry: false } };
      expect(regionBlockFromError(e)).toEqual({ unknown: false, message: BLOCKED_COPY });
    });

    it('reads an unconfirmed place as one worth retrying', () => {
      const e = { status: 403, message: 'x', body: { errorCode: 'LOCATION_UNKNOWN', message: UNKNOWN_COPY, retry: true } };
      expect(regionBlockFromError(e)).toEqual({ unknown: true, message: UNKNOWN_COPY });
    });

    it('falls back to plain copy when the server sends no message', () => {
      expect(regionBlockFromError({ status: 403, message: '', body: { errorCode: 'REGION_BLOCKED' } })?.message).toBe(BLOCKED_COPY);
      expect(regionBlockFromError({ status: 403, message: '', body: { errorCode: 'LOCATION_UNKNOWN' } })?.message).toBe(UNKNOWN_COPY);
    });

    it('ignores every other error, so a real failure is never shown as a region screen', () => {
      expect(regionBlockFromError({ status: 403, message: 'no', body: { errorCode: 'NOT_ALLOWED' } })).toBeNull();
      expect(regionBlockFromError({ status: 500, message: 'x', body: { errorCode: 'REGION_BLOCKED' } })).toBeNull();
      expect(regionBlockFromError({ status: 503, message: 'x', body: { errorCode: 'PRICE_UNAVAILABLE', retry: true } })).toBeNull();
      expect(regionBlockFromError(new Error('boom'))).toBeNull();
      expect(regionBlockFromError(null)).toBeNull();
    });
  });

  describe('the price lookup', () => {
    it('is null for an allowed place', () => {
      expect(regionBlockFromPrice({ blocked: false, price: 150 })).toBeNull();
      expect(regionBlockFromPrice({ price: 150 })).toBeNull();
      expect(regionBlockFromPrice(undefined)).toBeNull();
    });

    it('reads a block and an unconfirmed place', () => {
      expect(regionBlockFromPrice({ blocked: true, blockedCode: 'REGION_BLOCKED', blockedMessage: BLOCKED_COPY, retry: false })).toEqual({
        unknown: false,
        message: BLOCKED_COPY,
      });
      expect(regionBlockFromPrice({ blocked: true, blockedCode: 'LOCATION_UNKNOWN', blockedMessage: UNKNOWN_COPY, retry: true })).toEqual({
        unknown: true,
        message: UNKNOWN_COPY,
      });
    });

    it('treats blocked:true with no code as a block, never as allowed', () => {
      expect(regionBlockFromPrice({ blocked: true })).toEqual({ unknown: false, message: BLOCKED_COPY });
    });
  });

  describe('the event card flags', () => {
    it('is null when the viewer may see the event', () => {
      expect(regionBlockFromEvent({ action: 1, hasPurchasedAccess: false })).toBeNull();
      expect(regionBlockFromEvent({ regionBlocked: false })).toBeNull();
    });

    it('reads a block and an unconfirmed place', () => {
      expect(
        regionBlockFromEvent({ regionBlocked: true, regionBlockedCode: 'REGION_BLOCKED', regionBlockedMessage: BLOCKED_COPY, regionRetry: false }),
      ).toEqual({ unknown: false, message: BLOCKED_COPY });
      expect(
        regionBlockFromEvent({ regionBlocked: true, regionBlockedCode: 'LOCATION_UNKNOWN', regionBlockedMessage: UNKNOWN_COPY, regionRetry: true }),
      ).toEqual({ unknown: true, message: UNKNOWN_COPY });
    });
  });
});
