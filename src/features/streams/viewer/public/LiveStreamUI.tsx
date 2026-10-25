/**
 * The Live Stream screen, Midnight Glass x Broadcast Red (design/live-stream.png).
 *
 * Presentational only: every piece takes its data and handlers as props from the screen, which keeps
 * its own state, sockets, chat and payment code. Anything the screen has no data for (a start time,
 * a pinned message, join notices, a signal reading) is simply not drawn.
 *
 * Motion follows the reference (new rows slide up 8px in 200ms, the gift row glows in over 600ms,
 * a reaction press scales .9 to 1.1 to 1, floating reactions rise 160px with a 12px sway over
 * 1.8s). Reduced motion drops the movement and keeps simple fades.
 */
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GlassLayer, glassClear } from '@/components/ui/GlassCard';
import { LiveDot, LivePill, LiveRing } from '@/components/ui/live';
import { fonts, glowRgb, liveFill, makeStyles, motion, onFill, raisedStops, shadows, useReducedMotion, useTheme } from '@/theme';

/** Seconds the stage controls stay up after the last touch. */
export const CONTROLS_HIDE_MS = 3000;

/** Reaction float: rise, sway and total time, from the reference. */
export const FLOAT = { rise: 160, sway: 12, ms: 1800 } as const;

const HIT = 44;

/* ── Auto-hiding controls ─────────────────────────────────────────────────────────────────── */

/** Controls fade out after 3s and return on a tap. `pinned` keeps them up (a loading or error state). */
export function useAutoHide(pinned = false) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [opacity] = useState(() => new Animated.Value(1));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const arm = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setVisible(false), CONTROLS_HIDE_MS);
  }, [clear]);
  const show = useCallback(() => {
    setVisible(true);
    arm();
  }, [arm]);

  const shown = pinned || visible;
  useEffect(() => {
    if (shown && !pinned) arm();
    else clear();
    return clear;
  }, [shown, pinned, arm, clear]);
  useEffect(() => {
    Animated.timing(opacity, { toValue: shown ? 1 : 0, duration: reduced ? 0 : motion.fast, useNativeDriver: true }).start();
  }, [shown, opacity, reduced]);

  return { visible: shown, opacity, show };
}

/* ── Stage ────────────────────────────────────────────────────────────────────────────────── */

const MediaBtn = memo(function MediaBtn({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.mediaBtn, glassClear, active && s.mediaBtnOn, pressed && { opacity: 0.75 }]}
    >
      <GlassLayer />
      <Ionicons name={icon} size={20} color={onFill} />
    </Pressable>
  );
});

/**
 * Glass controls over the video: back, LIVE badge and viewers on top; volume, donate and fullscreen
 * below. Fades with `useAutoHide`; the caller draws the tap layer that brings it back.
 */
export const StageControls = memo(function StageControls(p: {
  opacity: Animated.Value;
  visible: boolean;
  live: boolean;
  viewerCount: number;
  muted: boolean;
  onBack: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onDonate?: () => void;
  /** Called on any press inside the controls, so the timer restarts. */
  onTouch?: () => void;
}) {
  const pe = p.visible ? 'box-none' : 'none';
  const touch = (fn: () => void) => () => {
    p.onTouch?.();
    fn();
  };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: p.opacity }]} pointerEvents={pe}>
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']} style={s.topScrim} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={s.bottomScrim} pointerEvents="none" />
      <View style={s.top} pointerEvents={pe}>
        <MediaBtn icon="chevron-back" label="Back" onPress={touch(p.onBack)} />
        {p.live ? <LivePill size="md" style={s.pillSelf} /> : null}
        {p.viewerCount > 0 ? <ViewerChip count={p.viewerCount} /> : null}
      </View>
      <View style={s.bottom} pointerEvents={pe}>
        <View style={{ flex: 1 }} />
        {p.onDonate ? <MediaBtn icon="heart-circle-outline" label="Donate" onPress={touch(p.onDonate)} /> : null}
        <MediaBtn icon={p.muted ? 'volume-mute' : 'volume-high'} label={p.muted ? 'Unmute stream' : 'Mute stream'} onPress={touch(p.onToggleMute)} />
        <MediaBtn icon="expand" label="Full screen cinema mode" onPress={touch(p.onFullscreen)} />
      </View>
    </Animated.View>
  );
});

