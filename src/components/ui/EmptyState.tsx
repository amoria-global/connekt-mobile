/**
 * EmptyState and ErrorState: never a dead end (design/brief.png). An empty list says what is
 * missing and offers the next step; a failed one says what went wrong and offers a retry.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { fonts, fontSize, makeStyles, radii, spacing, tracking } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { Button, GhostButton, PrimaryButton } from './Button';
import { GlassCard } from './GlassCard';
import { IconTile } from './IconTile';

type Action = {
  label: string;
  onPress: () => void;
  /** The raised treatment, when this is the screen's one main action (Events: Create event). */
  raised?: boolean;
};

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: Action;
  /** A second, quieter step (Events: Jump to next). */
  secondary?: Action;
  /** Replaces the icon tile with a richer piece of art (the Events calendar tile). */
  art?: ReactNode;
  /** Draw on a glass card (default), or bare when the host already is one. */
  card?: boolean;
};

export function EmptyState({ icon, title, message, action, secondary, art, card = true }: Props) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const body = (
    <>
      {art ?? <IconTile icon={icon} size="lg" />}
      <Text style={styles.title} accessibilityRole="header">
        {tr(title)}
      </Text>
      <Text style={styles.message}>{tr(message)}</Text>
      {action || secondary ? (
        <View style={styles.actions}>
          {action ? (
            action.raised ? (
              <PrimaryButton title={action.label} onPress={action.onPress} style={styles.action} />
            ) : (
              <Button title={action.label} onPress={action.onPress} style={styles.action} />
            )
          ) : null}
          {secondary ? <GhostButton title={secondary.label} onPress={secondary.onPress} style={styles.action} /> : null}
        </View>
      ) : null}
    </>
  );
  if (!card) return <View style={styles.bare}>{body}</View>;
  return <GlassCard style={styles.card}>{body}</GlassCard>;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Check your connection and try again.',
  onRetry,
  card = true,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  card?: boolean;
}) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      art={<IconTile icon="cloud-offline-outline" tone="error" size="lg" />}
      title={title}
      message={message}
      action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
      card={card}
    />
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radii.xl, alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  bare: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: tracking(22, -0.02),
    color: c.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: c.textSoft, textAlign: 'center', maxWidth: 300 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm, alignSelf: 'stretch' },
  action: { flexGrow: 1, flexBasis: 140 },
}));
