/**
 * Bottom tab bar — flat, edge-to-edge, no rounded float.
 *
 * Visible tabs (left → right): Home · Events · Wallet · Inbox · More.
 * "More" is intercepted: instead of navigating, it opens a bottom-sheet
 * modal that lists every menu item that isn't on the bar (Profile,
 * Notifications, Photographers, Find My Photos, Team for owners,
 * Packages for photographers, Donate, Preferences, Logout). The list is
 * role-aware so a coordinator sees Team + photographer shortcuts but
 * not Packages/Clients (which are photographer-only).
 *
 * The bar fills the full screen width (no horizontal margin, no border
 * radius) and sits flush against the safe-area inset at the bottom so
 * the same bar fits the same way on a 360×640 phone as on a 430×932
 * iPhone Pro Max. The chip behind the active tab keeps the brand pink
 * highlight from the previous design.
 */
import { useState } from 'react';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, type Href } from 'expo-router';
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
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const BAR_CONTENT_HEIGHT = 60;

const MORE_KEY = '__more__';

type MoreItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: Href;
  onPress?: () => void;
  destructive?: boolean;
};

function CustomTabBar({ state, descriptors, navigation, insets, onMore }: any) {
  return (
    <View
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 6) }]}
    >
      {Platform.OS === 'ios' ? (
        <>
          <BlurView tint="light" intensity={28} style={StyleSheet.absoluteFillObject} />
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.primary, opacity: 0.92 }]}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.primary }]} />
      )}

      <View style={styles.tabRow}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isMore = route.name === 'more';

          const onPress = () => {
            if (isMore) {
              onMore();
              return;
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const iconName = iconFor(route.name, isFocused);
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              <View style={[styles.iconChip, isFocused && styles.iconChipFocused]}>
                <Ionicons
                  name={iconName}
                  size={20}
                  color={isFocused ? '#fff' : 'rgba(255,255,255,0.78)'}
                />
              </View>
              <Text
                style={[styles.label, { color: isFocused ? '#fff' : 'rgba(255,255,255,0.78)' }]}
                numberOfLines={1}
              >
                {String(label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function iconFor(routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case 'index':
      return focused ? 'home' : 'home-outline';
    case 'events':
      return focused ? 'calendar' : 'calendar-outline';
    case 'wallet':
      return focused ? 'wallet' : 'wallet-outline';
    case 'inbox':
      return focused ? 'chatbubbles' : 'chatbubbles-outline';
    case 'more':
      return 'ellipsis-horizontal';
    default:
      return 'apps-outline';
  }
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

export default function AppTabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const { role, isCoordinator, isPhotographer, isClient, isUser } = useRole();
  const logout = useAuth((s) => s.logout);

  // Role-aware overflow menu. Every entry below isn't already on the
  // visible bar; the goal is "one tap to anywhere from anywhere".
  const moreItems: MoreItem[] = [
    { label: 'Profile', icon: 'person-outline', href: '/profile' as Href },
    { label: 'Notifications', icon: 'notifications-outline', href: '/notifications' as Href },
    ...(isCoordinator || isClient || isUser
      ? [
          { label: 'Find photographers', icon: 'camera-outline' as const, href: '/photographers' as Href },
          { label: 'Find my photos', icon: 'scan-outline' as const, href: '/find-my-photos' as Href },
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
    ...(isClient || isCoordinator || isUser
      ? [
          { label: 'My bookings', icon: 'briefcase-outline' as const, href: '/bookings' as Href },
          { label: 'Payments', icon: 'card-outline' as const, href: '/payments' as Href },
        ]
      : []),
    { label: 'Gallery', icon: 'images-outline', href: '/gallery' as Href },
    { label: 'Donations', icon: 'heart-outline', href: '/donations' as Href },
    { label: 'Transactions', icon: 'list-outline', href: '/transactions' as Href },
    { label: 'Preferences', icon: 'settings-outline', href: '/preferences' as Href },
    { label: 'Verification', icon: 'shield-checkmark-outline', href: '/kyc' as Href },
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
            // swallow — the auth store has already cleared local state
          }
        }
      },
    },
  ];

  return (
    <>
      <Tabs
        // The visible bar moved to (app)/_layout.tsx (PersistentBottomBar)
        // so it stays on every (app) route, not just (tabs). We render a
        // null bar here so this Tabs container doesn't paint its own.
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: Platform.OS === 'android',
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="events" options={{ title: 'Events' }} />
        <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
        <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
        {/*
         * Profile stays as a route so existing deep links + Topbar avatar
         * tap still work, but it's hidden from the bar — the More sheet
         * surfaces it instead. `href: null` removes the tab button
         * entirely (expo-router v3+).
         */}
        <Tabs.Screen name="profile" options={{ title: 'Profile', href: null }} />
        <Tabs.Screen
          name="more"
          options={{ title: 'More' }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMoreOpen(true);
            },
          }}
        />
      </Tabs>

      <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />
    </>
  );
}

const styles = StyleSheet.create({
  // Edge-to-edge, flat, flush — no radius, no horizontal margin, no
  // floating shadow. Sits at the bottom safe area so it doesn't get
  // squeezed by the home indicator on Pro phones.
  tabBar: {
    backgroundColor: colors.primary,
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
  iconChipFocused: { backgroundColor: colors.accent },
  label: { fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.3 },

  // Sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(15,18,23,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
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
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
