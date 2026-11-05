import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { copyText } from '@/utils/copyText';
import type { ActionId } from '@/features/errors/catalogue';
import type { Presentation } from '@/features/errors/presentError';
import { fontSize, fontWeight, fonts, makeStyles, spacing } from '@/theme';
import { GhostButton, PrimaryButton } from './Button';
import { IconTile } from './IconTile';

/**
 * For a failure that leaves the screen with nothing to show: the server is down, or the whole load failed. Plain
 * message, "Try again" as the raised action, "Go to Home" as the way out, and a short support code people can copy and
 * read out. Use it only then; anything smaller is a Toast, a Banner or a Sheet.
 */
export function FullScreenError({ presentation, onAction }: { presentation: Presentation; onAction: (id: ActionId) => void }) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);
  const [retry, ...rest] = presentation.actions;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="assertive">
      <IconTile icon="cloud-offline-outline" tone="error" size="lg" glow />
      <Text style={styles.title} accessibilityRole="header">
        {presentation.title}
      </Text>
      <Text style={styles.message}>{presentation.message}</Text>
      <View style={styles.actions}>
        {retry ? <PrimaryButton title={retry.label} onPress={() => onAction(retry.id)} /> : null}
        {rest.map((a) => (
          <GhostButton key={a.id} title={a.label} onPress={() => onAction(a.id)} />
        ))}
      </View>
      {presentation.supportCode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Support code ${presentation.supportCode}. Copy`}
          hitSlop={12}
          onPress={async () => {
            const r = await copyText(presentation.supportCode!);
            setCopied(r === 'copied' || r === 'shared');
          }}
          style={styles.codeRow}
        >
          <Text style={styles.code}>
            Support code {presentation.supportCode} · <Text style={styles.copy}>{copied ? 'Copied' : 'Copy'}</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, textAlign: 'center' },
  message: { color: c.textSoft, fontSize: fontSize.md, lineHeight: 23, textAlign: 'center', maxWidth: 360 },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md, maxWidth: 420, width: '100%' },
  codeRow: { minHeight: 44, justifyContent: 'center' },
  code: { color: c.textMuted, fontSize: fontSize.xs },
  copy: { color: c.link, fontWeight: fontWeight.bold },
}));
