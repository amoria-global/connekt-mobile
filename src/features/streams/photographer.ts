/**
 * Photographer stream lifecycle — mobile port of the web photographer
 * dashboard's stream control (salo-run StreamPreview + events.tsx
 * handleStart/Resume/Pause/End/Reset).
 *
 * Backend (PhotographerRemoteController @ /api/remote/photographer):
 *   POST /events/{id}/stream/start   → { whipUrl, whepUrl, liveInputId }
 *                                       ("Call /stream/resume to go live")
 *   POST /events/{id}/stream/resume  → data.connectionStatus = 'connected'
 *                                       (Go Live; may return inviteToken)
 *   POST /events/{id}/stream/pause   → data.connectionStatus = 'paused'
 *   POST /events/{id}/stream/stop    → data.connectionStatus = 'ended'
 *   POST /events/{id}/stream/reset   → { whipUrl, whepUrl } (rotate URL)
 *   GET  /events/{id}/stream/config  → full snapshot (whipUrl, whepUrl,
 *        connectionStatus, viewerCount, peakViewers, streamHealth,
 *        uploadSpeed, inviteToken) — PhotographerDashboardController.
 *
 * The mobile api client base is `…/api/remote`, so these all sit under
 * the `/photographer/...` prefix (same base, different controller than
 * the `/customer/...` calls in features/events/api.ts).
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

/** Mirrors the web's StreamConfig connectionStatus union. */
export type StreamConnectionStatus = 'disconnected' | 'connected' | 'paused' | 'ended' | 'idle';

export type StreamCredentials = {
  whipUrl?: string;
  whepUrl?: string;
  liveInputId?: string;
  inviteToken?: string;
};

export type StreamConfig = {
  whipUrl?: string;
  whepUrl?: string;
  connectionStatus: StreamConnectionStatus;
  viewerCount: number;
  peakViewers: number;
  streamHealth?: string;
  uploadSpeed?: string;
  inviteToken?: string;
};

function flat(res: unknown): Raw {
  // start/reset put the URLs at the TOP level; resume/pause/stop/config
  // nest under `data`. Merge both so callers read uniformly.
  const top = (res ?? {}) as Raw;
  const data = (top.data ?? {}) as Raw;
  return { ...top, ...data };
}

function pickCreds(res: unknown): StreamCredentials {
  const d = flat(res);
  return {
    whipUrl: str(d.whipUrl),
    whepUrl: str(d.whepUrl),
    liveInputId: str(d.liveInputId),
    inviteToken: str(d.inviteToken),
  };
}

/** Boot the live input + WHIP/WHEP URLs. Status stays 'disconnected'. */
export async function startPhotographerStream(eventId: string): Promise<StreamCredentials> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/photographer/events/${encodeURIComponent(eventId)}/stream/start`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not start the stream.' };
  }
  return pickCreds(res);
}

/** Rotate the WHIP URL (after End → Reset & Restart). */
export async function resetPhotographerStream(eventId: string): Promise<StreamCredentials> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/photographer/events/${encodeURIComponent(eventId)}/stream/reset`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not reset the stream.' };
  }
  return pickCreds(res);
}

/** Go live — flips the event to ONGOING and notifies viewers. */
export async function resumePhotographerStream(eventId: string): Promise<{ inviteToken?: string }> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/photographer/events/${encodeURIComponent(eventId)}/stream/resume`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not go live.' };
  }
  return { inviteToken: str((res?.data as Raw)?.inviteToken) };
}

export async function pausePhotographerStream(eventId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/photographer/events/${encodeURIComponent(eventId)}/stream/pause`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not pause the stream.' };
  }
}

/** End permanently (backend endpoint is /stream/stop). */
export async function stopPhotographerStream(eventId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/photographer/events/${encodeURIComponent(eventId)}/stream/stop`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not end the stream.' };
  }
}

/** Poll target — connection status, viewer/peak counts, health, bitrate. */
export async function getPhotographerStreamConfig(eventId: string): Promise<StreamConfig> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/photographer/events/${encodeURIComponent(eventId)}/stream/config`,
  );
  const d = (res?.data ?? {}) as Raw;
  const cs = (str(d.connectionStatus) ?? 'disconnected') as StreamConnectionStatus;
  return {
    whipUrl: str(d.whipUrl),
    whepUrl: str(d.whepUrl),
    connectionStatus: cs,
    viewerCount: num(d.viewerCount) ?? 0,
    peakViewers: num(d.peakViewers) ?? 0,
    streamHealth: str(d.streamHealth),
    uploadSpeed: str(d.uploadSpeed),
    inviteToken: str(d.inviteToken),
  };
}
