/**
 * A round avatar with the web's verified seal.
 *
 * Mirrors `.ph-avatar` / `.ph-avatar-verif` on the landing's photographers
 * page, so a photographer looks the same on the web and in the app: a white
 * ring with a soft drop shadow, and a blue patch-check seal on a white disc at
 * the bottom-right, shadowed so it reads as a separate chip over the ring.
 *
 * The ring and the disc are white in both themes on purpose. They used to
 * take the theme surface, which in dark mode is near black, so the ring and
 * the badge melted into the dark card and the tick looked misplaced.
 */
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, onFill } from '@/theme';

/** The web's seal colour (`.ph-avatar-verif i { color: #3b82f6 }`). */
export const VERIFIED_BLUE = '#3B82F6';
const RING = onFill;
/** The web's empty-avatar grey, with slate text that clears WCAG AA on it. */
const EMPTY_BG = '#CBD5E1';
const EMPTY_TEXT = '#334155';

/** Ring width: 3px at the web's 56px avatar, 2px at its 40px mobile one. */
export function ringWidthFor(size: number) {
  return Math.min(4, Math.max(2, Math.round(size / 20)));
}

/** Seal disc: 22px at 56 and 14px at 40 on the web, capped for large headers. */
export function badgeSizeFor(size: number) {
  return Math.min(28, Math.max(14, Math.round(14 + (size - 40) / 2)));
}

export function VerifiedAvatar({
  uri,
  name,
  size,
  verified = true,
  style,
}: {
  uri?: string | null;
  name?: string | null;
  size: number;
  verified?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = ringWidthFor(size);
  const badge = badgeSizeFor(size);
  const initials = (name?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, borderWidth: ring },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.fill}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.fill, styles.empty]}>
            <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initials}</Text>
          </View>
        )}
      </View>

      {verified && (
        <View
          testID="verified-badge"
          accessibilityLabel="Verified photographer"
          style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}
        >
          <MaterialCommunityIcons
            name="check-decagram"
            size={Math.round(badge * 0.72)}
            color={VERIFIED_BLUE}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderColor: RING,
    backgroundColor: RING,
    overflow: 'hidden',
    // box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fill: { width: '100%', height: '100%' },
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: EMPTY_BG },
  initials: { color: EMPTY_TEXT, fontFamily: fonts.bold },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: RING,
    alignItems: 'center',
    justifyContent: 'center',
    // box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18); above the ring's elevation
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
