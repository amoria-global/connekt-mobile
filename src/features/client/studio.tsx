/**
 * Night-studio building blocks for the client screens: a gradient hero action, a list row and a progress track.
 * Presentational only. Colours and gradients come from the active palette, so light and dark both work; nothing
 * here hard-codes a colour, a size below 12pt or a touch target below 44pt.
 *
 * Gradients are reserved: one hero per screen, plus at most one violet secondary. Everything else stays flat.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

type IconName = keyof typeof Ionicons.glyphMap;

/** A large, gradient action: icon tile, title, one line of help and a chevron. White text reads on both gradients. */
export function HeroActionCard({
  title,
  subtitle,
  icon,
  tone = 'blue',
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  tone?: 'blue' | 'violet';
  onPress: () => void;
}) {
  const styles = useStyles();
  const { gradients } = useTheme();
  const { tr } = useSharedT();
  const colors = tone === 'violet' ? gradients.heroViolet : gradients.heroBlue;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${tr(title)}, ${tr(subtitle)}` : tr(title)}
      style={({ pressed }) => [styles.heroWrap, pressed && styles.pressed]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {tr(title)}
          </Text>
          {subtitle ? (
            <Text style={styles.heroSub} numberOfLines={2} maxFontSizeMultiplier={1.25}>
              {tr(subtitle)}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

/**
 * One row of a list: a leading icon tile or thumbnail, a title and meta line, a trailing value or chip, a chevron
 * when it can be opened. A row with `onPress` is at least 56dp tall. Group rows inside a `Card` with `padding: 0`
 * and pass `divider` on every row but the last.
 */
export function ListRow({
  title,
  meta,
  icon,
  tone = 'primary',
  leading,
  trailing,
  onPress,
  divider,
  accessibilityLabel,
  destructive,
  titleLines = 2,
  metaLines = 2,
}: {
  title: string;
  meta?: string;
  icon?: IconName;
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'error';
  /** Replaces the icon tile (a thumbnail, an avatar). */
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  accessibilityLabel?: string;
  destructive?: boolean;
  /** Lines the title may use before it is cut; raise it for sentences that must be read in full. */
  titleLines?: number;
  /** Lines the meta may use before it is cut; raise it when the meta carries something to read in full (an email). */
  metaLines?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const toneFg = { primary: colors.link, accent: colors.accent, success: colors.success, warning: colors.warning, error: colors.error }[tone];
  const toneBg = { primary: colors.tint, accent: colors.tintAccent, success: colors.successBg, warning: colors.warningBg, error: colors.errorBg }[tone];
  const body = (
    <>
      {leading ??
        (icon ? (
          <View style={[styles.rowIcon, { backgroundColor: destructive ? colors.errorBg : toneBg }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name={icon} size={18} color={destructive ? colors.error : toneFg} />
          </View>
        ) : null)}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, destructive && { color: colors.error }]} numberOfLines={titleLines} maxFontSizeMultiplier={1.3}>
          {tr(title)}
        </Text>
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={metaLines} maxFontSizeMultiplier={1.3}>
            {tr(meta)}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </>
  );
  const rowStyle = [styles.row, divider && styles.rowDivider];
  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (meta ? `${title}, ${meta}` : title)}
      style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export type TrackStep = { key: string; label: string; state: 'done' | 'current' | 'todo' };

/**
 * A horizontal progress track (booking steps, a wizard). The current step is pink, done steps carry a check, and the
 * state is also in the accessible label, so it never relies on colour alone. Labels wrap rather than truncate.
 */
export function ProgressTrack({ steps, label = 'Progress' }: { steps: readonly TrackStep[]; label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const current = steps.findIndex((s) => s.state === 'current');
  const summary =
    current >= 0 ? `${label}: step ${current + 1} of ${steps.length}, ${steps[current].label}` : `${label}: ${steps.filter((s) => s.state === 'done').length} of ${steps.length} done`;
  return (
    <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityLabel={summary}>
      {steps.map((s, i) => {
        const done = s.state === 'done';
        const on = s.state === 'current';
        return (
          <View key={s.key} style={styles.trackStep}>
            <View style={styles.trackDotRow}>
              <View style={[styles.trackLine, (done || on) && { backgroundColor: colors.success }, i === 0 && styles.trackLineHidden]} />
              <View
                style={[
                  styles.trackDot,
                  done && { backgroundColor: colors.success, borderColor: colors.success },
                  on && { borderColor: colors.accent, backgroundColor: colors.tintAccent },
                ]}
              >
                {done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : on ? <View style={[styles.trackInner, { backgroundColor: colors.accent }]} /> : null}
              </View>
              <View style={[styles.trackLine, done && { backgroundColor: colors.success }, i === steps.length - 1 && styles.trackLineHidden]} />
            </View>
            <Text style={[styles.trackLabel, on && { color: colors.text, fontWeight: '700' }]} maxFontSizeMultiplier={1.3}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pressed: { opacity: 0.88 },
  heroWrap: { borderRadius: radii.lg, overflow: 'hidden' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  heroIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 23 },
  heroSub: { color: '#FFFFFF', opacity: 0.92, fontSize: 13, lineHeight: 18, marginTop: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  rowIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 1 },

  track: { flexDirection: 'row', paddingHorizontal: spacing.lg },
  trackStep: { flex: 1, alignItems: 'center', minWidth: 0 },
  trackDotRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  trackLine: { flex: 1, height: 2, backgroundColor: c.border },
  trackLineHidden: { backgroundColor: 'transparent' },
  trackDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
  trackInner: { width: 8, height: 8, borderRadius: 4 },
  trackLabel: { color: c.textMuted, fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: 2 },
}));
