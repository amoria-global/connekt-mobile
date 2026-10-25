import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts, onFill } from '@/theme';
import { S, TOUCH } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  icon: IconName;
  /** Accessible label, always required. */
  label: string;
  onPress: () => void;
  /** Short caption under the button (rail style). */
  caption?: string;
  /** Highlighted / "on" state (white fill). */
  active?: boolean;
  /** Off / muted state, red tint + slashed icon supplied by caller. */
  off?: boolean;
  badge?: number;
  size?: number;
  disabled?: boolean;
  selected?: boolean;
};

/**
 * Circular glass touch target. State is conveyed by fill + icon + caption,
 * never by colour alone.
 */
function RoundButtonBase({
  icon,
  label,
  onPress,
  caption,
  active,
  off,
  badge,
  size = TOUCH,
  disabled,
  selected,
}: Props) {
  const { tr } = useSharedT();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: selected ?? active }}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          active && styles.circleActive,
          off && styles.circleOff,
        ]}
      >
        <Ionicons
          name={icon}
          size={Math.round(size * 0.46)}
          color={active ? '#111' : off ? '#FCA5A5' : S.text}
        />
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {tr(caption)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const RoundButton = memo(RoundButtonBase);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 3 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  disabled: { opacity: 0.4 },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: S.line,
  },
  circleActive: { backgroundColor: S.glassActive },
  circleOff: { backgroundColor: 'rgba(127,29,29,0.72)', borderColor: 'rgba(252,165,165,0.5)' },
  caption: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: S.text,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    maxWidth: 64,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: S.go,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: onFill },
});
