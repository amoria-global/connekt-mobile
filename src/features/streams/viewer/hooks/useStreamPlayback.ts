import { useCallback, useEffect, useRef, useState } from 'react';
import { useVideoPlayer, type VideoPlayerStatus } from 'expo-video';
import { getStream, joinStream } from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import type { PlaybackPhase } from '../types';

const MAX_AUTO_RECONNECTS = 3;
/** Light status check once playing, so a host ending the stream is noticed. */
const ENDED_POLL_MS = 15_000;

/**
 * Wraps the EXISTING playback pipeline (getStream -> playbackUrl -> expo-video)
 * and derives a UI phase from it. Same API calls as before the redesign:
 * getStream, joinStream, 8s polling while no playback URL exists.
 */
export function useStreamPlayback(id: string) {
  const { data, loading, error, refresh } = useAsync(useCallback(() => getStream(id), [id]));
  const [overridePlayUrl, setOverridePlayUrl] = useState<string | null>(null);
  const playUrl = overridePlayUrl ?? data?.playbackUrl ?? null;
  const [status, setStatus] = useState<VideoPlayerStatus>('idle');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [ended, setEnded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const wasLive = useRef(false);
  const notLiveStreak = useRef(0);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
    p.audioMixingMode = 'auto';
  });

  useEffect(() => {
    const s1 = player.addListener('statusChange', ({ status: next, error: playError }) => {
      setStatus(next);
      if (next === 'readyToPlay') {
        setHasPlayed(true);
        setAttempts(0);
      }
      if (next === 'error' && playError?.message) {
        console.warn('[stream] playback error', playError.message);
      }
    });
    const s2 = player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying));
    const s3 = player.addListener('playToEnd', () => setEnded(true));
    return () => {
      s1.remove();
      s2.remove();
      s3.remove();
    };
  }, [player]);

  // Start / restart playback (nonce bumps on manual retry or auto-reconnect).
  useEffect(() => {
    if (!playUrl || ended) return;
    try {
      player.replace({ uri: playUrl });
      player.play();
    } catch (e) {
      console.warn('[stream] could not start playback', e);
      setTimeout(() => setStatus('error'), 0);
    }
  }, [playUrl, player, nonce, ended]);

  // Existing behaviour: poll for a playback URL while the stream is not up yet.
  useEffect(() => {
    if (playUrl || !id) return;
    const handle = setInterval(() => {
      refresh().catch(() => undefined);
    }, 8000);
    return () => clearInterval(handle);
  }, [playUrl, id, refresh]);

  // Auto-reconnect with backoff when the player errors.
  useEffect(() => {
    if (status !== 'error' || !playUrl || ended || attempts >= MAX_AUTO_RECONNECTS) return;
    const t = setTimeout(() => {
      setAttempts((a) => a + 1);
      setNonce((n) => n + 1);
    }, 1500 * (attempts + 1));
    return () => clearTimeout(t);
  }, [status, playUrl, ended, attempts]);

  // Detect the host ending the stream (two consecutive "not live" reads).
  useEffect(() => {
    if (data?.isLive) {
      wasLive.current = true;
      notLiveStreak.current = 0;
    }
  }, [data?.isLive]);

  useEffect(() => {
    if (!playUrl || ended || !id) return;
    let active = true;
    const handle = setInterval(async () => {
      try {
        const fresh = await getStream(id);
        if (!active) return;
        if (fresh.isLive) {
          wasLive.current = true;
          notLiveStreak.current = 0;
        } else if (wasLive.current && ++notLiveStreak.current >= 2) {
          setEnded(true);
        }
      } catch {
        /* transient, ignore */
      }
    }, ENDED_POLL_MS);
    return () => {
      active = false;
      clearInterval(handle);
    };
  }, [playUrl, ended, id]);

  useEffect(() => {
    if (ended) {
      try {
        player.pause();
      } catch {
        /* player may be released */
      }
    }
  }, [ended, player]);

  /** Existing "refresh stream" behaviour (joinStream -> new URL or refresh). */
  const retry = useCallback(async () => {
    setRetrying(true);
    setAttempts(0);
    setEnded(false);
    notLiveStreak.current = 0;
    try {
      const url = (await joinStream(id)) ?? data?.playbackUrl;
      if (url) {
        setOverridePlayUrl(url);
        setNonce((n) => n + 1);
      } else {
        await refresh();
      }
    } catch {
      /* surfaced by phase */
    } finally {
      setRetrying(false);
    }
  }, [id, data, refresh]);

  const togglePlay = useCallback(() => {
    try {
      if (player.playing) player.pause();
      else player.play();
    } catch {
      /* ignore */
    }
  }, [player]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      player.muted = !m;
      return !m;
    });
  }, [player]);

  let phase: PlaybackPhase;
  if (ended) phase = 'ended';
  else if (!playUrl) phase = data?.isLive ? 'connecting' : 'waiting';
  else if (status === 'error') phase = attempts < MAX_AUTO_RECONNECTS ? 'reconnecting' : 'error';
  else if (status === 'loading' || status === 'idle') phase = hasPlayed ? 'buffering' : 'connecting';
  else phase = 'playing';

  return {
    data,
    loading,
    error,
    refresh,
    player,
    playUrl,
    phase,
    playing,
    muted,
    retrying,
    retry,
    togglePlay,
    toggleMute,
  };
}