function formatViewers(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();
}

const ViewerChip = memo(function ViewerChip({ count }: { count: number }) {
  return (
    <View style={s.viewerChip} accessible accessibilityLabel={`${count} watching`}>
      <Ionicons name="eye-outline" size={14} color={onFill} />
      <Text style={s.viewerText}>{formatViewers(count)}</Text>
    </View>
  );
});

/** The thin red line under the video, glowing like the rest of the live card. */
export const LiveEdge = memo(function LiveEdge() {
  return <View style={s.edge} pointerEvents="none" />;
});

/* ── Host bar ─────────────────────────────────────────────────────────────────────────────── */

const useHost = makeStyles((c) => ({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, margin: 2 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  initial: { fontFamily: fonts.bold, fontSize: 18, color: onFill },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: c.text },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted, marginTop: 1 },
  giftBtn: { height: HIT, borderRadius: HIT / 2, overflow: 'hidden', justifyContent: 'center' },
  giftFill: { ...StyleSheet.absoluteFill },
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: HIT },
  giftText: { fontFamily: fonts.bold, fontSize: 15, color: onFill },
  likeBtn: { width: HIT, height: HIT, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: c.well, borderColor: c.stroke },
}));

/** Host identity: a red live ring around the avatar, the title and organiser, Gift and Like. */
export const HostBar = memo(function HostBar(p: {
  title: string;
  hostName?: string;
  hostImage?: string;
  live: boolean;
  onGift?: () => void;
  onLike: () => void;
}) {
  const st = useHost();
  const { colors, gradients } = useTheme();
  const initial = (p.hostName || p.title).charAt(0).toUpperCase();
  return (
    <View style={st.bar}>
      <LiveRing size={50} live={p.live} colors={[colors.primary, colors.primaryLight] as const}>
        {p.hostImage ? (
          <Image source={{ uri: p.hostImage }} style={[st.avatar, { backgroundColor: colors.card }]} contentFit="cover" />
        ) : (
          <View style={[st.avatar, st.avatarFallback]}>
            <Text style={st.initial}>{initial}</Text>
          </View>
        )}
      </LiveRing>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.title} numberOfLines={2} accessibilityRole="header">
          {p.title}
        </Text>
        {p.hostName ? (
          <Text style={st.sub} numberOfLines={1}>
            {p.hostName}
          </Text>
        ) : null}
      </View>
      {p.onGift ? (
        <Pressable
          onPress={p.onGift}
          accessibilityRole="button"
          accessibilityLabel="Send a gift"
          style={({ pressed }) => [st.giftBtn, { boxShadow: shadows.raised(glowRgb.accent) }, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient colors={gradients.raisedAccent as unknown as [string, string, string]} locations={raisedStops as unknown as [number, number, number]} style={st.giftFill} />
          <View style={st.giftRow}>
            <Ionicons name="gift-outline" size={17} color={onFill} />
            <Text style={st.giftText}>Gift</Text>
          </View>
        </Pressable>
      ) : null}
      <Pressable onPress={p.onLike} accessibilityRole="button" accessibilityLabel="Like" style={({ pressed }) => [st.likeBtn, pressed && { opacity: 0.75 }]}>
        <Ionicons name="heart" size={20} color={colors.live} />
      </Pressable>
    </View>
  );
});

/* ── Chat ─────────────────────────────────────────────────────────────────────────────────── */

const useChat = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, minHeight: 52 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: fonts.display, fontSize: 16, color: c.text },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghost: { width: HIT, height: HIT, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: c.well, borderColor: c.stroke },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.bold, fontSize: 13, color: onFill },
  col: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.bold, fontSize: 14 },
  msg: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.text },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: c.liveDeep },
  tagText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: onFill },
  youTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: c.pendingBg, borderWidth: 1, borderColor: c.pending },
  youText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: c.pending },
  gift: { borderRadius: 14, borderWidth: 1, borderColor: c.accent, backgroundColor: 'rgba(238,14,143,0.12)', paddingHorizontal: 12, paddingVertical: 10, marginVertical: 4 },
  giftLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  giftEmoji: { fontSize: 22 },
  giftText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: c.text },
  giftName: { fontFamily: fonts.bold },
  giftAmount: { fontFamily: fonts.bold, color: c.accentLight },
  reactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  react: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: c.glassSolid, borderColor: c.stroke },
  reactEmoji: { fontSize: 22 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  cam: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: c.well, borderColor: c.stroke },
  input: { flex: 1, minHeight: HIT, paddingHorizontal: 18, borderRadius: HIT / 2, borderWidth: 1, backgroundColor: c.well, borderColor: c.stroke, color: c.text, fontFamily: fonts.regular, fontSize: 15 },
  send: { width: HIT, height: HIT, borderRadius: HIT / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: c.text, marginTop: 10 },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  chip: { minHeight: HIT, paddingHorizontal: 16, borderRadius: HIT / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.well, borderColor: c.stroke },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: c.text },
  illBack: { width: 66, height: 42, borderRadius: 12, borderWidth: 1, backgroundColor: c.glassSolid, borderColor: c.stroke, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  illDot: { width: 6, height: 6, borderRadius: 3 },
  illFront: { position: 'absolute', right: -22, bottom: -14, width: 46, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
}));

