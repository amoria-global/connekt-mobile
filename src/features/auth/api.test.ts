import {
  isNeedsVerification,
  isNeedsTotp,
  isNeedsPasswordChange,
  isNeedsRole,
} from './api';

/**
 * The first test in this repo (CONN-TEST-2).
 *
 * These four predicates decide where a failed login SENDS the user: to OTP
 * entry, to the TOTP prompt, to a forced password change, or to role
 * selection. They are the branch points of the post-login router, so a
 * misfire does not throw - it quietly routes someone to the wrong screen, or
 * to a generic "invalid credentials" for an account that is perfectly valid
 * and merely unverified.
 *
 * That is exactly the shape of CONN-AUTH-1, where invited members could never
 * reach the forced password change that was gating them.
 *
 * Each predicate requires BOTH its flag and its companion id. A truthy flag
 * with a missing customerId would send the app to a screen it cannot complete,
 * so the tests below pin that pairing rather than just the flag.
 */
describe('isNeedsVerification', () => {
  it('accepts the real shape', () => {
    expect(isNeedsVerification({ needsVerification: true, customerId: 'c1' })).toBe(true);
  });

  it('rejects the flag without a customerId', () => {
    // Routing to OTP entry with no customer to verify is a dead end.
    expect(isNeedsVerification({ needsVerification: true })).toBe(false);
    expect(isNeedsVerification({ needsVerification: true, customerId: 42 })).toBe(false);
  });

  it('rejects a truthy-but-not-true flag', () => {
    // `=== true`, not a loose check: a string "true" from a JSON envelope
    // should not be mistaken for the boolean.
    expect(isNeedsVerification({ needsVerification: 'true', customerId: 'c1' })).toBe(false);
    expect(isNeedsVerification({ needsVerification: 1, customerId: 'c1' })).toBe(false);
  });

  it('survives the values that actually reach an error handler', () => {
    for (const v of [null, undefined, '', 0, 'error', [], new Error('boom')]) {
      expect(isNeedsVerification(v)).toBe(false);
    }
  });
});

describe('isNeedsTotp', () => {
  it('accepts the real shape and rejects a missing id', () => {
    expect(isNeedsTotp({ needsTotp: true, customerId: 'c1' })).toBe(true);
    expect(isNeedsTotp({ needsTotp: true })).toBe(false);
  });

  it('does not confuse itself with the verification error', () => {
    // Both carry customerId; only the flag distinguishes them. Crossing these
    // sends a 2FA user to email verification and vice versa.
    expect(isNeedsTotp({ needsVerification: true, customerId: 'c1' })).toBe(false);
    expect(isNeedsVerification({ needsTotp: true, customerId: 'c1' })).toBe(false);
  });
});

describe('isNeedsPasswordChange', () => {
  it('requires an email, not a customerId', () => {
    // The change-password screen keys off the email, so the companion field
    // differs from the other two on purpose.
    expect(isNeedsPasswordChange({ needsPasswordChange: true, email: 'a@b.com' })).toBe(true);
    expect(isNeedsPasswordChange({ needsPasswordChange: true, customerId: 'c1' })).toBe(false);
  });
});

describe('isNeedsRole', () => {
  it('requires the profile as well as the flag', () => {
    // The profile is what carries the Google/Apple identity into role
    // selection, so the flag alone is not enough to route there - there would
    // be nothing to create the account with.
    expect(isNeedsRole({ needsRole: true, profile: { email: 'a@b.com' } })).toBe(true);
    expect(isNeedsRole({ needsRole: true })).toBe(false);
  });

  it('rejects everything else', () => {
    expect(isNeedsRole({ needsVerification: true, customerId: 'c1' })).toBe(false);
    expect(isNeedsRole(null)).toBe(false);
  });
});

describe('the four are mutually exclusive', () => {
  // The post-login router checks these in sequence. If two matched the same
  // error, the branch order would silently decide the user's fate.
  const cases = [
    { needsVerification: true, customerId: 'c1' },
    { needsTotp: true, customerId: 'c1' },
    { needsPasswordChange: true, email: 'a@b.com' },
    { needsRole: true, profile: { email: 'a@b.com' } },
  ];

  it.each(cases)('%j matches exactly one predicate', (err) => {
    const matches = [
      isNeedsVerification(err),
      isNeedsTotp(err),
      isNeedsPasswordChange(err),
      isNeedsRole(err),
    ].filter(Boolean);
    expect(matches).toHaveLength(1);
  });
});
