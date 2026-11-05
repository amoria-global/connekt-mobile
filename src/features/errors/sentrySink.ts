import { scrubPii, scrubString, setErrorSink, type ErrorReport, type ErrorSink } from './report';

/**
 * Reports to Sentry over plain HTTPS, with no SDK and no native module, so it works on every installed build and can
 * ship in an OTA update. It speaks Sentry's envelope format directly: one `event` per failure, tagged with the support
 * code the person was shown, so a code read out to support finds exactly this event.
 *
 * Nothing is sent unless a DSN is configured. Everything is scrubbed first (`report.ts`), events are rate limited and
 * de-duplicated, and a failing request is swallowed: reporting must never become a second failure.
 *
 * What this does not do: native crashes and symbolicated stack traces. Those need the Sentry SDK, which carries native
 * code and so waits for the next store build (see docs/ERROR_REPORTING.md).
 */

export type SentryOptions = {
  dsn: string;
  /** Where to POST instead of Sentry's own host (the website tunnels through its own origin to dodge ad blockers). */
  endpoint?: string;
  app: string;
  platform: string;
  environment?: string;
  release?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Events allowed per rolling minute. */
  perMinute?: number;
};

export type ParsedDsn = { key: string; host: string; projectId: string; protocol: string };

/** `https://<publicKey>@<host>/<projectId>`; null for anything else. */
export function parseDsn(dsn: string | undefined | null): ParsedDsn | null {
  if (!dsn) return null;
  const m = /^(https?):\/\/([A-Za-z0-9]+)(?::[^@]*)?@([^/]+)\/(\d+)\/?$/.exec(dsn.trim());
  if (!m) return null;
  return { protocol: m[1], key: m[2], host: m[3], projectId: m[4] };
}

function eventId(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(random() * 16).toString(16);
  return s;
}

/** The two-line-plus envelope Sentry's ingest takes. Exported for tests. */
export function buildEnvelope(report: ErrorReport, o: SentryOptions, nowMs: number): { id: string; body: string } {
  const id = eventId();
  const tags: Record<string, string> = { app: o.app, platform: o.platform, kind: report.kind };
  if (report.supportCode) tags.support_code = report.supportCode;
  if (report.code) tags.error_code = report.code;
  if (report.where) tags.where = report.where;
  const detail = scrubPii(report.detail);
  const message = scrubString(
    typeof (detail as { message?: unknown })?.message === 'string'
      ? String((detail as { message: string }).message)
      : `${report.where ?? 'error'}${report.code ? ` ${report.code}` : ''}`,
  );
  const event = {
    event_id: id,
    timestamp: nowMs / 1000,
    platform: 'javascript',
    level: report.kind === 'crash' ? 'fatal' : 'error',
    logger: 'connekyt.errors',
    message,
    environment: o.environment ?? 'production',
    ...(o.release ? { release: o.release } : {}),
    tags,
    extra: { detail },
  };
  const parsed = parseDsn(o.dsn);
  const header = { event_id: id, sent_at: new Date(nowMs).toISOString(), ...(parsed ? { dsn: o.dsn } : {}) };
  return { id, body: [JSON.stringify(header), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n') };
}

/** A sink that posts each report once, at most `perMinute` a minute, and never twice for the same failure in a minute. */
export function createSentrySink(o: SentryOptions): ErrorSink | null {
  const dsn = parseDsn(o.dsn);
  if (!dsn) return null;
  const send = o.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!send) return null;
  const now = o.now ?? (() => Date.now());
  const limit = o.perMinute ?? 10;
  const url = o.endpoint ?? `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`;
  const recent: number[] = [];
  const seen = new Map<string, number>();

  return (report) => {
    const t = now();
    while (recent.length && t - recent[0] > 60_000) recent.shift();
    if (recent.length >= limit) return;
    const key = `${report.code ?? ''}|${report.where ?? ''}|${report.kind}|${report.supportCode ? '' : JSON.stringify(report.detail).slice(0, 120)}`;
    const last = seen.get(key);
    if (last !== undefined && t - last < 60_000) return;
    seen.set(key, t);
    if (seen.size > 200) seen.clear();
    recent.push(t);
    try {
      const { body } = buildEnvelope(report, o, t);
      void Promise.resolve(
        send(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=connekyt-sink/1.0, sentry_key=${dsn.key}` },
          body,
          keepalive: true,
        }),
      ).catch(() => {});
    } catch {
      /* reporting must never become a second failure */
    }
  };
}

/** Installs the sink when a DSN is configured; returns whether it did. */
export function initSentryReporting(o: Omit<SentryOptions, 'dsn'> & { dsn?: string | null }): boolean {
  const sink = o.dsn ? createSentrySink({ ...o, dsn: o.dsn }) : null;
  if (!sink) return false;
  setErrorSink(sink);
  return true;
}

type Handler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void };

/**
 * Reports an uncaught JavaScript error, then hands it to whatever handled it before (so the red box and the app's own
 * crash behaviour are untouched). Returns an undo function.
 */
export function installCrashReporting(report: ErrorSink, utils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils): () => void {
  if (!utils) return () => {};
  const previous = utils.getGlobalHandler();
  const handler: Handler = (error, isFatal) => {
    try {
      const e = error as { name?: string; message?: string; stack?: string } | undefined;
      report({
        kind: 'crash',
        where: isFatal ? 'js.fatal' : 'js.uncaught',
        detail: { name: e?.name, message: scrubString(String(e?.message ?? error ?? 'unknown')), stack: scrubString(String(e?.stack ?? '').slice(0, 2000)) },
      });
    } catch {
      /* never let reporting change how a crash behaves */
    }
    previous(error, isFatal);
  };
  utils.setGlobalHandler(handler);
  return () => utils.setGlobalHandler(previous);
}