/** Name colours for chat, all readable (4.5:1) on the dark card. */
function nameColors(c: ReturnType<typeof useTheme>['colors']) {
  return [c.active, c.primaryLight, c.accentLight, c.pending, c.success, c.liveText];
}
function hue(name: string, palette: string[]) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/** Glass header: title with a live dot, then the full screen and collapse buttons. */
export const ChatHeaderBar = memo(function ChatHeaderBar(p: {
  title: string;
  live: boolean;
  minimized: boolean;
  onFullscreen: () => void;
  onToggleMinimize: () => void;
  fullscreenLabel: string;
}) {
  const st = useChat();
  const { colors } = useTheme();
  return (
    <View style={st.header}>
      <View style={st.headerLeft}>
        <Text style={st.headerTitle}>{p.title}</Text>
        {p.live ? <LiveDot size={6} color={colors.live} /> : null}
      </View>
      <View style={st.headerBtns}>
        <Pressable style={st.ghost} onPress={p.onFullscreen} accessibilityRole="button" accessibilityLabel={p.fullscreenLabel}>
          <Ionicons name="expand-outline" size={18} color={colors.text} />
        </Pressable>
        <Pressable style={st.ghost} onPress={p.onToggleMinimize} accessibilityRole="button" accessibilityLabel={p.minimized ? 'Expand chat' : 'Collapse chat'}>
          <Ionicons name={p.minimized ? 'chevron-down' : 'chevron-up'} size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
});

type RowProps = {
  name: string;
  avatar?: string;
  isOwn: boolean;
  isHost: boolean;
  onLongPress?: () => void;
  youLabel: string;
  /** Message body, or the gift description. */
  children: ReactNode;
  gift?: boolean;
  accessibilityHint?: string;
};

/** One chat row: coloured name, HOST tag, a glowing row for a gift. Slides up 8px as it arrives. */
export const ChatRow = memo(function ChatRow({ name, avatar, isOwn, isHost, onLongPress, youLabel, children, gift }: RowProps) {
  const st = useChat();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [enter] = useState(() => new Animated.Value(0));
  const [settle] = useState(() => new Animated.Value(gift && !reduced ? 1 : 0));
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: reduced ? 120 : 200, easing: motion.easing, useNativeDriver: true }).start();
    if (gift && !reduced) Animated.timing(settle, { toValue: 0, duration: 600, useNativeDriver: false }).start();
  }, [enter, settle, gift, reduced]);

  const tint = isHost ? colors.liveText : isOwn ? colors.pending : hue(name, nameColors(colors));
  const initial = name.trim().charAt(0).toUpperCase() || 'G';
  const glow = settle.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.55] });

  return (
    <Animated.View style={{ opacity: enter, transform: reduced ? [] : [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      <Pressable onLongPress={onLongPress} delayLongPress={300} accessibilityRole={onLongPress ? 'button' : undefined} accessibilityHint={onLongPress ? 'Long press to report this message or hide this person' : undefined}>
        {gift ? (
          <View>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 14, boxShadow: `0 0 18px ${colors.accent}`, opacity: glow }]} />
            <View style={st.gift}>
              <Text style={[st.name, { color: tint, marginBottom: 2 }]} numberOfLines={1}>
                {name}
              </Text>
              {children}
            </View>
          </View>
        ) : (
          <View style={st.row}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={st.avatar} contentFit="cover" />
            ) : (
              <View style={[st.avatar, st.avatarFallback, { backgroundColor: colors.glassSolid, borderWidth: 1, borderColor: tint }]}>
                <Text style={[st.avatarInitial, { color: tint }]}>{initial}</Text>
              </View>
            )}
            <View style={st.col}>
              <View style={st.nameRow}>
                <Text style={[st.name, { color: tint }]} numberOfLines={1}>
                  {name}
                </Text>
                {isHost ? (
                  <View style={st.tag}>
                    <Text style={st.tagText}>HOST</Text>
                  </View>
                ) : null}
                {isOwn ? (
                  <View style={st.youTag}>
                    <Text style={st.youText}>{youLabel}</Text>
                  </View>
                ) : null}
              </View>
              {children}
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

/** Hook for the screen's own message text and gift lines, so they share this file's type. */
export const useChatText = useChat;

/** Empty chat: a small illustration, a prompt and quick-hello chips that only fill the input. */
export const EmptyChat = memo(function EmptyChat({ onPick, phrases }: { onPick: (text: string) => void; phrases: string[] }) {
  const st = useChat();
  const { colors, gradients } = useTheme();
  return (
    <View style={st.emptyWrap}>
      <View style={{ marginBottom: 10, marginRight: 10 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={st.illBack}>
          <View style={[st.illDot, { backgroundColor: colors.primaryLight }]} />
          <View style={[st.illDot, { backgroundColor: colors.primaryLight, opacity: 0.7 }]} />
          <View style={[st.illDot, { backgroundColor: colors.primaryLight, opacity: 0.4 }]} />
        </View>
        <View style={st.illFront}>
          <LinearGradient colors={gradients.raisedAccent as unknown as [string, string, string]} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 20 }}>👋</Text>
        </View>
      </View>
      <Text style={st.emptyTitle}>Be the first to say hello</Text>
      <Text style={st.emptySub}>Everyone watching sees your message instantly.</Text>
      <View style={st.chips}>
        {phrases.map((t) => (
          <Pressable key={t} onPress={() => onPick(t)} accessibilityRole="button" accessibilityLabel={`Use "${t}"`} style={({ pressed }) => [st.chip, pressed && { opacity: 0.75 }]}>
            <Text style={st.chipText}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

/** Glass circle reaction buttons. A press scales .9, 1.1, 1. */
export const ReactionRow = memo(function ReactionRow({ emojis, onReact }: { emojis: string[]; onReact: (e: string) => void }) {
  const st = useChat();
  return (
    <View style={st.reactRow}>
      {emojis.map((e) => (
        <ReactionButton key={e} emoji={e} onPress={() => onReact(e)} />
      ))}
    </View>
  );
});

const ReactionButton = memo(function ReactionButton({ emoji, onPress }: { emoji: string; onPress: () => void }) {
  const st = useChat();
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const press = () => {
    if (!reduced) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.9, duration: 70, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.1, duration: 90, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
      ]).start();
    }
    onPress();
  };
  return (
    <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={`React with ${emoji}`}>
      <Animated.View style={[st.react, { transform: [{ scale }] }]}>
        <Text style={st.reactEmoji}>{emoji}</Text>
      </Animated.View>
    </Pressable>
  );
});

/** Camera button, inset input and a raised blue send. The placeholder and send rules stay the screen's. */
export const Composer = memo(function Composer(p: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onVideo: () => void;
  videoSending: boolean;
  sending: boolean;
  placeholder: string;
  bottomInset: number;
}) {
  const st = useChat();
  const { colors, gradients } = useTheme();
  const canSend = !p.sending && p.value.trim().length > 0;
  return (
    <View style={[st.composer, { paddingBottom: Math.max(p.bottomInset, 10) }]}>
      <Pressable
        onPress={p.onVideo}
        disabled={p.videoSending || p.sending}
        accessibilityRole="button"
        accessibilityLabel="Send a video"
        style={[st.cam, p.videoSending && { opacity: 0.5 }]}
      >
        {p.videoSending ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="videocam-outline" size={20} color={colors.text} />}
      </Pressable>
      <TextInput
        value={p.value}
        onChangeText={p.onChange}
        placeholder={p.placeholder}
        placeholderTextColor={colors.textMuted}
        editable={!p.sending}
        style={st.input}
        returnKeyType="send"
        onSubmitEditing={p.onSend}
        accessibilityLabel="Chat message"
      />
      <Pressable
        onPress={p.onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        style={[st.send, canSend && { boxShadow: shadows.raised(glowRgb.primary) }, !canSend && { backgroundColor: colors.well, opacity: 0.8 }]}
      >
        {canSend ? <LinearGradient colors={gradients.raisedPrimary as unknown as [string, string, string]} locations={raisedStops as unknown as [number, number, number]} style={StyleSheet.absoluteFill} /> : null}
        {p.sending ? <ActivityIndicator size="small" color={onFill} /> : <Ionicons name="send" size={18} color={canSend ? onFill : colors.textMuted} />}
      </Pressable>
    </View>
  );
});

/* ── Floating reactions ───────────────────────────────────────────────────────────────────── */

export type FloatItem = { id: string; emoji: string; anim: Animated.Value; offset: number };

/** Tapped reactions rise 160px, sway 12px either way and fade out over 1.8s. Reduced motion: a short fade in place. */
export const FloatingReactions = memo(function FloatingReactions({ items, style }: { items: FloatItem[]; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  if (items.length === 0) return null;
  return (
    <View pointerEvents="none" style={style} importantForAccessibility="no-hide-descendants">
      {items.map((fx) => (
        <Animated.Text
          key={fx.id}
          style={[
            s.floater,
            {
              left: fx.offset,
              opacity: fx.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: reduced
                ? []
                : [
                    { translateY: fx.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT.rise] }) },
                    { translateX: fx.anim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, FLOAT.sway, 0, -FLOAT.sway, 0] }) },
                    { scale: fx.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.15, 1] }) },
                  ],
            },
          ]}
        >
          {fx.emoji}
        </Animated.Text>
      ))}
    </View>
  );
});

