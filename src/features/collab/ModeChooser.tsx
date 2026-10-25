/**
 * The first thing on Collaborate: two clearly different ways to work with another photographer.
 *  - Workspace access: they work in your whole business (bookings, clients, events, opportunities).
 *  - Album collaboration: they add photos to one album and see nothing else.
 * The chosen card is expanded with its three points; the other stays short, so the screen does not turn into two long
 * lists on a phone. It is a radio group for a screen reader, and the choice is also shown by colour, a check and a border.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme, onFill } from '@/theme';

export type CollaborateMode = 'workspace' | 'albums';

type Option = {
  mode: CollaborateMode;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  title: string;
  lead: string;
  points: string[];
};

export const COLLABORATE_OPTIONS: Option[] = [
  {
    mode: 'workspace',
    icon: 'briefcase',
    badge: 'WHOLE WORKSPACE',
    title: 'Workspace access',
    lead: 'Let another photographer work in your business.',
    points: ['They sign in with their own account', 'They handle bookings, clients and events with you', 'Withdrawals and transactions stay with you'],
  },
  {
    mode: 'albums',
    icon: 'images',
    badge: 'ONE ALBUM',
    title: 'Album collaboration',
    lead: 'Share a single album so others can add photos.',
    points: ['You invite them with a link', 'They add photos, you choose what goes in', 'They never see your bookings, clients or money'],
  },
];

export function ModeChooser({ mode, onChange }: { mode: CollaborateMode; onChange: (mode: CollaborateMode) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="How do you want to work with another photographer?" style={styles.group}>
      {COLLABORATE_OPTIONS.map((o) => {
        const on = mode === o.mode;
        return (
          <Pressable
            key={o.mode}
            onPress={() => onChange(o.mode)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, selected: on }}
            accessibilityLabel={`${o.title}. ${o.lead}`}
            style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && styles.pressed]}
          >
            <View style={styles.head}>
              <View style={[styles.iconTile, on && styles.iconTileOn]}>
                <Ionicons name={o.icon} size={20} color={on ? onFill : colors.textMuted} />
              </View>
              <View style={styles.headText}>
                <Text style={[styles.badge, on && styles.badgeOn]}>{o.badge}</Text>
                <Text style={styles.title}>{o.title}</Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]}>
                {on ? <Ionicons name="checkmark" size={14} color={onFill} /> : null}
              </View>
            </View>
            <Text style={styles.lead}>{o.lead}</Text>
            {on ? (
              <View style={styles.points}>
                {o.points.map((p) => (
                  <View key={p} style={styles.point}>
                    <Ionicons name="checkmark" size={15} color={colors.primary} style={styles.pointIcon} />
                    <Text style={styles.pointText}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A one-line pointer to the other mode, so someone in the wrong place can cross over without hunting for it. */
export function CrossLink({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.cross}>
      <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
      <Text style={styles.crossText}>
        {text}{' '}
        <Text style={styles.crossAction} onPress={onPress} accessibilityRole="button">{action}</Text>
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  group: { gap: spacing.md },
  card: {
    ...e(1), backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 2, borderColor: c.borderSoft,
    padding: spacing.lg, gap: spacing.sm,
  },
  cardOn: { borderColor: c.primary, backgroundColor: c.tint },
  pressed: { opacity: 0.92 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1 },
  iconTile: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceMuted },
  iconTileOn: { backgroundColor: c.primary },
  badge: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.8 },
  badgeOn: { color: c.accent },
  title: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  radio: { width: 22, height: 22, borderRadius: radii.full, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: c.primary, borderColor: c.primary },
  lead: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  points: { gap: spacing.xs, paddingTop: spacing.xs },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pointIcon: { marginTop: 2 },
  pointText: { flex: 1, color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  cross: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.surfaceMuted, borderRadius: radii.md, padding: spacing.md },
  crossText: { flex: 1, color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  crossAction: { color: c.primary, fontWeight: fontWeight.bold },
}));
