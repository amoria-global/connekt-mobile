/**
 * The photographer's entry to hosting: "Go live" starts the quick flow, "My hosted events" lists them.
 * Renders nothing unless the server says this account can host, so with the feature off the app looks
 * exactly as it did, and a failed or slow answer never leaves a broken control behind.
 */
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useAsync } from '@/hooks/useAsync';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { getHostingEligibility } from './api';

export function HostEntry() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const eligibility = useAsync(getHostingEligibility);

  if (!eligibility.data?.canHostFree) return null;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push('/host/new' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Go live. Host your own event"
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <Ionicons name="radio-outline" size={20} color={colors.accent} />
        <Text style={styles.label}>Go live</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/host' as Href)}
        accessibilityRole="button"
        accessibilityLabel="My hosted events"
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <Ionicons name="albums-outline" size={20} color={colors.primary} />
        <Text style={styles.label}>My hosted events</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  label: { flex: 1, color: c.text, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.85 },
}));
