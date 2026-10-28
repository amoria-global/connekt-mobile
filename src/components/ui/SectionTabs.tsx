/**
 * SectionTabs: one inset bar of equal tabs, each with an icon over a label (design: Events screen, Events | Albums |
 * Photobooks | Content). 50pt tall, every tab visible without scrolling. The active tab is a raised blue gradient pill with
 * white text; inactive tabs use the soft light text colour (#C9D5EA in the dark palette), never a dim grey.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { darkPalette, fontSize, fonts, makeStyles, onFill, radii, shadows, useTheme } from '@/theme';

export type SectionTab<K extends string> = { key: K; label: string; icon: keyof typeof Ionicons.glyphMap };

export function SectionTabs<K extends string>({ tabs, value, onChange, label = 'Sections' }: { tabs: readonly SectionTab<K>[]; value: K; onChange: (k: K) => void; label?: string }) {
  const styles = useStyles();
  const { colors, gradients } = useTheme();
  return (
    <View style={styles.bar} accessibilityRole="tablist" accessibilityLabel={label}>
      {tabs.map((t) => {
        const active = t.key === value;
        const fg = active ? onFill : colors.textSoft;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            {active ? <LinearGradient colors={gradients.raisedPrimary} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, styles.pill]} /> : null}
            <Ionicons name={t.icon} size={18} color={fg} />
            <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
  },
  tab: { flex: 1, height: 50, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  pill: { borderRadius: radii.md },
  text: { fontFamily: fonts.semibold, fontSize: fontSize.xs },
}));
