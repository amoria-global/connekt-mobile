import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { compactSheet, fonts, motion, radii, spacing, tracking, useTheme } from '@/theme';
import { GREETINGS, gradientChars, timeOfDay } from './greetingModel';

/** Web cycles the phrase every 5 seconds. */
export const GREETING_ROTATE_MS = 5000;

/**
 * The welcome hero at the top of every role's Home (design/home.png): a glass panel with a
 * magenta eyebrow (the date, or "Your dashboard"), a time-of-day greeting that rotates every
 * five seconds, and the first name in the blue-to-magenta ring gradient. The card eases up on
 * mount and the phrase cross-fades on change. With "Reduce motion" on it shows one fixed
 * phrase and does not animate.
 */
export function DashboardGreeting({
  name,
  eyebrow = 'Your dashboard',
  subtitle,
  trailing,
  footer,
}: {
  name: string;
  /** The small magenta line above the greeting. */
  eyebrow?: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** Rendered inside the card under the greeting, e.g. a stats strip. */
  footer?: ReactNode;
}) {
  const { colors, gradients } = useTheme();
  const reduced = useReducedMotion();
  const [tod, setTod] = useState(() => timeOfDay());
  const [index, setIndex] = useState(0);
  const [enter] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const phrases = GREETINGS[tod];

  useEffect(() => {
    if (reduced) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, { toValue: 1, duration: motion.slow, easing: motion.easing, useNativeDriver: true }).start();
  }, [enter, reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      const now = timeOfDay();
      Animated.timing(fade, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start(() => {
        if (now !== tod) {
          setTod(now);
          setIndex(0);
        } else {
          setIndex((i) => (i + 1) % phrases.length);
        }
        Animated.timing(fade, { toValue: 1, duration: motion.slow, useNativeDriver: true }).start();
      });
    }, GREETING_ROTATE_MS);
    return () => clearInterval(id);
  }, [fade, phrases.length, reduced, tod]);

  const [from, to] = gradients.ring;
  const glyphs = useMemo(() => gradientChars(name, from, to), [name, from, to]);
  const phrase = reduced ? phrases[0] : phrases[index % phrases.length];

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.text}>
            <Text style={[styles.eyebrow, { color: colors.accentLight }]}>{eyebrow}</Text>
            <Animated.View style={{ opacity: fade }}>
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={3}
                accessibilityRole="header"
                accessibilityLabel={`${phrase}, ${name}`}
              >
                {phrase},{' '}
                {glyphs.map((g, i) => (
                  <Text key={i} style={{ color: g.color }}>
                    {g.ch}
                  </Text>
                ))}
              </Text>
            </Animated.View>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textSoft }]}>{subtitle}</Text> : null}
          </View>
          {trailing}
        </View>
        {footer}
      </GlassCard>
    </Animated.View>
  );
}

const styles = compactSheet({
  wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  card: { borderRadius: radii.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  text: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 12, fontFamily: fonts.semibold, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: spacing.sm },
  title: { fontSize: 32, fontFamily: fonts.display, lineHeight: 36, letterSpacing: tracking(32, -0.03) },
  subtitle: { fontSize: 15, lineHeight: 21, fontFamily: fonts.regular, marginTop: spacing.sm },
});
