/**
 * Notifications Screen — Instagram / Apple Activity Feed style.
 *
 * Highlights:
 *   • Direct-to-screen navigation on tap (NO modal popup).
 *   • Circular avatar on the left with overlapping category icon badge.
 *   • Rich inline narrative typography with relative timestamps ("2m", "1h", "Yesterday").
 *   • Square media thumbnail preview on the right (for albums, events, and photos).
 *   • Sapphire unread indicator dot.
 *   • Long-press context action sheet (Mark read, Delete, Open).
 *   • Clean chronological grouping: Today, Yesterday, This Week, Earlier.
 *   • Streamlined top header with unread badge and options menu.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { isApiError } from '@/store/auth';
import {
  deleteAllNotifications,
  deleteNotification,
  deleteReadNotifications,
  listNotifications,
  markAllRead,
  markRead,
  sendBackendTestPush,
  type AppNotification,
  type NotificationType,
} from '@/features/notifications/api';
import {
  checkNotificationDiagnostics,
  scheduleTestBookingAlert,
  scheduleTestLockScreenNotification,
} from '@/features/notifications/push';
import { notificationTarget } from '@/features/notifications/routing';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatPrice, formatRelativeTime } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';

type FilterOption = 'all' | 'unread' | 'booking' | 'payment_group' | 'album' | 'security';
type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

const GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];

function getDateGroup(dateStr?: string): DateGroup {
  if (!dateStr) return 'Earlier';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Earlier';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

function cleanNarrative(n: AppNotification) {
  const title = (n.title || '').trim();
  const body = (n.message || n.body || '').trim();
  if (!body || body.toLowerCase() === title.toLowerCase()) {
    return { title, body: '' };
  }
  return { title, body };
}

export default function NotificationsScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { language, t } = useLanguage();
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { role, isPhotographer, isCoordinator } = useRole();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  // A failed read is not an empty feed: it is said, and it can be retried.
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const items = await listNotifications(role);
        setNotifications(items);
        setLoadError(null);
      } catch (e) {
        // Keep existing items on a network error, and say that the refresh failed.
        setLoadError(isApiError(e) ? e.message : 'Could not load your notifications.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  // Mark single as read in the background
  const onMarkAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      markRead(role, id).catch(() => {});
    },
    [role],
  );

  // Mark all as read
  const onMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllRead(role);
    } catch {
      // ignore
    }
  };

  // Direct Tap: Instant navigation straight to destination (NO modal popup!)
  const onTapNotification = (item: AppNotification) => {
    if (!item.read) {
      onMarkAsRead(String(item.id));
    }
    const target = notificationTarget(item);
    router.push(target);
  };

  // Delete single notification
  const onDeleteOne = (notification: AppNotification) => {
    const backup = [...notifications];
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    deleteNotification(role, String(notification.id)).catch(() => {
      Alert.alert('Error', 'Could not delete notification.');
      setNotifications(backup);
    });
  };

  // Clear all read notifications
  const onClearRead = async () => {
    const hasRead = notifications.some((n) => n.read);
    if (!hasRead) return;

    const backup = [...notifications];
    setNotifications((prev) => prev.filter((n) => !n.read));
    try {
      await deleteReadNotifications(role);
    } catch {
      Alert.alert('Error', 'Could not clear read notifications.');
      setNotifications(backup);
    }
  };

  // Delete all notifications
  const onDeleteAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Clear all notifications',
      'Are you sure you want to remove all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            const backup = [...notifications];
            setNotifications([]);
            try {
              await deleteAllNotifications(role);
            } catch {
              Alert.alert('Error', 'Failed to clear notifications.');
              setNotifications(backup);
            }
          },
        },
      ],
    );
  };

  // Options menu sheet
  const onOptionsPress = () => {
    Alert.alert('Notification Settings', undefined, [
      ...(unreadCount > 0
        ? [
            {
              text: 'Mark all as read',
              onPress: onMarkAllRead,
            },
          ]
        : []),
      ...(notifications.some((n) => n.read)
        ? [
            {
              text: 'Clear read notifications',
              onPress: onClearRead,
            },
          ]
        : []),
      ...(notifications.length > 0
        ? [
            {
              text: 'Delete all notifications',
              style: 'destructive' as const,
              onPress: onDeleteAll,
            },
          ]
        : []),
      {
        text: 'Test Booking Alert (5s)',
        onPress: async () => {
          try {
            await scheduleTestBookingAlert(5);
            Alert.alert(
              'Booking Alert Scheduled',
              'Lock your phone now! In 5 seconds, an incoming booking request will ring and wake your screen with the "View & respond" button.',
            );
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not schedule booking alert.');
          }
        },
      },
      {
        text: 'Test Generic Alert (5s)',
        onPress: async () => {
          try {
            await scheduleTestLockScreenNotification(5);
            Alert.alert(
              'Test Alert Scheduled',
              'Lock your phone now! In 5 seconds, a test alert will wake your screen with sound and notification banner.',
            );
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not schedule test alert.');
          }
        },
      },
      {
        text: 'Check Push & Lock-Screen Status',
        onPress: async () => {
          try {
            const diag = await checkNotificationDiagnostics();
            let msg = `Permissions: ${diag.permissionGranted ? '✅ Granted' : '❌ NOT Granted (' + diag.permissionStatus + ')'}\n`;
            msg += `Device: ${diag.isDevice ? 'Physical Phone' : 'Simulator'}\n`;
            msg += `Push Token: ${diag.pushToken ? '✅ Obtained' : '❌ None'}\n`;
            msg += `Server Registration: ${diag.registeredWithBackend ? '✅ Registered' : '⚠️ Pending / Not Registered'}\n`;
            if (diag.iosDetails) {
              msg += `\nLock Screen: ${diag.iosDetails.allowsLockScreen ? '✅ Allowed' : '⚠️ Disabled in iOS Settings'}\n`;
              msg += `Sounds: ${diag.iosDetails.allowsSound ? '✅ Allowed' : '⚠️ Disabled'}\n`;
              msg += `Banners: ${diag.iosDetails.allowsAlert ? '✅ Allowed' : '⚠️ Disabled'}\n`;
            }
            if (diag.channelsSummary) {
              msg += `\n${diag.channelsSummary}`;
            }

            Alert.alert('Lock-Screen Diagnostics', msg, [
              ...(!diag.permissionGranted || (diag.iosDetails && !diag.iosDetails.allowsLockScreen)
                ? [
                    {
                      text: 'Open Settings',
                      onPress: () => void Linking.openSettings(),
                    },
                  ]
                : []),
              { text: 'OK' },
            ]);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not run diagnostics.');
          }
        },
      },
      {
        text: 'Send Server Test Push',
        onPress: async () => {
          try {
            await sendBackendTestPush(
              'Connekyt Booking Alert',
              'Test push notification dispatched directly from the Connekyt server.',
            );
            Alert.alert(
              'Server Push Dispatched',
              'Lock your phone now! The backend has sent a push notification to this account. It should land on your lock screen shortly.',
            );
          } catch (e: any) {
            Alert.alert('Server Push Error', e?.message || 'Could not trigger server push. Verify your device is registered.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Long press contextual menu on a specific item
  const onLongPressItem = (item: AppNotification) => {
    Alert.alert(item.title, item.message || item.body || undefined, [
      {
        text: 'Open',
        onPress: () => onTapNotification(item),
      },
      ...(!item.read
        ? [
            {
              text: 'Mark as read',
              onPress: () => onMarkAsRead(String(item.id)),
            },
          ]
        : []),
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteOne(item),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Filter options
  const filterOptions: { key: FilterOption; label: string; count?: number }[] = useMemo(() => {
    const paymentLabel = isCoordinator ? t('streamRevenue') : isPhotographer ? t('payments') : t('gifts');
    return [
      { key: 'all', label: t('filterAll') },
      { key: 'unread', label: t('unread'), count: unreadCount },
      { key: 'booking', label: t('bookings') },
      { key: 'payment_group', label: paymentLabel },
      { key: 'album', label: t('albums') },
      { key: 'security', label: t('security') },
    ];
  }, [isCoordinator, isPhotographer, unreadCount, t]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'unread') return notifications.filter((n) => !n.read);
    if (activeFilter === 'album') {
      return notifications.filter((n) => n.type === 'album' || n.type === 'photobook');
    }
    if (activeFilter === 'payment_group') {
      return notifications.filter(
        (n) =>
          n.type === 'gift' ||
          n.type === 'payment' ||
          n.type === 'streamfee' ||
          n.type === 'tip' ||
          n.type === 'bonus',
      );
    }
    if (activeFilter === 'booking') {
      return notifications.filter((n) => n.type === 'booking' || n.type === 'event');
    }
    if (activeFilter === 'security') {
      return notifications.filter((n) => n.type === 'security');
    }
    return notifications;
  }, [activeFilter, notifications]);

  // Chronological grouping
  const groupedNotifications = useMemo(() => {
    const map = new Map<DateGroup, AppNotification[]>();
    for (const group of GROUP_ORDER) {
      map.set(group, []);
    }
    for (const item of filteredNotifications) {
      const group = getDateGroup(item.createdAt);
      map.get(group)?.push(item);
    }
    return GROUP_ORDER.map((group) => ({
      title: group,
      items: map.get(group) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [filteredNotifications]);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* ── 1. Instagram Activity Style Header ── */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressedOpacity]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('notificationsTitle')}</Text>
          {unreadCount > 0 ? (
            <View style={styles.unreadCounterPill}>
              <Text style={styles.unreadCounterText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerActionsRight}>
          {unreadCount > 0 ? (
            <Pressable
              onPress={onMarkAllRead}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('markAllAsRead')}
              style={({ pressed }) => [styles.markAllLink, pressed && styles.pressedOpacity]}
            >
              <Text style={styles.markAllLinkText}>{t('markAll')}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onOptionsPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Notification options"
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressedOpacity]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* ── 2. Compact Horizontal Filter Tabs ── */}
      <View style={styles.filterRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterOptions.map((opt) => {
            const isActive = activeFilter === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setActiveFilter(opt.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${opt.label}`}
                style={({ pressed }) => [
                  styles.filterPill,
                  isActive && styles.filterPillActive,
                  pressed && styles.pressedScale,
                ]}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {opt.label}
                </Text>
                {opt.key === 'unread' && opt.count && opt.count > 0 ? (
                  <View style={[styles.filterCountBadge, isActive && styles.filterCountBadgeActive]}>
                    <Text
                      style={[
                        styles.filterCountBadgeText,
                        isActive && styles.filterCountBadgeTextActive,
                      ]}
                    >
                      {opt.count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 3. Main Activity Feed ── */}
      <ScrollView
        contentContainerStyle={styles.feedScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : loadError && notifications.length === 0 ? (
          <View style={styles.emptyWrap} accessibilityRole="alert">
            <View style={styles.emptyCircle}>
              <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Could not load notifications</Text>
            <Text style={styles.emptySub}>{loadError}</Text>
            <Pressable onPress={() => loadData(true)} style={styles.resetPill} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={styles.resetPillText}>Try again</Text>
            </Pressable>
          </View>
        ) : filteredNotifications.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyWrap}>
            <View style={styles.emptyCircle}>
              <Ionicons name="notifications-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'unread' ? t('allCaughtUp') : t('noActivityYet')}
            </Text>
            <Text style={styles.emptySub}>
              {activeFilter === 'unread'
                ? t('reviewedAllUpdates')
                : t('activityWillAppearHere')}
            </Text>
            {activeFilter !== 'all' ? (
              <Pressable onPress={() => setActiveFilter('all')} style={styles.resetPill}>
                <Text style={styles.resetPillText}>{t('viewAllNotifications')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          /* Instagram Chronological Activity Feed */
          groupedNotifications.map((group) => {
            const groupTitle =
              group.title === 'Today'
                ? t('today')
                : group.title === 'Yesterday'
                ? t('yesterday')
                : group.title === 'This Week'
                ? t('thisWeek')
                : t('earlier');
            return (
              <View key={group.title} style={styles.groupSection}>
                {/* Subtle Section Header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{groupTitle}</Text>
                </View>

              {/* Activity Rows */}
              {group.items.map((item) => {
                const iconMeta = getCategoryIconMeta(item.type, isDark);
                const isUnread = !item.read;
                const { title, body } = cleanNarrative(item);

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onTapNotification(item)}
                    onLongPress={() => onLongPressItem(item)}
                    delayLongPress={350}
                    accessibilityRole="button"
                    accessibilityLabel={`${isUnread ? 'Unread: ' : ''}${title}`}
                    style={({ pressed }) => [
                      styles.activityRow,
                      isUnread && styles.activityRowUnread,
                      pressed && styles.activityRowPressed,
                    ]}
                  >
                    {/* Left: Avatar with Category Badge Overlay */}
                    <View style={styles.avatarWrap}>
                      {item.avatar ? (
                        <Image
                          source={{ uri: item.avatar }}
                          style={styles.avatarImg}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View style={[styles.avatarFallback, { backgroundColor: iconMeta.bg }]}>
                          <Ionicons name={iconMeta.name} size={20} color={iconMeta.color} />
                        </View>
                      )}

                      {/* Small overlapping category badge icon */}
                      <View style={[styles.avatarBadge, { backgroundColor: iconMeta.color }]}>
                        <Ionicons name={iconMeta.miniIcon} size={10} color="#fff" />
                      </View>
                    </View>

                    {/* Middle: Rich narrative text */}
                    <View style={styles.narrativeWrap}>
                      <Text style={styles.narrativeText} numberOfLines={3}>
                        <Text style={styles.boldSender}>{title}</Text>
                        {body ? <Text style={styles.bodyCopy}> {body}</Text> : null}
                        <Text style={styles.timeAgo}> {formatRelativeTime(item.createdAt)}</Text>
                      </Text>

                      {/* Amount pill if monetary */}
                      {item.amount ? (
                        <View style={styles.amountPill}>
                          <Text style={styles.amountPillText}>+{formatPrice(item.amount)}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Right: Media thumbnail preview OR Unread Dot */}
                    <View style={styles.rightSlot}>
                      {item.albumPreview ? (
                        <Image
                          source={{ uri: item.albumPreview }}
                          style={styles.mediaThumbnail}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : null}

                      {/* Sapphire unread dot */}
                      {isUnread ? (
                        <View style={styles.unreadDot} />
                      ) : !item.albumPreview ? (
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Category metadata with distinct icon and badge for Instagram feed.
 */
function getCategoryIconMeta(type: NotificationType, isDark: boolean) {
  switch (type) {
    case 'album':
    case 'photobook':
      return {
        name: 'images' as const,
        miniIcon: 'images' as const,
        bg: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F3E8FF',
        color: '#8B5CF6',
      };
    case 'gift':
      return {
        name: 'gift' as const,
        miniIcon: 'gift' as const,
        bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7',
        color: '#10B981',
      };
    case 'payment':
    case 'streamfee':
    case 'tip':
    case 'bonus':
      return {
        name: 'card' as const,
        miniIcon: 'cash-outline' as const,
        bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7',
        color: '#10B981',
      };
    case 'security':
      return {
        name: 'shield-checkmark' as const,
        miniIcon: 'shield' as const,
        bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
        color: '#EF4444',
      };
    case 'booking':
    case 'event':
      return {
        name: 'calendar' as const,
        miniIcon: 'calendar' as const,
        bg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#DBEAFE',
        color: '#2563EB',
      };
    case 'photographer':
    case 'review':
      return {
        name: 'camera' as const,
        miniIcon: 'camera' as const,
        bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
        color: '#F59E0B',
      };
    default:
      return {
        name: 'notifications' as const,
        miniIcon: 'notifications' as const,
        bg: isDark ? 'rgba(148, 163, 184, 0.14)' : '#F1F5F9',
        color: '#64748B',
      };
  }
}

const useStyles = makeStyles((c) => ({
  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: c.text,
    letterSpacing: -0.4,
  },
  unreadCounterPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCounterText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  markAllLink: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  markAllLinkText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },

  // ── Filter Strip ──
  filterRowWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    paddingBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: 6,
    paddingTop: 4,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  filterPillActive: {
    backgroundColor: c.text,
  },
  filterPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  filterPillTextActive: {
    color: c.background,
  },
  filterCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#2563EB',
  },
  filterCountBadgeTextActive: {
    color: c.background,
  },

  // ── Feed Scroll ──
  feedScrollContent: {
    paddingBottom: spacing['3xl'],
  },
  loadingBox: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },

  // ── Section Group ──
  groupSection: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
    letterSpacing: -0.2,
  },

  // ── Instagram Activity Row ──
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    gap: 12,
    backgroundColor: c.background,
  },
  activityRowUnread: {
    backgroundColor: 'rgba(37, 99, 235, 0.035)',
  },
  activityRowPressed: {
    backgroundColor: c.surfaceMuted,
  },

  // Avatar & Overlapping Badge
  avatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: c.background,
  },

  // Narrative Text
  narrativeWrap: {
    flex: 1,
    gap: 3,
  },
  narrativeText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: c.text,
  },
  boldSender: {
    fontFamily: fonts.bold,
    color: c.text,
  },
  bodyCopy: {
    color: c.textSoft,
  },
  timeAgo: {
    color: c.textMuted,
    fontSize: 12,
  },
  amountPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 2,
  },
  amountPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#059669',
  },

  // Right Slot: Media Thumbnail or Unread Dot
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaThumbnail: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  chevron: {
    opacity: 0.35,
  },

  // ── Empty State ──
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    gap: 8,
  },
  emptyCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.text,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  resetPill: {
    marginTop: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  resetPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.text,
  },

  // ── Micro States ──
  pressedOpacity: {
    opacity: 0.6,
  },
  pressedScale: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
}));
