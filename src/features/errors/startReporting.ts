import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { scrubPii, scrubString, setErrorSink, type ErrorReport } from './report';
import { createSentrySink, installCrashReporting } from './sentrySink';

let started = false;

/** Removes personal data from an event before the SDK sends it. Mirrors `report.ts`, so every channel scrubs the same way. */
export function scrubEvent<T extends Sentry.ErrorEvent | Sentry.Event>(event: T): T {
  event.user = undefined;
  if (event.request) event.request = { method: event.request.method, url: event.request.url?.split('?')[0] };
  if (event.message) event.message = scrubString(event.message);
  event.exception?.values?.forEach((v) => {
    if (v.value) v.value = scrubString(v.value);
  });
  if (event.extra) event.extra = scrubPii(event.extra) as Record<string, unknown>;
  event.breadcrumbs?.forEach((b) => {
    if (b.message) b.message = scrubString(b.message);
    if (b.data) b.data = scrubPii(b.data) as Record<string, unknown>;
  });
  return event;
}

/** A handled failure, tagged with the support code the person was shown, sent through the SDK. */
function report(r: ErrorReport) {
  Sentry.withScope((scope) => {
    if (r.supportCode) scope.setTag('support_code', r.supportCode);
    if (r.code) scope.setTag('error_code', r.code);
    if (r.where) scope.setTag('where', r.where);
    scope.setTag('kind', r.kind);
    scope.setExtra('detail', scrubPii(r.detail));
    Sentry.captureMessage(`${r.where ?? 'error'}${r.code ? ` ${r.code}` : ''}`, r.kind === 'crash' ? 'fatal' : 'error');
  });
}

/**
 * Store-build version (branch feat/next-store-build): uses the Sentry SDK, which adds native crash capture and
 * symbolicated traces. It needs the native module in the installed build, so it cannot ship in an OTA update; the
 * plain-HTTPS version on `main` keeps working on every build until this one is merged with the next store build.
 *
 * Does nothing unless `EXPO_PUBLIC_SENTRY_DSN` is set. If `Sentry.init` throws, it falls back to the plain-HTTPS sink
 * instead of leaving the app unreported.
 */
export function startErrorReporting(dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  if (started || !dsn) return false;
  started = true;
  const release = Constants.expoConfig?.version;
  const environment = __DEV__ ? 'development' : 'production';
  try {
    Sentry.init({
      dsn,
      release,
      environment,
      dist: String(Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? ''),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      enableNative: true,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (b) => (b.category === 'console' ? null : b),
    });
    setErrorSink(report);
    return true;
  } catch {
    // The SDK could not start: report over plain HTTPS so nothing is lost.
    const sink = createSentrySink({ dsn, app: 'mobile', platform: Platform.OS, release, environment });
    if (!sink) return false;
    setErrorSink(sink);
    installCrashReporting(sink);
    return true;
  }
}
