import Constants from 'expo-constants';
import { getUpdates } from '@/features/updates/useAppUpdates';

/**
 * What a phone is running, for tagging every report: the app version and, when the JavaScript came from an over-the-air
 * update, which update. Two updates on the same app version are then two releases in Sentry, so a fix can be confirmed
 * by the release that carries it and a regression pinned to the update that introduced it.
 *
 * Release looks like `2.3.2+ota.a1b2c3d4` (an update) or `2.3.2+embedded` (the JavaScript the store build shipped).
 * Nothing here identifies a person or a device.
 */
export type BuildInfo = {
  release: string;
  /** Short update id, or `embedded`. Sent as Sentry's `dist`. */
  dist: string;
  tags: Record<string, string>;
};

export function describeBuild(o: {
  version?: string | null;
  updateId?: string | null;
  isEmbeddedLaunch?: boolean | null;
  runtimeVersion?: string | null;
  channel?: string | null;
}): BuildInfo {
  const version = o.version || 'unknown';
  const fromUpdate = !!o.updateId && o.isEmbeddedLaunch === false;
  const dist = fromUpdate ? String(o.updateId).replace(/-/g, '').slice(0, 8) : 'embedded';
  const tags: Record<string, string> = { app_version: version, js_source: fromUpdate ? 'ota' : 'embedded' };
  if (fromUpdate) tags.update_id = String(o.updateId);
  if (o.runtimeVersion) tags.runtime_version = o.runtimeVersion;
  if (o.channel) tags.channel = o.channel;
  return { release: fromUpdate ? `${version}+ota.${dist}` : `${version}+embedded`, dist, tags };
}

/** Reads the running build from expo-updates and the app config; falls back to the embedded build anywhere without them. */
export function currentBuild(): BuildInfo {
  const u = getUpdates() as unknown as {
    updateId?: string | null;
    isEmbeddedLaunch?: boolean;
    runtimeVersion?: string | null;
    channel?: string | null;
  } | null;
  return describeBuild({
    version: Constants.expoConfig?.version,
    updateId: u?.updateId,
    isEmbeddedLaunch: u?.isEmbeddedLaunch,
    runtimeVersion: u?.runtimeVersion,
    channel: u?.channel,
  });
}
