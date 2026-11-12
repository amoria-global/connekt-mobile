import { Platform } from 'react-native';
import { setErrorSink } from './report';
import { currentBuild } from './release';
import { createSentrySink, installCrashReporting } from './sentrySink';

let started = false;
let activeSink: ((report: import('./report').ErrorReport) => void) | null = null;

/**
 * Turns error reporting on when a DSN is configured: `EXPO_PUBLIC_SENTRY_DSN`, inlined at publish time like the other
 * public values. Without one this does nothing, so it is safe to ship before the Sentry project exists. Called once from
 * the root layout; further calls are ignored.
 */
export function startErrorReporting(dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  if (started) return false;
  const build = currentBuild();
  const sink = dsn
    ? createSentrySink({
        dsn,
        app: 'mobile',
        platform: Platform.OS,
        release: build.release,
        dist: build.dist,
        extraTags: build.tags,
        environment: __DEV__ ? 'development' : 'production',
      })
    : null;
  if (!sink) return false;
  started = true;
  activeSink = sink;
  setErrorSink(sink);
  installCrashReporting(sink);
  return true;
}

/**
 * Sends one clearly labelled report so a person can confirm reporting works on this phone. Returns false when reporting
 * is off (no DSN in this build), so the screen can say so instead of pretending.
 */
export function sendSentryTestEvent(): boolean {
  if (!activeSink) return false;
  activeSink({
    kind: 'crash',
    where: 'sentry.test',
    detail: { name: 'SentryTestEvent', message: 'Sentry test report from the app, safe to ignore', stack: '' },
  });
  return true;
}
