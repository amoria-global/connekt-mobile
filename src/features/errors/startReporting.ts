import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { setErrorSink } from './report';
import { createSentrySink, installCrashReporting } from './sentrySink';

let started = false;

/**
 * Turns error reporting on when a DSN is configured: `EXPO_PUBLIC_SENTRY_DSN`, inlined at publish time like the other
 * public values. Without one this does nothing, so it is safe to ship before the Sentry project exists. Called once from
 * the root layout; further calls are ignored.
 */
export function startErrorReporting(dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  if (started) return false;
  const sink = dsn
    ? createSentrySink({
        dsn,
        app: 'mobile',
        platform: Platform.OS,
        release: Constants.expoConfig?.version,
        environment: __DEV__ ? 'development' : 'production',
      })
    : null;
  if (!sink) return false;
  started = true;
  setErrorSink(sink);
  installCrashReporting(sink);
  return true;
}
