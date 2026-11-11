/**
 * "What do you want to sell?": the bottom sheet every "Sell photos" entry opens BEFORE any form.
 * Event photos goes to the standalone PAID album (Find my photos); Stock & content goes to the content album form.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Sheet } from '@/components/ui/Sheet';
import { IconTile } from '@/components/ui/IconTile';
import { storage } from '@/services/storage';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { SELL_CHOICES, SELL_CHOOSER_TITLE, SELL_LAST_CHOICE_KEY, parseSellChoice, type SellChoiceKey } from './sellPhotos';

export function SellChooserSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (key: SellChoiceKey) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [last, setLast] = useState<SellChoiceKey | null>(null);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    storage
      .get(SELL_LAST_CHOICE_KEY)
      .then((v) => {
        if (alive) setLast(parseSellChoice(v));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible]);

  return (
    <Sheet visible={visible} title={SELL_CHOOSER_TITLE} onClose={onClose}>
      {SELL_CHOICES.map((c) => {
        const isLast = last === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onPick(c.key)}
            accessibilityRole="button"
            accessibilityLabel={`${c.title}. ${c.body}`}
            accessibilityState={{ selected: isLast }}
            testID={`sell-choice-${c.key}`}
            style={({ pressed }) => [styles.row, isLast && { borderColor: colors.primary }, pressed && styles.pressed]}
          >
            <IconTile icon={c.icon} tone={c.tone} size="lg" />
            <View style={styles.text}>
              <Text style={styles.title}>
                {c.title}
                {isLast ? <Text style={[styles.last, { color: colors.primary }]}>{'  Last used'}</Text> : null}
              </Text>
              <Text style={[styles.body, { color: colors.textMuted }]}>{c.body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </Sheet>
  );
}

/** One place that owns the chooser: `open()` from any "Sell photos" control, render `chooser` once on the screen. */
export function useSellChooser() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const pick = useCallback(
    (key: SellChoiceKey) => {
      setVisible(false);
      storage.set(SELL_LAST_CHOICE_KEY, key).catch(() => {});
      const choice = SELL_CHOICES.find((c) => c.key === key);
      if (choice) router.push(choice.href as Href);
    },
    [router],
  );
  const chooser = <SellChooserSheet visible={visible} onClose={close} onPick={pick} />;
  return { open, chooser };
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  pressed: { opacity: 0.85 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: 15, fontWeight: '700' },
  last: { fontSize: 11, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
}));
