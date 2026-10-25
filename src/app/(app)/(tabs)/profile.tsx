/**
 * Profile tab, Midnight Glass (design/profile.png): the person is the hero, the cover is soft light behind them,
 * the appearance switch sits in the title row, and every group is a glass panel.
 *
 * Earlier layout, kept for the record of what each piece does:
 *
 * Visual hierarchy:
 *   1. Full-bleed background cover picture with camera upload button
 *   2. Instagram profile header:
 *        - Left: Circular avatar overlapping cover with halo border & camera edit badge
 *        - Right: 3-4 column clean stats (Jobs/Events, Reviews, Rating, Acceptance)
 *   3. Bio & Details: Full name + verified checkmark badge, @username, category, bio, location
 *   4. Instagram action buttons row: [Edit profile], [Wallet], [Verify / Gallery]
 *   5. Highlights horizontal shortcuts: Wallet, Gallery, TV screens, Analytics, Team, Security
 *   6. Tab switcher (Personal Details, Settings, Account & Legal)
 *   7. Clean tab content (No loud/tacky gradients, pure minimalist typography)
 */
import { MatchingProfileCard } from '@/features/hybrid/MatchingProfile';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Screen } from '@/components/ui/Screen';
import { GhostButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { ActionTile } from '@/components/ui/Compact';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { HeaderHelpButton } from '@/components/help/HeaderHelpButton';
import { useRole } from '@/features/auth/role';
import { clientStats, coordinatorStats, photographerStats } from '@/features/profile/clientStats';
import { KycBadge } from '@/features/kyc/KycBadge';
import { getKyc } from '@/features/kyc/api';
import {
  fetchProfile,
  updateCoverPicture,
  updateProfilePicture,
} from '@/features/profile/api';
import { pickFromLibrary } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { useAppUpdates } from '@/features/updates';
import { LanguageSelectorSheet } from '@/components/LanguageSelectorSheet';
import { CurrencySelectorSheet } from '@/components/CurrencySelectorSheet';
import { SUPPORTED_LANGUAGES, useLanguage } from '@/store/language';
import { useSharedT } from '@/i18n/sharedStrings';
import { useCurrency } from '@/store/currency';
import { alpha, spacing, radii, fonts, makeStyles, tracking, useTheme } from '@/theme';
import { useTabBarClearance } from '@/hooks/useScrollClearance';

type ProfileTab = 'details' | 'settings' | 'account';

function roleLabel(type?: string) {
  if (!type) return null;
  if (type === 'Coordinator' || type === 'event-coordinator') return 'Event Coordinator';
  return type;
}

function formatJoinedDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useTabBarClearance();
  const router = useRouter();
  const { language, t } = useLanguage();
  const { tr } = useSharedT();
  const currency = useCurrency((s) => s.currency);
  const currencies = useCurrency((s) => s.currencies);
  const currentCurrency = currencies.find((c) => c.code === currency);

  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const updateUser = useAuth((s) => s.updateUser);
  const { isCoordinator, isPhotographer, role: customerRole } = useRole();

  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('details');
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);

  const currentLanguageInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Connekyt User';
  const username = user?.email ? user.email.split('@')[0] : 'connekt';
  const initials = `${user?.firstName?.[0] ?? user?.email?.[0] ?? '?'}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const completion = user?.profileCompletionPercentage ?? null;
  const needsSetup = completion != null && completion < 100;
  const role = roleLabel(user?.customerType);
  const coverUri = user?.coverPicture;
  const kycStatus = user?.kycStatus;
  const isVerified = kycStatus === 'APPROVED';
  const {
    updateReady,
    isChecking: isCheckingUpdate,
    isDownloading: isDownloadingUpdate,
    currentVersion,
    checkForUpdates,
    previewUpdateScreen,
  } = useAppUpdates();

  const handleCheckUpdate = async () => {
    const result = await checkForUpdates(true);
    if (!result.ready && !result.available) {
      Alert.alert(
        'Connekyt Updates',
        result.message || `You are using the latest version of Connekyt (v${currentVersion}).`,
        [
          { text: 'Review Update Screen', onPress: () => previewUpdateScreen(true) },
          { text: 'OK', style: 'cancel' },
        ],
      );
    }
  };

  // Sync profile & live KYC status whenever this tab is focused
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [profile, kyc] = await Promise.all([
            fetchProfile(customerRole),
            getKyc().catch(() => null),
          ]);
          if (cancelled) return;
          const patch: Parameters<typeof updateUser>[0] = {};
          if (profile.coverPicture) patch.coverPicture = profile.coverPicture;
          if (profile.profilePicture) patch.profilePicture = profile.profilePicture;
          if (profile.firstName != null) patch.firstName = profile.firstName;
          if (profile.lastName != null) patch.lastName = profile.lastName;
          if (profile.phone != null) patch.phone = profile.phone;
          if (profile.address != null) patch.address = profile.address;
          if (profile.profileCompletionPercentage != null) {
            patch.profileCompletionPercentage = profile.profileCompletionPercentage;
          }
          if (kyc?.status) {
            patch.kycStatus = kyc.status;
          } else if (profile.kycStatus) {
            patch.kycStatus = profile.kycStatus;
          }
          if (profile.rating != null) patch.rating = profile.rating;
          if (profile.completedEvents != null) patch.completedEvents = profile.completedEvents;
          if (profile.reviewsCount != null) patch.reviewsCount = profile.reviewsCount;
          if (profile.acceptanceRate != null) patch.acceptanceRate = profile.acceptanceRate;
          if (profile.organizationName != null) patch.organizationName = profile.organizationName;
          if (profile.specialty != null) patch.specialty = profile.specialty;
          if (profile.about != null) patch.about = profile.about;
          if (profile.joinedFrom != null) patch.joinedFrom = profile.joinedFrom;

          if (Object.keys(patch).length > 0) updateUser(patch);
        } catch {
          // Keep cached session
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [customerRole, updateUser]),
  );

  const onChangeCover = async () => {
    if (coverUploading) return;
    const img = await pickFromLibrary();
    if (!img) return;
    const previous = user?.coverPicture;
    updateUser({ coverPicture: img.uri });
    setCoverUploading(true);
    try {
      const url = await updateCoverPicture(img, customerRole);
      updateUser({ coverPicture: url });
    } catch (err) {
      updateUser({ coverPicture: previous });
      Alert.alert(
        'Cover photo',
        isApiError(err) ? err.message : 'Could not upload cover photo. Please try again.',
      );
    } finally {
      setCoverUploading(false);
    }
  };

  const onChangeAvatar = async () => {
    if (avatarUploading) return;
    const img = await pickFromLibrary();
    if (!img) return;
    const previous = user?.profilePicture;
    updateUser({ profilePicture: img.uri });
    setAvatarUploading(true);
    try {
      const url = await updateProfilePicture(img);
      updateUser({ profilePicture: url });
    } catch (err) {
      updateUser({ profilePicture: previous });
      Alert.alert(
        'Profile photo',
        isApiError(err) ? err.message : 'Could not upload photo. Please try again.',
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const stats = useMemo(() => {
    if (isPhotographer) {
      return photographerStats(user);
    }
    if (isCoordinator) {
      return coordinatorStats(user);
    }
    // Clients: a missing count is a dash, never a zero, and there is no invented "Active".
    return clientStats(user);
  }, [isPhotographer, isCoordinator, user]);

  const highlights = useMemo(
    () => [
      { key: 'wallet', icon: 'wallet-outline' as const, label: 'Wallet', href: '/(app)/(tabs)/wallet' as Href },
      { key: 'gallery', icon: 'images-outline' as const, label: 'Gallery', href: '/gallery' as Href },
      { key: 'tv', icon: 'tv-outline' as const, label: 'TV Screens', href: '/tv-devices' as Href },
      { key: 'analytics', icon: 'bar-chart-outline' as const, label: 'Analytics', href: '/analytics' as Href },
      ...(isPhotographer
        ? [{ key: 'collaborate', icon: 'people-outline' as const, label: 'Collaborate', href: '/collaborate' as Href }]
        : []),
      { key: 'security', icon: 'lock-closed-outline' as const, label: 'Security', href: '/two-factor' as Href },
    ],
    [isPhotographer],
  );

  const { isDark, setPreference, gradients } = useTheme();
  const { top } = useSafeAreaInsets();
  const specialties = (user?.specialty ?? '')
    .split(/[,/]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 2);
  const chips = [...(role && specialties.length === 0 ? [tr(role)] : []), ...specialties];

  const actionTiles: { key: string; icon: keyof typeof Ionicons.glyphMap; tone: ChipTone; label: string; onPress: () => void }[] = [
    { key: 'edit', icon: 'pencil-outline', tone: 'primary', label: t('editProfile'), onPress: () => router.push('/edit-profile' as Href) },
    { key: 'wallet', icon: 'wallet-outline', tone: 'pending', label: t('wallet'), onPress: () => router.push('/(app)/(tabs)/wallet' as Href) },
    isVerified
      ? { key: 'gallery', icon: 'images-outline', tone: 'active', label: t('gallery'), onPress: () => router.push('/gallery' as Href) }
      : {
          key: 'verify',
          icon: 'shield-checkmark-outline',
          tone: 'accent',
          label: kycStatus === 'PENDING' ? t('kycPending') : t('verify'),
          onPress: () => router.push('/kyc' as Href),
        },
  ];

  return (
    <Screen padded={false} edges={[]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: top + spacing.sm, paddingBottom: clearance }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title row: Help and the appearance switch (Midnight Glass is the default) ── */}
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              {tr('Profile')}
            </Text>
            <HeaderHelpButton />
            <Pressable
              onPress={() => setPreference(isDark ? 'light' : 'dark')}
              accessibilityRole="switch"
              accessibilityLabel={tr('Dark appearance')}
              accessibilityState={{ checked: isDark }}
              style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            >
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* ── Hero: the cover as soft light behind the avatar, the person front and centre ── */}
          <View style={styles.hero}>
            {coverUri ? (
              <Image key={coverUri} source={{ uri: coverUri }} style={styles.coverBackdrop} contentFit="cover" transition={200} />
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.coverEditBtn, pressed && styles.pressed]}
              onPress={onChangeCover}
              disabled={coverUploading}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Change cover photo"
            >
              {coverUploading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="image-outline" size={16} color={colors.text} />
              )}
            </Pressable>

            <Pressable
              onPress={onChangeAvatar}
              disabled={avatarUploading}
              style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              <LinearGradient colors={gradients.ring as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
                {user?.profilePicture ? (
                  <Image source={{ uri: user.profilePicture }} style={styles.avatar} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
              </LinearGradient>
              <View style={styles.avatarBadge}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Ionicons name="camera" size={12} color={colors.textOnPrimary} />
                )}
              </View>
            </Pressable>

            <View style={styles.nameRow}>
              <Text style={styles.fullName}>{fullName}</Text>
              {isVerified ? <Ionicons name="checkmark-circle" size={20} color={colors.primaryLight} accessibilityLabel="Verified" /> : null}
            </View>
            <Text style={styles.usernameHandle}>@{username}</Text>

            {chips.length > 0 || user?.address ? (
              <View style={styles.chipsRow}>
                {chips.map((ch) => (
                  <View key={ch} style={styles.chip}>
                    <Text style={styles.chipText}>{ch}</Text>
                  </View>
                ))}
                {user?.address ? (
                  <View style={styles.chip}>
                    <Ionicons name="location-outline" size={13} color={colors.textSoft} />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {user.address}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {user?.about || user?.joinedFrom ? (
              <Text style={styles.bioText} numberOfLines={4}>
                {user?.about ? `${user.about}${user.joinedFrom ? '\n' : ''}` : ''}
                {user?.joinedFrom ? t('memberSince', { date: formatJoinedDate(user.joinedFrom) }) : ''}
              </Text>
            ) : null}
          </View>

          {/* ── Action tiles: one job each, colour by meaning ── */}
          <View style={styles.tilesRow}>
            {actionTiles.map((a) => (
              <ActionTile key={a.key} stacked icon={a.icon} tone={a.tone} title={a.label} onPress={a.onPress} accessibilityLabel={a.label} />
            ))}
          </View>

          {/* ── Stats: numbers above labels ── */}
          {stats.length > 0 ? (
            <View style={styles.gutter}>
              <GlassCard style={styles.statsCard}>
                {stats.map((s, i) => (
                  <View key={s.label} style={[styles.statCol, i > 0 && styles.statDivider]} accessible accessibilityLabel={`${tr(s.label)}, ${s.value}`}>
                    <Text style={styles.statNumber}>{s.value}</Text>
                    <Text style={styles.statLabel} numberOfLines={2}>
                      {tr(s.label)}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            </View>
          ) : null}

          {/* ── Setup prompt ── */}
          {needsSetup ? (
            <Pressable
              style={({ pressed }) => [styles.gutter, pressed && styles.pressed]}
              onPress={() => router.push('/edit-profile' as Href)}
              accessibilityRole="button"
              accessibilityLabel={`${t('completeYourProfile')}. ${t('profileCompletionSub', { count: completion })}`}
            >
              <GlassCard style={styles.setupBanner}>
                <IconTile icon="sparkles-outline" tone="accent" size="sm" />
                <View style={styles.setupBannerTextWrap}>
                  <Text style={styles.setupBannerTitle}>{t('completeYourProfile')}</Text>
                  <Text style={styles.setupBannerSub}>{t('profileCompletionSub', { count: completion })}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, completion ?? 0))}%` }]} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </GlassCard>
            </Pressable>
          ) : null}

          {/* Instagram and base city, for Post My Event matching */}
          {isPhotographer ? (
            <View style={styles.gutter}>
              <MatchingProfileCard />
            </View>
          ) : null}

          {/* ── Shortcuts ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsScroll}>
            {highlights.map((h) => (
              <Pressable
                key={h.key}
                style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
                onPress={() => router.push(h.href)}
                hitSlop={{ top: 4, bottom: 4 }}
                accessibilityRole="button"
                accessibilityLabel={h.label}
              >
                <Ionicons name={h.icon} size={16} color={colors.link} />
                <Text style={styles.shortcutLabel} numberOfLines={1}>
                  {h.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── Details, Settings, Account ── */}
          <View style={styles.tabStrip} accessibilityRole="tablist">
            {(
              [
                ['details', 'Details', 'person'],
                ['settings', 'Settings', 'options'],
                ['account', 'Account', 'shield-checkmark'],
              ] as const
            ).map(([key, label, icon]) => {
              const on = activeTab === key;
              return (
                <Pressable
                  key={key}
                  style={styles.tabButton}
                  onPress={() => setActiveTab(key)}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={on ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)} size={20} color={on ? colors.text : colors.textMuted} />
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{tr(label)}</Text>
                  <View style={[styles.activeIndicator, on && styles.activeIndicatorOn]} />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'details' && (
              <GlassCard style={styles.listCard}>
                <DetailRow label={t('fullName')} value={fullName} />
                <DetailRow label={t('username')} value={`@${username}`} />
                <DetailRow label={t('email')} value={user?.email || '—'} />
                <DetailRow label={t('phone')} value={user?.phone || 'Not provided'} />
                <DetailRow label={t('location')} value={user?.address || 'Not provided'} />
                {isCoordinator && user?.organizationName ? <DetailRow label={t('organization')} value={user.organizationName} /> : null}
                {isPhotographer && user?.specialty ? <DetailRow label={t('specialty')} value={user.specialty} /> : null}
                <DetailRow label={t('accountType')} value={role || 'Client'} last />
                <View style={styles.listFooter}>
                  <GhostButton title={t('editPersonalInfo')} onPress={() => router.push('/edit-profile' as Href)} />
                </View>
              </GlassCard>
            )}

            {activeTab === 'settings' && (
              <GlassCard style={styles.listCard}>
                <MenuRow
                  icon="globe-outline"
                  label={t('languagePreference')}
                  hint={`${currentLanguageInfo.flagEmoji} ${currentLanguageInfo.nativeLabel}`}
                  onPress={() => setLanguageSheetOpen(true)}
                />
                <MenuRow
                  icon="cash-outline"
                  label={t('currencyPreference')}
                  hint={`${currency}${currentCurrency ? ` · ${currentCurrency.name}` : ''}`}
                  onPress={() => setCurrencySheetOpen(true)}
                />
                <MenuRow
                  icon={isDark ? 'moon-outline' : 'sunny-outline'}
                  label={tr('Appearance')}
                  hint={isDark ? tr('Midnight (dark)') : tr('Light')}
                  onPress={() => setPreference(isDark ? 'light' : 'dark')}
                />
                <MenuRow
                  icon="options-outline"
                  label={t('notificationSettings')}
                  hint={t('notificationSettingsHint')}
                  onPress={() => router.push('/preferences' as Href)}
                />
                <MenuRow
                  icon="notifications-outline"
                  label={t('notificationsHistory')}
                  hint={t('notificationsHistoryHint')}
                  onPress={() => router.push('/notifications' as Href)}
                />
                <MenuRow
                  icon="card-outline"
                  label={t('paymentAccounts')}
                  hint={t('paymentAccountsHint')}
                  onPress={() => router.push('/payment-accounts' as Href)}
                />
                <MenuRow
                  icon="lock-closed-outline"
                  label={t('twoFactorAuth')}
                  hint={t('twoFactorAuthHint')}
                  onPress={() => router.push('/two-factor' as Href)}
                />
                <MenuRow
                  icon="tv-outline"
                  label={t('connectedTvDevices')}
                  hint={t('connectedTvDevicesHint')}
                  onPress={() => router.push('/tv-devices' as Href)}
                />
                <MenuRow icon="ban-outline" label={t('blockedAccounts')} onPress={() => router.push('/blocked-accounts' as Href)} />
                {isPhotographer && (
                  <MenuRow
                    icon="people-circle-outline"
                    label={t('menuCollaborate')}
                    hint={t('collaborateHint')}
                    onPress={() => router.push('/collaborate' as Href)}
                  />
                )}
                <MenuRow
                  icon="bar-chart-outline"
                  label={t('analyticsDashboard')}
                  hint={t('analyticsDashboardHint')}
                  last
                  onPress={() => router.push('/analytics' as Href)}
                />
              </GlassCard>
            )}

            {activeTab === 'account' && (
              <GlassCard style={styles.listCard}>
                <MenuRow
                  icon="shield-checkmark-outline"
                  label={t('identityVerification')}
                  hint={isVerified ? t('kycApproved') : kycStatus === 'PENDING' ? t('kycPending') : 'Action required'}
                  onPress={() => router.push('/kyc' as Href)}
                  right={
                    isVerified ? (
                      <KycBadge kycStatus="APPROVED" size="sm" />
                    ) : (
                      <Text style={styles.verifyActionLink}>{kycStatus === 'PENDING' ? t('kycPending') : t('verify')}</Text>
                    )
                  }
                />
                <MenuRow
                  icon="cloud-download-outline"
                  label={t('appUpdate')}
                  hint={
                    updateReady
                      ? 'Update ready · Tap to restart'
                      : isCheckingUpdate
                        ? 'Checking for updates…'
                        : isDownloadingUpdate
                          ? 'Downloading update…'
                          : `v${currentVersion} · Up to date`
                  }
                  onPress={handleCheckUpdate}
                  onLongPress={() => previewUpdateScreen(true)}
                  disabled={isCheckingUpdate || isDownloadingUpdate}
                  right={
                    updateReady ? (
                      <StatusChip label="Restart" tone="active" />
                    ) : isCheckingUpdate || isDownloadingUpdate ? (
                      <ActivityIndicator size="small" color={colors.primaryLight} />
                    ) : (
                      <Text style={styles.verifyActionLink}>Check</Text>
                    )
                  }
                />
                <MenuRow icon="document-text-outline" label={t('privacyPolicy')} onPress={() => router.push('/privacy-policy' as Href)} />
                <MenuRow icon="reader-outline" label={t('termsOfService')} onPress={() => router.push('/terms-of-service' as Href)} />
                <MenuRow icon="log-out-outline" label={t('menuSignOut')} danger last onPress={() => logout()} />
              </GlassCard>
            )}
            {activeTab === 'account' ? (
              <Pressable
                style={styles.deleteLinkRow}
                onPress={() => router.push('/delete-account' as Href)}
                accessibilityRole="button"
              >
                <Text style={styles.deleteLinkText}>{t('deleteAccount')}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      <LanguageSelectorSheet visible={languageSheetOpen} onClose={() => setLanguageSheetOpen(false)} />
      <CurrencySelectorSheet visible={currencySheetOpen} onClose={() => setCurrencySheetOpen(false)} />
    </Screen>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.detailRow, !last && styles.rowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={4}>
        {value}
      </Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  onPress,
  onLongPress,
  disabled,
  right,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  right?: ReactNode;
  danger?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItemRow, !last && styles.rowBorder, pressed && styles.pressed]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
    >
      <IconTile icon={icon} tone={danger ? 'error' : 'neutral'} size="sm" />
      <View style={styles.menuItemText}>
        <Text style={[styles.menuItemLabel, danger && { color: colors.error }]}>{label}</Text>
        {hint ? <Text style={styles.menuItemHint}>{hint}</Text> : null}
      </View>
      {right}
      {danger ? null : <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { gap: spacing.lg },
  pressed: { opacity: 0.85 },
  gutter: { marginHorizontal: spacing.lg },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  title: { flex: 1, color: c.text, fontSize: 28, fontFamily: fonts.display, letterSpacing: tracking(28, -0.03) },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: { alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  coverBackdrop: { position: 'absolute', top: 0, left: spacing.lg, right: spacing.lg, height: 120, borderRadius: radii.xl, opacity: 0.35 },
  coverEditBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.lg + spacing.sm,
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarWrap: { marginTop: spacing.xl, marginBottom: spacing.xs },
  avatarRing: { width: 88, height: 88, borderRadius: radii.full, padding: 3 },
  avatar: { width: '100%', height: '100%', borderRadius: radii.full, borderWidth: 3, borderColor: c.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
  avatarText: { fontFamily: fonts.display, fontSize: 28, color: c.text },
  avatarBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fullName: { fontFamily: fonts.display, fontSize: 26, color: c.text, letterSpacing: tracking(26, -0.025), textAlign: 'center' },
  usernameHandle: { fontFamily: fonts.regular, fontSize: 15, color: c.textMuted },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 220,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: c.textSoft, flexShrink: 1 },
  bioText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: c.textSoft, textAlign: 'center', marginTop: spacing.xs, maxWidth: 340 },

  tilesRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  tileWrap: { flex: 1 },
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm, borderRadius: radii.lg, minHeight: 96 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 14, color: c.text, textAlign: 'center' },

  statsCard: { flexDirection: 'row', borderRadius: radii.lg, paddingVertical: spacing.md },
  statCol: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs },
  statDivider: { borderLeftWidth: 1, borderLeftColor: c.stroke },
  statNumber: { fontFamily: fonts.display, fontSize: 22, color: c.text },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, textAlign: 'center' },

  setupBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg },
  setupBannerTextWrap: { flex: 1, gap: 4 },
  setupBannerTitle: { fontFamily: fonts.display, fontSize: 16, color: c.text },
  setupBannerSub: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: c.well, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },

  highlightsScroll: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radii.full, borderWidth: 1, backgroundColor: alpha(c.primary, 0.16), borderColor: alpha(c.primaryLight, 0.55) },
  shortcutPressed: { transform: [{ scale: 0.97 }], borderColor: alpha(c.primaryLight, 0.8) },
  shortcutLabel: { fontFamily: fonts.semibold, fontSize: 13, color: c.link },

  tabStrip: { flexDirection: 'row', marginHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.stroke },
  tabButton: { flex: 1, alignItems: 'center', gap: 4, paddingTop: spacing.sm, minHeight: 56 },
  tabText: { fontFamily: fonts.medium, fontSize: 13, color: c.textMuted },
  tabTextOn: { color: c.text, fontFamily: fonts.semibold },
  activeIndicator: { marginTop: 'auto', height: 2, alignSelf: 'stretch', marginHorizontal: spacing.xl, borderRadius: 1, backgroundColor: 'transparent' },
  activeIndicatorOn: { backgroundColor: c.primaryLight },

  tabContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  listCard: { borderRadius: radii.lg, paddingHorizontal: spacing.lg },
  listFooter: { paddingVertical: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.stroke },
  detailRow: { paddingVertical: spacing.md, gap: 2 },
  detailLabel: { fontFamily: fonts.medium, fontSize: 12, color: c.textMuted, letterSpacing: 0.3 },
  detailValue: { fontFamily: fonts.regular, fontSize: 15, color: c.text },
  menuItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 60 },
  menuItemText: { flex: 1, minWidth: 0, gap: 2 },
  menuItemLabel: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
  menuItemHint: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted },
  verifyActionLink: { fontFamily: fonts.semibold, fontSize: 14, color: c.link },
  deleteLinkRow: { alignItems: 'center', paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center' },
  deleteLinkText: { fontFamily: fonts.medium, fontSize: 14, color: c.error },
}));