/* ── Reconnecting ─────────────────────────────────────────────────────────────────────────── */

const useRecon = makeStyles((c) => ({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 20, backgroundColor: 'rgba(5,8,18,0.62)' },
  ring: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: c.liveDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  arc: { ...StyleSheet.absoluteFill, borderRadius: 38, borderWidth: 4, borderColor: 'transparent', borderTopColor: c.live },
  title: { fontFamily: fonts.display, fontSize: 18, color: onFill },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.78)', textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: HIT, paddingHorizontal: 20, borderRadius: HIT / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8 },
  retryText: { fontFamily: fonts.semibold, fontSize: 14, color: onFill },
}));

/**
 * The reconnecting state: the last frame blurred, a red spinner around the logo, the auto-resume
 * line and a Retry button. `onRetry` is the screen's existing reconnect function.
 */
export const ReconnectingPanel = memo(function ReconnectingPanel({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  const st = useRecon();
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin, reduced]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={st.wrap} accessibilityLiveRegion="polite">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={st.ring}>
        <Animated.View style={[st.arc, { transform: [{ rotate }] }]} />
        <Ionicons name="radio" size={28} color={onFill} />
      </View>
      <Text style={st.title}>Reconnecting…</Text>
      <Text style={st.sub}>The stream will resume automatically</Text>
      <Pressable onPress={onRetry} disabled={retrying} accessibilityRole="button" accessibilityLabel="Retry now" style={({ pressed }) => [st.retry, pressed && { opacity: 0.75 }]}>
        {retrying ? <ActivityIndicator size="small" color={onFill} /> : <Ionicons name="refresh" size={16} color={onFill} />}
        <Text style={st.retryText}>Retry now</Text>
      </Pressable>
    </View>
  );
});

/* ── Styles that do not depend on the scheme (always over video) ──────────────────────────── */

const s = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 96 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 84 },
  top: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottom: { position: 'absolute', bottom: 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillSelf: { alignSelf: 'center' },
  mediaBtn: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(8,14,30,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  mediaBtnOn: { backgroundColor: 'rgba(255,255,255,0.28)' },
  viewerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(8,14,30,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  viewerText: { fontFamily: fonts.bold, fontSize: 13, color: onFill },
  edge: { height: 2, backgroundColor: liveFill.mid, boxShadow: '0 0 12px rgba(255,0,51,0.7)' },
  floater: { position: 'absolute', bottom: 0, fontSize: 30 },
});
