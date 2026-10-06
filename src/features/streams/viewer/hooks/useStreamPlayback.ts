import { useCallback, useEffect, useRef, useState } from 'react';
import { useVideoPlayer, type VideoPlayerStatus } from 'expo-video';
import { getStream, joinStream } from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import type { PlaybackPhase } from '../types';
import type { WhepHandle } from '../components/WhepVideo';
import { WHEP_FIRST_FRAME_TIMEOUT_MS, whepPhase, type WhepStatus } from '../whep';

const MAX_AUTO_RECONNECTS = 3;
/** Light status check once playing, so a host ending the stream is noticed. */
const ENDED_POLL_MS = 15_000;

/**
 * Playback for the live viewer, using the same feed path as the website:
 * WebRTC (WHEP) when the backend gives a whepUrl, HLS through expo-video
 * otherwise. WHEP never gives up reconnecting, like the web client. If WebRTC
 * never produces a first frame (an old or restricted WebView) it falls back to
 * HLS, which the web does not need but a phone does. Same API calls as before:
 * getStream, joinStream, 8s polling while no playback URL exists.
 */
export function useStreamPlayback(id: string) {
  const { data, loading, error, refresh } = useAsync(useCallback(() => getStream(id), [id]));
  const [overridePlayUrl, setOverridePlayUrl] = useState<string | null>(null);
  const playUrl = overridePlayUrl ?? data?.playbackUrl ?? null;
  const whepUrl = data?.whepUrl ?? null;
  const [whepFailed, setWhepFailed] = useState(false);
  const engine: 'whep' | 'hls' = whepUrl && !whepFailed ? 'whep' : 'hls';
  const hasUrl = engine === 'whep' || !!playUrl;
  const [whepStatus, setWhepStatus] = useState<WhepStatus>('connecting');
  const [whepPlayed, setWhepPlayed] = useState(false);
  const [whepPaused, setWhepPaused] = useState(false);
  const [whepNonce, setWhepNonce] = useState(0);
  const whepRef = useRef<WhepHandle | null>(null);
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
    if (!playUrl || ended || engine !== 'hls') return;
    try {
      player.replace({ uri: playUrl });
      player.play();
    } catch (e) {
      console.warn('[stream] could not start playback', e);
      setTimeout(() => setStatus('error'), 0);
    }
  }, [playUrl, player, nonce, ended, engine]);

  const onWhepStatus = useCallback((s: WhepStatus) => {
    setWhepStatus(s);
    if (s === 'playing') setWhepPlayed(true);
  }, []);

  // Safety net: WebRTC that never shows a first frame falls back to HLS.
  useEffect(() => {
    if (engine !== 'whep' || whepPlayed || !playUrl || ended) return;
    const t = setTimeout(() => setWhepFailed(true), WHEP_FIRST_FRAME_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [engine, whepPlayed, playUrl, ended, whepNonce]);

  // Existing behaviour: poll for a playback URL while the stream is not up yet.
  useEffect(() => {
    if (hasUrl || !id) return;
    const handle = setInterval(() => {
      refresh().catch(() => undefined);
    }, 8000);
    return () => clearInterval(handle);
  }, [hasUrl, id, refresh]);

  // Auto-reconnect with backoff when the player errors.
  useEffect(() => {
    if (engine !== 'hls' || status !== 'error' || !playUrl || ended || attempts >= MAX_AUTO_RECONNECTS) return;
    const t = setTimeout(() => {
      setAttempts((a) => a + 1);
      setNonce((n) => n + 1);
    }, 1500 * (attempts + 1));
    return () => clearTimeout(t);
  }, [engine, status, playUrl, ended, attempts]);

  // Detect the host ending the stream (two consecutive "not live" reads).
  useEffect(() => {
    if (data?.isLive) {
      wasLive.current = true;
      notLiveStreak.current = 0;
    }
  }, [data?.isLive]);

  useEffect(() => {
    if (!hasUrl || ended || !id) return;
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
  }, [hasUrl, ended, id]);

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
    setWhepFailed(false);
    setWhepPlayed(false);
    setWhepPaused(false);
    setWhepStatus('connecting');
    setWhepNonce((n) => n + 1);
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
    if (engine === 'whep') {
      const next = !whepPaused;
      setWhepPaused(next);
      whepRef.current?.setPlaying(!next);
      return;
    }
    try {
      if (player.playing) player.pause();
      else player.play();
    } catch {
      /* ignore */
    }
  }, [player, engine, whepPaused]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      player.muted = !m;
      whepRef.current?.setMuted(!m);
      return !m;
    });
  }, [player]);

  let phase: PlaybackPhase;
  if (ended) phase = 'ended';
  else if (engine === 'whep') phase = whepPhase(whepStatus, whepPlayed);
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
    engine,
    whepUrl,
    whepRef,
    whepNonce,
    onWhepStatus,
    hasUrl,
    phase,
    playing: engine === 'whep' ? whepPlayed && !whepPaused : playing,
    muted,
    retrying,
    retry,
    togglePlay,
    toggleMute,
  };
}
