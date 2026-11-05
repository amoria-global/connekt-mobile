import { CATALOGUE, TRANSPORT } from './catalogue';
import { fill, isSafeMessage, makeSupportCode, pluralize, presentError, waitText } from './presentError';
import { reportError, scrubPii, scrubString, setErrorSink, type ErrorReport } from './report';

/**
 * Pins the rules the whole error system rests on: where a failure shows, what it says, and that nothing technical
 * reaches a person. The catalogue copy is checked as data so a future edit cannot reintroduce a code or a dash.
 */
describe('catalogue copy', () => {
  const all = [...Object.entries(CATALOGUE), ...Object.entries(TRANSPORT)];

  it.each(all)('%s reads as plain language', (_key, entry) => {
    const text = `${entry.title} ${entry.message}`;
    expect(text).not.toMatch(/[–—]/); // no en or em dashes
    expect(text).not.toMatch(/\b[45]\d\d\b/); // no HTTP statuses
    expect(text).not.toMatch(/ERR_|Exception|payload|null|undefined|\bPAID\b/);
    expect(entry.title.length).toBeLessThanOrEqual(48);
  });

  it('never blames the person', () => {
    const text = all.map(([, e]) => `${e.title} ${e.message}`).join(' ');
    expect(text).not.toMatch(/you (entered|typed|made|did) (a )?wrong|invalid (code|input)|your fault/i);
  });
});

describe('presentError: where a failure shows', () => {
  it('puts a wrong code on the code field with the attempts left', () => {
    const p = presentError({ action: 0, errorCode: 'WRONG_CODE', attemptsLeft: 2 }, { intent: 'validate' });
    expect(p.kind).toBe('field');
    expect(p.field).toBe('code');
    expect(p.message).toContain('2 tries left');
    expect(p.title).toBe("That code didn't work");
  });

  it('says "1 try left" for one attempt', () => {
    expect(presentError({ errorCode: 'WRONG_CODE', attemptsLeft: 1 }).message).toContain('1 try left');
  });

  it('uses the field the server names over the catalogue default', () => {
    const p = presentError({ errorCode: 'MISSING_FIELDS', field: 'price' }, { intent: 'validate' });
    expect(p.kind).toBe('field');
    expect(p.field).toBe('price');
  });

  it('takes the first field of an ApiError fieldErrors map', () => {
    const p = presentError({ status: 400, message: 'bad', fieldErrors: { email: 'x' } }, { intent: 'validate' });
    expect(p.kind).toBe('field');
    expect(p.field).toBe('email');
  });

  it('falls back to a toast when a field error has no field to blame', () => {
    expect(presentError({ errorCode: 'MISSING_FIELDS' }).kind).toBe('toast');
  });

  it('shows a network blip as a toast with Retry', () => {
    const p = presentError({ status: 0, message: 'Network request failed' });
    expect(p.kind).toBe('toast');
    expect(p.actions.map((a) => a.id)).toContain('retry');
    expect(p.title).toBe("You're offline");
  });

  it('shows a timeout as its own message', () => {
    expect(presentError({ status: 408, message: 'Request timed out' }).title).toBe('That took too long');
  });

  it('leaves the loud part to a Banner when the device is known to be offline', () => {
    expect(presentError({ status: 0, message: 'x' }, { offline: true }).kind).toBe('banner');
  });

  it('never interrupts for a background refresh', () => {
    expect(presentError({ errorCode: 'LOCKED', retryAfterSeconds: 900 }, { intent: 'background' }).kind).toBe('toast');
  });

  it('turns a payment failure into a sheet with the reassurance', () => {
    const p = presentError({ status: 500, message: 'boom' }, { intent: 'pay', reassurance: "You weren't charged." });
    expect(p.kind).toBe('sheet');
    expect(p.message).toContain("You weren't charged.");
    expect(p.actions.map((a) => a.id)).toEqual(expect.arrayContaining(['retry']));
  });

  it('asks for a decision before a destructive step fails quietly', () => {
    expect(presentError({ status: 500, message: 'x' }, { intent: 'destructive' }).kind).toBe('sheet');
  });

  it('shows a screen that cannot load at all as full screen with Try again and Home plus a support code', () => {
    const p = presentError({ status: 503, message: 'x' }, { intent: 'load', critical: true });
    expect(p.kind).toBe('fullscreen');
    expect(p.actions.map((a) => a.id)).toEqual(['retry', 'home']);
    expect(p.supportCode).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  });

  it('keeps a non-critical load failure to a toast', () => {
    expect(presentError({ status: 503, message: 'x' }, { intent: 'load' }).kind).toBe('toast');
  });

  it('sends an expired session to sign-in, not to an error', () => {
    for (const e of [{ status: 401, message: 'x' }, { errorCode: 'SESSION_EXPIRED' }]) {
      const p = presentError(e, { intent: 'save' });
      expect(p.kind).toBe('signin');
      expect(p.actions.map((a) => a.id)).toContain('sign-in');
    }
  });
});

