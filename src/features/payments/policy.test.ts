import { Platform } from 'react-native';
import {
  digitalPurchasesEnabled,
  isDigitalDeclaration,
  canPayDeclarationHere,
  canShowDigitalPrice,
  isOwedObligation,
} from './policy';

/**
 * The store-billing gate.
 *
 * Neither store lets an app sell digital content through anything but its own
 * billing, and both forbid pointing the buyer somewhere else instead. Connekyt
 * can use neither: the merchant entity is in Rwanda, every price is dynamic
 * (per album, per event, per country, free-form gifts), and most of the money
 * is the photographer's or the creator's rather than ours.
 *
 * So the digital purchase surface is absent in the app on BOTH platforms, and
 * present on the web, where no store policy reaches.
 *
 * This file exists because the flag is one line and flipping it back would
 * look harmless in review. It is not harmless. It is App Store guideline 3.1.1
 * and Play's payments policy, and it decides whether the app ships at all.
 */
describe('digitalPurchasesEnabled', () => {
  it('is off on the platform these tests run as', () => {
    // jest-expo runs as ios. This is the assertion that matters for the App
    // Store: a build where this is true ships a purchase flow Apple rejects.
    expect(Platform.OS).toBe('ios');
    expect(digitalPurchasesEnabled).toBe(false);
  });

  it('is derived from the platform, never hardcoded true', () => {
    // Guards against someone "temporarily" setting it to true to test a flow
    // and leaving it that way.
    expect(typeof digitalPurchasesEnabled).toBe('boolean');
    expect(digitalPurchasesEnabled).toBe(Platform.OS === 'web');
  });
});

describe('isDigitalDeclaration', () => {
  it('treats every digital payment type as digital', () => {
    for (const t of [
      'STREAMING',
      'TIP',
      'GIFT',
      'ARCHIVE',
      'ALBUM_SALE',
      'FACE_RECOGNITION',
      'PHOTOBOOK_EXTRAS',
    ]) {
      expect(isDigitalDeclaration(t)).toBe(true);
    }
  });

  it('does NOT treat a booking as digital', () => {
    // A photographer physically attends and shoots the event. That is a
    // real-world service, which both stores exempt, and gating it would
    // remove the app's main revenue path for no reason.
    expect(isDigitalDeclaration('BOOKING')).toBe(false);
  });

  it('is case-insensitive, because payment types arrive from several clients', () => {
    expect(isDigitalDeclaration('streaming')).toBe(true);
    expect(isDigitalDeclaration('Album_Sale')).toBe(true);
  });

  it('treats a missing type as not digital rather than guessing', () => {
    expect(isDigitalDeclaration(null)).toBe(false);
    expect(isDigitalDeclaration(undefined)).toBe(false);
    expect(isDigitalDeclaration('')).toBe(false);
  });

  it('does not classify an unknown type as digital', () => {
    // A new payment type must be added to the set deliberately. Failing open
    // here would be safe for the store and wrong for the user, who would be
    // blocked from paying for something legitimate.
    expect(isDigitalDeclaration('SOMETHING_NEW')).toBe(false);
  });
});

describe('canPayDeclarationHere', () => {
  it('refuses every digital declaration in the app', () => {
    // The generic pending-payments screen lists every declaration type. This
    // is what stops it offering to complete a digital one through the web
    // checkout, which is the exact anti-steering violation.
    for (const t of ['STREAMING', 'TIP', 'GIFT', 'ARCHIVE', 'ALBUM_SALE']) {
      expect(canPayDeclarationHere(t)).toBe(false);
    }
  });

  it('still allows a booking to be paid', () => {
    expect(canPayDeclarationHere('BOOKING')).toBe(true);
  });

  it('allows an unrecognised type through', () => {
    // Same reasoning as above: a type nobody classified is not assumed
    // digital, so a legitimate payment is never silently blocked.
    expect(canPayDeclarationHere('SOMETHING_NEW')).toBe(true);
    expect(canPayDeclarationHere(null)).toBe(true);
  });
});

describe('canShowDigitalPrice', () => {
  /**
   * Found by running a release build, not by reading code. browse-photos
   * showed "$2.03" on every photo after the buy button had been gated away,
   * and explore-events and the event page both showed a stream fee the user
   * could do nothing with.
   *
   * Hiding the button but keeping the price is the half-measure both stores
   * see through, and it is also just a bad screen: a figure nobody can act on.
   */
  it('hides a paid price where digital purchases are gated off', () => {
    expect(canShowDigitalPrice(false)).toBe(digitalPurchasesEnabled);
    expect(canShowDigitalPrice(false)).toBe(false); // ios
  });

  it('always shows Free, on every platform', () => {
    // "Free" is information about what the app can do, not an invitation to
    // pay. Hiding it would make free events look paywalled, which costs the
    // user something real and buys no compliance.
    expect(canShowDigitalPrice(true)).toBe(true);
  });
});

describe('isOwedObligation', () => {
  it('counts only what the declaration handoff accepts as owed', () => {
    // 90 of 91 unsettled declarations in production were viewers' unfinished
    // tickets and gifts. Summing them produced a "$132,642 pending" banner.
    expect(isOwedObligation('BOOKING')).toBe(true);
    expect(isOwedObligation('PHOTOBOOK_EXTRAS')).toBe(true);
    for (const t of ['STREAMING', 'GIFT', 'TIP', 'FACE_RECOGNITION', 'ALBUM_SALE', 'DONATION']) {
      expect(isOwedObligation(t)).toBe(false);
    }
  });

  it('does not depend on the digital-purchases flag, which is on in release builds', () => {
    expect(canPayDeclarationHere('STREAMING')).toBe(false);
    expect(canPayDeclarationHere('photobook_extras')).toBe(true);
  });
});

describe('digitalPurchasesEnabled in a release build', () => {
  it('stays off on native even when NODE_ENV is not "test"', () => {
    // The gate used to read `NODE_ENV !== 'test'`, which is true in every
    // shipped build, so it was open everywhere except under jest.
    const before = process.env.NODE_ENV;
    const flag = process.env.EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES;
    try {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      delete process.env.EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fresh = require('./policy') as typeof import('./policy');
        expect(fresh.digitalPurchasesEnabled).toBe(false);
        expect(fresh.canShowDigitalPrice(false)).toBe(false);
      });
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = before;
      if (flag !== undefined) process.env.EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES = flag;
    }
  });
});
