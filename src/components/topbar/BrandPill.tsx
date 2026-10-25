import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, spacing, radii, makeStyles, tracking } from '@/theme';

/**
 * Center slot: a rounded pill. Defaults to the Connekyt brand (logo + wordmark),
 * but accepts `children` so the same pill can show location/context later
 * without changing the top-bar layout.
 */
export function BrandPill({
  onPress,
  children,
  style,
  flat,
}: {
  onPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Wordmark without the raised pill, left aligned (the photographer chrome, as in the prototype). */
  flat?: boolean;
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
      <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, flat && styles.flat, style, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.pill, flat && styles.flat, style]}>{content}</View>;
}

const useStyles = makeStyles((c, e) => ({
  pill: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    ...e(2),
  },
  flat: { height: 40, backgroundColor: 'transparent', justifyContent: 'flex-start', paddingHorizontal: 0, shadowOpacity: 0, elevation: 0 },
  pressed: { opacity: 0.9 },
  mark: { width: 22, height: 22 },
  // The wordmark in the display face, as design/home.png sets it.
  text: {
    fontSize: 19,
    fontFamily: fonts.display,
    color: c.text,
    letterSpacing: tracking(19, -0.02),
    flexShrink: 1,
  },
}));
