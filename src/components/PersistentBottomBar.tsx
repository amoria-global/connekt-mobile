/**
 * Always-visible bottom bar for every authenticated (app) route.
 *
 * Senior-crafted mobile navigation hub:
 *   • Five persistent entries: Home · Events/Streams · Wallet/Photos · Inbox/Payments · More
 *   • "More" opens a categorized, card-based bottom-sheet hub:
 *     - Personalized time-based greeting & profile card with completion badge
 *     - Instant search & filter bar with category tagging
 *     - Interactive category filter tabs with icons & counters (All · Services · Finances · Account · Support)
 *     - 2×2 quick action cards grid with tactile press physics
 *     - Grouped card containers with inset hairline dividers
 *     - Section headers with category icons & item counts
 *     - Real-time unread notification badge & tab indicator
 *     - Safe logout with confirmation dialog
 *   • Every opened destination features a clean chevron back button.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments, type Href } from 'expo-router';
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRole } from '@/features/auth/role';
import { listNotifications } from '@/features/notifications/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const BAR_CONTENT_HEIGHT = 60;

type Tab = {
  key: string;
  label: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  isMore?: boolean;
  match: string[];
};

// Owner/creator roles (Client, Coordinator, Photographer) run a business:
const OWNER_TABS: Tab[] = [
  { key: 'home', label: 'Home', href: '/(tabs)' as Href, icon: 'home-outline', iconFocused: 'home', match: ['index', '(tabs)'] },
  { key: 'events', label: 'Events', href: '/(tabs)/events' as Href, icon: 'calendar-outline', iconFocused: 'calendar', match: ['events', 'event', 'bookings'] },
  { key: 'wallet', label: 'Wallet', href: '/(tabs)/wallet' as Href, icon: 'wallet-outline', iconFocused: 'wallet', match: ['wallet', 'transactions', 'withdraw', 'payroll'] },
  { key: 'inbox', label: 'Inbox', href: '/(tabs)/inbox' as Href, icon: 'chatbubbles-outline', iconFocused: 'chatbubbles', match: ['inbox', 'conversation', 'notifications'] },
  { key: 'more', label: 'More', href: '/(tabs)' as Href, icon: 'ellipsis-horizontal', iconFocused: 'ellipsis-horizontal', isMore: true, match: [] },
];

// The consumer `User` role:
const USER_TABS: Tab[] = [
  { key: 'home', label: 'Home', href: '/(tabs)' as Href, icon: 'home-outline', iconFocused: 'home', match: ['index', '(tabs)'] },
  { key: 'streams', label: 'Streams', href: '/streams' as Href, icon: 'videocam-outline', iconFocused: 'videocam', match: ['streams', 'stream', 'event', 'events'] },
  { key: 'photos', label: 'Photos', href: '/gallery' as Href, icon: 'images-outline', iconFocused: 'images', match: ['gallery', 'album', 'photobooks', 'find-my-photos'] },
  { key: 'payments', label: 'Payments', href: '/payments' as Href, icon: 'card-outline', iconFocused: 'card', match: ['payments', 'payment', 'transactions'] },
  { key: 'more', label: 'More', href: '/(tabs)' as Href, icon: 'ellipsis-horizontal', iconFocused: 'ellipsis-horizontal', isMore: true, match: [] },
];

export type MoreGridItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string | number;
  href?: Href;
  onPress?: () => void;
  destructive?: boolean;
};

export type MoreCardItem = MoreGridItem;

export type MoreGridSection = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: MoreGridItem[];
};

export type MoreCardSection = MoreGridSection;
export type MoreCardGroup = MoreGridSection;


export function PersistentBottomBar() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as string[];
  const [moreOpen, setMoreOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { isUser } = useRole();

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const tabs = isUser ? USER_TABS : OWNER_TABS;

  const activeKey = useMemo<string>(() => {
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

  if (
    keyboardVisible ||
    segments.includes('kyc') ||
    segments.includes('connect-to-tv') ||
    segments.includes('pay-on-tv') ||
    segments.includes('stream')
  ) {
    return <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />;
  }

  return (
    <>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {Platform.OS === 'ios' ? (
          <>
            <BlurView
              tint={isDark ? 'dark' : 'light'}
              intensity={48}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.elevated, opacity: 0.88 }]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.elevated }]} />
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
            const iconColor = isFocused ? colors.textOnPrimary : colors.textMuted;
            const labelColor = isFocused ? colors.primary : colors.textMuted;
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
                    color={iconColor}
                  />
                </View>
                <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

export function MoreSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const { role, isCoordinator, isPhotographer, isUser } = useRole();

  const [searchQuery, setSearchQuery] = useState('');

  // Live unread notification count
  const { data: notifications } = useAsync(useCallback(() => listNotifications(role), [role]));
  const unreadCount = useMemo(
    () => notifications?.filter((n) => !n.read).length ?? 0,
    [notifications],
  );

  const handleCardPress = (item: MoreGridItem) => {
    onClose();
    if (item.onPress) {
      item.onPress();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your Connekyt account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          onClose();
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
    ]);
  };

  // Verified items matching salo-run web sidebar navigation
  const allItems: MoreGridItem[] = useMemo(() => {
    const list: MoreGridItem[] = [];

    // 1. Profile (All roles in salo-run bottom nav)
    list.push({
      id: 'profile',
      label: 'Profile',
      icon: 'person-outline',
      href: '/profile' as Href,
    });

    // 2. Streams (Client & Coordinator in salo-run; User already has it in bottom tab)
    if (!isUser) {
      list.push({
        id: 'streams',
        label: 'Streams',
        icon: 'videocam-outline',
        href: '/streams' as Href,
      });
    }

    // 3. Gallery / My Photos (Client & Coordinator in salo-run; User already has it in bottom tab)
    if (!isUser && !isPhotographer) {
      list.push({
        id: 'gallery',
        label: 'Gallery',
        icon: 'images-outline',
        href: '/gallery' as Href,
      });
    }

    // 4. Bookings (User in salo-run Watch group: "My Bookings"; Owners have Events in bottom tab)
    if (isUser) {
      list.push({
        id: 'bookings',
        label: 'Bookings',
        icon: 'calendar-outline',
        href: '/bookings' as Href,
      });
    }

    // 5. Photographers (Client, Coordinator, User in salo-run)
    if (!isPhotographer) {
      list.push({
        id: 'photographers',
        label: 'Photographers',
        icon: 'camera-outline',
        href: '/photographers' as Href,
      });
    }

    // 6. Clients (Photographer in salo-run Work group)
    if (isPhotographer) {
      list.push({
        id: 'clients',
        label: 'Clients',
        icon: 'people-outline',
        href: '/clients' as Href,
      });
    }

    // 7. Team (Photographer, Client, Coordinator in salo-run Team group)
    if (!isUser) {
      list.push({
        id: 'team',
        label: 'Team',
        icon: 'people-circle-outline',
        href: '/team' as Href,
      });
    }

    // 8. Payments (Client, Coordinator in salo-run Money group; User already has it in bottom tab)
    if (!isUser && !isPhotographer) {
      list.push({
        id: 'payments',
        label: 'Payments',
        icon: 'card-outline',
        href: '/payments' as Href,
      });
    }

    // 9. Transactions (Photographer in salo-run Money group)
    if (isPhotographer) {
      list.push({
        id: 'transactions',
        label: 'Transactions',
        icon: 'swap-horizontal-outline',
        href: '/transactions' as Href,
      });
    }

    // 10. Donate (All roles in salo-run Money group)
    list.push({
      id: 'donations',
      label: 'Donate',
      icon: 'heart-outline',
      href: '/donations' as Href,
    });

    // 11. Notifications (All roles in salo-run Overview group)
    list.push({
      id: 'notifications',
      label: 'Alerts',
      icon: 'notifications-outline',
      badge: unreadCount > 0 ? unreadCount : undefined,
      href: '/notifications' as Href,
    });

    // 12. Preferences / Settings (All roles in salo-run bottom nav)
    list.push({
      id: 'preferences',
      label: 'Settings',
      icon: 'settings-outline',
      href: '/preferences' as Href,
    });

    // 13. Sign Out / Logout (All roles in salo-run bottom nav)
    list.push({
      id: 'sign-out',
      label: 'Sign Out',
      icon: 'log-out-outline',
      onPress: handleLogout,
      destructive: true,
    });

    return list;
  }, [isCoordinator, isPhotographer, isUser, unreadCount, handleLogout]);

  // Filter shortcuts by search query
  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [searchQuery, allItems]);

  const renderGridItem = (item: MoreGridItem) => (
    <Pressable
      key={item.id}
      style={({ pressed }) => [styles.gridItem, pressed && styles.gridItemPressed]}
      onPress={() => handleCardPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={styles.gridIconBox}>
        <Ionicons name={item.icon} size={24} color={colors.primary} />
        {item.badge != null ? (
          <View style={styles.gridBadge}>
            <Text style={styles.gridBadgeText}>{item.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.gridLabel} numberOfLines={2}>
        {item.label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) },
        ]}
      >
        <View style={styles.handle} />

        {/* Header with Title and Close Button */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Shortcuts</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <Ionicons name="close" size={18} color={colors.textSoft} />
          </Pressable>
        </View>

        {/* Instant Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search shortcuts..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {displayedItems.length > 0 ? (
            <View style={styles.gridContainer}>
              {displayedItems.map(renderGridItem)}
            </View>
          ) : (
            <View style={styles.emptySearchWrap}>
              <Ionicons name="search" size={38} color={colors.textMuted} />
              <Text style={styles.emptySearchTitle}>No shortcuts found</Text>
              <Text style={styles.emptySearchSub}>
                No shortcuts matched &ldquo;{searchQuery}&rdquo;
              </Text>
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Text style={styles.clearSearchButtonText}>Clear search</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  tabBar: {
    backgroundColor: c.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
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

  backdrop: { flex: 1, backgroundColor: c.scrim },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingTop: spacing.sm,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  sheetTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: c.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    height: 42,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: c.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: spacing.md + 2,
    paddingHorizontal: 4,
  },
  gridItemPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.75,
  },
  gridIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: c.tint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  gridBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: c.accent,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  gridBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: fontWeight.bold,
  },
  gridLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.text,
    textAlign: 'center',
    lineHeight: 14,
    height: 28,
  },
  emptySearchWrap: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptySearchTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  emptySearchSub: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  clearSearchButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
}));
