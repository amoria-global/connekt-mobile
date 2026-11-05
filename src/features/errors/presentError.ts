import { ACTION_LABELS, CATALOGUE, TRANSPORT, type ActionId, type CatalogueEntry, type Severity, type Tone } from './catalogue';

/**
 * The one place that decides HOW a failure is shown and WHAT it says. Screens hand over whatever they caught and say
 * what they were doing; they never pick a component or write copy themselves.
 *
 * Input is anything: an ApiError from the client ({ status, message, body, fieldErrors }), an envelope
 * ({ action: 0, errorCode, message, field }), an Error, a string. Output is a Presentation.
 *
 * Rules this file enforces:
 * - Copy comes from the catalogue. A server message is shown only when it looks safe (see `isSafeMessage`), so a raw
 *   exception, a status number or an internal word never reaches a screen. Anything else is the generic message.
 * - Every unknown failure gets a support code, and the caller reports it with the same code (`reportError`).
 * - Every presentation has at least one next step. There is no dead-end "OK".
 */

export type Intent =
  /** Checking input: the problem belongs on a field. */
  | 'validate'
  /** Fetching to show a screen. */
  | 'load'
  /** Saving something the person typed. */
  | 'save'
  /** Money moves: a failure needs a decision and reassurance. */
  | 'pay'
  /** Deleting or another step that cannot be undone. */
  | 'destructive'
  /** A refresh nobody asked for: never interrupt. */
  | 'background';

export type ErrorContext = {
  intent?: Intent;
  /** The form field to blame when neither the server nor the catalogue names one. */
  field?: string;
  /** A failure that leaves the whole screen with nothing to show. */
  critical?: boolean;
  /** The device is known to be offline: a Banner owns that, so the error itself stays quiet. */
  offline?: boolean;
  /** Extra sentence for the sheet: what did and did not happen, e.g. "You weren't charged." */
  reassurance?: string;
};

export type Action = { id: ActionId; label: string };

export type Presentation = {
  kind: Severity;
  tone: Tone;
  title: string;
  message: string;
  actions: Action[];
  /** The field to focus and mark, for kind 'field'. */
  field?: string;
  /** Show it and copy it, and send it with the report, so support can find the event. */
  supportCode?: string;
  /** The server's own error code, for logs and tests. Never shown. */
  code?: string;
  retryAfterSeconds?: number;
};

type Parsed = {
  status?: number;
  code?: string;
  message?: string;
  field?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  /** The code the server logged this failure under, so the one a person reads out finds the backend event. */
  supportCode?: string;
  network: boolean;
};

