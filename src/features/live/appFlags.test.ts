import { flagOn, guestWishesOn, parseMode } from './appFlags';

describe('guest wishes remote switch', () => {
  it('is off for anything that is not allowlist or all', () => {
    expect(parseMode(undefined)).toBe('off');
    expect(parseMode('maybe')).toBe('off');
    expect(parseMode(5)).toBe('off');
    expect(parseMode(' ALL ')).toBe('all');
    expect(parseMode('Allowlist')).toBe('allowlist');
  });

  it('never turns on when the file is missing, empty or malformed', () => {
    expect(guestWishesOn(null)).toBe(false);
    expect(guestWishesOn(undefined)).toBe(false);
    expect(guestWishesOn({})).toBe(false);
    expect(guestWishesOn({ liveGuestWishes: { mode: 'bogus' } })).toBe(false);
    expect(guestWishesOn({ liveGuestWishes: { mode: 'allowlist', allowlist: 'qa@example.com' } }, 'qa@example.com')).toBe(false);
  });

  it('off keeps it off for everyone, even a listed account', () => {
    expect(guestWishesOn({ liveGuestWishes: { mode: 'off', allowlist: ['qa@example.com'] } }, 'qa@example.com')).toBe(false);
  });

  it('allowlist shows it only to listed accounts, never to a guest', () => {
    const flags = { liveGuestWishes: { mode: 'allowlist', allowlist: ['QA@Example.com', 7] } };
    expect(guestWishesOn(flags, 'qa@example.com')).toBe(true);
    expect(guestWishesOn(flags, 'someone@example.com')).toBe(false);
    expect(guestWishesOn(flags, null)).toBe(false);
  });

  it('all shows it to everyone, guests included', () => {
    expect(guestWishesOn({ liveGuestWishes: { mode: 'all' } }, null)).toBe(true);
  });
});

describe('live viewer layout switch', () => {
  it('is read on its own key, independent of the guest wishes switch', () => {
    const flags = { liveGuestWishes: { mode: 'all' }, liveViewerV2: { mode: 'off' } };
    expect(flagOn(flags, 'liveGuestWishes', null)).toBe(true);
    expect(flagOn(flags, 'liveViewerV2', null)).toBe(false);
  });

  it('allowlist reaches only listed accounts; all reaches guests too; missing is off', () => {
    expect(flagOn({ liveViewerV2: { mode: 'allowlist', allowlist: ['qa+viewer1@amoriaglobal.com'] } }, 'liveViewerV2', 'QA+viewer1@amoriaglobal.com')).toBe(true);
    expect(flagOn({ liveViewerV2: { mode: 'allowlist', allowlist: ['qa+viewer1@amoriaglobal.com'] } }, 'liveViewerV2', null)).toBe(false);
    expect(flagOn({ liveViewerV2: { mode: 'all' } }, 'liveViewerV2', null)).toBe(true);
    expect(flagOn({}, 'liveViewerV2', 'a@b.c')).toBe(false);
  });
});