describe('presentError: what a person reads', () => {
  it('never shows a raw exception, a status or an enum name, and offers a support code instead', () => {
    const raw = 'Failed to create PAID album: org.hibernate.exception.ConstraintViolationException: could not execute statement';
    const p = presentError({ status: 400, message: raw, body: { action: 0, message: raw } });
    expect(p.message).not.toContain('PAID');
    expect(p.message).not.toContain('hibernate');
    expect(p.message).toBe(TRANSPORT.unknown.message);
    expect(p.supportCode).toBeDefined();
    expect(p.actions.map((a) => a.id)).toEqual(expect.arrayContaining(['retry', 'contact-support']));
  });

  it('shows a friendly server message when no code exists and the message is safe', () => {
    const p = presentError({ status: 400, message: 'That email is already registered.' });
    expect(p.message).toBe('That email is already registered.');
    expect(p.supportCode).toBeUndefined();
  });

  it('does not trust a safe-looking message on a 5xx', () => {
    expect(presentError({ status: 500, message: 'Something happened here.' }).message).toBe(TRANSPORT.server.message);
  });

  it('gives an unknown code the generic message', () => {
    const p = presentError({ action: 0, errorCode: 'SOMETHING_NEW', message: 'ERR_SOMETHING_NEW' });
    expect(p.message).toBe(TRANSPORT.unknown.message);
    expect(p.code).toBe('SOMETHING_NEW');
  });

  it('handles a thrown Error, a string and nothing at all', () => {
    expect(presentError(new TypeError('Network request failed')).title).toBe("You're offline");
    expect(presentError('oops').kind).toBeDefined();
    expect(presentError(undefined).message).toBe(TRANSPORT.unknown.message);
  });

  it('every presentation offers a next step', () => {
    const inputs = [{ status: 0 }, { status: 401 }, { status: 403 }, { status: 404 }, { status: 409 }, { status: 429 }, { status: 500 }, {}, { errorCode: 'LOCKED' }];
    for (const i of inputs) expect(presentError(i).actions.length).toBeGreaterThan(0);
  });

  it('puts the wait into a locked message and rounds up', () => {
    expect(presentError({ errorCode: 'LOCKED', retryAfterSeconds: 900 }).message).toBe('For your security, start again in 15 minutes.');
    expect(presentError({ errorCode: 'RESEND_TOO_SOON', retryAfterSeconds: 61 }).message).toBe('You can ask for another in 2 minutes.');
  });
});

describe('codes the backend now sends (ApiErrors)', () => {
  it('puts a field-specific refusal on its field using the server text', () => {
    const p = presentError({ status: 400, message: 'x', body: { action: 0, errorCode: 'MISSING_FIELDS', field: 'title', message: 'Add a title for this album.' } }, { intent: 'validate' });
    expect(p.kind).toBe('field');
    expect(p.field).toBe('title');
    expect(p.message).toBe('Add a title for this album.');
  });

  it('shows INVALID_VALUE on the named field with the server text, and falls back to the catalogue when that text looks technical', () => {
    const ok = presentError({ status: 400, message: 'x', body: { errorCode: 'INVALID_VALUE', field: 'price', message: "That price can't be used. Check it and try again." } }, { intent: 'validate' });
    expect(ok.message).toBe("That price can't be used. Check it and try again.");
    const bad = presentError({ status: 400, message: 'x', body: { errorCode: 'INVALID_VALUE', field: 'price', message: 'ConstraintViolationException on album' } }, { intent: 'validate' });
    expect(bad.message).toBe('Check the details and try again.');
  });

  it('turns NOT_ALLOWED, NOT_FOUND and CONFLICT into decisions with a way forward', () => {
    for (const code of ['NOT_ALLOWED', 'NOT_FOUND', 'CONFLICT']) {
      const p = presentError({ status: 403, message: 'x', body: { errorCode: code, message: 'You do not have permission to publish this album.' } });
      expect(p.kind).toBe('sheet');
      expect(p.actions.length).toBeGreaterThan(0);
    }
  });

  it('shows the generic copy and the server support code for UNEXPECTED_ERROR', () => {
    const p = presentError({ status: 500, message: 'x', body: { errorCode: 'UNEXPECTED_ERROR', supportCode: 'K7M-9PQ', message: "We couldn't finish that. Please try again, and contact support if it keeps happening." } });
    expect(p.kind).toBe('toast');
    expect(p.supportCode).toBe('K7M-9PQ');
    expect(p.actions.map((a) => a.id)).toEqual(expect.arrayContaining(['retry', 'contact-support']));
  });
});

