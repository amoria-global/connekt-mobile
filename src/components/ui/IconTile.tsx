/**
 * IconTile: the glowing icon square that heads a bento tile or a glass panel (design/home.png,
 * Opportunities and Collaborate). Tone follows colour meaning; `glow` counts toward the screen's
 * three, so leave it off unless the tile is where attention should go.
 */
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { alpha, glowRgb, makeStyles, radii, shadows, useTheme } from '@/theme';
import { chipColors, type ChipTone } from './StatusChip';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: ChipTone;
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
};

const SIZES = { sm: { box: 32, icon: 16 }, md: { box: 36, icon: 18 }, lg: { box: 40, icon: 20 } } as const;
const GLOW: Partial<Record<ChipTone, string>> = {
  primary: glowRgb.primary,
  accent: glowRgb.accent,
  live: glowRgb.live,
  active: glowRgb.active,
  pending: glowRgb.pending,
};

export function IconTile({ icon, tone = 'primary', size = 'md', glow = false }: Props) {
  const styles = useStyles();
  const { colors, gradients, isDark } = useTheme();
  const { fg, bg } = chipColors(colors, gradients, isDark, tone);
  const s = SIZES[size];
  const rgb = GLOW[tone];
  return (
    <View
      style={[
        styles.tile,
        { width: s.box, height: s.box, backgroundColor: bg, borderColor: alpha(fg, 0.35) },
        glow && rgb ? { boxShadow: shadows.glow(rgb, 0.35) } : null,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icon} size={s.icon} color={fg} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  tile: { borderRadius: radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
}));
