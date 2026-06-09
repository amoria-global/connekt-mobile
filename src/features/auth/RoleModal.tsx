import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import type { CustomerType } from './types';

type RoleOption = {
  role: CustomerType;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  { role: 'Client', icon: 'person-outline', description: 'Book photographers for your events' },
  { role: 'Photographer', icon: 'camera-outline', description: 'Offer your services and get booked' },
  { role: 'Coordinator', icon: 'people-outline', description: 'Manage events and hire photographers' },
];

/** Bottom-sheet style modal: choose an account type before signing up. */
export function RoleModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (role: CustomerType) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Join as</Text>
          <Text style={styles.subtitle}>Choose the account type that fits you</Text>

          <View style={styles.options}>
            {ROLE_OPTIONS.map((o) => (
              <Pressable
                key={o.role}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                onPress={() => onSelect(o.role)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={o.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.optionBody}>
                  <Text style={styles.optionRole}>{o.role}</Text>
                  <Text style={styles.optionDesc}>{o.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    padding: spacing.xl,
    paddingBottom: spacing['2xl'],
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  options: { gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: { flex: 1 },
  optionRole: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  optionDesc: { fontSize: fontSize.sm, color: colors.textMuted },
  cancel: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.sm },
  cancelText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textMuted },
});
