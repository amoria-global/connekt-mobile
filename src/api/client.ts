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
  /** Custom request timeout in ms (e.g. for large uploads or ML face recognition). */
  timeoutMs?: number;
  /** Internal: marks a request that has already been retried after a refresh. */
  _retried?: boolean;
};

/** Called when refresh fails — the store uses this to force a logout. */
let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(cb: () => void) {
  onAuthExpired = cb;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, timeoutMs, _retried, ...rest } = options;

  const url = path.startsWith('http') ? path : `${env.apiBaseUrl}${path}`;

  const isForm =
    typeof FormData !== 'undefined' &&
    (body instanceof FormData ||
      (body != null && typeof (body as { append?: unknown }).append === 'function'));

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

  // File uploads, face scans, and KYC documents take longer to transmit and process on backend.
  const effectiveTimeout =
    timeoutMs ?? (isForm ? (env.uploadTimeoutMs ?? 120_000) : env.requestTimeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), effectiveTimeout);

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
    if (isAbortError(err, controller)) {
      throw {
        status: 408,
        message: 'Request timed out. Please check your internet connection and try again.',
      } satisfies ApiError;
    }

    // iOS NSURLSession -1005 ("The network connection was lost") happens when reusing
    // an idle keep-alive TCP socket that the server/Cloudflare has closed.
    // Retrying once immediately opens a fresh socket, which usually succeeds.
    // GET only: replaying a POST after a lost connection can submit a payment
    // or withdrawal twice, because the first one may already have landed.
    if (isConnectionLostError(err) && !_retried && (rest.method ?? 'GET') === 'GET') {
      return request<T>(path, { ...options, _retried: true });
    }

    if (isApiError(err)) throw err;
    const rawMessage = err instanceof Error ? err.message : String(err ?? 'Network error');
    const userMessage = isConnectionLostError(err)
      ? 'The network connection was lost. Please check your internet connection and try again.'
      : sanitizeErrorMessage(rawMessage);
    throw { status: 0, message: userMessage } satisfies ApiError;
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Network error';
  return (
    msg
      .replace(/\s*\(at [^)]+\)/g, '')
      .replace(/^fetch failed:\s*/i, '')
      .replace(/^UnexpectedException:\s*/i, '')
      .trim() || 'Network error'
  );
}

function isConnectionLostError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('network connection was lost') ||
    msg.includes('connection was lost') ||
    msg.includes('-1005') ||
    msg.includes('connection reset') ||
    msg.includes('connection closed') ||
    msg.includes('broken pipe') ||
    msg.includes('socket closed') ||
    msg.includes('econnreset')
  );
}

function isAbortError(err: unknown, controller?: AbortController): boolean {
  if (controller?.signal?.aborted) {
    return true;
  }

  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'AbortError';
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message === 'AbortError' || err.message === 'Aborted') {
      return true;
    }
    const msg = (err.message || '').toLowerCase();
    if (
      msg.includes('fetch request has been canceled') ||
      msg.includes('fetchrequestcanceledexception') ||
      msg.includes('nativeresponse') ||
      msg.includes('operation was aborted') ||
      msg.includes('request has been canceled') ||
      msg.includes('request was cancelled') ||
      msg.includes('request was canceled')
    ) {
      return true;
    }
  }

  const strErr = String(err ?? '').toLowerCase();
  return (
    strErr.includes('fetch request has been canceled') ||
    strErr.includes('fetchrequestcanceledexception') ||
    strErr.includes('nativeresponse')
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
    return {
      status,
      message: p.message ?? 'Request failed',
      fieldErrors: p.fieldErrors,
      body: payload as Record<string, unknown>,
    };
  }
  return { status, message: typeof payload === 'string' ? payload : 'Request failed' };
}

function isApiError(err: unknown): err is ApiError {
  return !!err && typeof err === 'object' && 'status' in err && 'message' in err;
}

/**
 * The backend answers failures with HTTP 200 and action 0. A reader that only
 * looks at data turns that into zeros on screen, so money and analytics reads
 * go through getOk, which throws instead. A body without an action field
 * (a raw page) passes through unchanged.
 */
export function requireOk<T>(res: T): T {
  if (res && typeof res === 'object' && 'action' in res && (res as { action?: unknown }).action !== 1) {
    const message = (res as { message?: unknown }).message;
    throw { status: 200, message: typeof message === 'string' && message ? message : 'Could not load this. Please try again.' } satisfies ApiError;
  }
  return res;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  getOk: async <T>(path: string, opts?: RequestOptions) =>
    requireOk(await request<T>(path, { ...opts, method: 'GET' })),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
