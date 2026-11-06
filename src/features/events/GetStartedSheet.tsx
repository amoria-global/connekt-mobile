/**
 * "Get started with Events": the wallet's bottom sheet (Sheet) with role-aware shortcut rows, a tip, a
 * "Don't show this again" checkbox, the primary action and "Explore on my own".
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '@/components/ui/Sheet';
import { IconTile } from '@/components/ui/IconTile';
import { ActionButton } from '@/features/photographer/kit';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import type { GetStartedAction, GetStartedKey } from './getStarted';

export function GetStartedSheet({
  actions,
  createLabel,
  initialDismissed = false,
  onPick,
  onClose,
  onDismissChange,
}: {
  actions: GetStartedAction[];
  /** The floating button's label, named in the tip. */
  createLabel: string;
  initialDismissed?: boolean;
  /** A row or the primary button: the sheet closes, then the flow opens. */
  onPick: (key: GetStartedKey) => void;
  /** Closed for this session only (x, backdrop, Back, "Explore on my own"). */
  onClose: () => void;
  /** The checkbox was ticked or cleared. */
  onDismissChange: (forever: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [forever, setForever] = useState(initialDismissed);
  const first = actions[0];

  return (
    <Sheet
      title="Get started with Events"
      subtitle="What would you like to do first?"
      onClose={onClose}
      footer={
        <View style={styles.actions}>
          {first ? <ActionButton label={first.title} icon="add" variant="primary" onPress={() => onPick(first.key)} /> : null}
          <ActionButton label="Explore on my own" variant="secondary" onPress={onClose} />
        </View>
      }
    >
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => onPick(a.key)}
          accessibilityRole="button"
          accessibilityLabel={`${a.title}. ${a.body}`}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <IconTile icon={a.icon} tone={a.tone} size="lg" />
          <View style={styles.text}>
            <Text style={styles.rowTitle}>{a.title}</Text>
            <Text style={[styles.rowBody, { color: colors.textMuted }]} numberOfLines={1}>
              {a.body}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
      <Text style={[styles.tip, { color: colors.textMuted }]}>
        You can always create from the blue <Text style={styles.tipStrong}>+ {createLabel}</Text> button at the bottom of this page.
      </Text>
      <Pressable
        onPress={() => {
          setForever(!forever);
          onDismissChange(!forever);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: forever }}
        accessibilityLabel="Don't show this again"
        hitSlop={8}
        style={styles.check}
      >
        <View style={[styles.box, forever && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          {forever ? <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} /> : null}
        </View>
        <Text style={[styles.checkText, { color: colors.textMuted }]}>Don&apos;t show this again</Text>
      </Pressable>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  pressed: { opacity: 0.85 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  rowBody: { fontSize: 13 },
  tip: { fontSize: 13, lineHeight: 19 },
  tipStrong: { color: c.text, fontWeight: '700' },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 14 },
  actions: { gap: spacing.sm, paddingBottom: spacing.sm },
}));
