/**
 * Role-selection bottom sheet — "How will you use Connekyt?"
 *
 * Registration used to hand straight off to the web sign-up with NO
 * `userType`, on the assumption that knockout's own `UserTypeModal` would
 * ask. In the in-app browser that picker was unreliable, and knockout falls
 * back to a default role when nothing is chosen — so people were landing in
 * the wrong account type. The app now asks first and always registers with
 * an explicit role, so the role can never be guessed downstream.
 *
 * Roles mirror knockout's `UserTypeModal` (app/components/UserTypeModal.tsx),
 * including `User` — the mobile/TV consumer role.
 *
 * Presentation is deliberately static and flat: no entrance animation, no
 * gradients. Each role carries one solid colour, used for its icon tile and
 * (in a darker, AA-contrast variant) its tagline.
 */
import { useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CustomerType } from '@/features/auth/types';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

/** Roles offered at sign-up, in the order the sheet presents them. */
export type SignupRole = Extract<
  CustomerType,
  'User' | 'Photographer' | 'Client' | 'Coordinator'
>;

type RoleOption = {
  id: SignupRole;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tagline: string;
  description: string;
  /** Solid icon-tile fill (white icon sits on top). */
  tint: string;
  /** Darker variant of `tint` — small uppercase text needs AA contrast. */
  label: string;
};

const ROLES: RoleOption[] = [
  {
    id: 'User',
    icon: 'sparkles',
    title: 'User',
    tagline: 'For fans & guests',
    description: 'Watch live streams, buy photos & book photographers',
    tint: '#0EA5E9',
    label: '#0369A1',
  },
  {
    id: 'Photographer',
    icon: 'camera',
    title: 'Photographer',
    tagline: 'For creators',
    description: 'Join as a verified pro · build your portfolio',
    tint: colors.primary,
    label: colors.primary,
  },
  {
    id: 'Client',
    icon: 'person',
    title: 'Client',
    tagline: 'For memory keepers',
    description: 'Find and book trusted creative talent',
    tint: '#B83AB6',
    label: '#9D1F9B',
  },
  {
    id: 'Coordinator',
    icon: 'calendar',
    title: 'Event Coordinator',
    tagline: 'For organizers',
    description: 'Organize, manage, and broadcast events',
    tint: '#EF4444',
    label: '#B91C1C',
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Fires once, with the chosen role. The caller decides where to send them. */
  onSelect: (role: SignupRole) => void;
};

export function RoleSelectSheet({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  // Guards against a double-tap firing two selections in the same frame — with
  // no exit animation the sheet is gone immediately, but the press could
  // already have been queued twice.
  const firedRef = useRef(false);

  const handlePick = (role: SignupRole) => {
    if (firedRef.current) return;
    firedRef.current = true;
    onSelect(role);
    firedRef.current = false;
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss role selection"
      />

      <View style={styles.anchor} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.eyebrow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrowText}>Step 1 of 2</Text>
            </View>

            <Text style={styles.title}>How will you use Connekyt?</Text>
            <Text style={styles.subtitle}>
              Pick the one that fits you best. You can change it later.
            </Text>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {ROLES.map((role) => (
              <Pressable
                key={role.id}
                onPress={() => handlePick(role.id)}
                accessibilityRole="button"
                accessibilityLabel={`${role.title}. ${role.description}`}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { borderColor: role.tint, backgroundColor: colors.background },
                ]}
              >
                <View style={[styles.iconTile, { backgroundColor: role.tint }]}>
                  <Ionicons name={role.icon} size={21} color="#fff" />
                </View>

                <View style={styles.cardText}>
                  <Text style={[styles.tagline, { color: role.label }]}>{role.tagline}</Text>
                  <Text style={styles.cardTitle}>{role.title}</Text>
                  <Text style={styles.cardDesc}>{role.description}</Text>
                </View>

                <View style={styles.chevron}>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.trust}>
            <TrustItem icon="checkmark-circle" color="#047857" label="Verified creators" />
            <TrustItem icon="shield-checkmark" color={colors.primary} label="Secure & private" />
            <TrustItem icon="globe-outline" color="#9D1F9B" label="47+ cities" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TrustItem({
  icon,
  color,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}) {
  return (
    <View style={styles.trustItem}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={styles.trustText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingTop: spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 24,
  },

  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },

  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    backgroundColor: colors.infoBg,
    marginBottom: spacing.md,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  eyebrowText: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  list: { flexGrow: 0 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm + 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    padding: spacing.md + 2,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, minWidth: 0 },
  tagline: {
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: fontSize.md - 1,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  cardDesc: { fontSize: fontSize.xs + 0.5, color: colors.textMuted, lineHeight: 17 },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  trust: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.medium },
});
