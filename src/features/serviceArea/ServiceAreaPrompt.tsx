import { useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, GhostButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts, fontSize, makeStyles, spacing, useTheme } from '@/theme';
import { useServiceArea } from './useServiceArea';

/**
 * Home prompt for a photographer with no service area: "Set your service area". Until they set one they are not on the map.
 *
 * It is dismissible ("Later" or the close button) for the rest of the session and comes back next launch, and it disappears as
 * soon as an area is saved. It shows nothing while the area is still loading and nothing if the read failed, so it never claims
 * "not on the map" about someone who is.
 */
export function ServiceAreaPrompt({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const router = useRouter();
  const { area, loaded, failed } = useServiceArea();
  const [dismissed, setDismissed] = useState(false);

  if (!loaded || failed || dismissed || area?.set) return null;

  const open = () => router.push('/service-area' as Href);

  return (
    <GlassCard style={[styles.card, style]}>
      <View style={styles.top}>
        <IconTile icon="location-outline" tone="primary" size="lg" />
        <View style={styles.text}>
          <Text style={styles.title} accessibilityRole="header">{tr('Set your service area')}</Text>
          <Text style={styles.body}>
            {tr('Clients searching nearby will find you on the map. They only see an approximate area, never your address.')}
          </Text>
        </View>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel={tr('Dismiss')}
          hitSlop={12}
          style={styles.close}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Button title={tr('Set area')} onPress={open} style={styles.primary} />
        <GhostButton title={tr('Later')} onPress={() => setDismissed(true)} />
      </View>
    </GlassCard>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: spacing.md, padding: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.md },
  body: { color: c.textSoft, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 20 },
  close: { padding: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: { flex: 1 },
}));
