import { useCallback } from 'react';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRole } from '@/features/auth/role';
import { listNotifications } from '@/features/notifications/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { spacing, makeStyles } from '@/theme';
import { BrandPill } from './BrandPill';
import { NotificationButton } from './NotificationButton';
import { ProfileButton } from './ProfileButton';

const BAR_HEIGHT = 60;

/** Total height the bar occupies (safe-area top + bar row). Screens pad their content by this so it scrolls under the translucent bar. */
export function useTopBarHeight() {
  const insets = useSafeAreaInsets();
  return insets.top + BAR_HEIGHT;
}

/**
 * Shared, translucent (frosted-glass) top bar for all roles:
 * profile (left) · brand pill (center) · notifications (right).
 * Renders as an absolute overlay so content scrolls under the blur.
 * Place it as the last child of a screen and pad the scroll content by
 * useTopBarHeight().
 */
export function TopBar() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const { role } = useRole();

  const { data } = useAsync(useCallback(() => listNotifications(role), [role]));
  const hasUnread = !!data?.some((n) => !n.read);

  return (
    <View style={[styles.wrap, { height: insets.top + BAR_HEIGHT }]} pointerEvents="box-none">
      <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.tint} pointerEvents="none" />
      <View style={[styles.row, { top: insets.top }]}>
        <ProfileButton user={user} onPress={() => router.push('/profile')} />
        <BrandPill />
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
    borderBottomColor: 'rgba(8,58,133,0.12)',
  },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,58,133,0.5)' },
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
}));
