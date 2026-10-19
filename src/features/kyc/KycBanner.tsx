import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useRole } from '@/features/auth/role';
import { getKyc } from './api';
import { getKycBannerConfig } from './bannerConfig';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

export { getKycBannerConfig, type KycBannerConfig } from './bannerConfig';

export type KycBannerProps = {
  style?: StyleProp<ViewStyle>;
  /**
   * One slim row (icon, title, action, close) instead of the full card, so a reminder does not take a third of
   * the first screen. The whole row still opens the KYC flow and the accessibility label still carries the detail.
   */
  compact?: boolean;
};

/**
 * Top banner that prompts the user to verify their identity.
 *
 * For Clients, Coordinators, and Users, identity verification is optional,
 * so the banner displays an explicit "Optional" badge. For Photographers,
 * it displays "Recommended" (since payouts require KYC).
 *
 * Tapping the banner navigates to `/kyc`. Users can dismiss the banner
 * for their current session using the close icon in the top corner.
 */
export function KycBanner({ style, compact }: KycBannerProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { role } = useRole();
  const [dismissed, setDismissed] = useState(false);

  const { data, loading, refresh } = useAsync(useCallback(() => getKyc(), []));

  // Re-read status on return from the KYC screen or web flow
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (dismissed) return null;
  if (!data && loading) return null;

  const cfg = getKycBannerConfig(data?.status, role, colors);
  if (!cfg.visible) return null;

  return (
    <View style={[styles.card, { borderColor: cfg.accent + '35' }, style]}>
      <Pressable
        style={({ pressed }) => [styles.mainArea, pressed && styles.pressed]}
        onPress={() => router.push('/kyc')}
        accessibilityRole="button"
        accessibilityLabel={`${cfg.title} (${cfg.badge}). ${cfg.detail}`}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.tint }]}>
            <Ionicons name={cfg.icon} size={24} color={cfg.accent} />
          </View>

          <View style={styles.titleWrap}>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.title}>{cfg.title}</Text>
              {compact ? null : (
                <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
                  <Text style={[styles.badgeText, { color: cfg.badgeColor }]}>{cfg.badge}</Text>
                </View>
              )}
            </View>
            {compact ? null : <Text style={styles.subtitleCategory}>{t('identityVerification')}</Text>}
          </View>

          {compact ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                router.push('/kyc');
              }}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: cfg.accent }, pressed && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${cfg.buttonText} identity verification`}
            >
              <Text style={styles.actionText}>{cfg.buttonText}</Text>
            </Pressable>
          ) : null}

          <Pressable
            hitSlop={14}
            onPress={(e) => {
              e.stopPropagation?.();
              setDismissed(true);
            }}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('dismissVerificationBanner')}
          >
            <Ionicons name="close" size={17} color={colors.textMuted} />
          </Pressable>
        </View>

        {compact ? null : (
          <Text style={styles.detail} numberOfLines={3}>
            {cfg.detail}
          </Text>
        )}

        {compact ? null : (
        <View style={styles.bottomRow}>
          <View style={styles.securityPill}>
            <Ionicons name="shield-checkmark" size={13} color={colors.textMuted} />
            <Text style={styles.securityText}>{t('kycOfficialEncrypted')}</Text>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              router.push('/kyc');
            }}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: cfg.accent }, pressed && styles.actionBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${cfg.buttonText} identity verification`}
          >
            <Text style={styles.actionText}>{cfg.buttonText}</Text>
            <Ionicons name="arrow-forward" size={13} color="#fff" />
          </Pressable>
        </View>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  card: {
    backgroundColor: c.card,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    padding: spacing.lg + 2,
    ...e(2),
  },
  mainArea: {
    gap: spacing.sm + 4,
  },
  pressed: {
    opacity: 0.92,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  subtitleCategory: {
    fontFamily: fonts.regular,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  detail: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: c.textMuted,
    lineHeight: 19,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    gap: spacing.sm,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  securityText: {
    fontFamily: fonts.regular,
    fontWeight: fontWeight.medium,
    fontSize: 11.5,
    color: c.textMuted,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  actionBtnPressed: {
    opacity: 0.82,
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#fff',
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
}));
