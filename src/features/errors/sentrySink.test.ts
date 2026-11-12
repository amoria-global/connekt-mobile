import { buildEnvelope, createSentrySink, installCrashReporting, isAppBreaking, isNoise, parseDsn } from './sentrySink';
import { presentError } from './presentError';
import { setErrorSink } from './report';

const DSN = 'https://abc123publickey@o1.ingest.de.sentry.io/4501';

/** Reports go out as Sentry envelopes, tagged with the support code, scrubbed, rate limited, and never a second failure. */
describe('parseDsn', () => {
  it('reads key, host and project from a DSN', () => {
    expect(parseDsn(DSN)).toEqual({ protocol: 'https', key: 'abc123publickey', host: 'o1.ingest.de.sentry.io', projectId: '4501' });
  });
  it.each([undefined, null, '', 'not a dsn', 'https://host/123', 'ftp://k@h/1', 'https://k@h/abc'])('rejects %j', (bad) => {
    expect(parseDsn(bad as string)).toBeNull();
  });
});

describe('buildEnvelope', () => {
  const opts = { dsn: DSN, app: 'mobile', platform: 'android', release: '2.3.2' };

  it('is three JSON lines: header, item type, event', () => {
    const { body } = buildEnvelope({ kind: 'toast', where: 'album.create', code: 'UNEXPECTED_ERROR', supportCode: '7F3-A2C', detail: {} }, opts, 1_700_000_000_000);
    const [h, i, e] = body.split('\n').map((l) => JSON.parse(l));
    expect(h.dsn).toBe(DSN);
    expect(i).toEqual({ type: 'event' });
    expect(e.tags).toMatchObject({ app: 'mobile', platform: 'android', support_code: '7F3-A2C', error_code: 'UNEXPECTED_ERROR', where: 'album.create' });
    expect(e.release).toBe('2.3.2');
    expect(e.timestamp).toBe(1_700_000_000);
  });

  it('marks a crash fatal and scrubs personal data out of the message and detail', () => {
    const { body } = buildEnvelope(
      { kind: 'crash', where: 'js.fatal', detail: { message: 'failed for jo@mail.com on +250 788 123 456 Bearer abc.def-123', token: 'secret' } },
      opts,
      1,
    );
    const e = JSON.parse(body.split('\n')[2]);
    expect(e.level).toBe('fatal');
    const text = JSON.stringify(e);
    expect(text).not.toContain('jo@mail.com');
    expect(text).not.toContain('788');
    expect(text).not.toContain('abc.def-123');
    expect(text).not.toContain('secret');
  });
});

describe('createSentrySink', () => {
  const mk = (extra: Record<string, unknown> = {}) => {
    const calls: { url: string; init: RequestInit }[] = [];
    let t = 1_000_000;
    const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {} as Response;
    }) as unknown as typeof fetch;
    const sink = createSentrySink({ dsn: DSN, app: 'mobile', platform: 'ios', fetchImpl, now: () => t, ...extra })!;
    return { sink, calls, advance: (ms: number) => (t += ms), fetchImpl };
  };

  it('posts to the project envelope endpoint with the public key', () => {
    const { sink, calls } = mk();
    sink({ kind: 'sheet', where: 'pay', code: 'X', supportCode: 'AAA-111', detail: {} });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://o1.ingest.de.sentry.io/api/4501/envelope/');
    expect((calls[0].init.headers as Record<string, string>)['X-Sentry-Auth']).toContain('sentry_key=abc123publickey');
  });

  it('can post through the website tunnel instead of the Sentry host', () => {
    const { sink, calls } = mk({ endpoint: '/api/monitoring' });
    sink({ kind: 'toast', where: 'w', detail: {} });
    expect(calls[0].url).toBe('/api/monitoring');
  });

  it('sends the same failure once a minute and again after that', () => {
    const { sink, calls, advance } = mk();
    const r = { kind: 'toast', where: 'album.create', code: 'UNEXPECTED_ERROR', supportCode: 'AAA-111', detail: {} };
    sink(r);
    sink(r);
    expect(calls).toHaveLength(1);
    advance(61_000);
    sink(r);
    expect(calls).toHaveLength(2);
  });

  it('allows ten different events a minute, no more', () => {
    const { sink, calls } = mk();
    for (let i = 0; i < 25; i++) sink({ kind: 'toast', where: `w${i}`, detail: {} });
    expect(calls).toHaveLength(10);
  });

  it('swallows a failing network and a throwing fetch', async () => {
    const reject = createSentrySink({ dsn: DSN, app: 'a', platform: 'p', fetchImpl: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch })!;
    expect(() => reject({ kind: 'toast', where: 'x', detail: {} })).not.toThrow();
    const sync = createSentrySink({ dsn: DSN, app: 'a', platform: 'p', fetchImpl: (() => { throw new Error('boom'); }) as unknown as typeof fetch })!;
    expect(() => sync({ kind: 'toast', where: 'y', detail: {} })).not.toThrow();
    await Promise.resolve();
  });

  it('is off without a valid DSN', () => {
    expect(createSentrySink({ dsn: '', app: 'a', platform: 'p' })).toBeNull();
    expect(createSentrySink({ dsn: 'nope', app: 'a', platform: 'p' })).toBeNull();
  });
});

