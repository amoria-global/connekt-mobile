/**
 * Buttons in the Midnight Glass kit (design/brief.png).
 *
 *   PrimaryButton   raised blue: gradient fill, top highlight, coloured glow. ONE per screen.
 *   AccentButton    raised magenta, for the one action that needs attention (Save changes).
 *   GhostButton     glass with a stroke, for every secondary action.
 *   Button          the flat variants, for the other actions on a screen that already has its raised one.
 *
 * The raised magenta is darker in the middle than `accent`: white on #EE0E8F is 4.1:1, under AA.
 */
import { ActivityIndicator, Pressable, Text, View, type PressableProps, type StyleProp, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRole } from '@/features/auth/role';
import {
  alpha,
  density,
  fontSize,
  fonts,
  glowRgb,
  makeStyles,
  radii,
  raisedStops,
  shadows,
  spacing,
  useTheme,
} from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

type Variant = 'primary' | 'accent' | 'ghost' | 'outline' | 'danger';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  /** Gradient fill and glow. Reserve for the screen's one main action. */
  raised?: boolean;
  loading?: boolean;
  textStyle?: StyleProp<TextStyle>;
  /** Optional leading icon, drawn in the label colour by the caller. */
  icon?: React.ReactNode;
};

export function Button({ title, variant = 'primary', raised = false, loading, disabled, style, textStyle, icon, ...rest }: Props) {
  const variantStyles = useVariantStyles();
  const styles = useStyles();
  const { colors, gradients, isDark } = useTheme();
  const { tr } = useSharedT();
  // Photographer screens use the prototype's squarer 48dp buttons; other roles keep the pill.
  const flat = useRole().isPhotographer;
  const isDisabled = disabled || loading;
  const isOutlined = variant === 'ghost' || variant === 'outline';
  const fill = raised && !isDisabled ? (variant === 'accent' ? gradients.raisedAccent : variant === 'primary' ? gradients.raisedPrimary : null) : null;
  const radius = flat ? density.radius.button : radii.full;
  const labelColor = variant === 'ghost' ? colors.link : isOutlined ? colors.link : colors.textOnPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      // Named by its label unless the caller says otherwise (spread after, so `rest` still wins).
      accessibilityLabel={tr(title)}
      disabled={isDisabled}
      hitSlop={isOutlined ? { top: 4, bottom: 4 } : undefined}
      style={(state) => [
        styles.base,
        flat && styles.baseFlat,
        { borderRadius: radius },
        variantStyles[variant],
        // The flat magenta takes the raised fill's middle stop, the AA-safe one.
        variant === 'accent' && { backgroundColor: gradients.raisedAccent[1] },
        variant === 'ghost' && styles.secondary,
        variant === 'outline' && styles.tertiary,
        fill && { boxShadow: shadows.raised(variant === 'accent' ? glowRgb.accent : glowRgb.primary) },
        isDisabled && styles.disabled,
        state.pressed && !isDisabled && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {fill ? (
        <LinearGradient
          colors={fill as unknown as [string, string, ...string[]]}
          locations={raisedStops as unknown as [number, number, ...number[]]}
          style={[styles.fill, { borderRadius: radius }]}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: labelColor }, textStyle]}>{tr(title)}</Text>
        </View>
      )}
    </Pressable>
  );
}

type KitProps = Omit<Props, 'variant' | 'raised'>;

/** The screen's one raised blue action. */
export function PrimaryButton(props: KitProps) {
  return <Button {...props} variant="primary" raised />;
}

/** The screen's one raised magenta action, for something that needs attention. */
export function AccentButton(props: KitProps) {
  return <Button {...props} variant="accent" raised />;
}

/** Glass with a stroke: every secondary action. */
export function GhostButton(props: KitProps) {
  return <Button {...props} variant="ghost" />;
}

const useStyles = makeStyles(() => ({
  // minHeight, not height: at large text sizes a long label must grow the button, never be cut off.
  base: {
    minHeight: density.button.primary,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Photographer screens: the prototype's 48dp, still over the 44pt minimum.
  baseFlat: { minHeight: density.button.primary },
  // Secondary 40: tinted fill and a coloured border. Tertiary 36: outline and coloured text. Hit area stays 44 via hitSlop.
  secondary: { minHeight: density.button.secondary },
  tertiary: { minHeight: density.button.tertiary },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
}));

const useVariantStyles = makeStyles((c) => ({
  // Flat fills keep a 1px top highlight so they read as the same family as the raised ones.
  primary: { backgroundColor: c.primary, boxShadow: shadows.highlight },
  accent: { boxShadow: shadows.highlight },
  ghost: { backgroundColor: alpha(c.primary, 0.16), borderWidth: 1, borderColor: alpha(c.primaryLight, 0.6) },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: alpha(c.primaryLight, 0.5) },
  danger: { backgroundColor: c.error },
}));
