import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'expo-image';
import { env } from '@/config/env';
import { storage, StorageKeys } from '@/services/storage';
import { isGatedOriginal } from './imageUrls';

/**
 * Loads `uri` (normally the public thumbnail) and, if that fails, `fallbackUri` (the original).
 *
 * The backend refuses an original of a paid album unless the request is signed in (owner, collaborator
 * or buyer). A signed request sends the stored token, and only to this app's own backend. `signed`
 * does that for `uri` itself (the full-size viewer); otherwise it applies only to the fallback.
 */
export function FallbackImage({
  uri,
  fallbackUri,
  signed,
  ...rest
}: Omit<ImageProps, 'source'> & { uri?: string; fallbackUri?: string; signed?: boolean }) {
  // Remember which url failed, so a new `uri` starts fresh without resetting state in an effect.
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const failed = failedUri !== undefined && failedUri === uri;
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const shown = failed && fallbackUri ? fallbackUri : uri;
  const wantsToken = (signed || (failed && !!fallbackUri)) && isGatedOriginal(shown);

  useEffect(() => {
    if (!wantsToken) return;
    let live = true;
    storage.get(StorageKeys.authToken).then((t) => live && setToken(t ?? null));
    return () => {
      live = false;
    };
  }, [wantsToken]);

  if (!shown) return null;
  // Wait for the token read so the first request is already signed, not a refused one.
  if (wantsToken && token === undefined) return null;
  const backend = env.apiBaseUrl.replace(/\/api\/remote\/?$/, '');
  const headers = wantsToken && token && shown.startsWith(backend) ? { Authorization: `Bearer ${token}` } : undefined;
  return <Image {...rest} source={{ uri: shown, headers }} onError={() => setFailedUri(uri)} />;
}
