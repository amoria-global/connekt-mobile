import { Text, View } from 'react-native';
import type { ActionId } from '@/features/errors/catalogue';
import { closeSheet, useErrorState } from '@/features/errors/store';
import type { Presentation } from '@/features/errors/presentError';
import { fontSize, fontWeight, fonts, makeStyles, spacing } from '@/theme';
import { Button, GhostButton, PrimaryButton } from './Button';
import { IconTile } from './IconTile';
import { Sheet } from './Sheet';

const ICON = { danger: 'alert-circle-outline', warning: 'warning-outline', info: 'information-circle-outline' } as const;

/**
 * A bottom sheet for a failure that needs a decision: a payment that did not go through, a permission that is blocked,
 * a step that cannot be undone. It says what happened, reassures about what did not (the Presentation's message carries
 * "You weren't charged."), and offers clear choices: the first action is the raised one, the rest are quieter. The last
 * choice is always a plain way out, so there is never a dead end.
 */
export function ErrorSheet({ presentation, onAction, onClose }: { presentation: Presentation; onAction: (id: ActionId) => void; onClose: () => void }) {
  const styles = useStyles();
  const [primary, ...rest] = presentation.actions;
  const quiet = rest.filter((a) => a.id !== 'dismiss');
  return (
    <Sheet title="" onClose={onClose}>
      <View style={styles.body} accessibilityLiveRegion="assertive">
        <IconTile icon={ICON[presentation.tone]} tone={presentation.tone === 'danger' ? 'error' : presentation.tone === 'warning' ? 'pending' : 'primary'} size="lg" />
        <Text style={styles.title} accessibilityRole="header">
          {presentation.title}
        </Text>
        <Text style={styles.message}>{presentation.message}</Text>
        {presentation.supportCode ? <Text style={styles.code}>Support code {presentation.supportCode}</Text> : null}
        <View style={styles.actions}>
          {primary ? <PrimaryButton title={primary.label} onPress={() => onAction(primary.id)} /> : null}
          {quiet.map((a) => (
            <GhostButton key={a.id} title={a.label} onPress={() => onAction(a.id)} />
          ))}
          <Button title="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Sheet>
  );
}

/** The sheet the store holds, mounted once at the root. */
export function ErrorSheetHost() {
  const { sheet } = useErrorState();
  if (!sheet) return null;
  return (
    <ErrorSheet
      presentation={sheet.presentation}
      onClose={closeSheet}
      onAction={(id) => {
        closeSheet();
        sheet.onAction(id);
      }}
    />
  );
}

const useStyles = makeStyles((c) => ({
  body: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  message: { color: c.textSoft, fontSize: fontSize.sm, lineHeight: 21, textAlign: 'center' },
  code: { color: c.textMuted, fontSize: fontSize.xs },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
}));
