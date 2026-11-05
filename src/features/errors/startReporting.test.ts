const mockScope = { setTag: jest.fn(), setExtra: jest.fn() };
const mockInit = jest.fn();
const mockCaptureMessage = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: (...a: unknown[]) => mockInit(...a),
  withScope: (fn: (s: typeof mockScope) => void) => fn(mockScope),
  captureMessage: (...a: unknown[]) => mockCaptureMessage(...a),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.4.0', android: { versionCode: 41 } } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { setErrorSink } from './report';
import { scrubEvent, startErrorReporting } from './startReporting';

/** Store-build reporter: the SDK is started only with a DSN, sends no personal data, and tags the support code. */
describe('startErrorReporting (native SDK)', () => {
  beforeEach(() => {
    mockInit.mockClear();
    mockCaptureMessage.mockClear();
    mockScope.setTag.mockClear();
    jest.resetModules();
  });
  afterEach(() => setErrorSink(null));

  it('does nothing without a DSN', () => {
    const { startErrorReporting: start } = require('./startReporting');
    expect(start(undefined)).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('starts the SDK once with no default PII, no tracing and native capture on', () => {
    const { startErrorReporting: start } = require('./startReporting');
    expect(start('https://k@o1.ingest.de.sentry.io/1')).toBe(true);
    expect(start('https://k@o1.ingest.de.sentry.io/1')).toBe(false);
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit.mock.calls[0][0]).toMatchObject({ sendDefaultPii: false, tracesSampleRate: 0, enableNative: true, release: '2.4.0', dist: '41' });
  });

  it('reports a handled failure through the SDK tagged with the support code', () => {
    const { startErrorReporting: start } = require('./startReporting');
    const { reportError } = require('./report');
    const { presentError } = require('./presentError');
    start('https://k@o1.ingest.de.sentry.io/1');
    const err = { status: 500, message: 'x', body: { errorCode: 'UNEXPECTED_ERROR', supportCode: 'K7M-9PQ' } };
    reportError(err, presentError(err), 'album.create');
    expect(mockScope.setTag).toHaveBeenCalledWith('support_code', 'K7M-9PQ');
    expect(mockScope.setTag).toHaveBeenCalledWith('where', 'album.create');
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
  });

  it('scrubs the user, the request query and personal text before the SDK sends an event', () => {
    const event = scrubEvent({
      user: { email: 'jo@mail.com' },
      request: { method: 'POST', url: 'https://backend.connekyt.com/api/x?email=jo@mail.com' },
      message: 'call +250 788 123 456 for jo@mail.com',
      exception: { values: [{ value: 'wallet 4242 4242 4242 4242 refused' }] },
      extra: { otp: '123456', note: 'a@b.co' },
      breadcrumbs: [{ message: 'Bearer abc.def-123', data: { token: 'x' } }],
    } as never) as Record<string, any>;
    expect(event.user).toBeUndefined();
    expect(event.request.url).toBe('https://backend.connekyt.com/api/x');
    const text = JSON.stringify(event);
    for (const leak of ['jo@mail.com', '788', '4242', 'abc.def-123', '123456']) expect(text).not.toContain(leak);
  });
});

// keep the unused import honest: the module under test is also imported statically above for scrubEvent
void startErrorReporting;
