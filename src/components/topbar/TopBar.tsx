import { useCallback } from 'react';
import { BlurView } from 'expo-blur';
import { useRouter, type Href } from 'expo-router';
import { HELP_HREF } from '@/components/help/GlobalHelpButton';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRole } from '@/features/auth/role';
import { listNotifications } from '@/features/notifications/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { fonts, spacing, radii, makeStyles, useTheme } from '@/theme';
import { GLASS_BAR } from '@/components/ui/GlassCard';
import { BrandPill } from './BrandPill';
import { CurrencyButton } from './CurrencyButton';
import { LanguageButton } from './LanguageButton';
import { NotificationButton, TopBarIconButton } from './NotificationButton';
import { ProfileButton } from './ProfileButton';
import { selectIsShared, useWorkspace } from '@/store/workspace';

const BAR_HEIGHT = 60;

/** Total height the bar occupies (safe-area top + bar row). Screens pad their content by this so it scrolls under the translucent bar. */
export function useTopBarHeight() {
  const insets = useSafeAreaInsets();
  return insets.top + BAR_HEIGHT;
}

export type TopBarProps = {
  /** If true, renders a back chevron button on the left slot instead of ProfileButton */
  back?: boolean;
  /** Optional custom back action. Defaults to router.back() */
  onBack?: () => void;
};

/**
 * Shared glass top bar for all roles (design/home.png):
 * avatar in its ring (or back) · wordmark · "RWF · EN" glass pill · Help · notifications.
 * Renders as an absolute overlay so content scrolls under it. Place it as the last child of a
 * screen and pad the scroll content by useTopBarHeight().
 *
 * Help lives here on the tab screens rather than floating at the bottom right, where it sat over
 * whatever scrolled beneath it (the View shoot button on Home). See helpButtonLayout.
 */
export function TopBar({ back, onBack }: TopBarProps = {}) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const { role } = useRole();
  const isShared = useWorkspace(selectIsShared);

  const { data } = useAsync(useCallback(() => listNotifications(role), [role]));
  const hasUnread = !!data?.some((n) => !n.read);

  return (
    <View style={[styles.wrap, { height: insets.top + BAR_HEIGHT }]} pointerEvents="box-none">
      {Platform.OS === 'ios' ? (
        <BlurView intensity={GLASS_BAR.intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      <View
        // Android has no real blur here, and any translucency lets scrolled text ghost through the bar, so it
        // is the page colour there; iOS lays the glass over its blur.
        style={[styles.tint, { backgroundColor: Platform.OS === 'ios' ? colors.glassBottom : colors.background }]}
        pointerEvents="none"
      />
      <View style={[styles.row, { top: insets.top }]}>
        {back ? (
          <Pressable
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={2}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <ProfileButton user={user} onPress={() => router.push(isShared ? '/more' : '/profile')} />
        )}
        <BrandPill style={styles.brand} flat />
        <View style={styles.pill}>
          <CurrencyButton inPill />
          <Text style={styles.sep} aria-hidden>
            ·
          </Text>
          <LanguageButton inPill />
        </View>
        <TopBarIconButton icon="help-circle-outline" label="Help" onPress={() => router.push(HELP_HREF as Href)} />
        <NotificationButton hasUnread={hasUnread} onPress={() => router.push('/notifications')} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.stroke,
  },
  tint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  brand: { paddingHorizontal: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
    paddingHorizontal: 2,
  },
  sep: { color: c.textMuted, fontFamily: fonts.semibold, fontSize: 13 },
}));
