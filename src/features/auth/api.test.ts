import { api } from '@/api/client';
import {
  resendOtp,
  isNeedsVerification,
  isNeedsTotp,
  isNeedsPasswordChange,
} from './api';

jest.mock('@/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

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

describe('the three are mutually exclusive', () => {
  // The post-login router checks these in sequence. If two matched the same
  // error, the branch order would silently decide the user's fate.
  const cases = [
    { needsVerification: true, customerId: 'c1' },
    { needsTotp: true, customerId: 'c1' },
    { needsPasswordChange: true, email: 'a@b.com' },
    // main also carries a needsRole guard. This release line predates role
    // selection, so there are three predicates here, not four.
  ];

  it.each(cases)('%j matches exactly one predicate', (err) => {
    const matches = [
      isNeedsVerification(err),
      isNeedsTotp(err),
      isNeedsPasswordChange(err),
    ].filter(Boolean);
    expect(matches).toHaveLength(1);
  });
});

/**
 * Users reported not receiving their OTP. The backend was proven to deliver
 * it, but resend-otp answers its failures with HTTP 200 and action 0, and the
 * app treated any 200 as "a new code has been sent". The user then waited for
 * an email that was never going to come.
 */
describe('resendOtp', () => {
  const post = api.post as jest.Mock;
  beforeEach(() => post.mockReset());

  it('resolves only when the backend says action 1', async () => {
    post.mockResolvedValue({ action: 1, message: 'OTP resent successfully' });
    await expect(resendOtp('c1')).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith('/auth/resend-otp?customerId=c1', undefined, { skipAuth: true });
  });

  it('throws the backend message on action 0 instead of claiming success', async () => {
    for (const message of ['Customer not found', 'OTP already verified']) {
      post.mockResolvedValue({ action: 0, message });
      await expect(resendOtp('c1')).rejects.toMatchObject({ message });
    }
  });

  it('still fails with a readable message when the envelope has no message', async () => {
    for (const body of [{ action: 0 }, {}, undefined]) {
      post.mockResolvedValue(body);
      await expect(resendOtp('c1')).rejects.toMatchObject({ message: expect.stringMatching(/new code/) });
    }
  });
});
