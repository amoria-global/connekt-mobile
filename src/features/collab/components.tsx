/**
 * Building blocks shared by the Collaborate screens. Presentational only;
 * screens own data and API calls.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';
import type { Person, SubmissionStatus } from './model';

export function AlbumCover({ uri, title }: { uri?: string; title: string }) {
  const styles = useStyles();
  const { gradients } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={styles.fill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
  }
  return (
    <LinearGradient colors={gradients.brand as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1.3, y: 1.3 }}
      style={[styles.fill, styles.center]}>
      <Text style={styles.initial}>{(title || '?').trim().charAt(0).toUpperCase()}</Text>
    </LinearGradient>
  );
}

const STATUS: Record<SubmissionStatus, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PENDING: { label: 'Waiting', icon: 'hourglass-outline' },
  APPROVED: { label: 'Added', icon: 'checkmark-circle' },
  REJECTED: { label: 'Not accepted', icon: 'close-circle' },
};

export function StatusChip({ status }: { status: SubmissionStatus }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const fg = status === 'APPROVED' ? colors.success : status === 'REJECTED' ? colors.error : colors.warning;
  const bg = status === 'APPROVED' ? colors.successBg : status === 'REJECTED' ? colors.errorBg : colors.warningBg;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Ionicons name={STATUS[status].icon} size={12} color={fg} />
      <Text style={[styles.chipText, { color: fg }]}>{STATUS[status].label}</Text>
    </View>
  );
}

export function PersonRow({ person, caption, size = 36 }: { person: Person; caption?: string; size?: number }) {
  const styles = useStyles();
  const initials = person.name.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase();
  return (
    <View style={styles.personRow}>
      {person.avatar ? (
        <Image source={{ uri: person.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
      )}
      <View style={styles.personText}>
        <Text style={styles.personName} numberOfLines={2}>{person.name}</Text>
        {caption ? <Text style={styles.personCaption} numberOfLines={3}>{caption}</Text> : null}
      </View>
    </View>
  );
}

/** Number + label, used in the summary strips. */
export function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && value > 0 ? { color: colors.accent } : null]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: c.textOnPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, fontFamily: fonts.bold },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.full,
  },
  chipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  avatarFallback: { backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.primary, fontWeight: fontWeight.bold, fontSize: fontSize.xs },
  personText: { flexShrink: 1 },
  personName: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  personCaption: { color: c.textMuted, fontSize: fontSize.xs },
  stat: { alignItems: 'flex-start', flex: 1 },
  statValue: { color: c.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, fontFamily: fonts.bold },
  statLabel: { color: c.textMuted, fontSize: fontSize.xs },
}));
