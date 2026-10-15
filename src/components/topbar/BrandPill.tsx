import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';

/**
 * Center slot: a rounded pill. Defaults to the Connekyt brand (logo + wordmark),
 * but accepts `children` so the same pill can show location/context later
 * without changing the top-bar layout.
 */
export function BrandPill({
  onPress,
  children,
  style,
}: {
  onPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const content = children ?? (
    <>
      <Image
        source={require('../../../assets/images/logo.png')}
        style={styles.mark}
        contentFit="contain"
      />
      {/* The pill sits in a fixed-height bar: at 1.6x text on a 360dp phone the wordmark wrapped to "Connek / yt". */}
      <Text style={styles.text} numberOfLines={1} maxFontSizeMultiplier={1.1}>
        Connekyt
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, style, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.pill, style]}>{content}</View>;
}

const useStyles = makeStyles((c, e) => ({
  pill: {
    flex: 1,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...e(2),
  },
  pressed: { opacity: 0.9 },
  mark: { width: 22, height: 22 },
  text: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: 0.2,
  },
}));
