import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { clearBanner, useErrorState, type BannerItem, type BannerTone } from '@/features/errors/store';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON: Record<BannerTone, keyof typeof Ionicons.glyphMap> = {
  warning: 'cloud-offline-outline',
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
};

/**
 * A state that stays until it changes: offline, a degraded service, an account notice, and the green "back online"
 * that replaces them. Amber warns, blue informs, green says recovered. It never auto-dismisses; the close button only
 * appears when the state does not block anything (`dismissible`).
 */
export function Banner({ tone, title, message, actionLabel, onAction, onDismiss }: {
  tone: BannerTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fg = tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.info;
  const bg = tone === 'warning' ? colors.warningBg : tone === 'success' ? colors.successBg : colors.infoBg;
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: fg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name={ICON[tone]} size={20} color={fg} importantForAccessibility="no" />
      <View style={styles.body}>
        <Text style={[styles.title, { color: fg }]}>{title}</Text>
        {message ? <Text style={[styles.message, { color: fg }]}>{message}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={styles.action} hitSlop={8}>
          <Text style={[styles.actionText, { color: fg }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={18} color={fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Banners requested through the store, stacked at the top of the screen it is placed in. */
export function BannerHost() {
  const { banners } = useErrorState();
  if (!banners.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      {banners.map((b: BannerItem) => (
        <Banner
          key={b.key}
          tone={b.tone}
          title={b.title}
          message={b.message}
          actionLabel={b.actionLabel}
          onAction={b.onAction}
          onDismiss={b.dismissible ? () => clearBanner(b.key) : undefined}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.md, borderWidth: 1, paddingVertical: spacing.md, paddingLeft: spacing.lg, paddingRight: spacing.sm, minHeight: 52 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  message: { fontSize: fontSize.xs, lineHeight: 17 },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
