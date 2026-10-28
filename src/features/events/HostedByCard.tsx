/**
 * One "Hosted by" card. The organizer and the photographer share a row with both role chips when they are the same user
 * (see hostRows), and get a row each inside the same card when they are not. A row with a photographer id opens that
 * photographer's profile.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StatusChip } from '@/components/ui/StatusChip';
import { fontSize, fontWeight, makeStyles, onFill, radii, spacing, useTheme } from '@/theme';
import type { HostRow } from './hostRows';

export function HostedByCard({ rows }: { rows: HostRow[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  if (!rows.length) return null;
  return (
    <View style={styles.card}>
      {rows.map((r, i) => {
        const body = (
          <>
            <View style={styles.avatar}>
              <Avatar row={r} imgStyle={styles.avatarImg} />
            </View>
            <View style={styles.flex}>
              {i === 0 ? <Text style={styles.label}>Hosted by</Text> : null}
              <Text style={styles.name} numberOfLines={1}>
                {r.name}
              </Text>
              <View style={styles.chips}>
                {r.roles.map((role) => (
                  <StatusChip key={role} label={role === 'ORGANIZER' ? 'ORGANIZER' : 'PHOTOGRAPHER'} tone={role === 'ORGANIZER' ? 'primary' : 'active'} />
                ))}
              </View>
            </View>
            {r.photographerId ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
          </>
        );
        return r.photographerId ? (
          <Pressable
            key={r.key}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/photographer/${r.photographerId}` as unknown as Href)}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}, ${r.roles.join(' and ').toLowerCase()}. Open profile`}
          >
            {body}
          </Pressable>
        ) : (
          <View key={r.key} style={styles.row}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** The host's picture, or the role icon when there is none or it will not load. */
function Avatar({ row, imgStyle }: { row: HostRow; imgStyle: object }) {
  const [failed, setFailed] = useState(false);
  return row.image && !failed ? (
    <Image source={{ uri: row.image }} style={imgStyle} contentFit="cover" onError={() => setFailed(true)} />
  ) : (
    <Ionicons name={row.roles.includes('PHOTOGRAPHER') ? 'camera' : 'mic'} size={20} color={onFill} />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    flex: { flex: 1, gap: 2 },
    card: { borderRadius: radii.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface, padding: spacing.md, gap: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
    avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarImg: { width: '100%', height: '100%' },
    label: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
    chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  }),
);
