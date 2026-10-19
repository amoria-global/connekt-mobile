import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useRole } from '@/features/auth/role';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

type Variant = 'primary' | 'accent' | 'ghost' | 'outline' | 'danger';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({ title, variant = 'primary', loading, disabled, style, textStyle, ...rest }: Props) {
  const variantStyles = useVariantStyles();
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  // Photographer screens use the prototype's squarer 48dp buttons; other roles keep the pill.
  const flat = useRole().isPhotographer;
  const isDisabled = disabled || loading;
  const isOutlined = variant === 'ghost' || variant === 'outline';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        flat && styles.baseFlat,
        variantStyles[variant],
        isDisabled && styles.disabled,
        state.pressed && !isDisabled && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isOutlined ? colors.primary : colors.textOnPrimary} />
      ) : (
        <Text style={[styles.label, isOutlined && styles.labelGhost, textStyle]}>{tr(title)}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  // minHeight, not height: at large text sizes a long label must grow the button, never be cut off.
  base: {
    minHeight: 52,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  baseFlat: { minHeight: 48, borderRadius: radii.md },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  label: {
    color: c.textOnPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  labelGhost: { color: c.primary },
}));

const useVariantStyles = makeStyles((c) => ({
  primary: { backgroundColor: c.primary },
  accent: { backgroundColor: c.accent },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary },
  danger: { backgroundColor: c.error },
}));
