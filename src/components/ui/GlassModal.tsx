/**
 * The glass modal kit: one look for every sheet and dialog in the app, taken from the sign-in sheet.
 *
 * A modal is three layers, in this order:
 *   1. GlassScrim      the dim behind it, with the screen underneath frosted (iOS blur, a dim on Android below 12)
 *   2. GlassSheetHost  the panel itself: a detached "thick" GlassSurface, a lit rim, transparent otherwise
 *   3. content         rows and fields on the glass use `glassTile(c)` / `glassField(c)`, never a solid card colour,
 *                      so the frost carries through instead of reading as a sticker
 *
 * Use them inside any `<Modal transparent>`:
 *
 *   <GlassScrim onPress={close} style={styles.root}>          // styles.root: flex 1, justifyContent 'flex-end'
 *     <GlassSheetHost style={styles.sheet}>...</GlassSheetHost> // styles.sheet: padding, maxHeight only
 *   </GlassScrim>
 *
 * Keep colour, border and radius out of the host's style; the host owns them. A centred dialog passes
 * `variant="dialog"` for rounded corners all round.
 */
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassSurface, glassScrim, useGlassEdge } from '@/components/ui/GlassCard';
import { darkPalette, makeStyles, useTheme, type Palette } from '@/theme';

/** The dim behind a glass modal, with the screen below it frosted. Closes the modal when pressed outside the panel. */
export function GlassScrim({
  onPress,
  style,
  children,
  accessibilityLabel = 'Close',
  ...rest
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
} & Omit<PressableProps, 'style' | 'onPress' | 'children'>) {
  const styles = useStyles();
  const { isDark } = useTheme();
  return (
    <View style={[styles.fill, style]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 30 : 50}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Pressable
        style={[StyleSheet.absoluteFill, styles.dim]}
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? accessibilityLabel : undefined}
        {...rest}
      />
      {children}
    </View>
  );
}

/**
 * The glass panel. It claims touches that land on it, so a tap on the panel never reaches the scrim behind it.
 * `variant="sheet"` rounds the top corners (a bottom sheet); `"dialog"` rounds all four.
 */
export function GlassSheetHost({
  variant = 'sheet',
  radius = 28,
  style,
  children,
  ...rest
}: {
  variant?: 'sheet' | 'dialog';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
} & Omit<ViewProps, 'style' | 'children'>) {
  const styles = useStyles();
  const edge = useGlassEdge();
  const sheet = variant === 'sheet';
  return (
    <View
      // Claims touches that land on the panel, so they never reach the scrim's press-to-close behind it.
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
      {...rest}
      style={[
        styles.host,
        edge,
        sheet
          ? { borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomWidth: 0 }
          : { borderRadius: radius },
        style,
      ]}
    >
      <GlassSurface
        detached
        strength="thick"
        style={sheet ? { borderTopLeftRadius: radius, borderTopRightRadius: radius } : { borderRadius: radius }}
      />
      {children}
    </View>
  );
}

/** A text field on glass: a faint frosted fill and a hairline, like the sign-in fields. */
export function glassField(c: Palette): { backgroundColor: string; borderColor: string; borderWidth: number } {
  return c === darkPalette
    ? { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1 }
    : { backgroundColor: 'rgba(255,255,255,0.62)', borderColor: 'rgba(15,18,23,0.12)', borderWidth: 1 };
}

const useStyles = makeStyles((c, e) => ({
  fill: { flex: 1 },
  dim: { backgroundColor: glassScrim(c) },
  host: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    ...e(4),
  },
}));