describe('installCrashReporting', () => {
  it('reports an uncaught error, then still runs the previous handler, and can be undone', () => {
    const previous = jest.fn();
    let current: (e: unknown, f?: boolean) => void = previous;
    const utils = { getGlobalHandler: () => current, setGlobalHandler: (h: typeof current) => (current = h) };
    const report = jest.fn();

    const undo = installCrashReporting(report, utils);
    current(new Error('render failed for jo@mail.com'), true);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toMatchObject({ kind: 'crash', where: 'js.fatal' });
    expect(JSON.stringify(report.mock.calls[0][0])).not.toContain('jo@mail.com');
    expect(previous).toHaveBeenCalledWith(expect.any(Error), true);

    undo();
    expect(current).toBe(previous);
  });

  it('does nothing without ErrorUtils', () => {
    expect(() => installCrashReporting(jest.fn(), undefined)).not.toThrow();
  });

  it('still hands the crash on when the reporter itself throws', () => {
    const previous = jest.fn();
    let current: (e: unknown, f?: boolean) => void = previous;
    const utils = { getGlobalHandler: () => current, setGlobalHandler: (h: typeof current) => (current = h) };
    installCrashReporting(() => {
      throw new Error('tracker down');
    }, utils);
    expect(() => current(new Error('x'), false)).not.toThrow();
    expect(previous).toHaveBeenCalled();
  });
});

describe('the server support code', () => {
  afterEach(() => setErrorSink(null));

  it('is shown instead of a generated one, so the person reads out the code in the backend log', () => {
    const p = presentError({ status: 500, message: 'x', body: { action: 0, errorCode: 'UNEXPECTED_ERROR', supportCode: 'K7M-9PQ' } });
    expect(p.supportCode).toBe('K7M-9PQ');
  });

  it('ignores a malformed one and makes its own for an unknown failure', () => {
    const p = presentError({ status: 500, message: 'x', body: { supportCode: '<script>' } });
    expect(p.supportCode).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  });
});

describe('isNoise', () => {
  const crash = (message: string, where = 'js.uncaught') => ({ kind: 'crash' as const, where, detail: { message } });

  it.each(['Network request failed', 'Failed to fetch', 'Load failed'])('drops a bare uncaught "%s"', (m) => {
    expect(isNoise(crash(m))).toBe(true);
  });

  it('keeps a real crash, a handled failure, and the deliberate test report', () => {
    expect(isNoise(crash("undefined is not an object (evaluating 'a.b')"))).toBe(false);
    expect(isNoise({ kind: 'toast', where: 'pay', detail: { message: 'Network request failed' } })).toBe(false);
    expect(isNoise(crash('Network request failed', 'sentry.test'))).toBe(false);
  });

  it('never reaches the network', () => {
    const fetchImpl = jest.fn(async () => ({}) as Response) as unknown as typeof fetch;
    const sink = createSentrySink({ dsn: DSN, app: 'mobile', platform: 'ios', fetchImpl })!;
    sink(crash('Network request failed'));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('severity', () => {
  const level = (r: Parameters<typeof buildEnvelope>[0]) =>
    JSON.parse(buildEnvelope(r, { dsn: DSN, app: 'mobile', platform: 'ios' }, 1).body.split('\n')[2]).level;

  it('is fatal only for a fatal JavaScript error; an uncaught one the app survived is an error', () => {
    expect(level({ kind: 'crash', where: 'js.fatal', detail: {} })).toBe('fatal');
    expect(level({ kind: 'crash', where: 'js.uncaught', detail: {} })).toBe('error');
    expect(isAppBreaking({ kind: 'toast', where: 'js.fatal', detail: {} })).toBe(false);
  });

  it('carries the release, the update id as dist, and the extra tags', () => {
    const e = JSON.parse(
      buildEnvelope({ kind: 'toast', where: 'x', detail: {} }, { dsn: DSN, app: 'mobile', platform: 'ios', release: '2.3.2+ota.a1b2c3d4', dist: 'a1b2c3d4', extraTags: { update_id: 'u-1' } }, 1).body.split('\n')[2],
    );
    expect(e.release).toBe('2.3.2+ota.a1b2c3d4');
    expect(e.dist).toBe('a1b2c3d4');
    expect(e.tags).toMatchObject({ update_id: 'u-1', app: 'mobile' });
  });
});
