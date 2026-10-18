import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { Button } from './Button';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ icon, title, message, action }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>{tr(title)}</Text>
      <Text style={styles.message}>{tr(message)}</Text>
      {action ? <Button title={tr(action.label)} onPress={action.onPress} style={styles.action} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  message: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center', maxWidth: 280 },
  action: { marginTop: spacing.md, alignSelf: 'center', paddingHorizontal: spacing['2xl'] },
}));
