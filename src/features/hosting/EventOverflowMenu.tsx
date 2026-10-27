import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '@/components/ui/Sheet';
import { GhostButton, PrimaryButton } from '@/components/ui/Button';
import { fontSize, fontWeight, makeStyles, spacing, useTheme } from '@/theme';
import type { PublishAction, UnpublishImpact } from './publishFlow';
import { unpublishCopy } from './publishFlow';

/**
 * The event's overflow menu (the three dots): Unpublish or Republish, with a confirm sheet for Unpublish that says what
 * happens and how many bookings or tickets are affected. A live event shows "End the stream first". Renders nothing when
 * there is nothing to offer.
 */
export function EventOverflowMenu({
  title,
  action,
  loadImpact,
  onUnpublish,
  onRepublish,
}: {
  title: string;
  action: PublishAction;
  /** Counts of bookings and sold tickets, when the server can tell. Failing is fine: the warning is just left out. */
  loadImpact?: () => Promise<UnpublishImpact | undefined>;
  onUnpublish: () => Promise<void>;
  onRepublish: () => Promise<void>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [impact, setImpact] = useState<UnpublishImpact | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (action.kind === 'none') return null;

  const run = async (fn: () => Promise<void>, done: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      done();
    } catch (e) {
      setError((e as { message?: string })?.message || 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openConfirm = () => {
    setMenu(false);
    setImpact(undefined);
    setError(null);
    setConfirm(true);
    void loadImpact?.().then(setImpact).catch(() => undefined);
  };

  const copy = unpublishCopy(impact);

  return (
    <>
      <Pressable
        onPress={() => setMenu(true)}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${title}`}
        hitSlop={6}
        style={({ pressed }) => [styles.dots, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
      </Pressable>

      <Sheet visible={menu} title={title} onClose={() => setMenu(false)}>
        {action.kind === 'blocked' ? (
          <View style={styles.row}>
            <Ionicons name="radio-outline" size={20} color={colors.textMuted} />
            <Text style={styles.muted}>{action.reason}</Text>
          </View>
        ) : action.kind === 'unpublish' ? (
          <Pressable onPress={openConfirm} accessibilityRole="button" style={styles.row}>
            <Ionicons name="eye-off-outline" size={20} color={colors.text} />
            <Text style={styles.label}>Unpublish</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => run(onRepublish, () => setMenu(false))}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            disabled={busy}
            style={styles.row}
          >
            <Ionicons name="megaphone-outline" size={20} color={colors.text} />
            <Text style={styles.label}>{busy ? 'Republishing' : 'Republish'}</Text>
          </Pressable>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Sheet>

      <Sheet
        visible={confirm}
        title={copy.title}
        onClose={() => setConfirm(false)}
        busy={busy}
        footer={
          <>
            <PrimaryButton title="Unpublish" onPress={() => run(onUnpublish, () => setConfirm(false))} loading={busy} />
            <GhostButton title="Cancel" onPress={() => setConfirm(false)} disabled={busy} />
          </>
        }
      >
        <Text style={styles.body}>{copy.body}</Text>
        {copy.warning ? <Text style={styles.warn}>{copy.warning}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  dots: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  label: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  muted: { color: c.textMuted, fontSize: fontSize.md },
  body: { color: c.text, fontSize: fontSize.md, lineHeight: 22 },
  warn: { color: c.pending, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  error: { color: c.error, fontSize: fontSize.sm },
}));
