import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import {
  listConversations,
  listChatContacts,
  markConversationRead,
  type Conversation,
  type ChatContact,
} from '@/features/inbox/api';
import { ConversationRow, conversationLabel } from '@/features/inbox/ConversationRow';
import { useRole } from '@/features/auth/role';
import { useModeration } from '@/features/moderation/useModeration';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { SkeletonCard } from '@/features/photographer/kit';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { glassTile } from '@/components/ui/GlassCard';

type FilterType = 'ALL' | 'CREATORS' | 'UNREAD';
type SortType = 'recent' | 'unread' | 'name' | 'oldest';

const SORT_OPTIONS: { key: SortType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'recent', label: 'Most Recent', icon: 'time-outline' },
  { key: 'unread', label: 'Unread First', icon: 'mail-unread-outline' },
  { key: 'name', label: 'Name (A to Z)', icon: 'text-outline' },
  { key: 'oldest', label: 'Oldest First', icon: 'hourglass-outline' },
];

export default function InboxScreen() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const { colors } = useTheme();
  const styles = useStyles();
  const user = useAuth((s) => s.user);

  const { data, loading, error, refresh } = useAsync(useCallback(() => listConversations(), []));
  const { isClient } = useRole();

  // Focus effect: re-fetch conversations whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Background polling: keep inbox in sync with web every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  const blockedIds = useModeration((s) => s.blockedIds);
  const loadModeration = useModeration((s) => s.load);

  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  // Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [sortKey, setSortKey] = useState<SortType>('recent');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [clearedUnreadIds, setClearedUnreadIds] = useState<Set<string>>(new Set());

  // New Message Modal State
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactScope, setContactScope] = useState<'ALL' | 'BOOKED'>('ALL');

  // Base list of live conversations from API
  const baseConversations: Conversation[] = useMemo(() => {
    if (data && data.length > 0) {
      return data
        .filter((c) => !blockedIds.has(c.partnerId))
        .map((c) => (clearedUnreadIds.has(c.id) ? { ...c, unreadCount: 0 } : c));
    }
    return [];
  }, [data, blockedIds, clearedUnreadIds]);

  // Load Contacts for New Message modal & stories tray
  const loadContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const items = await listChatContacts(user?.customerType);
      setContacts(items);
    } catch {
      setContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  }, [user?.customerType]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  // Filter contacts inside New Message modal
  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (contactScope === 'BOOKED') {
      list = list.filter((c) => c.isBooked);
    }
    const q = contactSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.category && c.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contacts, contactScope, contactSearchQuery]);

  const existingChatIds = useMemo(
    () => new Set(baseConversations.map((c) => c.partnerId || c.id)),
    [baseConversations]
  );

  const handleSelectContact = (contact: ChatContact) => {
    setShowNewMessageModal(false);
    setContactSearchQuery('');
    router.push(`/conversation/${contact.id}?name=${encodeURIComponent(contact.name)}`);
  };

  // Dynamic Counts
  const totalCount = baseConversations.length;
  const unreadCount = useMemo(
    () => baseConversations.reduce((sum, c) => sum + (c.unreadCount > 0 ? 1 : 0), 0),
    [baseConversations]
  );

  // Mark all as read handler
  const handleMarkAllRead = useCallback(async () => {
    const unreadItems = baseConversations.filter((c) => c.unreadCount > 0);
    setClearedUnreadIds((prev) => {
      const next = new Set(prev);
      unreadItems.forEach((c) => next.add(c.id));
      return next;
    });
    for (const item of unreadItems) {
      markConversationRead(item.partnerId).catch(() => {});
    }
  }, [baseConversations]);

  // Filtered & Sorted items
  const displayConversations = useMemo(() => {
    let list = [...baseConversations];

    // 1. Text Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      );
    }

    // 2. Filter Pills
    if (activeFilter === 'UNREAD') {
      list = list.filter((c) => c.unreadCount > 0);
    } else if (activeFilter === 'CREATORS') {
      list = list.filter((c) =>
        /studio|media|visuals|photo|lens|arts/i.test(c.name)
      );
    }

    // 3. Sorting
    return list.sort((a, b) => {
      if (sortKey === 'unread') {
        if ((b.unreadCount > 0) !== (a.unreadCount > 0)) {
          return (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0);
        }
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      }
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortKey === 'oldest') {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      }
      // 'recent' (default)
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [baseConversations, searchQuery, activeFilter, sortKey]);

  const activeSortOption = useMemo(
    () => SORT_OPTIONS.find((s) => s.key === sortKey) ?? SORT_OPTIONS[0],
    [sortKey]
  );

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <View style={styles.instagramHeader}>
        <Text style={styles.headerTitleText}>{t('inbox')}</Text>

        <View style={styles.headerIconsRow}>
          {unreadCount > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              onPress={handleMarkAllRead}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('markAllAsRead')}
            >
              <Ionicons name="checkmark-done" size={20} color={colors.primary} />
            </Pressable>
          ) : null}

          {/* Sort / Filter Options */}
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={() => setSortModalVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('filterAndSort')}
          >
            <Ionicons name="options-outline" size={22} color={colors.text} />
          </Pressable>

          {/* Instagram Compose / New Message Icon */}
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={() => {
              setShowNewMessageModal(true);
              void loadContacts();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('newMessage')}
          >
            <Ionicons name="create-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* ── Instagram Direct Search Pill ────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Category Tabs ─────────────────────────────────────────── */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabItem, activeFilter === 'ALL' && styles.tabItemActive]}
          onPress={() => setActiveFilter('ALL')}
        >
          <Text style={[styles.tabLabel, activeFilter === 'ALL' && styles.tabLabelActive]}>
            {t('primary')} {totalCount > 0 ? `(${totalCount})` : ''}
          </Text>
          {activeFilter === 'ALL' ? <View style={styles.activeTabIndicator} /> : null}
        </Pressable>

        <Pressable
          style={[styles.tabItem, activeFilter === 'CREATORS' && styles.tabItemActive]}
          onPress={() => setActiveFilter('CREATORS')}
        >
          <Text style={[styles.tabLabel, activeFilter === 'CREATORS' && styles.tabLabelActive]}>
            {t('general')}
          </Text>
          {activeFilter === 'CREATORS' ? <View style={styles.activeTabIndicator} /> : null}
        </Pressable>

        <Pressable
          style={[styles.tabItem, activeFilter === 'UNREAD' && styles.tabItemActive]}
          onPress={() => setActiveFilter('UNREAD')}
        >
          <View style={styles.tabWithBadge}>
            <Text style={[styles.tabLabel, activeFilter === 'UNREAD' && styles.tabLabelActive]}>
              {t('unread')}
            </Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadCountChip}>
                <Text style={styles.unreadCountChipText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
          {activeFilter === 'UNREAD' ? <View style={styles.activeTabIndicator} /> : null}
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <FlatList
        data={displayConversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/conversation/${item.id}?name=${encodeURIComponent(item.name)}`)
            }
            accessibilityRole="button"
            accessibilityLabel={conversationLabel(item)}
            style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressableActive]}
          >
            <ConversationRow conversation={item} accent={isClient} />
          </Pressable>
        )}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: topBarHeight + spacing.xs,
            paddingBottom: spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.primary}
            progressViewOffset={topBarHeight}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.sm, padding: spacing.lg }} accessibilityLabel="Loading">
              <SkeletonCard height={72} />
              <SkeletonCard height={72} />
              <SkeletonCard height={72} />
            </View>
          ) : error && !data ? (
            // A failed read is not an empty inbox.
            <View style={styles.emptyKit}>
              <ErrorState title="Could not load your messages" message={error} onRetry={refresh} />
            </View>
          ) : (
            <View style={styles.emptyKit}>
              {searchQuery.trim().length > 0 || activeFilter !== 'ALL' ? (
                <EmptyState
                  icon="search-outline"
                  title={searchQuery.trim().length > 0 ? t('noMatchingMessages') : t('yourMessages')}
                  message={searchQuery.trim().length > 0 ? t('noConversationsMatch', { query: searchQuery.trim() }) : t('noConversationsCategory')}
                  action={{
                    label: t('viewAllMessages'),
                    onPress: () => {
                      setSearchQuery('');
                      setActiveFilter('ALL');
                    },
                  }}
                />
              ) : (
                <EmptyState
                  icon="paper-plane-outline"
                  title={t('yourMessages')}
                  message={t('privateMessagesBlurb')}
                  action={{
                    label: t('sendMessage'),
                    raised: true,
                    onPress: () => {
                      setShowNewMessageModal(true);
                      void loadContacts();
                    },
                  }}
                />
              )}
            </View>
          )
        }
      />

      {/* ── Instagram Direct New Message Sheet ──────────────────────── */}
      <Modal
        visible={showNewMessageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewMessageModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <GlassScrim
          style={styles.modalBackdrop}
          onPress={() => setShowNewMessageModal(false)}
        >
          <GlassSheetHost style={styles.newMsgSheet}>
            <View style={styles.modalHandle} />

            {/* Instagram New Message Header */}
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setShowNewMessageModal(false)}
                hitSlop={8}
                style={styles.headerTextBtn}
              >
                <Text style={styles.headerCancelText}>{t('cancel')}</Text>
              </Pressable>

              <Text style={styles.modalTitle}>{t('newMessage')}</Text>

              <View style={styles.headerTextBtn}>
                <Text style={styles.headerPlaceholderText}> </Text>
              </View>
            </View>

            {/* "To: Search" Input */}
            <View style={styles.toSearchRow}>
              <Text style={styles.toLabel}>{t('toLabel')}</Text>
              <TextInput
                style={styles.toInput}
                placeholder={t('searchCreatorsPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={contactSearchQuery}
                onChangeText={setContactSearchQuery}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
              {contactSearchQuery.length > 0 ? (
                <Pressable onPress={() => setContactSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Scope Selector: All vs Booked Creators */}
            <View style={styles.scopeTabRow}>
              <Pressable
                style={[styles.scopeTab, contactScope === 'ALL' && styles.scopeTabActive]}
                onPress={() => setContactScope('ALL')}
              >
                <Text
                  style={[
                    styles.scopeTabText,
                    contactScope === 'ALL' && styles.scopeTabTextActive,
                  ]}
                >
                  {t('allCreators')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.scopeTab, contactScope === 'BOOKED' && styles.scopeTabActive]}
                onPress={() => setContactScope('BOOKED')}
              >
                <Text
                  style={[
                    styles.scopeTabText,
                    contactScope === 'BOOKED' && styles.scopeTabTextActive,
                  ]}
                >
                  {t('bookedPhotographers')}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.suggestedSectionHeader}>{t('suggested')}</Text>

            {/* Contacts List */}
            <View style={styles.contactListContainer}>
              {isLoadingContacts ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>{t('loadingCreators')}</Text>
                </View>
              ) : filteredContacts.length === 0 ? (
                <View style={styles.emptyContactsBox}>
                  <Ionicons name="people-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyContactsTitle}>{t('noCreatorsFound')}</Text>
                  <Text style={styles.emptyContactsSub}>
                    {t('trySearchingAnother')}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredContacts}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: spacing.lg }}
                  renderItem={({ item }) => {
                    const initials = (item.name?.[0] ?? '?').toUpperCase();
                    const hasChat = existingChatIds.has(item.id);

                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.contactRow,
                          pressed && styles.contactRowPressed,
                        ]}
                        onPress={() => handleSelectContact(item)}
                      >
                        {/* Avatar */}
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} style={styles.contactAvatar} />
                        ) : (
                          <View style={styles.contactAvatarFallback}>
                            <Text style={styles.contactAvatarText}>{initials}</Text>
                          </View>
                        )}

                        {/* Details */}
                        <View style={styles.contactInfo}>
                          <View style={styles.contactNameRow}>
                            <Text style={styles.contactName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.isVerified ? (
                              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                            ) : null}
                          </View>
                          <Text style={styles.contactCategory} numberOfLines={1}>
                            {item.category || 'Creator & Photographer'}
                          </Text>
                        </View>

                        {/* Trailing */}
                        <View style={styles.contactTrailing}>
                          {hasChat ? (
                            <View style={styles.activeChatBadge}>
                              <Text style={styles.activeChatBadgeText}>{t('chat')}</Text>
                            </View>
                          ) : null}
                          <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                        </View>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>
          </GlassSheetHost>
        </GlassScrim>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Sort Options Modal Sheet ────────────────────────────────── */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <GlassScrim
          style={styles.modalBackdrop}
          onPress={() => setSortModalVisible(false)}
        >
          <GlassSheetHost style={styles.sortModalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('sortAndFilter')}</Text>
              <Pressable
                onPress={() => setSortModalVisible(false)}
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.sortOptionsList}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortKey === opt.key;
                const optLabel =
                  opt.key === 'recent'
                    ? t('mostRecent')
                    : opt.key === 'unread'
                    ? t('unreadFirst')
                    : opt.key === 'name'
                    ? t('nameAtoZ')
                    : t('oldestFirst');
                return (
                  <Pressable
                    key={opt.key}
                    style={({ pressed }) => [
                      styles.sortOptionRow,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => {
                      setSortKey(opt.key);
                      setSortModalVisible(false);
                    }}
                  >
                    <View style={styles.sortOptionLeft}>
                      <Ionicons
                        name={opt.icon}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.sortOptionLabel,
                          isSelected && styles.sortOptionLabelActive,
                        ]}
                      >
                        {optLabel}
                      </Text>
                    </View>

                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={19} color={colors.primary} />
                    ) : (
                      <View style={styles.radioUnchecked} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </GlassSheetHost>
        </GlassScrim>
      </Modal>

      {/* Floating Translucent TopBar */}
      <TopBar />
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  emptyKit: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  listContent: {
    paddingHorizontal: 0,
    flexGrow: 1,
  },
  headerWrap: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },

  // Instagram Header Row
  instagramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  headerTitleText: {
    fontFamily: fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.4,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Instagram Search Pill
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.text,
    paddingVertical: 0,
  },

  // Instagram Direct Tabs Row
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    gap: 20,
  },
  tabItem: {
    paddingVertical: 10,
    position: 'relative',
    alignItems: 'center',
  },
  tabItemActive: {},
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: c.text,
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: c.text,
    borderRadius: 1,
  },
  unreadCountChip: {
    backgroundColor: c.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  unreadCountChipText: {
    color: c.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Flat Row Pressable
  rowPressable: {
    backgroundColor: 'transparent',
  },
  rowPressableActive: {
    backgroundColor: c.surfaceMuted,
  },

  // Instagram Direct Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: c.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 270,
  },
  emptyActionBtn: {
    marginTop: spacing.md,
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    backgroundColor: c.primary,
  },
  emptyActionBtnText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13,
    color: c.textOnPrimary,
  },

  // Modals & Sheets
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  newMsgSheet: {
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.lg,
    paddingHorizontal: spacing.lg,
    height: '85%',
    gap: spacing.sm,
  },
  sortModalSheet: {
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  headerTextBtn: {
    minWidth: 50,
  },
  headerCancelText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.text,
  },
  headerPlaceholderText: {
    width: 50,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...glassTile(c),
  },

  // "To:" Search Row
  toSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    paddingVertical: 10,
    gap: 8,
  },
  toLabel: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 15,
    color: c.text,
  },
  toInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.text,
    paddingVertical: 0,
  },

  // Scope Tabs inside New Message modal
  scopeTabRow: {
    flexDirection: 'row',
    ...glassTile(c),
    borderRadius: radii.lg,
    padding: 3,
    gap: 4,
    marginTop: spacing.xs,
  },
  scopeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  scopeTabActive: {
    ...glassTile(c),
    ...e(1),
  },
  scopeTabText: {
    fontFamily: fonts.regular,
    fontWeight: '600',
    fontSize: 12,
    color: c.textMuted,
  },
  scopeTabTextActive: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: c.text,
  },

  suggestedSectionHeader: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13,
    color: c.text,
    marginTop: spacing.sm,
    letterSpacing: -0.1,
  },

  // Contacts List
  contactListContainer: {
    flex: 1,
    marginTop: spacing.xs,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  emptyContactsBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  emptyContactsTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
    marginTop: spacing.xs,
  },
  emptyContactsSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
  },
  contactRowPressed: {
    ...glassTile(c),
    borderRadius: radii.md,
  },
  contactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    ...glassTile(c),
  },
  contactAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    color: c.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactName: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    fontWeight: '600',
    color: c.text,
  },
  contactCategory: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  contactTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeChatBadge: {
    backgroundColor: c.primary + '15',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.full,
  },
  activeChatBadgeText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 12,
    color: c.primary,
  },

  // Sort Options
  sortOptionsList: {
    gap: 2,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sortOptionLabel: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: c.text,
  },
  sortOptionLabelActive: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: c.primary,
  },
  radioUnchecked: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
}));
