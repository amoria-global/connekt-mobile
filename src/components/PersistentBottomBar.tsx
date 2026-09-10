/**
 * Always-visible bottom bar for every authenticated (app) route.
 *
 * Before this component, the bottom bar only existed inside
 * `(app)/(tabs)/_layout.tsx`. Any screen pushed onto the parent Stack
 * (event/[id], gallery, transactions, photographer/[id], etc.) covered
 * the bar — the "ribbon menu is not on all pages" report. The fix is
 * to render this widget at the (app) layout level *below* the Stack so
 * it persists across every screen, and to hide the old in-tabs bar so
 * we don't have two overlapping bars on the Home/Events/Wallet/Inbox
 * routes.
 *
 * The navigation contract is identical to the old in-tabs bar:
 *   • Five entries — Home · Events · Wallet · Inbox · More
 *   • "More" opens a bottom-sheet listing every menu item not on the
 *     visible bar, role-aware (Coordinator sees Team, Photographer
 *     sees Packages/Clients, etc.)
 *   • Active state derived from `useSegments`: the deepest tab segment
 *     becomes the highlighted one.
 *   • iOS uses a BlurView + branded overlay; Android uses a solid
 *     branded fill (Android BlurView is laggy on mid-range devices).
 */
import { useMemo, useState } from 'react';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments, type Href } from 'expo-router';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRole } from '@/features/auth/role';
import { isApiError, useAuth } from '@/store/auth';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const BAR_CONTENT_HEIGHT = 60;

type Tab = {
  key: string;
  label: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  isMore?: boolean;
  /** Route sub-segments that light this tab as active. */
  match: string[];
};

// Owner/creator roles (Client, Coordinator, Photographer) run a business:
// Events they own, a Wallet with earnings, an Inbox.
const OWNER_TABS: Tab[] = [
  { key: 'home', label: 'Home', href: '/(tabs)' as Href, icon: 'home-outline', iconFocused: 'home', match: ['index', '(tabs)'] },
  { key: 'events', label: 'Events', href: '/(tabs)/events' as Href, icon: 'calendar-outline', iconFocused: 'calendar', match: ['events', 'event', 'bookings'] },
  { key: 'wallet', label: 'Wallet', href: '/(tabs)/wallet' as Href, icon: 'wallet-outline', iconFocused: 'wallet', match: ['wallet', 'transactions', 'withdraw', 'payroll'] },
  { key: 'inbox', label: 'Inbox', href: '/(tabs)/inbox' as Href, icon: 'chatbubbles-outline', iconFocused: 'chatbubbles', match: ['inbox', 'conversation', 'notifications'] },
  { key: 'more', label: 'More', href: '/(tabs)' as Href, icon: 'ellipsis-horizontal', iconFocused: 'ellipsis-horizontal', isMore: true, match: [] },
];

// The consumer `User` role only consumes — it never creates events, has no
// wallet (no earnings) and no inbox. Its bar is buy/watch/pay focused; the
// rest (bookings, notifications, donations, etc.) lives in the More sheet.
const USER_TABS: Tab[] = [
  { key: 'home', label: 'Home', href: '/(tabs)' as Href, icon: 'home-outline', iconFocused: 'home', match: ['index', '(tabs)'] },
  { key: 'streams', label: 'Streams', href: '/streams' as Href, icon: 'videocam-outline', iconFocused: 'videocam', match: ['streams', 'stream', 'event', 'events'] },
  { key: 'photos', label: 'Photos', href: '/gallery' as Href, icon: 'images-outline', iconFocused: 'images', match: ['gallery', 'album', 'photobooks', 'find-my-photos'] },
  { key: 'payments', label: 'Payments', href: '/payments' as Href, icon: 'card-outline', iconFocused: 'card', match: ['payments', 'payment', 'transactions'] },
  { key: 'more', label: 'More', href: '/(tabs)' as Href, icon: 'ellipsis-horizontal', iconFocused: 'ellipsis-horizontal', isMore: true, match: [] },
];

type MoreItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: Href;
  onPress?: () => void;
  destructive?: boolean;
};

