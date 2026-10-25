import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, onFill } from '@/theme';
import { V } from '../viewerTheme';
import type { PlaybackPhase } from '../types';
import { ReconnectingPanel } from '../public/LiveStreamUI';

type Props = {
  phase: PlaybackPhase;
  retrying: boolean;
  onRetry: () => void;
  onBack: () => void;
};

/** Visual feedback for every non-playing phase. Never blocks the surrounding screen. */
export const StreamStateOverlay = memo(function StreamStateOverlay({ phase, retrying, onRetry, onBack }: Props) {
  if (phase === 'playing') return null;

  if (phase === 'buffering') {
    return (
      <View style={styles.bufferWrap} pointerEvents="none" accessibilityLiveRegion="polite">
        <View style={styles.bufferPill}>
          <ActivityIndicator size="small" color={onFill} />
          <Text style={styles.bufferText}>Buffering…</Text>
        </View>
      </View>
    );
  }

  if (phase === 'ended') {
    return (
      <View style={styles.full} accessibilityLiveRegion="polite">
        <Ionicons name="radio-outline" size={34} color={V.textMuted} />
        <Text style={styles.endedKicker}>LIVE STREAM ENDED</Text>
        <Text style={styles.title}>This live stream has ended.</Text>
        <Text style={styles.sub}>Thanks for watching.</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to live"
        >
          <Text style={styles.primaryText}>Back to Live</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'reconnecting') return <ReconnectingPanel onRetry={onRetry} retrying={retrying} />;

  const spinning = phase === 'connecting';
  const copy =
    phase === 'waiting'
      ? { t: 'Waiting for the stream to start', s: 'Playback begins automatically as soon as it goes live.' }
      : phase === 'connecting'
        ? { t: 'Connecting to live stream…', s: undefined }
      : { t: 'Unable to load this live stream.', s: 'Check your connection and try again.' };

  return (
    <View style={styles.full} accessibilityLiveRegion="polite">
      {spinning ? (
        <ActivityIndicator size="large" color={onFill} />
      ) : (
        <Ionicons
          name={phase === 'error' ? 'cloud-offline-outline' : 'videocam-outline'}
          size={36}
          color={V.textSoft}
        />
      )}
      <Text style={styles.title}>{copy.t}</Text>
      {copy.s ? <Text style={styles.sub}>{copy.s}</Text> : null}
      {phase === 'error' || phase === 'waiting' ? (
        <Pressable
          style={styles.primaryBtn}
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel={phase === 'error' ? 'Try again' : 'Check feed now'}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={onFill} />
          ) : (
            <Text style={styles.primaryText}>{phase === 'error' ? 'Try Again' : 'Check Now'}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  full: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11,13,18,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: { fontFamily: fonts.bold, fontSize: 17, color: V.text, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: V.textMuted, textAlign: 'center', maxWidth: 300 },
  endedKicker: { fontFamily: fonts.bold, fontSize: 12, color: V.live, letterSpacing: 1.2, marginTop: 4 },
  primaryBtn: {
    minHeight: V.hit,
    minWidth: 140,
    marginTop: 8,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: V.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: onFill },
  bufferWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bufferPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: V.chipStrong,
  },
  bufferText: { fontFamily: fonts.bold, fontSize: 14, color: onFill },
});
