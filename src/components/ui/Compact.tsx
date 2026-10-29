/**
 * Compact Glass kit (design/compact-glass.png): the dense, obviously-tappable pieces.
 *
 *  - ActionTile:  a horizontal tile (icon left, text right, about 52pt) with a solid coloured icon
 *                 tile, a tinted fill and a 1px coloured border. For one tap action.
 *  - ActionRow:   a full-width ActionTile with a small button on the right (Share profile, Copy).
 *  - StatStrip:   a slim, flat, non-tappable strip for a number and its note.
 *  - NavGroup and NavRow: stacked navigation cards as one grouped list with dividers; every row ends
 *                 with a chevron.
 *
 * Tappable means a coloured signal (tint plus border, a solid icon tile, or a chevron); info-only
 * stays flat. Visuals are small, targets are not: each pressable is at least 44pt tall, or padded
 * with `hitSlop` up to it.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { alpha, density, fonts, hitSlopFor, makeStyles, onFill, radii, shadows, useTheme } from '@/theme';
import type { Palette } from '@/theme';
import { chipColors, type ChipTone } from './StatusChip';

type IconName = keyof typeof Ionicons.glyphMap;

/** The solid fill behind a white icon, per tone. */
function solidFill(c: Palette, tone: ChipTone): string {
  switch (tone) {
    case 'accent':
      return c.accent;
    case 'active':
      return c.active;
    case 'live':
      return c.liveDeep;
    case 'pending':
      return c.pending;
    case 'success':
      return c.success;
    case 'error':
      return c.error;
    case 'neutral':
      return c.textMuted;
    default:
      return c.primary;
  }
}

/** The coloured square that heads a tile or a row: solid fill, white glyph. */
export function SolidTile({ icon, tone = 'primary', size = density.iconTile }: { icon: IconName; tone?: ChipTone; size?: number }) {
  const { colors } = useTheme();
  const fill = solidFill(colors, tone);
  return (
    <View
      style={{ width: size, height: size, borderRadius: radii.md - 2, alignItems: 'center', justifyContent: 'center', backgroundColor: fill, boxShadow: shadows.highlight }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icon} size={density.icon} color={onFill} />
    </View>
  );
}

const useTile = makeStyles((c) => ({
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, padding: 10, borderRadius: density.radius.card, borderWidth: 1 },
  text: { flex: 1, minWidth: 0 },
  tileStacked: { flexDirection: 'column', justifyContent: 'center', gap: 4, minHeight: 64, paddingVertical: 8 },
  title: { fontFamily: fonts.bold, fontSize: 14.5, color: c.text },
  caption: { fontFamily: fonts.regular, fontSize: 11.5, color: c.textMuted, marginTop: 1 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: onFill },
  pressed: { transform: [{ scale: 0.97 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, padding: 10, borderRadius: density.radius.card, borderWidth: 1 },
  smallBtn: { minHeight: 32, paddingHorizontal: 12, borderRadius: density.radius.button, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  smallBtnText: { fontFamily: fonts.bold, fontSize: 13 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 6, paddingHorizontal: 12, borderRadius: density.radius.card, borderWidth: 1, backgroundColor: c.well, borderColor: c.stroke },
  stripValue: { fontFamily: fonts.display, fontSize: 22 },
  stripLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  stripDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4, backgroundColor: c.stroke },
  stripNote: { fontFamily: fonts.regular, fontSize: 12, color: c.text },
  group: { borderRadius: density.radius.card, borderWidth: 1, overflow: 'hidden', backgroundColor: c.glassTop, borderColor: c.stroke },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 10 },
  navDivider: { height: 1, marginLeft: 54, backgroundColor: c.stroke },
}), { compact: false });

type TileProps = {
  icon: IconName;
  tone?: ChipTone;
  title: string;
  caption?: string;
  onPress: () => void;
  /** A count or status at the right, e.g. "3" or "1 LIVE". */
  badge?: ReactNode;
  /** Icon above the title, for three tiles across. */
  stacked?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** One tap action. Place two side by side in a `TileRow`. */
export function ActionTile({ icon, tone = 'primary', title, caption, onPress, badge, stacked, accessibilityLabel, style }: TileProps) {
  const st = useTile();
  const { colors, gradients, isDark } = useTheme();
  const { fg } = chipColors(colors, gradients, isDark, tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        st.tile,
        stacked && st.tileStacked,
        { backgroundColor: alpha(fg, 0.12), borderColor: alpha(fg, pressed ? 0.8 : 0.55) },
        pressed && st.pressed,
        style,
      ]}
    >
      <SolidTile icon={icon} tone={tone} />
      <View style={stacked ? undefined : st.text}>
        <Text style={[st.title, stacked && { textAlign: 'center', fontSize: 13 }]} numberOfLines={stacked ? 2 : 1}>
          {title}
        </Text>
        {caption && !stacked ? (
          <Text style={st.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {badge}
    </Pressable>
  );
}

/** Two tiles side by side, 8pt apart. */
export function TileRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap: density.gap }, style]}>{children}</View>;
}