export function PersistentBottomBar() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as string[];
  const [moreOpen, setMoreOpen] = useState(false);
  const { isCoordinator, isPhotographer, isClient, isUser } = useRole();
  const logout = useAuth((s) => s.logout);

  const tabs = isUser ? USER_TABS : OWNER_TABS;

  /**
   * Resolve which tab should glow as "active". The (tabs) folder maps
   * to `index`/`events`/`wallet`/`inbox`/`profile`; everything else
   * (event/[id], gallery, etc.) is sitting on a Stack screen and has
   * NO tab focus — we keep the last-known focus from the segment
   * stack when we're on a detail screen so the user sees a hint of
   * "you came from Events" while drilled in.
   */
  const activeKey = useMemo<string>(() => {
    // Resolve the current route's leading sub-segment: the (tabs) inner
    // route when on a tab, else the first segment after (app) for a
    // pushed detail screen (event/[id], gallery, payments, …).
    const tabsIdx = segments.indexOf('(tabs)');
    let sub: string | undefined;
    if (tabsIdx !== -1 && tabsIdx + 1 < segments.length) {
      sub = segments[tabsIdx + 1];
      if (sub === 'profile') return 'more';
    } else {
      const appIdx = segments.indexOf('(app)');
      sub = appIdx !== -1 ? segments[appIdx + 1] : segments[0];
    }
    if (sub) {
      const hit = tabs.find((t) => !t.isMore && t.match.includes(sub as string));
      if (hit) return hit.key;
    }
    return 'home';
  }, [segments, tabs]);

  const moreItems: MoreItem[] = [
    { label: 'Profile', icon: 'person-outline', href: '/profile' as Href },
    { label: 'Notifications', icon: 'notifications-outline', href: '/notifications' as Href },
    ...(isCoordinator || isClient || isUser
      ? [
          { label: 'Find photographers', icon: 'camera-outline' as const, href: '/photographers' as Href },
          { label: 'Find my photos', icon: 'scan-outline' as const, href: '/find-my-photos' as Href },
        ]
      : []),
    // A User's bookings + live streams live in More (off the main bar).
    ...(isUser
      ? [
          { label: 'My bookings', icon: 'briefcase-outline' as const, href: '/bookings' as Href },
          { label: 'Live streams', icon: 'videocam-outline' as const, href: '/streams' as Href },
        ]
      : []),
    ...(isCoordinator
      ? [{ label: 'Team', icon: 'people-circle-outline' as const, href: '/team' as Href }]
      : []),
    ...(isPhotographer
      ? [
          { label: 'Bookings', icon: 'briefcase-outline' as const, href: '/bookings' as Href },
          { label: 'My packages', icon: 'pricetags-outline' as const, href: '/packages' as Href },
          { label: 'Clients', icon: 'people-outline' as const, href: '/clients' as Href },
        ]
      : []),
    ...(isClient || isCoordinator
      ? [{ label: 'My bookings', icon: 'briefcase-outline' as const, href: '/bookings' as Href }]
      : []),
    { label: 'Gallery', icon: 'images-outline', href: '/gallery' as Href },
    { label: 'Donations', icon: 'heart-outline', href: '/donations' as Href },
    { label: 'Transactions', icon: 'list-outline', href: '/transactions' as Href },
    { label: 'Preferences', icon: 'settings-outline', href: '/preferences' as Href },
    { label: 'Verification', icon: 'shield-checkmark-outline', href: '/kyc' as Href },
    { label: 'Help center', icon: 'help-circle-outline', href: '/help-center' as Href },
    { label: 'Contact us', icon: 'mail-outline', href: '/contact_us' as Href },
    { label: 'Send feedback', icon: 'chatbox-ellipses-outline', href: '/feedback' as Href },
    { label: 'Privacy policy', icon: 'lock-closed-outline', href: '/privacy-policy' as Href },
    { label: 'Terms & conditions', icon: 'document-text-outline', href: '/terms-of-service' as Href },
    {
      label: 'Sign out',
      icon: 'log-out-outline',
      destructive: true,
      onPress: async () => {
        try {
          await logout();
          router.replace('/login' as Href);
        } catch (e) {
          if (isApiError(e)) {
            /* auth store cleared local state */
          }
        }
      },
    },
  ];

  return (
    <>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {Platform.OS === 'ios' ? (
          <>
            <BlurView tint="light" intensity={28} style={StyleSheet.absoluteFill} />
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: 0.92 }]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />
        )}

        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const isFocused = tab.key === activeKey;
            const onPress = () => {
              if (tab.isMore) {
                setMoreOpen(true);
                return;
              }
              router.push(tab.href);
            };
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.tab}
              >
                <View style={[styles.iconChip, isFocused && styles.iconChipFocused]}>
                  <Ionicons
                    name={isFocused ? tab.iconFocused : tab.icon}
                    size={20}
                    color={isFocused ? '#fff' : 'rgba(255,255,255,0.78)'}
                  />
                </View>
                <Text
                  style={[styles.label, { color: isFocused ? '#fff' : 'rgba(255,255,255,0.78)' }]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />
    </>
  );
}

function MoreSheet({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: MoreItem[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) },
        ]}
      >
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>More</Text>
        <ScrollView contentContainerStyle={styles.sheetList}>
          {items.map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                onClose();
                if (item.onPress) item.onPress();
                else if (item.href) router.push(item.href);
              }}
            >
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: item.destructive ? colors.errorBg : colors.infoBg },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.destructive ? colors.error : colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { color: item.destructive ? colors.error : colors.text },
                ]}
              >
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  tabBar: {
    backgroundColor: c.primary,
    paddingTop: 6,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  tabRow: {
    height: BAR_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: '100%',
  },
  iconChip: {
    width: 46,
    height: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipFocused: { backgroundColor: c.accent },
  label: { fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.3 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,18,23,0.55)' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    marginBottom: spacing.sm,
  },
  sheetList: { paddingBottom: spacing.md, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  rowPressed: { backgroundColor: c.surfaceMuted },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
}));
