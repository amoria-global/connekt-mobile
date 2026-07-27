/**
 * GiftOverlay — incoming-gift animation layer for live streams.
 *
 * Phase-2 integration of `src/_design-sandbox/LiveGifting.preview.tsx`,
 * preserving its visual design: pink gift banners stacked top-left with a
 * combo counter (xN per sender+gift), floating emoji risers on the right,
 * and a full-stage takeover for `bigAnimation` gifts.
 *
 * Display-only and pointer-transparent. It renders on ALL platforms —
 * including Android, where the gift BUTTON is absent (Play billing policy):
 * showing someone else's gift is not a purchase, so it is never
 * policy-gated.
 *
 * Feed it an append-only `events` array. The CALLER dedupes by id (the
 * chat-row id) before appending; this layer additionally absorbs whatever
 * is already in the array when it mounts, so remounting (e.g. entering the
 * fullscreen viewer) never replays history as a burst of stale banners.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Parsed contents of a GIFT chat row's `giftMeta` JSON string. */
export type GiftMeta = {
  code: string;
  name: string;
  emoji: string;
  amountUsd: number;
  bigAnimation: boolean;
  senderName?: string;
  declarationId?: string;
  message?: string;
};

/** One incoming gift, ready for the overlay. `id` is the chat-row id. */
export type GiftEvent = Omit<GiftMeta, 'senderName'> & {
  id: string;
  senderName: string;
};

/**
 * Defensive parse of a GIFT row's `giftMeta` — a JSON STRING like
 * {"code","name","emoji","amountUsd","bigAnimation","senderName",
 *  "declarationId","message"?}. Returns null when the payload is missing
 * or unusable, so callers can fall back to the row's human-readable text.
 */
export function parseGiftMeta(raw?: string | null): GiftMeta | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (!d || typeof d !== 'object') return null;
    const code = typeof d.code === 'string' && d.code ? d.code : '';
    if (!code) return null;
    return {
      code,
      name: typeof d.name === 'string' && d.name ? d.name : code,
      emoji: typeof d.emoji === 'string' && d.emoji ? d.emoji : '🎁',
      amountUsd:
        typeof d.amountUsd === 'number' && Number.isFinite(d.amountUsd) && d.amountUsd > 0
          ? d.amountUsd
          : 0,
      bigAnimation: d.bigAnimation === true,
      senderName: typeof d.senderName === 'string' && d.senderName ? d.senderName : undefined,
      declarationId:
        typeof d.declarationId === 'string' && d.declarationId ? d.declarationId : undefined,
      message: typeof d.message === 'string' && d.message ? d.message : undefined,
    };
  } catch {
    return null;
  }
}

/** "$5", "$2.50" — whole dollars stay clean, cents only when needed. */
export function formatGiftUsd(v: number): string {
  return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

// ─── Gift banner (top-left stack, combo-aware) ────────────────────────────

type BannerModel = {
  key: string; // sender+code combo key
  from: string;
  name: string;
  emoji: string;
  amountUsd: number;
  count: number;
};

function GiftBanner({ model }: { model: BannerModel }) {
  const slide = useRef(new Animated.Value(-300)).current;
  const comboScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
  }, [slide]);

  useEffect(() => {
    comboScale.setValue(1.6);
    Animated.spring(comboScale, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
  }, [model.count, comboScale]);

  return (
    <Animated.View style={[s.banner, { transform: [{ translateX: slide }] }]}>
      <View style={s.bannerAvatar}>
        <Text style={s.bannerAvatarText}>{model.from.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.bannerName} numberOfLines={1}>
          {model.from}
        </Text>
        <Text style={s.bannerSub} numberOfLines={1}>
          sent a {model.name} · {formatGiftUsd(model.amountUsd)}
        </Text>
      </View>
      <Text style={s.bannerEmoji}>{model.emoji}</Text>
      <Animated.Text style={[s.bannerCombo, { transform: [{ scale: comboScale }] }]}>
        x{model.count}
      </Animated.Text>
    </Animated.View>
  );
}

// ─── Floating emoji riser ─────────────────────────────────────────────────

function Floater({
  emoji,
  rise: riseDistance,
  onDone,
}: {
  emoji: string;
  rise: number;
  onDone: () => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const sway = useRef(Math.random() * 44 - 22).current;
  const right = useRef(10 + Math.random() * 32).current;
  // Stable ref so the parent recreating the inline onDone every render
  // (chat polls re-render the screen every 2.5s) never restarts the rise.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: 2600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDoneRef.current());
  }, [rise]);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 0,
        right,
        fontSize: 26,
        opacity: rise.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -riseDistance] }) },
          { translateX: rise.interpolate({ inputRange: [0, 1], outputRange: [0, sway] }) },
          { scale: rise.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.6, 1, 1.15] }) },
        ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ─── Big-gift takeover ────────────────────────────────────────────────────

