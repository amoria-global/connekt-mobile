/**
 * Typed HTTP client for the amoria-connect backend.
 *
 * Uses the built-in fetch (no extra deps). Handles base URL, JSON,
 * auth bearer token, timeouts, normalized errors, and automatic access-token
 * refresh on 401 (single-flight, retries the original request once).
 */
import { env } from '@/config/env';
import { storage, StorageKeys } from '@/services/storage';
import type { ApiError } from '@/types';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skip attaching the auth token (e.g. for login/refresh). */
  skipAuth?: boolean;
  /** Internal: marks a request that has already been retried after a refresh. */
  _retried?: boolean;
};

/** Called when refresh fails — the store uses this to force a logout. */
let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(cb: () => void) {
  onAuthExpired = cb;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, _retried, ...rest } = options;

  const url = path.startsWith('http') ? path : `${env.apiBaseUrl}${path}`;

  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    // For multipart, let fetch set Content-Type (it adds the boundary).
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await storage.get(StorageKeys.authToken);
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.requestTimeoutMs);

  try {
    const res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: isForm
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
      signal: controller.signal,
    });

    // Access token likely expired → try a one-time refresh, then retry.
    if (res.status === 401 && !skipAuth && !_retried) {
      const outcome = await refreshAccessToken();
      if (outcome === 'refreshed') {
        return request<T>(path, { ...options, _retried: true });
      }
      // Only a real refusal ends the session. When the refresh simply could
      // not be reached, fall through and let the original 401 surface as a
      // retryable error instead of throwing the user out to the login screen.
      if (outcome === 'rejected') onAuthExpired?.();
    }

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      throw normalizeError(res.status, payload);
    }

    return payload as T;
  } catch (err) {
    if (isAbortError(err)) {
      throw { status: 408, message: 'Request timed out' } satisfies ApiError;
    }
    if (isApiError(err)) throw err;
    const rawMessage = err instanceof Error ? err.message : String(err ?? 'Network error');
    throw { status: 0, message: rawMessage || 'Network error' } satisfies ApiError;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'AbortError';
  }

  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.message === 'AbortError' || err.message === 'Aborted')
  );
}

// --- Token refresh (single-flight) ---------------------------------------

/**
 * Three outcomes, not two.
 *
 * 'refreshed'   — we hold a new access token.
 * 'rejected'    — the server actually said no (no stored token, an explicit
 *                 refusal, 401/403). The session really is dead.
 * 'unavailable' — we could not ask: network down, timeout, 5xx. This says
 *                 NOTHING about the session's validity.
 *
 * Collapsing the last two into `false` is what signed people out the moment
 * a lift or a tunnel interrupted one request mid-action.
 */
type RefreshOutcome = 'refreshed' | 'rejected' | 'unavailable';

let refreshPromise: Promise<RefreshOutcome> | null = null;

function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<RefreshOutcome> {
  const refreshToken = await storage.get(StorageKeys.refreshToken).catch(() => null);
  if (!refreshToken) return 'rejected';

  // This was the only fetch in the file without a timeout, and it is
  // single-flight: a hung refresh stalled every request queued behind it.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.requestTimeoutMs);

  try {
    const res = await fetch(`${env.apiBaseUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    // A refusal is 401/403 or a 200 envelope saying no. A 5xx is the server
    // failing, not the session expiring.
    if (res.status >= 500) return 'unavailable';
    if (!res.ok) return 'rejected';

    const data = (await res.json()) as {
      action?: number;
      token?: string;
      refreshToken?: string;
    };
    if (data.action !== 1 || !data.token) return 'rejected';

    await storage.set(StorageKeys.authToken, data.token);
    if (data.refreshToken) await storage.set(StorageKeys.refreshToken, data.refreshToken);

    // Keep the persisted session blob's token in sync.
    const raw = await storage.get(StorageKeys.session).catch(() => null);
    if (raw) {
      try {
        const session = JSON.parse(raw);
        session.token = data.token;
        if (data.refreshToken) session.refreshToken = data.refreshToken;
        await storage.set(StorageKeys.session, JSON.stringify(session));
      } catch {
        // ignore malformed session blob
      }
    }
    return 'refreshed';
  } catch {
    // Aborts, DNS failures, offline: we never got an answer, so we must not
    // conclude the session is dead.
    return 'unavailable';
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeError(status: number, payload: unknown): ApiError {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const p = payload as { message?: string; fieldErrors?: Record<string, string> };
    return { status, message: p.message ?? 'Request failed', fieldErrors: p.fieldErrors };
  }
  return { status, message: typeof payload === 'string' ? payload : 'Request failed' };
}

function isApiError(err: unknown): err is ApiError {
  return !!err && typeof err === 'object' && 'status' in err && 'message' in err;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
