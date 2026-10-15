import { useCallback } from 'react';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRole } from '@/features/auth/role';
import { listNotifications } from '@/features/notifications/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { spacing, radii, makeStyles, useTheme } from '@/theme';
import { BrandPill } from './BrandPill';
import { CurrencyButton } from './CurrencyButton';
import { NotificationButton } from './NotificationButton';
import { ProfileButton } from './ProfileButton';

const BAR_HEIGHT = 60;
/** The photographer chrome is a tighter bar (the prototype's header is a single quiet row). */
const COMPACT_BAR_HEIGHT = 52;

/** Total height the bar occupies (safe-area top + bar row). Screens pad their content by this so it scrolls under the translucent bar. */
export function useTopBarHeight() {
  const insets = useSafeAreaInsets();
  const { isPhotographer } = useRole();
  return insets.top + (isPhotographer ? COMPACT_BAR_HEIGHT : BAR_HEIGHT);
}

export type TopBarProps = {
  /** If true, renders a back chevron button on the left slot instead of ProfileButton */
  back?: boolean;
  /** Optional custom back action. Defaults to router.back() */
  onBack?: () => void;
};

/**
 * Shared, translucent (frosted-glass) top bar for all roles:
 * profile/back (left) · brand pill (center) · notifications (right).
 * Renders as an absolute overlay so content scrolls under the blur.
 * Place it as the last child of a screen and pad the scroll content by
 * useTopBarHeight().
 *
 * Colours follow the active palette (elevated surface + hairline), matching
 * PersistentBottomBar so light and dark both keep the same chrome combo.
 */
export function TopBar({ back, onBack }: TopBarProps = {}) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const { role, isPhotographer } = useRole();
  const compact = isPhotographer;
  const barHeight = compact ? COMPACT_BAR_HEIGHT : BAR_HEIGHT;

  const { data } = useAsync(useCallback(() => listNotifications(role), [role]));
  const hasUnread = !!data?.some((n) => !n.read);

  return (
    <View style={[styles.wrap, { height: insets.top + barHeight }]} pointerEvents="box-none">
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={48}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View
        // Android has no real blur, and any translucency there just lets scrolled text ghost through the bar (seen in
        // dark mode as "Booking earnings $95.50" behind the status bar), so the bar is fully opaque on Android. In
        // dark it uses the card step so the round buttons (surface) stay a visible step darker than the bar.
        style={[styles.tint, { backgroundColor: isDark ? colors.card : colors.elevated, opacity: Platform.OS === 'android' ? 1 : 0.88 }]}
        pointerEvents="none"
      />
      <View style={[styles.row, { top: insets.top, height: barHeight }, compact && styles.rowCompact]}>
        {back ? (
          <Pressable
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.btn, compact && styles.btnCompact, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <ProfileButton user={user} compact={compact} onPress={() => router.push('/profile')} />
        )}
        <BrandPill style={styles.brand} flat={compact} />
        <CurrencyButton bar={compact} />
        <NotificationButton compact={compact} hasUnread={hasUnread} onPress={() => router.push('/notifications')} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  tint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  btn: {
    width: 46,
    height: 46,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(2),
  },
  rowCompact: { gap: spacing.sm },
  btnCompact: { width: 40, height: 40, shadowOpacity: 0, elevation: 0, borderWidth: 1.5, borderColor: c.border },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  // Tighter padding so the pill still fits beside the currency chip on narrow phones.
  brand: { paddingHorizontal: spacing.md },
}));