describe('helpers', () => {
  it('waitText', () => {
    expect(waitText(1)).toBe('1 second');
    expect(waitText(45)).toBe('45 seconds');
    expect(waitText(60)).toBe('1 minute');
    expect(waitText(901)).toBe('16 minutes');
  });

  it('fill drops a sentence whose number is missing instead of printing a placeholder', () => {
    expect(fill('Check it. {attemptsLeft} left.', {})).toBe('Check it.');
    expect(fill('Try again in {wait}.', {})).toBe('Try again in a little while.');
  });

  it('pluralize', () => {
    expect(pluralize(1, 'photo')).toBe('1 photo');
    expect(pluralize(0, 'photo')).toBe('0 photos');
    expect(pluralize(3, 'photo')).toBe('3 photos');
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
  });

  it('isSafeMessage', () => {
    expect(isSafeMessage('That email is already registered.')).toBe(true);
    expect(isSafeMessage('Request failed with status 500')).toBe(false);
    expect(isSafeMessage('java.lang.NullPointerException')).toBe(false);
    expect(isSafeMessage('x'.repeat(200))).toBe(false);
    expect(isSafeMessage('ERR_NETWORK_FAILED')).toBe(false);
    expect(isSafeMessage(undefined)).toBe(false);
  });

  it('makeSupportCode avoids look-alike characters and is deterministic with a seeded random', () => {
    let i = 0;
    const seq = () => [0.0, 0.2, 0.4, 0.6, 0.8, 0.99][i++ % 6];
    const code = makeSupportCode(seq);
    expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(code).not.toMatch(/[01IO]/);
  });
});

describe('reporting and PII scrubbing', () => {
  afterEach(() => setErrorSink(null));

  it('removes emails, phone numbers, tokens and long digit runs from text', () => {
    const s = scrubString('jo@mail.com called +250 788 123 456 with Bearer abc.def-123 card 4242 4242 4242 4242');
    expect(s).not.toContain('jo@mail.com');
    expect(s).not.toMatch(/788/);
    expect(s).not.toContain('abc.def-123');
    expect(s).not.toMatch(/4242/);
  });

  it('blanks secret-looking keys but keeps errorCode readable', () => {
    const out = scrubPii({ errorCode: 'LOCKED', otp: '123456', accessToken: 'x', apiKey: 'y', password: 'z', nested: { email: 'a@b.co', note: 'hi a@b.co' } }) as Record<string, any>;
    expect(out.errorCode).toBe('LOCKED');
    expect(out.otp).toBe('[redacted]');
    expect(out.accessToken).toBe('[redacted]');
    expect(out.apiKey).toBe('[redacted]');
    expect(out.password).toBe('[redacted]');
    expect(out.nested.email).toBe('[redacted]');
    expect(out.nested.note).toBe('hi [email]');
  });

  it('survives a circular value', () => {
    const a: any = { name: 'x' };
    a.self = a;
    expect(() => scrubPii(a)).not.toThrow();
  });

  it('sends the same support code the screen shows, scrubbed', () => {
    const seen: ErrorReport[] = [];
    setErrorSink((r) => seen.push(r));
    const err = { status: 500, message: 'Failed for jo@mail.com', body: { token: 'abc' } };
    const p = presentError(err, { intent: 'load', critical: true });
    reportError(err, p, 'album.create');
    expect(seen).toHaveLength(1);
    expect(seen[0].supportCode).toBe(p.supportCode);
    expect(seen[0].where).toBe('album.create');
    expect(JSON.stringify(seen[0].detail)).not.toContain('jo@mail.com');
    expect(JSON.stringify(seen[0].detail)).not.toContain('abc');
  });

  it('does nothing without a sink and never throws from a broken one', () => {
    const p = presentError({ status: 500 });
    expect(() => reportError({}, p)).not.toThrow();
    setErrorSink(() => {
      throw new Error('tracker down');
    });
    expect(() => reportError({}, p)).not.toThrow();
  });
});
