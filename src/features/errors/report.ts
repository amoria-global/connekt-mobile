import type { Presentation } from './presentError';

/**
 * Where failures are reported. The screen shows a support code; the same code goes out with the event, so a person can
 * read it to support and support can find exactly that failure. Nothing here talks to a vendor: `setErrorSink` takes
 * the tracker (Sentry, once its setup is approved) and until then reports go nowhere.
 *
 * Everything is scrubbed first. Emails, phone numbers, tokens, card-length digit runs and values under secret-looking
 * keys never leave the device.
 */

export type ErrorReport = {
  supportCode?: string;
  code?: string;
  kind: string;
  /** What the person was doing, e.g. "album.create". Free of user data. */
  where?: string;
  /** Scrubbed detail for engineers. */
  detail: unknown;
};

export type ErrorSink = (report: ErrorReport) => void;

let sink: ErrorSink | null = null;

export function setErrorSink(next: ErrorSink | null): void {
  sink = next;
}

// Anchored, so `errorCode` stays readable while `code`, `otp`, `accessToken` and `apiKey` are blanked.
const SECRET_KEY = /^(.*pass(word)?.*|.*token.*|.*secret.*|authorization|cookie|otp|code|pin|cvv|card.*|account.*|iban|msisdn|phone.*|email|.*key)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const PHONE = /(?<![\w.])\+?\d[\d\s().-]{7,}\d(?![\w.])/g;

/** Redacts personal data in a string. Order matters: tokens before the generic digit runs. */
export function scrubString(text: string): string {
  return text
    .replace(JWT, '[token]')
    .replace(BEARER, '$1 [token]')
    .replace(EMAIL, '[email]')
    .replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 9 ? '[number]' : m));
}

/** Copies a value with every secret-looking key blanked and every string scrubbed. Depth-limited, cycle-safe. */
export function scrubPii(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 5) return '[deep]';
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrubPii(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : scrubPii(v, depth + 1, seen);
  }
  return out;
}

/** Sends one failure to the sink with its support code. Never throws: reporting must not become a second failure. */
export function reportError(error: unknown, presentation: Presentation, where?: string): void {
  if (!sink) return;
  try {
    const detail =
      error instanceof Error
        ? { name: error.name, message: scrubString(error.message) }
        : scrubPii(error);
    sink({ supportCode: presentation.supportCode, code: presentation.code, kind: presentation.kind, where, detail });
  } catch {
    /* a broken tracker must not break the app */
  }
}
