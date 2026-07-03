/**
 * Live-stream sponsor-ad overlay (mobile port of knockout's StreamAdBanners).
 *
 * Ads render OVER the video at a placement encoded by `adType`:
 *   • bars    — full-width strips on the TOP or BOTTOM edge
 *   • rails   — vertical strips on the LEFT or RIGHT edge
 *   • corners — small cards in any of the four corners
 *   • L-shape — a bottom bar + a side rail that meet at a corner, wrapping the
 *               video on two sides like a broadcast L-band (it does NOT draw a
 *               literal letter "L" — the creative image fills the frame)
 *
 * Behaviour rules (per product spec):
 *   • If the ad carries a `ctaUrl`, the whole ad is tappable and opens that URL.
 *   • A viewer may ONLY dismiss an ad when `closable` is true; otherwise no
 *     close button is shown and the ad stays until it auto-expires / rotates.
 *
 * Rotation mirrors the web StreamAdManager: after `startAfterSeconds` the first
 * ad shows, then a new one every `intervalSeconds`; an ad with `duration > 0`
 * auto-hides after that many seconds. The organizer can also push an ad
 * instantly via the trigger endpoint (polled here).
 */
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  getPendingAdTrigger,
  getStreamAds,
  recordAdClick,
  type StreamAd,
  type StreamAdSchedule,
} from '@/features/streams/ads';

// ─── Placement parsing ──────────────────────────────────────────────────────

type Placement =
  | { kind: 'bar'; edge: 'top' | 'bottom' }
  | { kind: 'rail'; side: 'left' | 'right' }
  | { kind: 'corner'; v: 'top' | 'bottom'; h: 'left' | 'right' }
  | { kind: 'l'; v: 'top' | 'bottom'; h: 'left' | 'right' };

/** Map the free-form `adType` string to a concrete placement. Tolerant of the
 *  web's legacy names (glass_bottom / top_ribbon / side_panel / corner_card)
 *  and the new edge/corner/L keys. */
function placementFor(adType: string): Placement {
  const t = (adType || '').toLowerCase();
  const v: 'top' | 'bottom' = t.includes('top') ? 'top' : 'bottom';
  const h: 'left' | 'right' = t.includes('left') ? 'left' : 'right';

  if (t.includes('l_') || t.includes('l-shape') || t === 'lshape' || t.includes('lband')) {
    return { kind: 'l', v, h };
  }
  if (t.includes('corner') || t === 'corner_card') {
    // Legacy corner_card sat bottom-right.
    return { kind: 'corner', v: t.includes('top') ? 'top' : 'bottom', h: t.includes('left') ? 'left' : 'right' };
  }
  if (t.includes('top') || t.includes('ribbon')) return { kind: 'bar', edge: 'top' };
  if (t.includes('bottom') || t.includes('glass')) return { kind: 'bar', edge: 'bottom' };
  if (t === 'left' || t.includes('edge_left') || t.includes('rail_left')) return { kind: 'rail', side: 'left' };
  if (t === 'right' || t.includes('side') || t.includes('edge_right') || t.includes('rail_right')) {
    return { kind: 'rail', side: 'right' };
  }
  // Sensible default: a bottom bar (the most common sponsor strip).
  return { kind: 'bar', edge: 'bottom' };
}

// ─── Ad media (image / video / brand-colour fallback) ───────────────────────

function AdVideo({ uri, style }: { uri: string; style: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={style as any} contentFit="cover" nativeControls={false} />;
}

function AdMedia({ ad, style }: { ad: StreamAd; style: StyleProp<ViewStyle> }) {
  if (ad.videoUrl) return <AdVideo uri={ad.videoUrl} style={style} />;
  if (ad.imageUrl) return <Image source={{ uri: ad.imageUrl }} style={style as any} contentFit="cover" />;
  return <View style={[style, { backgroundColor: ad.brandColor || '#111827' }]} />;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
      <Ionicons name="close" size={14} color="#fff" />
    </Pressable>
  );
}

// ─── Positioned ad view ─────────────────────────────────────────────────────