const SAFE_MAX = 160;
// Words and shapes that mean "this came from code, not from a person".
const TECHNICAL = [
  /exception/i,
  /\bERR_[A-Z_]+/,
  /\b[45]\d\d\b/,
  /\bfailed to\b/i,
  /\bnull\b|\bundefined\b|\bNaN\b/,
  /\bsql\b|\bhibernate\b|\bjdbc\b|\bconstraint\b/i,
  /\bpayload\b|\bstack\b|\btrace\b|\bnullpointer/i,
  /\bPAID\b|\bFREE\b album/,
  /\bat [\w.$]+\(/,
  /[A-Z][A-Z0-9]*_[A-Z0-9_]{2,}/,
  /\{|\}|<|>/,
  /: *[A-Za-z.]+Exception/,
];

/** A server message a person can read as is: short, a sentence, none of the technical shapes above. */
export function isSafeMessage(message: unknown): message is string {
  if (typeof message !== 'string') return false;
  const m = message.trim();
  if (m.length < 4 || m.length > SAFE_MAX) return false;
  return !TECHNICAL.some((re) => re.test(m));
}

function asNumber(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function parse(error: unknown): Parsed {
  if (typeof error === 'string') return { message: error, network: false };
  if (!error || typeof error !== 'object') return { network: false };
  const e = error as Record<string, unknown>;
  // An ApiError carries the envelope in `body`; an envelope is the object itself.
  const body = (e.body && typeof e.body === 'object' ? (e.body as Record<string, unknown>) : e) as Record<string, unknown>;
  const fieldErrors = (e.fieldErrors ?? body.fieldErrors) as Record<string, unknown> | undefined;
  const firstField = fieldErrors && typeof fieldErrors === 'object' ? Object.keys(fieldErrors)[0] : undefined;
  const status = asNumber(e.status);
  const message = typeof body.message === 'string' ? body.message : typeof e.message === 'string' ? e.message : undefined;
  return {
    status,
    code: typeof body.errorCode === 'string' ? body.errorCode : undefined,
    message,
    field: typeof body.field === 'string' ? body.field : firstField,
    attemptsLeft: asNumber(body.attemptsLeft),
    retryAfterSeconds: asNumber(body.retryAfterSeconds),
    supportCode: typeof body.supportCode === 'string' && /^[A-Z0-9-]{4,16}$/.test(body.supportCode) ? body.supportCode : undefined,
    // The client reports a failed request as status 0 or 408; a thrown TypeError("Network request failed") has no status.
    network: status === 0 || status === 408 || (status === undefined && error instanceof Error && /network|fetch|timed? ?out/i.test(error.message)),
  };
}

/** "45 seconds", "1 minute", "15 minutes". Rounds up so a person never retries a moment early. */
export function waitText(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return s === 1 ? '1 second' : `${s} seconds`;
  const m = Math.ceil(s / 60);
  return m === 1 ? '1 minute' : `${m} minutes`;
}

function plural(n: number, one: string, other: string): string {
  return n === 1 ? one : other;
}

/** Fills {attemptsLeft} and {wait}; a sentence whose parameter is missing is dropped whole. */
export function fill(template: string, p: { attemptsLeft?: number; retryAfterSeconds?: number }): string {
  const parts = template.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const part of parts) {
    let text = part;
    if (text.includes('{attemptsLeft}')) {
      if (p.attemptsLeft === undefined) continue;
      text = text.replace('{attemptsLeft}', `${p.attemptsLeft} ${plural(p.attemptsLeft, 'try', 'tries')}`);
    }
    if (text.includes('{wait}')) {
      if (p.retryAfterSeconds === undefined) {
        // "Try again in {wait}." without a number is still useful as "Try again in a little while."
        text = text.replace('in {wait}', 'in a little while');
        text = text.replace('{wait}', 'a little while');
      } else {
        text = text.replace('{wait}', waitText(p.retryAfterSeconds));
      }
    }
    out.push(text);
  }
  return out.join(' ');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Six characters people can read out over the phone: no 0, 1, I or O. */
export function makeSupportCode(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

function transportFor(p: Parsed): keyof typeof TRANSPORT {
  if (p.network) return p.status === 408 ? 'timeout' : 'offline';
  switch (p.status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
    case 410:
      return 'notFound';
    case 409:
      return 'conflict';
    case 429:
      return 'tooMany';
    default:
      return p.status !== undefined && p.status >= 500 ? 'server' : 'unknown';
  }
}

function actionsOf(ids: ActionId[] | undefined, fallback: ActionId[]): Action[] {
  return (ids && ids.length ? ids : fallback).map((id) => ({ id, label: ACTION_LABELS[id] }));
}

export function presentError(error: unknown, ctx: ErrorContext = {}, random: () => number = Math.random): Presentation {
  const p = parse(error);
  const intent = ctx.intent ?? 'save';
  const entry: CatalogueEntry | undefined = p.code ? CATALOGUE[p.code] : undefined;
  const transport = entry ? undefined : TRANSPORT[transportFor(p)];
  const base = entry ?? transport!;
  const known = !!entry || (transport !== undefined && transport !== TRANSPORT.unknown);

  // A server message may stand in for the generic one when it is clearly written for people.
  const serverCopy = !known && p.status !== undefined && p.status >= 400 && p.status < 500 && isSafeMessage(p.message) ? p.message : undefined;

  let kind = base.severity;
  let tone: Tone = base.tone ?? 'danger';
  const field = p.field ?? entry?.field ?? ctx.field;

  // The caller's intent can raise or lower how loud the failure is, never below the catalogue's floor for 'field'.
  if (intent === 'validate' && field) kind = 'field';
  if (intent === 'background' && kind !== 'signin') kind = 'toast';
  if (intent === 'pay' && kind === 'toast') kind = 'sheet';
  if (intent === 'destructive' && kind === 'toast') kind = 'sheet';
  if (ctx.critical && (p.network || (p.status ?? 0) >= 500) && intent === 'load') kind = 'fullscreen';
  if (ctx.offline && p.network) kind = 'banner';
  if (kind === 'field' && !field) kind = 'toast';
  if (kind === 'field') tone = 'danger';

  const message = serverCopy ?? fill(base.message, p);
  const title = base.title;
  const reassurance = ctx.reassurance && (kind === 'sheet' || kind === 'fullscreen') ? ` ${ctx.reassurance}` : '';

  const needsRetry: ActionId[] = kind === 'fullscreen' ? ['retry', 'home'] : kind === 'sheet' ? ['retry', 'dismiss'] : ['retry'];
  const noRetryKinds: Severity[] = ['field', 'signin'];
  const fallback: ActionId[] = noRetryKinds.includes(kind) ? ['dismiss'] : needsRetry;
  const actions = actionsOf(kind === 'fullscreen' ? base.actions?.includes('home') ? base.actions : [...(base.actions ?? ['retry']), 'home'] : base.actions, fallback);

  const unknown = !known && !serverCopy;
  return {
    kind,
    tone,
    title,
    message: `${message}${reassurance}`.trim(),
    actions,
    field: kind === 'field' ? field : undefined,
    // The server's own code wins: it is the one in the backend log. Otherwise make one for failures nobody has a code for.
    supportCode: p.supportCode ?? (unknown || kind === 'fullscreen' || (p.status ?? 0) >= 500 ? makeSupportCode(random) : undefined),
    code: p.code,
    retryAfterSeconds: p.retryAfterSeconds,
  };
}

/** "1 photo", "3 photos". The one place that decides between the two forms. */
export function pluralize(count: number, one: string, other = `${one}s`): string {
  return `${count} ${count === 1 ? one : other}`;
}
