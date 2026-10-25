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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { GLASS_BAR, glassTile } from '@/components/ui/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments, type Href } from 'expo-router';
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRole } from '@/features/auth/role';
import { listNotifications } from '@/features/notifications/api';
import { getOpportunityCounts } from '@/features/hybrid/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError, useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { useSharedT } from '@/i18n/sharedStrings';
import { LanguageSelectorSheet } from '@/components/LanguageSelectorSheet';
import { WorkspaceSwitcherSheet } from '@/features/workspace/WorkspaceSwitcherSheet';
import { selectIsShared, useWorkspace } from '@/store/workspace';
import { darkPalette, fonts, glowRgb, shadows, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

import { BAR_CONTENT_HEIGHT } from '@/components/barMetrics';

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


type TabButtonProps = {
  tab: Tab;
  isFocused: boolean;
  onPress: () => void;
  width: number;
  badgeCount?: number;
};

/**
 * A Midnight Glass tab (design/home.png): icon and label always shown; the selected tab is magenta
 * with a soft glow pill behind its icon, one of the screen's three glows.
 */
function TabButton({ tab, isFocused, onPress, width, badgeCount }: TabButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = isFocused ? colors.accentLight : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, { width }]}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={tab.label}
    >
      <View style={[styles.tabPill, isFocused && styles.tabPillOn]}>
        <Ionicons name={isFocused ? tab.iconFocused : tab.icon} size={22} color={tone} />
        {badgeCount != null && badgeCount > 0 ? <View style={styles.badgeDot} /> : null}
      </View>
      <Text style={[styles.tabLabel, { color: tone }, isFocused && styles.tabLabelOn]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function PersistentBottomBar() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as string[];
  const [moreOpen, setMoreOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const { role } = useRole();
  const isShared = useWorkspace(selectIsShared);
  const { data: notifications } = useAsync(useCallback(() => listNotifications(role), [role]));
  const unreadCount = useMemo(
    () => notifications?.filter((n) => !n.read).length ?? 0,
    [notifications],
  );

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

  const { language, t } = useLanguage();
  const tabs = useMemo<Tab[]>(
    () => ([
      { key: 'home', label: t('tabHome'), href: '/(tabs)' as Href, icon: 'home-outline', iconFocused: 'home', match: ['index', '(tabs)'] },
      { key: 'events', label: t('tabEvents'), href: '/(tabs)/events' as Href, icon: 'calendar-outline', iconFocused: 'calendar', match: ['events', 'event', 'bookings'] },
      { key: 'wallet', label: t('tabWallet'), href: '/(tabs)/wallet' as Href, icon: 'wallet-outline', iconFocused: 'wallet', match: ['wallet', 'transactions', 'withdraw', 'payroll'] },
      { key: 'inbox', label: t('tabInbox'), href: '/(tabs)/inbox' as Href, icon: 'chatbubbles-outline', iconFocused: 'chatbubbles', match: ['inbox', 'conversation', 'notifications'] },
      { key: 'more', label: t('tabMore'), href: '/(tabs)' as Href, icon: 'ellipsis-horizontal', iconFocused: 'ellipsis-horizontal', isMore: true, match: [] },
    ] as Tab[]),
    [language, t],
  );

  const lastActiveKeyRef = useRef<string>('home');

  const activeKey = useMemo<string>(() => {
    const tabsIdx = segments.indexOf('(tabs)');
    if (tabsIdx !== -1) {
      if (tabsIdx + 1 < segments.length) {
        const sub = segments[tabsIdx + 1];
        if (sub === 'profile' || sub === 'more') {
          lastActiveKeyRef.current = 'more';
          return 'more';
        }
        const hit = tabs.find((t) => !t.isMore && t.match.includes(sub as string));
        if (hit) {
          lastActiveKeyRef.current = hit.key;
          return hit.key;
        }
      }
      lastActiveKeyRef.current = 'home';
      return 'home';
    }
    // Retain the last active tab when navigating to child pages outside (tabs)
    // so the selected tab never flickers when returning.
    return lastActiveKeyRef.current;
  }, [segments, tabs]);

  const activeIndex = useMemo(() => {
    if (moreOpen) {
      const moreIdx = tabs.findIndex((t) => t.isMore);
      return moreIdx !== -1 ? moreIdx : 4;
    }
    const idx = tabs.findIndex((t) => t.key === activeKey);
    return idx !== -1 ? idx : 0;
  }, [activeKey, moreOpen, tabs]);

  const { width: windowWidth } = useWindowDimensions();
  const contentMaxWidth = Math.min(windowWidth, 540);
  const [barWidth, setBarWidth] = useState(contentMaxWidth);

  useEffect(() => {
    setBarWidth(Math.min(windowWidth, 540));
  }, [windowWidth]);

  const tabWidth = barWidth > 0 ? barWidth / tabs.length : 0;

  return (
    <>
      <View
        pointerEvents={keyboardVisible ? 'none' : 'box-none'}
        style={[styles.tabBarContainer, { bottom: Math.max(insets.bottom, 8) }, keyboardVisible && styles.tabBarHidden]}
      >
        {/* Floating glass: blur where the platform can, the brief's solid fallback where it cannot. */}
        <View style={styles.tabBarBackground}>
          {Platform.OS === 'ios' ? (
            <BlurView tint={isDark ? 'dark' : 'light'} intensity={GLASS_BAR.intensity} style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={Platform.OS === 'ios' ? [colors.glassTop, colors.glassBottom] : [colors.glassSolid, colors.glassSolid]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View
          style={styles.tabRow}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - barWidth) > 1) {
              setBarWidth(w);
            }
          }}
        >
          {tabs.map((tab, idx) => {
            const isFocused = idx === activeIndex;
            const onPress = () => {
              if (tab.isMore) {
                setMoreOpen(true);
                return;
              }
              router.push(tab.href);
            };

            return (
              <TabButton
                key={tab.key}
                tab={tab}
                isFocused={isFocused}
                onPress={onPress}
                width={tabWidth}
                badgeCount={tab.isMore && unreadCount > 0 ? unreadCount : undefined}
              />
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
  const { role, isPhotographer, isCoordinator } = useRole();
  const { language, t } = useLanguage();
  const { tr } = useSharedT();

  const [searchQuery, setSearchQuery] = useState('');
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [workspaceSheetOpen, setWorkspaceSheetOpen] = useState(false);
  const isShared = useWorkspace(selectIsShared);
  const hasWorkspaces = useWorkspace((s) => s.memberships.length > 0);

  // Live unread notification count
  const { data: notifications } = useAsync(useCallback(() => listNotifications(role), [role]));
  const unreadCount = useMemo(
    () => notifications?.filter((n) => !n.read).length ?? 0,
    [notifications],
  );
  // Open Post My Event invites, so photographers see them from anywhere.
  const [opportunityCount, setOpportunityCount] = useState(0);
  useEffect(() => {
    if (!isPhotographer) return;
    getOpportunityCounts().then((c) => setOpportunityCount(c.pending)).catch(() => {});
  }, [isPhotographer]);

  const handleCardPress = (item: MoreGridItem) => {
    onClose();
    if (item.onPress) {
      item.onPress();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleLogout = useCallback(() => {
    Alert.alert(t('signOutConfirmTitle'), t('signOutConfirmMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('menuSignOut'),
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
  }, [logout, onClose, router, t]);

  // Verified items matching salo-run web sidebar navigation
  const allItems: MoreGridItem[] = useMemo(() => {
    const list: MoreGridItem[] = [];

    // 1. Profile (All roles in salo-run bottom nav)
    list.push({
      id: 'profile',
      label: t('tabProfile'),
      icon: 'person-outline',
      href: '/profile' as Href,
    });

    // 2. Streams (Client & Coordinator in salo-run)
    list.push({
      id: 'streams',
      label: t('menuStreams'),
      icon: 'videocam-outline',
      href: '/streams' as Href,
    });

    // Calendar: events the coordinator runs and the payments they owe, by day.
    if (isCoordinator) {
      list.push({
        id: 'calendar',
        label: 'Calendar',
        icon: 'calendar-outline',
        href: '/calendar' as Href,
      });
    }

    // Post My Event opportunities: their own entry, as on the web sidebar.
    if (isPhotographer) {
      list.push({
        id: 'opportunities',
        label: t('menuOpportunities'),
        icon: 'radio-outline',
        badge: opportunityCount > 0 ? opportunityCount : undefined,
        href: '/bookings?tab=opportunities' as Href,
      });
    }

    // The two ways to book, named as on the web dashboard.
    if (!isPhotographer) {
      list.push({
        id: 'post-my-event',
        label: t('menuPostMyEvent'),
        icon: 'radio-outline',
        href: '/event/hybrid-wizard' as Href,
      });
    }

    // 3. Gallery / My Photos (Client & Coordinator in salo-run)
    if (!isPhotographer) {
      list.push({
        id: 'gallery',
        label: t('menuGallery'),
        icon: 'images-outline',
        href: '/gallery' as Href,
      });
    }

    // 5. Photographers (Client, Coordinator in salo-run)
    if (!isPhotographer) {
      list.push({
        id: 'photographers',
        label: t('menuPhotographers'),
        icon: 'search-outline',
        href: '/photographers' as Href,
      });
    }

    // 6. Clients (Photographer in salo-run Work group)
    if (isPhotographer) {
      list.push({
        id: 'clients',
        label: t('menuClients'),
        icon: 'people-outline',
        href: '/clients' as Href,
      });
    }

    // 7. Collaborate (Photographer only, salo-run Work group)
    if (isPhotographer) {
      list.push({
        id: 'collaborate',
        label: t('menuCollaborate'),
        icon: 'people-circle-outline',
        href: '/collaborate' as Href,
      });
    }

    // 8. Payments (Client, Coordinator in salo-run Money group)
    if (!isPhotographer) {
      list.push({
        id: 'payments',
        label: t('menuPayments'),
        icon: 'card-outline',
        href: '/payments' as Href,
      });
    }

    // 9. Transactions (Photographer in salo-run Money group)
    if (isPhotographer) {
      list.push({
        id: 'transactions',
        label: t('menuTransactions'),
        icon: 'swap-horizontal-outline',
        href: '/transactions' as Href,
      });
    }

    // 10. Donate (All roles in salo-run Money group)
    list.push({
      id: 'donations',
      label: t('menuDonate'),
      icon: 'heart-outline',
      href: '/donations' as Href,
    });

    // 11. Notifications (All roles in salo-run Overview group)
    list.push({
      id: 'notifications',
      label: t('menuAlerts'),
      icon: 'notifications-outline',
      badge: unreadCount > 0 ? unreadCount : undefined,
      href: '/notifications' as Href,
    });

    // 12. Language Preferences (globe icon, opens language selector)
    list.push({
      id: 'language',
      label: t('menuLanguage'),
      icon: 'globe-outline',
      onPress: () => {
        onClose();
        setTimeout(() => setLanguageSheetOpen(true), 150);
      },
    });

    // 13. Preferences / Settings (All roles in salo-run bottom nav)
    list.push({
      id: 'preferences',
      label: t('menuSettings'),
      icon: 'settings-outline',
      href: '/preferences' as Href,
    });

    // Switch between the photographer's own workspace and the ones they were invited to. Offered only when there is
    // something to choose.
    if (isPhotographer && (hasWorkspaces || isShared)) {
      list.push({
        id: 'workspace',
        label: 'Workspace',
        icon: 'swap-horizontal-outline',
        onPress: () => {
          onClose();
          setTimeout(() => setWorkspaceSheetOpen(true), 150);
        },
      });
    }

    // 14. Sign Out / Logout (All roles in salo-run bottom nav)
    list.push({
      id: 'sign-out',
      label: t('menuSignOut'),
      icon: 'log-out-outline',
      onPress: handleLogout,
      destructive: true,
    });

    // In a shared workspace the owner's account, the transaction history, donating and collaboration stay with the owner.
    if (isShared && isPhotographer) {
      const hidden = new Set(['profile', 'streams', 'calendar', 'collaborate', 'transactions', 'donations', 'preferences']);
      return list.filter((i) => !hidden.has(i.id));
    }
    return list;
  }, [language, t, isPhotographer, isCoordinator, isShared, hasWorkspaces, unreadCount, opportunityCount, handleLogout, onClose]);

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
      <GlassScrim onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <GlassSheetHost
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) },
        ]}
      >
        <View style={styles.handle} />

        {/* Header with Title and Close Button */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{t('tabMore')}</Text>
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
            placeholder={t('searchServices')}
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
              <Text style={styles.emptySearchTitle}>{tr('No shortcuts found')}</Text>
              <Text style={styles.emptySearchSub}>
                {tr(`No shortcuts matched "${searchQuery}"`)}
              </Text>
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Text style={styles.clearSearchButtonText}>Clear search</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </GlassSheetHost>
      </GlassScrim>

      <LanguageSelectorSheet
        visible={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
      />
      <WorkspaceSwitcherSheet visible={workspaceSheetOpen} onClose={() => setWorkspaceSheetOpen(false)} />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  // Floats 16pt in from the edges, above the home indicator (design/home.png).
  tabBarContainer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: 540,
    alignSelf: 'center',
    zIndex: 99,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: c.stroke,
    boxShadow: c === darkPalette ? shadows.glass : shadows.glassLight,
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
  },
  tabBarHidden: {
    display: 'none',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_CONTENT_HEIGHT,
  },
  tab: { height: BAR_CONTENT_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabPill: { width: 52, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  tabPillOn: { backgroundColor: c.tintAccent, boxShadow: shadows.glow(glowRgb.accent, 0.45) },
  tabLabel: { fontSize: 11, fontFamily: fonts.medium },
  tabLabelOn: { fontFamily: fonts.semibold },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.accent,
    borderWidth: 1.5,
    borderColor: c.glassSolid,
  },

  backdrop: { flex: 1, backgroundColor: c.scrim },
  sheet: {
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
    ...glassTile(c),
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    ...glassTile(c),
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
    color: c.textOnPrimary,
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