function AdView({
  ad,
  onPress,
  onClose,
  insetTop,
  insetBottom,
}: {
  ad: StreamAd;
  onPress: () => void;
  onClose?: () => void;
  insetTop: number;
  insetBottom: number;
}) {
  const p = placementFor(ad.adType);
  // Keep bottom ads clear of the chat composer / reactions / branded controls.
  const bottomSafe = insetBottom + 112;
  const topSafe = insetTop + 8;

  if (p.kind === 'bar') {
    const pos: ViewStyle = p.edge === 'top'
      ? { top: topSafe, left: 0, right: 0 }
      : { bottom: bottomSafe, left: 0, right: 0 };
    return (
      <Pressable style={[styles.bar, pos]} onPress={onPress}>
        <AdMedia ad={ad} style={StyleSheet.absoluteFillObject} />
        {onClose ? <CloseButton onClose={onClose} /> : null}
      </Pressable>
    );
  }

  if (p.kind === 'rail') {
    const pos: ViewStyle = p.side === 'left' ? { left: 8 } : { right: 8 };
    return (
      <Pressable style={[styles.rail, pos]} onPress={onPress}>
        <AdMedia ad={ad} style={StyleSheet.absoluteFillObject} />
        {onClose ? <CloseButton onClose={onClose} /> : null}
      </Pressable>
    );
  }

  if (p.kind === 'corner') {
    const pos: ViewStyle = {
      ...(p.v === 'top' ? { top: topSafe + 48 } : { bottom: bottomSafe }),
      ...(p.h === 'left' ? { left: 10 } : { right: 10 }),
    };
    return (
      <Pressable style={[styles.corner, pos]} onPress={onPress}>
        <AdMedia ad={ad} style={StyleSheet.absoluteFillObject} />
        {onClose ? <CloseButton onClose={onClose} /> : null}
      </Pressable>
    );
  }

  // L-shape — a bottom bar + a side rail meeting at a corner. Two tappable
  // segments; the close button lives on the horizontal bar.
  const railPos: ViewStyle = p.h === 'left' ? { left: 0 } : { right: 0 };
  return (
    <>
      <Pressable style={[styles.lRail, { bottom: bottomSafe }, railPos]} onPress={onPress}>
        <AdMedia ad={ad} style={StyleSheet.absoluteFillObject} />
      </Pressable>
      <Pressable style={[styles.bar, { bottom: bottomSafe, left: 0, right: 0 }]} onPress={onPress}>
        <AdMedia ad={ad} style={StyleSheet.absoluteFillObject} />
        {onClose ? <CloseButton onClose={onClose} /> : null}
      </Pressable>
    </>
  );
}

// ─── Manager (fetch + rotate + trigger) ─────────────────────────────────────

export function StreamAdOverlay({
  eventId,
  viewerId,
  enabled,
  insetTop = 0,
  insetBottom = 0,
}: {
  eventId: string;
  viewerId?: string;
  enabled: boolean;
  insetTop?: number;
  insetBottom?: number;
}) {
  const [ads, setAds] = useState<StreamAd[]>([]);
  const [schedule, setSchedule] = useState<StreamAdSchedule>({
    intervalSeconds: 300,
    startAfterSeconds: 30,
    enabled: false,
  });
  const [active, setActive] = useState<StreamAd | null>(null);
  const idxRef = useRef(0);
  const adsRef = useRef<StreamAd[]>([]);
  adsRef.current = ads;

  // Hide an ad only if it's still the one showing (a newer ad may have taken over).
  const hideIfCurrent = (id: string) =>
    setActive((cur) => (cur?.id === id ? null : cur));

  // Fetch ads + schedule, then refresh every 60s so newly-added ads appear.
  useEffect(() => {
    if (!enabled || !eventId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await getStreamAds(eventId);
        if (cancelled) return;
        setAds(r.ads);
        setSchedule(r.schedule);
      } catch {
        /* keep last-known ads */
      }
    };
    load();
    const h = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, [eventId, enabled]);

  // Auto-rotation.
  useEffect(() => {
    if (!enabled || ads.length === 0) return;
    const intervalMs = Math.max(15, schedule.intervalSeconds || 300) * 1000;
    const startMs = Math.max(0, schedule.startAfterSeconds ?? 30) * 1000;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const showNext = () => {
      const list = adsRef.current;
      if (list.length === 0) return;
      const ad = list[idxRef.current % list.length];
      idxRef.current += 1;
      setActive(ad);
      if (ad.duration && ad.duration > 0) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => hideIfCurrent(ad.id), ad.duration * 1000);
      }
    };

    const start = setTimeout(showNext, startMs);
    const rot = setInterval(showNext, intervalMs);
    return () => {
      clearTimeout(start);
      clearInterval(rot);
      clearTimeout(hideTimer);
    };
  }, [enabled, ads.length, schedule.intervalSeconds, schedule.startAfterSeconds]);

  // Manual push from the organizer's dashboard.
  useEffect(() => {
    if (!enabled || !eventId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const adId = await getPendingAdTrigger(eventId);
        if (cancelled || !adId) return;
        const ad = adsRef.current.find((a) => a.id === adId);
        if (!ad) return;
        setActive(ad);
        if (ad.duration && ad.duration > 0) {
          setTimeout(() => hideIfCurrent(ad.id), ad.duration * 1000);
        }
      } catch {
        /* ignore */
      }
    };
    const h = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, [eventId, enabled]);

  const onPressAd = (ad: StreamAd) => {
    if (!ad.ctaUrl) return;
    recordAdClick(eventId, ad.id, viewerId);
    WebBrowser.openBrowserAsync(ad.ctaUrl).catch(() => {});
  };

  if (!enabled || !active) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <AdView
        ad={active}
        onPress={() => onPressAd(active)}
        // Close button only when the ad opts into being dismissible.
        onClose={active.closable ? () => setActive(null) : undefined}
        insetTop={insetTop}
        insetBottom={insetBottom}
      />
    </View>
  );
}

const CORNER_W = 168;
const CORNER_H = 58;
const BAR_H = 48;
const RAIL_W = 62;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: BAR_H,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 50,
  },
  rail: {
    position: 'absolute',
    top: '30%',
    width: RAIL_W,
    height: '42%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 50,
  },
  corner: {
    position: 'absolute',
    width: CORNER_W,
    height: CORNER_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 50,
  },
  // Vertical arm of the L — rises from the bottom bar up one side.
  lRail: {
    position: 'absolute',
    width: RAIL_W,
    height: 168,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 50,
  },
  close: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
});
