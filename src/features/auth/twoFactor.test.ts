import {
  challengeFrom,
  challengeFromParams,
  challengeParams,
  codeErrorFrom,
  codeSentFrom,
  formatCountdown,
  isCodeError,
  needsTotpError,
  secondsUntil,
} from './twoFactor';

/**
 * The second sign-in step carries the server's answers to the screen. Nothing here decides whether a
 * code is right; these tests pin that the numbers the server sends are the numbers the screen shows.
 */
describe('challengeFrom', () => {
  it('reads the methods, default and masked email off a login answer', () => {
    const c = challengeFrom({
      customerId: 'c1',
      challengeId: 'p.sig',
      twoFactorMethods: ['TOTP', 'EMAIL'],
      twoFactorDefaultMethod: 'EMAIL',
      maskedEmail: 'jo•••@mail.com',
      challengeExpiresAt: '2026-11-04T10:05:00Z',
    });
    expect(c).toMatchObject({ challengeId: 'p.sig', methods: ['TOTP', 'EMAIL'], defaultMethod: 'EMAIL', maskedEmail: 'jo•••@mail.com' });
  });

  it('treats an old backend answer (customerId only) as an authenticator challenge', () => {
    expect(challengeFrom({ customerId: 'c1' })).toMatchObject({ challengeId: '', methods: ['TOTP'], defaultMethod: 'TOTP' });
  });

  it('ignores a default method the account does not have, and unknown method names', () => {
    const c = challengeFrom({ customerId: 'c1', twoFactorMethods: ['TOTP', 'SMS'], twoFactorDefaultMethod: 'EMAIL' });
    expect(c.methods).toEqual(['TOTP']);
    expect(c.defaultMethod).toBe('TOTP');
  });

  it('survives a trip through route params', () => {
    const c = challengeFrom({ customerId: 'c1', challengeId: 'p.sig', twoFactorMethods: ['TOTP', 'EMAIL'], twoFactorDefaultMethod: 'EMAIL', maskedEmail: 'a•••@b.co' });
    expect(challengeFromParams(challengeParams(c))).toEqual(c);
  });
});

describe('needsTotpError', () => {
  it('carries the whole challenge so the screen can switch methods', () => {
    const e = needsTotpError({ customerId: 'c1', challengeId: 'p.sig', twoFactorMethods: ['EMAIL'] });
    expect(e.needsTotp).toBe(true);
    expect(e.customerId).toBe('c1');
    expect(e.challenge.methods).toEqual(['EMAIL']);
  });
});

describe('codeErrorFrom', () => {
  it('keeps the server numbers and a known code', () => {
    const e = codeErrorFrom({ message: 'Wrong code', errorCode: 'WRONG_CODE', attemptsLeft: 2 }, 'x');
    expect(isCodeError(e)).toBe(true);
    expect(e).toMatchObject({ errorCode: 'WRONG_CODE', attemptsLeft: 2, message: 'Wrong code' });
  });

  it('carries a lock with its wait', () => {
    expect(codeErrorFrom({ errorCode: 'LOCKED', retryAfterSeconds: 840 }, 'x')).toMatchObject({ errorCode: 'LOCKED', retryAfterSeconds: 840 });
  });

  it('falls back to UNKNOWN and the fallback message for an unrecognised answer', () => {
    expect(codeErrorFrom({ errorCode: 'SOMETHING_NEW' }, 'Try again')).toMatchObject({ errorCode: 'UNKNOWN', message: 'Try again' });
  });

  it('is not mistaken for other errors', () => {
    expect(isCodeError({ status: 400, message: 'x' })).toBe(false);
    expect(isCodeError(null)).toBe(false);
  });
});

describe('codeSentFrom', () => {
  const data = { maskedEmail: 'jo•••@mail.com', expiresAt: '2026-11-04T10:05:00Z', resendAvailableAt: '2026-11-04T10:03:00Z', serverTime: '2026-11-04T10:00:00Z' };

  it('returns the timers of a sent code', () => {
    expect(codeSentFrom({ action: 1, data }, 'x')).toEqual(data);
  });

  it('turns a refused send into a code error with the wait', () => {
    expect(() => codeSentFrom({ action: 0, errorCode: 'RATE_LIMITED', retryAfterSeconds: 480, message: 'Slow down' }, 'x')).toThrow(
      expect.objectContaining({ errorCode: 'RATE_LIMITED', retryAfterSeconds: 480 }),
    );
  });

  it('refuses a success that has no timers rather than inventing them', () => {
    expect(() => codeSentFrom({ action: 1, data: { expiresAt: data.expiresAt } }, 'x')).toThrow();
  });
});

describe('secondsUntil', () => {
  it('counts on the server clock when the phone clock is wrong', () => {
    // Server says it is 10:00:00 while the phone thinks it is 09:00:00.
    const phoneNow = Date.parse('2026-11-04T09:00:00Z');
    expect(secondsUntil('2026-11-04T10:03:00Z', '2026-11-04T10:00:00Z', phoneNow, phoneNow)).toBe(180);
    expect(secondsUntil('2026-11-04T10:03:00Z', '2026-11-04T10:00:00Z', phoneNow, phoneNow + 60_000)).toBe(120);
  });

  it('never goes below zero', () => {
    const now = Date.parse('2026-11-04T10:10:00Z');
    expect(secondsUntil('2026-11-04T10:03:00Z', '2026-11-04T10:10:00Z', now, now)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it.each([
    [180, '3:00'],
    [90, '1:30'],
    [5, '0:05'],
    [0, '0:00'],
    [-3, '0:00'],
  ])('%i seconds reads %s', (s, text) => {
    expect(formatCountdown(s)).toBe(text);
  });
});
