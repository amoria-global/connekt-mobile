/**
 * The Home "Share & invite" card. The whole card opens the share sheet (the Share button is a label, not a second
 * target), and a row of chips says what is inside: Album, Profile and Referral. The badge at the right comes from the
 * referral stats: "Lower fees" before 5 qualifying referrals, "Your fee: N%" from 5, and at 20 the Referral chip and
 * the badge go away because the referral option is gone for good.
 */
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconTile } from '@/components/ui/IconTile';
import { chipColors, type ChipTone } from '@/components/ui/StatusChip';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { fill, useReferralStrings } from './referral';

export type CardStats = { qualifying: number; feePercent: number | null; complete: boolean } | null;

/** What the badge says: null when there is no badge (unknown stats, or the program is complete). */
export function badgeFor(stats: CardStats): { kind: 'lower' | 'fee'; fee: number | null } | null {
  if (!stats || stats.complete) return null;
  if (stats.feePercent == null || stats.qualifying < 5) return { kind: 'lower', fee: null };
  return { kind: 'fee', fee: stats.feePercent };
}

function Chip({ icon, label, tone }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; tone: ChipTone }) {
  const styles = useStyles();
  const { colors, gradients, isDark } = useTheme();
  const { fg, bg } = chipColors(colors, gradients, isDark, tone);
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: fg }]}>
      <Ionicons name={icon} size={12} color={fg} />
      <Text style={[styles.chipText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function ShareInviteCard({ stats, onPress }: { stats: CardStats; onPress: () => void }) {
  const s = useReferralStrings();
  const styles = useStyles();
  const { colors, gradients, isDark } = useTheme();
  const badge = badgeFor(stats);
  const showReferral = !stats?.complete;
  const badgeTone: ChipTone = badge?.kind === 'fee' ? 'success' : 'accent';
  const bc = chipColors(colors, gradients, isDark, badgeTone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={s.ui.cardTitle}
      testID="share-invite-card"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <IconTile icon="share-social-outline" tone="primary" size="lg" />
        <Text style={styles.title} numberOfLines={1}>{s.ui.cardTitle}</Text>
        <View style={styles.btn} pointerEvents="none">
          <Text style={styles.btnText}>{s.ui.shareTitle}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.text} />
        </View>
      </View>
      <View style={styles.chips}>
        <Chip icon="images-outline" label={s.ui.chipAlbum} tone="primary" />
        <Chip icon="person-circle-outline" label={s.ui.chipProfile} tone="primary" />
        {showReferral ? <Chip icon="gift-outline" label={s.ui.chipReferral} tone="accent" /> : null}
        <View style={styles.spacer} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: bc.bg, borderColor: bc.fg }]} testID="share-invite-badge">
            <Text style={[styles.badgeText, { color: bc.fg }]} numberOfLines={1}>
              {badge.kind === 'fee' ? fill(s.ui.badgeFee, { fee: badge.fee ?? 0 }) : s.ui.badgeLower}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.primary },
  pressed: { opacity: 0.88 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: '700', color: c.text },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: c.primary },
  btnText: { fontSize: 13, fontWeight: '700', color: c.text },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 11.5, fontWeight: '600' },
  spacer: { flexGrow: 1, flexBasis: 0 },
  badge: { height: 24, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, justifyContent: 'center', flexShrink: 1 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
}));
