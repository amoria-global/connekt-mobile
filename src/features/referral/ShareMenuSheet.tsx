/**
 * The Home "Share" menu as a bottom sheet: Share your album (the existing album flow), Share profile (today's action,
 * unchanged) and Share referral link or code (hidden for good once the photographer has 20 qualifying referrals).
 */
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '@/components/ui/Sheet';
import { IconTile } from '@/components/ui/IconTile';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { useReferralStrings } from './referral';

type Item = { key: 'album' | 'profile' | 'referral'; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub: string; tone: 'primary' | 'accent' | 'success' };

export function ShareMenuSheet({
  visible,
  onClose,
  onAlbum,
  onProfile,
  onReferral,
  referralHidden,
  canAlbum,
  profileUrl,
  qualifying,
}: {
  visible: boolean;
  onClose: () => void;
  onAlbum: () => void;
  onProfile: () => void;
  onReferral: () => void;
  referralHidden: boolean;
  canAlbum: boolean;
  /** The public profile link, shown under Share profile (the Home card no longer carries it). */
  profileUrl: string;
  /** Qualifying referrals for the progress chip: n/5 before 5, then n/20. Null while unknown. */
  qualifying: number | null;
}) {
  const s = useReferralStrings();
  const styles = useStyles();
  const { colors } = useTheme();
  const items: Item[] = [
    ...(canAlbum ? [{ key: 'album' as const, icon: 'images-outline' as const, label: s.ui.menuAlbum, sub: s.ui.subAlbum, tone: 'primary' as const }] : []),
    { key: 'profile', icon: 'person-circle-outline', label: s.ui.menuProfile, sub: profileUrl.replace(/^https?:\/\//, ''), tone: 'primary' },
    ...(referralHidden ? [] : [{ key: 'referral' as const, icon: 'gift-outline' as const, label: s.ui.menuReferral, sub: s.ui.subReferral, tone: 'accent' as const }]),
  ];
  const run = (k: Item['key']) => {
    onClose();
    if (k === 'album') onAlbum();
    else if (k === 'profile') onProfile();
    else onReferral();
  };
  return (
    <Sheet visible={visible} title={s.ui.cardTitle} onClose={onClose}>
      <View style={styles.list}>
        {items.map((i) => (
          <Pressable
            key={i.key}
            onPress={() => run(i.key)}
            accessibilityRole="button"
            accessibilityLabel={i.label}
            testID={`share-menu-${i.key}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <IconTile icon={i.icon} tone={i.tone} size="lg" />
            <View style={styles.text}>
              <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">{i.label}</Text>
              <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">{i.sub}</Text>
            </View>
            {i.key === 'referral' && qualifying != null ? (
              <View style={styles.progress} testID="share-menu-progress">
                <Text style={styles.progressText}>{qualifying < 5 ? `${qualifying}/5` : `${qualifying}/20`}</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border },
  pressed: { opacity: 0.85 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 15, fontWeight: '700', color: c.text },
  sub: { fontSize: 12.5, color: c.textMuted },
  progress: { height: 22, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: c.accent, justifyContent: 'center' },
  progressText: { fontSize: 11.5, fontWeight: '700', color: c.accent },
}));
