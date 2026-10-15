/**
 * Frontend adapter between the existing stream state (photographer.ts config,
 * CameraPublisher status, chat polling) and the studio components.
 * Nothing here talks to the backend or holds state of its own.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { PublishStatus } from '@/features/streams/CameraPublisher';
import type { StreamConnectionStatus } from '@/features/streams/photographer';
import { S } from './theme';

export type ConnectionState = 'good' | 'weak' | 'reconnecting' | 'lost' | 'paused';

type IconName = keyof typeof Ionicons.glyphMap;

export const CONNECTION_COPY: Record<
  ConnectionState,
  { label: string; icon: IconName; color: string }
> = {
  good: { label: 'Connection stable', icon: 'checkmark-circle', color: S.ok },
  weak: { label: 'Weak connection', icon: 'warning', color: S.warn },
  reconnecting: { label: 'Reconnecting…', icon: 'sync', color: S.warn },
  lost: { label: 'Connection lost', icon: 'cloud-offline', color: S.live },
  paused: { label: 'Stream paused', icon: 'pause-circle', color: S.warn },
};

/**
 * What the studio should show for a stream status.
 *
 * The server reports "connected" only once Cloudflare sees the encoder pushing,
 * which lags the host's GO LIVE tap, and drops back to "disconnected" on any
 * network blip. Neither means the host is not on air, so once the host has gone
 * live (onAir) a "disconnected" or "idle" report keeps the live studio on
 * screen, and the connection chip shows reconnecting instead.
 */
export function resolveStudioStatus(
  status: StreamConnectionStatus,
  onAir: boolean,
): StreamConnectionStatus {
  if (status === 'connected' || status === 'paused' || status === 'ended') return status;
  return onAir ? 'connected' : status;
}

/** Next value of the on-air latch given what the server last reported. */
export function nextOnAirLatch(reported: StreamConnectionStatus, prev: boolean): boolean {
  if (reported === 'connected' || reported === 'paused') return true;
  if (reported === 'ended') return false;
  return prev;
}

const WEAK_HEALTH = /poor|bad|weak|degrad|unstable|low|critical|warning/i;

export function deriveConnection(input: {
  isLive: boolean;
  isPaused: boolean;
  mode: 'browser' | 'obs';
  publishStatus: PublishStatus;
  streamHealth?: string;
  /** On air by the host's action, but the server has not confirmed the encoder yet. */
  encoderPending?: boolean;
  networkError: boolean;
}): ConnectionState {
  const { isLive, isPaused, mode, publishStatus, streamHealth, networkError, encoderPending } = input;
  if (isPaused) return 'paused';
  if (networkError) return 'lost';
  if (isLive && encoderPending) return 'reconnecting';
  if (mode === 'browser' && isLive) {
    if (publishStatus === 'error') return 'lost';
    if (publishStatus === 'starting') return 'reconnecting';
  }
  if (streamHealth && WEAK_HEALTH.test(streamHealth)) return 'weak';
  return 'good';
}

export function formatCount(n: number): string {
  if (n >= 10000) return `${Math.round(n / 100) / 10}K`.replace('.0K', 'K');
  return n.toLocaleString();
}

export function formatDuration(totalSec: number): string {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${String(hrs).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Human duration for the summary, e.g. "42 min" / "1 h 05 min" / "35 sec". */
export function formatDurationWords(totalSec: number): string {
  if (totalSec < 60) return `${totalSec} sec`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export type StreamerLiveViewModel = {
  status: StreamConnectionStatus;
  isLive: boolean;
  isPaused: boolean;
  isEnded: boolean;
  /** Pre-live = camera setup (not live, not paused, not ended). */
  isPreLive: boolean;
  connection: ConnectionState;
  viewerCount: number;
  peakViewers: number;
};

export function createStreamerLiveViewModel(input: {
  status: StreamConnectionStatus;
  mode: 'browser' | 'obs';
  publishStatus: PublishStatus;
  streamHealth?: string;
  viewerCount?: number;
  encoderPending?: boolean;
  peakViewers?: number;
  networkError: boolean;
}): StreamerLiveViewModel {
  const isLive = input.status === 'connected';
  const isPaused = input.status === 'paused';
  const isEnded = input.status === 'ended';
  return {
    status: input.status,
    isLive,
    isPaused,
    isEnded,
    isPreLive: !isLive && !isPaused && !isEnded,
    connection: deriveConnection({
      isLive,
      isPaused,
      mode: input.mode,
      publishStatus: input.publishStatus,
      streamHealth: input.streamHealth,
      encoderPending: input.encoderPending,
      networkError: input.networkError,
    }),
    viewerCount: input.viewerCount ?? 0,
    peakViewers: input.peakViewers ?? 0,
  };
}

export type LiveSummary = {
  /** Seconds on air, or null when unknown (e.g. screen opened after the stream ended). */
  durationSec: number | null;
  viewers: number;
  peakViewers: number;
  comments: number;
};