function Takeover({ gift, onDone }: { gift: GiftEvent; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  // Same stable-ref guard as Floater — parent re-renders must not restart
  // (and thereby prolong) the takeover animation.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 2600, useNativeDriver: true }).start(() =>
      onDoneRef.current(),
    );
  }, [t]);

  return (
    <View pointerEvents="none" style={s.takeover}>
      <Animated.View
        style={[
          s.takeoverBurst,
          {
            opacity: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.55, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2] }) }],
          },
        ]}
      />
      <Animated.Text
        style={{
          fontSize: 110,
          opacity: t.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            {
              scale: t.interpolate({
                inputRange: [0, 0.18, 0.3, 0.78, 1],
                outputRange: [0, 1.25, 1, 1.05, 0.6],
              }),
            },
            {
              translateY: t.interpolate({
                inputRange: [0.78, 1],
                outputRange: [0, -60],
                extrapolate: 'clamp',
              }),
            },
          ],
        }}
      >
        {gift.emoji}
      </Animated.Text>
      <Animated.View
        style={[
          s.takeoverLabel,
          { opacity: t.interpolate({ inputRange: [0, 0.15, 0.25, 0.8, 1], outputRange: [0, 0, 1, 1, 0] }) },
        ]}
      >
        <Text style={s.takeoverLabelText}>
          <Text style={{ fontWeight: fontWeight.extrabold }}>{gift.senderName}</Text> sent a{' '}
          {gift.name}! · {formatGiftUsd(gift.amountUsd)}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Overlay root ─────────────────────────────────────────────────────────

const BANNER_TTL_MS = 3600;

export function GiftOverlay({
  events,
  bannerTop = spacing.md,
  floaterBottom = 130,
  riseDistance = 420,
  style,
}: {
  /** Append-only list of incoming gifts, already deduped by id by the caller. */
  events: GiftEvent[];
  /** Distance from the overlay's top edge to the banner stack. */
  bannerTop?: number;
  /** Distance from the overlay's bottom edge to where emoji risers start. */
  floaterBottom?: number;
  /** How far the emoji risers travel upward. */
  riseDistance?: number;
  /** Extra style for the root layer (e.g. rounded clipping over a preview). */
  style?: StyleProp<ViewStyle>;
}) {
  const [banners, setBanners] = useState<BannerModel[]>([]);
  const [floaters, setFloaters] = useState<{ id: string; emoji: string }[]>([]);
  const [takeovers, setTakeovers] = useState<GiftEvent[]>([]);
  // null until the first effect run — that run absorbs pre-existing events
  // silently (remount safety) instead of animating them.
  const processedRef = useRef<Set<string> | null>(null);
  const bannerTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const comboCounts = useRef<Record<string, number>>({});
  const floaterSeq = useRef(0);

  const showEvent = useCallback((e: GiftEvent) => {
    // Combo aggregation: repeat gifts from the same sender bump the same
    // banner's xN counter while it's on screen, instead of stacking rows.
    const key = `${e.senderName.trim().toLowerCase()}:${e.code}`;
    const count = (comboCounts.current[key] ?? 0) + 1;
    comboCounts.current[key] = count;

    setBanners((prev) => {
      const existing = prev.find((b) => b.key === key);
      return existing
        ? prev.map((b) => (b.key === key ? { ...b, count } : b))
        : [
            { key, from: e.senderName, name: e.name, emoji: e.emoji, amountUsd: e.amountUsd, count },
            ...prev,
          ].slice(0, 3);
    });
    clearTimeout(bannerTimers.current[key]);
    bannerTimers.current[key] = setTimeout(() => {
      delete comboCounts.current[key];
      setBanners((prev) => prev.filter((b) => b.key !== key));
    }, BANNER_TTL_MS);

    const fid = `${e.id}:${++floaterSeq.current}`;
    setFloaters((prev) => [...prev.slice(-11), { id: fid, emoji: e.emoji }]);

    if (e.bigAnimation) setTakeovers((prev) => [...prev.slice(-2), e]);
  }, []);

  useEffect(() => {
    if (processedRef.current === null) {
      processedRef.current = new Set(events.map((e) => e.id));
      return;
    }
    const processed = processedRef.current;
    for (const e of events) {
      if (processed.has(e.id)) continue;
      processed.add(e.id);
      showEvent(e);
    }
  }, [events, showEvent]);

  // Clear pending banner expirations on unmount.
  useEffect(() => {
    const timers = bannerTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Banners */}
      <View style={[s.bannerStack, { top: bannerTop }]}>
        {banners.map((b) => (
          <GiftBanner key={b.key} model={b} />
        ))}
      </View>

      {/* Floating emoji risers */}
      <View style={[s.floaterLayer, { bottom: floaterBottom }]}>
        {floaters.map((f) => (
          <Floater
            key={f.id}
            emoji={f.emoji}
            rise={riseDistance}
            onDone={() => setFloaters((prev) => prev.filter((x) => x.id !== f.id))}
          />
        ))}
      </View>

      {/* Big-gift takeover — one at a time; extras queue behind it. */}
      {takeovers.length > 0 ? (
        <Takeover
          key={takeovers[0].id}
          gift={takeovers[0]}
          onDone={() => setTakeovers((prev) => prev.slice(1))}
        />
      ) : null}
    </View>
  );
}

// Overlay is intentionally dark-glass over video (like the live screens),
// so these colors are fixed rather than theme-surface driven.
const s = StyleSheet.create({
  bannerStack: {
    position: 'absolute',
    left: spacing.md,
    width: 270,
    maxWidth: '78%',
    gap: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bannerAvatar: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  bannerAvatarText: { color: colors.textOnPrimary, fontSize: 10, fontWeight: fontWeight.bold },
  bannerName: { color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  bannerEmoji: { fontSize: 24 },
  bannerCombo: {
    color: colors.textOnPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    fontStyle: 'italic',
    minWidth: 32,
    textAlign: 'center',
  },

  floaterLayer: { position: 'absolute', right: 6, width: 80, top: 0 },

  takeover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  takeoverBurst: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.accent,
  },
  takeoverLabel: {
    position: 'absolute',
    bottom: '32%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    maxWidth: '86%',
  },
  takeoverLabelText: {
    color: colors.textOnPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});
