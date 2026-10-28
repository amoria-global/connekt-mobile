/**
 * Section 2, the player: the frame, the access chip (Free / Ticket) and the live scrubber. The video, LIVE badge, viewer
 * count, pause, volume and fullscreen already live in features/streams/viewer (LiveVideoSurface, LiveOverlay); this adds
 * what was missing and keeps the same names as the web's LivePlayer.
 */
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, onFill, onMedia } from '@/theme';
import { V, VIDEO_ASPECT } from '@/features/streams/viewer/viewerTheme';

export type EventAccess = 'free' | 'ticket';

export const accessLabel = (a: EventAccess) => (a === 'ticket' ? 'Ticket' : 'Free');

/** Text, never colour alone. */
export const AccessChip = memo(function AccessChip({ access }: { access: EventAccess }) {
  return (
    <View style={s.chip} accessible accessibilityLabel={`Access: ${accessLabel(access)}`}>
      <Text style={s.chipText}>{accessLabel(access)}</Text>
    </View>
  );
});

/**
 * A live stream has no timeline to scrub, so the track is full when you are at the live edge and the LIVE pill is the
 * control: tapping it returns to live (a no-op when already there).
 */
export const LiveScrubber = memo(function LiveScrubber({ atLive, onGoLive }: { atLive: boolean; onGoLive: () => void }) {
  return (
    <View style={s.scrub}>
      <Pressable
        onPress={onGoLive}
        accessibilityRole="button"
        accessibilityLabel={atLive ? 'At the live edge' : 'Go to live'}
        accessibilityState={{ selected: atLive }}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        style={[s.livePill, atLive && s.livePillOn]}
      >
        <Text style={s.livePillText}>LIVE</Text>
      </Pressable>
      <View style={s.track} accessibilityRole="progressbar" accessibilityLabel="Live position" accessibilityValue={{ min: 0, max: 100, now: atLive ? 100 : 0 }}>
        <View style={[s.fill, { width: atLive ? '100%' : '0%' }]} />
      </View>
    </View>
  );
});

/** The 16:9 frame. The video and its overlay are the children. */
export const LivePlayer = memo(function LivePlayer({ topInset = 0, children }: { topInset?: number; children: ReactNode }) {
  return (
    <View style={{ paddingTop: topInset, backgroundColor: onMedia.black }}>
      <View style={{ aspectRatio: VIDEO_ASPECT }}>{children}</View>
    </View>
  );
});

const s = StyleSheet.create({
  chip: { height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: V.chipStrong },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: V.text },
  scrub: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  livePill: { height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: V.chipStrong },
  livePillOn: { backgroundColor: V.live },
  livePillText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: onFill },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: V.live },
});
