/**
 * Profile tab — Clean, modern Instagram-style profile layout with background cover picture.
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
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { KycBadge } from '@/features/kyc/KycBadge';
import { getKyc } from '@/features/kyc/api';
import {
  fetchProfile,
  updateCoverPicture,
  updateProfilePicture,
} from '@/features/profile/api';
import { pickFromLibrary } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

type ProfileTab = 'details' | 'settings' | 'account';

function roleLabel(type?: string) {
  if (!type) return null;
  if (type === 'User') return 'Guest Member';
  if (type === 'Coordinator' || type === 'event-coordinator') return 'Event Coordinator';
  return type;
}

function formatJoinedDate(iso?: string): string {
  if (!iso) return 'Recent';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();

  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const updateUser = useAuth((s) => s.updateUser);
  const { isCoordinator, isPhotographer, role: customerRole } = useRole();
  const isOwner = isCoordinator || isPhotographer;

  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('details');

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Connekyt User';
  const username = user?.email ? user.email.split('@')[0] : 'connekt';
  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const completion = user?.profileCompletionPercentage ?? null;
  const needsSetup = completion != null && completion < 100;
  const role = roleLabel(user?.customerType);
  const coverUri = user?.coverPicture;
  const kycStatus = user?.kycStatus;
  const isVerified = kycStatus === 'APPROVED';

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
      return [
        { label: 'Jobs', value: user?.completedEvents ?? 0 },
        { label: 'Reviews', value: user?.reviewsCount ?? 0 },
        { label: 'Rating', value: user?.rating != null ? user.rating.toFixed(1) : '5.0' },
        {
          label: 'Acceptance',
          value: typeof user?.acceptanceRate === 'number' ? `${user.acceptanceRate}%` : '—',
        },
      ];
    }
    if (isCoordinator) {
      return [
        { label: 'Events', value: user?.completedEvents ?? 0 },
        { label: 'Rating', value: user?.rating != null ? user.rating.toFixed(1) : '5.0' },
        { label: 'Status', value: 'Active' },
      ];
    }
    return [
      { label: 'Events', value: user?.completedEvents ?? 0 },
      { label: 'Reviews', value: user?.reviewsCount ?? 0 },
      { label: 'Status', value: 'Active' },
    ];
  }, [isPhotographer, isCoordinator, user]);

  const highlights = useMemo(
    () => [
      { key: 'wallet', icon: 'wallet-outline' as const, label: 'Wallet', href: '/(app)/(tabs)/wallet' as Href },
      { key: 'gallery', icon: 'images-outline' as const, label: 'Gallery', href: '/gallery' as Href },
      { key: 'tv', icon: 'tv-outline' as const, label: 'TV Screens', href: '/tv-devices' as Href },
      { key: 'analytics', icon: 'bar-chart-outline' as const, label: 'Analytics', href: '/analytics' as Href },
      ...(isOwner
        ? [{ key: 'team', icon: 'people-outline' as const, label: 'Team', href: '/team' as Href }]
        : []),
      { key: 'security', icon: 'lock-closed-outline' as const, label: 'Security', href: '/two-factor' as Href },
    ],
    [isOwner],
  );

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Background Profile Cover Photo ──────────────────────────── */}
        <View style={styles.coverWrap}>
          <View style={[styles.coverContainer, { height: topBarHeight + COVER_HEIGHT }]}>
            {coverUri ? (
              <Image
                key={coverUri}
                source={{ uri: coverUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <LinearGradient
                colors={['#0a1f44', '#083a85']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              style={styles.coverScrim}
            />

            {/* Change cover photo button */}
            <Pressable
              style={({ pressed }) => [styles.coverEditBtn, pressed && styles.pressed]}
              onPress={onChangeCover}
              disabled={coverUploading}
              hitSlop={8}
              accessibilityLabel="Change cover photo"
            >
              {coverUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={15} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Instagram Profile Header Row (Avatar + Stats) ───────────── */}
        <View style={styles.headerRow}>
          {/* Avatar with clean halo border cutting into the cover */}
          <Pressable
            onPress={onChangeAvatar}
            disabled={avatarUploading}
            style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
            accessibilityLabel="Change profile photo"
          >
            <View style={styles.avatarBorder}>
              {user?.profilePicture ? (
                <Image
                  source={{ uri: user.profilePicture }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.avatarBadge}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={11} color="#fff" />
              )}
            </View>
          </Pressable>

          {/* Clean Stats Counter Row (Right side of avatar) */}
          <View style={styles.statsContainer}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statCol}>
                <Text style={styles.statNumber}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Bio & Details Section (Instagram style) ─────────────────── */}
        <View style={styles.bioSection}>
          <View style={styles.nameRow}>
            <Text style={styles.fullName}>{fullName}</Text>
            {isVerified ? (
              <Ionicons name="checkmark-circle" size={16} color="#3897F0" />
            ) : null}
          </View>

          <Text style={styles.usernameHandle}>@{username}</Text>

          {role ? <Text style={styles.categoryText}>{role}</Text> : null}

          {user?.about ? (
            <Text style={styles.bioText} numberOfLines={3}>
              {user.about}
            </Text>
          ) : null}

          {user?.address ? (
            <View style={styles.locationLink}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {user.address}
              </Text>
            </View>
          ) : null}

          <Text style={styles.joinedText}>
            Member since {formatJoinedDate(user?.joinedFrom)}
          </Text>
        </View>

        {/* ── Action Buttons Row (Instagram style) ────────────────────── */}
        <View style={styles.actionButtonsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={() => router.push('/edit-profile' as Href)}
          >
            <Text style={styles.actionBtnText}>Edit profile</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={() => router.push('/(app)/(tabs)/wallet' as Href)}
          >
            <Text style={styles.actionBtnText}>Wallet</Text>
          </Pressable>

          {!isVerified ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnAccent,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push('/kyc' as Href)}
            >
              <Text style={styles.actionBtnAccentText}>
                {kycStatus === 'PENDING' ? 'KYC Pending' : 'Verify'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              onPress={() => router.push('/gallery' as Href)}
            >
              <Text style={styles.actionBtnText}>Gallery</Text>
            </Pressable>
          )}
        </View>

        {/* ── Setup Prompt (clean & non-intrusive) ─────────────────────── */}
        {needsSetup ? (
          <Pressable
            style={styles.setupBanner}
            onPress={() => router.push('/edit-profile' as Href)}
          >
            <View style={styles.setupBannerTextWrap}>
              <Text style={styles.setupBannerTitle}>Complete your profile</Text>
              <Text style={styles.setupBannerSub}>
                Your profile is {completion}% finished. Tap to add details.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* ── Story Highlights Row (Instagram circular shortcuts) ────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.highlightsScroll}
        >
          {highlights.map((h) => (
            <Pressable
              key={h.key}
              style={({ pressed }) => [styles.highlightItem, pressed && styles.pressed]}
              onPress={() => router.push(h.href)}
            >
              <View style={styles.highlightCircle}>
                <Ionicons name={h.icon} size={22} color={colors.text} />
              </View>
              <Text style={styles.highlightLabel} numberOfLines={1}>
                {h.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Instagram-Style Tab Switcher ────────────────────────────── */}
        <View style={styles.tabStrip}>
          <Pressable
            style={styles.tabButton}
            onPress={() => setActiveTab('details')}
          >
            <Ionicons
              name={activeTab === 'details' ? 'person' : 'person-outline'}
              size={20}
              color={activeTab === 'details' ? colors.text : colors.textMuted}
            />
            {activeTab === 'details' && <View style={styles.activeIndicator} />}
          </Pressable>

          <Pressable
            style={styles.tabButton}
            onPress={() => setActiveTab('settings')}
          >
            <Ionicons
              name={activeTab === 'settings' ? 'options' : 'options-outline'}
              size={20}
              color={activeTab === 'settings' ? colors.text : colors.textMuted}
            />
            {activeTab === 'settings' && <View style={styles.activeIndicator} />}
          </Pressable>

          <Pressable
            style={styles.tabButton}
            onPress={() => setActiveTab('account')}
          >
            <Ionicons
              name={activeTab === 'account' ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={20}
              color={activeTab === 'account' ? colors.text : colors.textMuted}
            />
            {activeTab === 'account' && <View style={styles.activeIndicator} />}
          </Pressable>
        </View>

        {/* ── Tab Content (Clean, minimalist list views) ──────────────── */}
        <View style={styles.tabContent}>
          {activeTab === 'details' && (
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue}>{fullName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Username</Text>
                <Text style={styles.detailValue}>@{username}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {user?.email || '—'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{user?.phone || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{user?.address || 'Rwanda'}</Text>
              </View>
              {isCoordinator && user?.organizationName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Organization</Text>
                  <Text style={styles.detailValue}>{user.organizationName}</Text>
                </View>
              ) : null}
              {isPhotographer && user?.specialty ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Specialty</Text>
                  <Text style={styles.detailValue}>{user.specialty}</Text>
                </View>
              ) : null}
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Account Type</Text>
                <Text style={styles.detailValue}>{role || 'Client'}</Text>
              </View>

              <Pressable
                style={styles.editDetailsFullBtn}
                onPress={() => router.push('/edit-profile' as Href)}
              >
                <Text style={styles.editDetailsFullBtnText}>Edit personal information</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'settings' && (
            <View style={styles.menuList}>
              <MenuRow
                icon="options-outline"
                label="Notification settings"
                hint="Push & email alerts"
                onPress={() => router.push('/preferences' as Href)}
              />
              <MenuRow
                icon="notifications-outline"
                label="Notifications history"
                hint="Recent activity"
                onPress={() => router.push('/notifications' as Href)}
              />
              <MenuRow
                icon="lock-closed-outline"
                label="Two-factor authentication"
                hint="Extra sign-in security"
                onPress={() => router.push('/two-factor' as Href)}
              />
              <MenuRow
                icon="tv-outline"
                label="Connected TV devices"
                hint="Pair a screen"
                onPress={() => router.push('/tv-devices' as Href)}
              />
              <MenuRow
                icon="ban-outline"
                label="Blocked accounts"
                onPress={() => router.push('/blocked-accounts' as Href)}
              />
              {isOwner && (
                <MenuRow
                  icon="people-circle-outline"
                  label="Team management"
                  hint="Members & permissions"
                  onPress={() => router.push('/team' as Href)}
                />
              )}
              <MenuRow
                icon="bar-chart-outline"
                label="Analytics dashboard"
                hint="Performance overview"
                last
                onPress={() => router.push('/analytics' as Href)}
              />
            </View>
          )}

          {activeTab === 'account' && (
            <View style={styles.menuList}>
              {/* KYC Status row */}
              <Pressable
                style={styles.menuItemRow}
                onPress={() => router.push('/kyc' as Href)}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                  <View>
                    <Text style={styles.menuItemLabel}>Identity verification</Text>
                    <Text style={styles.menuItemHint}>
                      {isVerified
                        ? 'KYC Verified'
                        : kycStatus === 'PENDING'
                        ? 'Under review'
                        : 'Action required'}
                    </Text>
                  </View>
                </View>
                <View style={styles.menuItemRight}>
                  {isVerified ? (
                    <KycBadge kycStatus="APPROVED" size="sm" />
                  ) : (
                    <Text style={styles.verifyActionLink}>
                      {kycStatus === 'PENDING' ? 'Pending' : 'Verify'}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </Pressable>

              <MenuRow
                icon="document-text-outline"
                label="Privacy policy"
                onPress={() => router.push('/privacy-policy' as Href)}
              />
              <MenuRow
                icon="reader-outline"
                label="Terms of service"
                onPress={() => router.push('/terms-of-service' as Href)}
              />

              {/* Sign out */}
              <Pressable style={styles.menuItemRow} onPress={() => logout()}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="log-out-outline" size={20} color={colors.error} />
                  <Text style={[styles.menuItemLabel, { color: colors.error }]}>Sign out</Text>
                </View>
              </Pressable>

              {/* Delete account */}
              <Pressable
                style={styles.deleteLinkRow}
                onPress={() => router.push('/delete-account' as Href)}
              >
                <Text style={styles.deleteLinkText}>Delete account</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
      <TopBar />
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItemRow,
        !last && styles.menuItemBorder,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={20} color={colors.text} />
        <View>
          <Text style={styles.menuItemLabel}>{label}</Text>
          {hint ? <Text style={styles.menuItemHint}>{hint}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const COVER_HEIGHT = 140;

const useStyles = makeStyles((c) => ({
  scroll: { paddingBottom: 110 },
  pressed: { opacity: 0.75 },

  // Background Profile Cover Photo
  coverWrap: {
    width: '100%',
  },
  coverContainer: {
    width: '100%',
    backgroundColor: c.primaryDark,
    overflow: 'hidden',
    position: 'relative',
  },
  coverScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  coverEditBtn: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 18, 23, 0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile Header Row (Avatar overlapping cover on left + stats on right)
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    position: 'relative',
  },
  avatarWrap: {
    marginTop: -42,
    position: 'relative',
  },
  avatarBorder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: c.background,
    overflow: 'hidden',
    backgroundColor: c.surfaceMuted,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: '#fff',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats Column (Aligned next to avatar)
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginLeft: spacing.md,
    paddingTop: 8,
  },
  statCol: {
    alignItems: 'center',
    gap: 1,
  },
  statNumber: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: c.text,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },

  // Bio Section
  bioSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
    letterSpacing: -0.1,
  },
  usernameHandle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  categoryText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    marginTop: 1,
  },
  bioText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.text,
    lineHeight: 18,
    marginTop: 3,
  },
  locationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  joinedText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    marginTop: 2,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: c.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  actionBtnAccent: {
    backgroundColor: c.tint,
    borderColor: c.primary,
  },
  actionBtnAccentText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.primary,
  },

  // Setup prompt banner
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  setupBannerTextWrap: { flex: 1, gap: 1 },
  setupBannerTitle: { fontFamily: fonts.bold, fontSize: 13, color: c.text },
  setupBannerSub: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },

  // Story Highlights
  highlightsScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 14,
  },
  highlightItem: {
    alignItems: 'center',
    gap: 4,
    width: 62,
  },
  highlightCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.text,
    textAlign: 'center',
  },

  // Instagram Tab Switcher
  tabStrip: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    height: 44,
    marginTop: spacing.xs,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: c.text,
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Details List (Instagram style)
  detailsList: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    gap: 12,
  },
  detailLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  editDetailsFullBtn: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  editDetailsFullBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.primary,
  },

  // Settings & Account List (Instagram style)
  menuList: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  menuItemHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  verifyActionLink: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
  deleteLinkRow: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLinkText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textDecorationLine: 'underline',
  },
}));
