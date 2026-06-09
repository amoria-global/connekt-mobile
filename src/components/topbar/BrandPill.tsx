import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

/**
 * Center slot: a rounded pill. Defaults to the Connekyt brand (logo + wordmark),
 * but accepts `children` so the same pill can show location/context later
 * without changing the top-bar layout.
 */
export function BrandPill({ onPress, children }: { onPress?: () => void; children?: ReactNode }) {
  const content = children ?? (
    <>
      <Image
        source={require('../../../assets/images/logo.png')}
        style={styles.mark}
        contentFit="contain"
      />
      <Text style={styles.text}>Connekyt</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.pill}>{content}</View>;
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { opacity: 0.9 },
  mark: { width: 22, height: 22 },
  text: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: 0.2,
  },
});