/** A small count at the right of a tile or row. */
export function CountBadge({ children, tone = 'accent' }: { children: ReactNode; tone?: ChipTone }) {
  const st = useTile();
  const { colors } = useTheme();
  return (
    <View style={[st.badge, { backgroundColor: solidFill(colors, tone) }]}>
      <Text style={st.badgeText}>{children}</Text>
    </View>
  );
}

type ActionRowProps = {
  icon: IconName;
  tone?: ChipTone;
  title: string;
  caption?: string;
  actionLabel: string;
  actionIcon?: IconName;
  onAction: () => void;
  accessibilityLabel?: string;
};

/** A full-width tile with a small button at the right (Share profile and Copy). */
export function ActionRow({ icon, tone = 'primary', title, caption, actionLabel, actionIcon, onAction, accessibilityLabel }: ActionRowProps) {
  const st = useTile();
  const { colors, gradients, isDark } = useTheme();
  const { fg } = chipColors(colors, gradients, isDark, tone);
  return (
    <View style={[st.row, { backgroundColor: alpha(fg, 0.12), borderColor: alpha(fg, 0.55) }]}>
      <SolidTile icon={icon} tone={tone} />
      <View style={st.text}>
        <Text style={st.title} numberOfLines={1}>
          {title}
        </Text>
        {caption ? (
          <Text style={st.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onAction}
        hitSlop={hitSlopFor(60, 32)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? actionLabel}
        style={({ pressed }) => [st.smallBtn, { backgroundColor: solidFill(colors, tone), borderColor: alpha(onFill, 0.35) }, pressed && st.pressed]}
      >
        {actionIcon ? <Ionicons name={actionIcon} size={14} color={onFill} /> : null}
        <Text style={[st.smallBtnText, { color: onFill }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

/** A slim, flat strip for a number and its note. Not tappable: no coloured border, chevron or shadow. */
export function StatStrip({ value, label, note, noteDot, accessibilityLabel }: { value: string | number; label: string; note?: string; noteDot?: boolean; accessibilityLabel?: string }) {
  const st = useTile();
  const { colors } = useTheme();
  return (
    <View style={st.strip} accessible accessibilityLabel={accessibilityLabel ?? `${value} ${label}${note ? `, ${note}` : ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
        <Text style={[st.stripValue, { color: colors.text }]}>{value}</Text>
        <Text style={st.stripLabel}>{label}</Text>
      </View>
      {note ? <View style={st.stripDivider} /> : null}
      {note ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          {noteDot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} /> : null}
          <Text style={st.stripNote} numberOfLines={1}>
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** One grouped glass list: rows separated by dividers. */
export function NavGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const st = useTile();
  const rows = (Array.isArray(children) ? children : [children]).flat().filter(Boolean) as ReactNode[];
  return (
    <View style={[st.group, style]}>
      {rows.map((row, i) => (
        <View key={i}>
          {i > 0 ? <View style={st.navDivider} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

/** A navigation row: coloured icon tile, title and caption, optional badge, and the chevron. */
export function NavRow({ icon, tone = 'primary', title, caption, onPress, badge, accessibilityLabel }: TileProps) {
  const st = useTile();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [st.navRow, pressed && { backgroundColor: alpha(colors.primary, 0.12) }]}
    >
      <SolidTile icon={icon} tone={tone} size={32} />
      <View style={st.text}>
        <Text style={st.title} numberOfLines={1}>
          {title}
        </Text>
        {caption ? (
          <Text style={st.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {badge}
      <Ionicons name="chevron-forward" size={16} color={colors.link} />
    </Pressable>
  );
}

const useGrid = makeStyles(
  (c) => ({
    grid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: density.radius.card, borderWidth: 1, backgroundColor: c.well, borderColor: c.stroke, overflow: 'hidden' },
    cell: { width: '50%', minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center', flexDirection: 'column-reverse' },
    value: { fontFamily: fonts.display, fontSize: 22, color: c.text },
    label: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  }),
  { compact: false },
);

/** Several single numbers as one flat, non-tappable panel (replaces a grid of one-number cards). */
export function StatGrid({ items }: { items: { key: string; label: string; value: string | number }[] }) {
  const st = useGrid();
  return (
    <View style={st.grid}>
      {items.map((it) => (
        <View key={it.key} style={st.cell} accessible accessibilityLabel={`${it.label}: ${it.value}`}>
          <Text style={st.label} numberOfLines={1}>
            {it.label}
          </Text>
          <Text style={st.value}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}
