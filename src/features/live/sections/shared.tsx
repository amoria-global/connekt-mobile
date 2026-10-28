/**
 * Small pieces the live-page sections share: the card frame, a pill button, and a skeleton block. Everything is drawn
 * from the viewer tokens (V), because the live page is always dark, whatever the app theme is.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, onFill } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { V } from '@/features/streams/viewer/viewerTheme';
import type { IconName } from '@/features/streams/viewer/types';

export function SectionCard({ title, subtitle, children, style }: { title?: string; subtitle?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.card, style]}>
      {title ? (
        <View style={s.head}>
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** A 44pt pill action. `tone="primary"` is the one filled action in a group. */
export function PillButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  tone = 'quiet',
  accessibilityLabel,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'primary' | 'quiet';
  accessibilityLabel?: string;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [s.pill, tone === 'primary' ? s.pillPrimary : s.pillQuiet, off && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
    >
      {icon ? <Ionicons name={icon} size={16} color={tone === 'primary' ? onFill : V.text} /> : null}
      <Text style={[s.pillText, tone === 'primary' && { color: onFill }]} numberOfLines={1}>
        {busy ? 'Please wait' : label}
      </Text>
    </Pressable>
  );
}

export function SkelBlock({ width = '100%', height = 14, radius = 8 }: { width?: number | `${number}%`; height?: number; radius?: number }) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: V.surfaceRaised, opacity: reduced ? 0.7 : pulse }} />;
}

/** One state message inside a section: an icon, a line, and an optional action. */
export function StateNote({ icon, text, actionLabel, onAction }: { icon: IconName; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={s.note} accessibilityRole="summary">
      <Ionicons name={icon} size={22} color={V.textMuted} />
      <Text style={s.noteText}>{text}</Text>
      {actionLabel && onAction ? <PillButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: V.surface, borderRadius: 16, borderWidth: 1, borderColor: V.border, padding: 12, gap: 10 },
  head: { gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: V.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: V.textMuted },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: V.hit, paddingHorizontal: 14, borderRadius: V.hit / 2, borderWidth: 1 },
  pillQuiet: { backgroundColor: V.surfaceRaised, borderColor: V.border },
  pillPrimary: { backgroundColor: V.primary, borderColor: V.primary },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: V.text },
  note: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  noteText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: V.textSoft, textAlign: 'center' },
});
