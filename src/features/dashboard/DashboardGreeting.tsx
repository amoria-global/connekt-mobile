import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { spacing, useTheme } from '@/theme';
import { GREETINGS, NAME_GRADIENT, gradientChars, timeOfDay } from './greetingModel';

/** Web cycles the phrase every 5 seconds. */
export const GREETING_ROTATE_MS = 5000;

/**
 * The welcome hero at the top of every role's Home, matching the web dashboards: a
 * tinted blue-to-pink card with a 3px gradient bar, the "Your dashboard" eyebrow, a
 * time-of-day greeting that rotates every five seconds, and the first name in the
 * brand gradient. The card eases up on mount and the phrase cross-fades on change.
 * With "Reduce motion" on it shows one fixed phrase and does not animate.
 */
export function DashboardGreeting({
  name,
  subtitle,
  trailing,
  footer,
}: {
  name: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** Rendered inside the card under the greeting, e.g. a stats strip. */
  footer?: ReactNode;
}) {
  const { colors, isDark } = useTheme();
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
    Animated.timing(enter, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      const now = timeOfDay();
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        if (now !== tod) {
          setTod(now);
          setIndex(0);
        } else {
          setIndex((i) => (i + 1) % phrases.length);
        }
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
    }, GREETING_ROTATE_MS);
    return () => clearInterval(id);
  }, [fade, phrases.length, reduced, tod]);

  const ramp = isDark ? NAME_GRADIENT.dark : NAME_GRADIENT.light;
  const glyphs = useMemo(() => gradientChars(name, ramp.from, ramp.to), [name, ramp.from, ramp.to]);
  const phrase = reduced ? phrases[0] : phrases[index % phrases.length];

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <LinearGradient
        colors={['rgba(8,58,133,0.08)', 'rgba(242,12,143,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: colors.border }]}
      >
        <LinearGradient
          colors={isDark ? ['#60A5FA', '#F472B6'] : ['#083A85', '#F20C8F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bar}
        />
        <View style={styles.row}>
          <View style={styles.text}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Your dashboard</Text>
            <Animated.View style={{ opacity: fade }}>
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={2}
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
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
          {trailing}
        </View>
        {footer}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 29, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, marginTop: 6 },
});
