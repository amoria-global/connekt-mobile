import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HelpBlock } from '@/content/helpCenter';
import { alpha, fontSize, fontWeight, makeStyles, spacing, useTheme } from '@/theme';

/** The body of one Help Center article: paragraphs, numbered steps, bullet lists, tips and warnings. */
export function HelpBlocks({ blocks }: { blocks: HelpBlock[] }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.type === 'p') {
          return <Text key={i} style={styles.body}>{b.text}</Text>;
        }
        if (b.type === 'tip' || b.type === 'warn') {
          const warn = b.type === 'warn';
          const tone = warn ? colors.error : colors.success;
          return (
            <View
              key={i}
              style={[styles.callout, { borderColor: alpha(tone, 0.35), backgroundColor: alpha(tone, 0.08) }]}
              accessibilityRole={warn ? 'alert' : undefined}
            >
              <Ionicons name={warn ? 'warning-outline' : 'bulb-outline'} size={18} color={tone} />
              <Text style={styles.calloutText}>{b.text}</Text>
            </View>
          );
        }
        const numbered = b.type === 'steps';
        return (
          <View key={i} style={styles.listWrap}>
            {b.title ? <Text style={styles.listTitle} accessibilityRole="header">{b.title}</Text> : null}
            {b.items.map((item, n) => (
              <View key={n} style={styles.row}>
                {numbered ? (
                  <View style={styles.num}><Text style={styles.numText}>{n + 1}</Text></View>
                ) : (
                  <View style={styles.bullet} />
                )}
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.md },
  body: { fontSize: fontSize.md, lineHeight: 24, color: c.textSoft },
  listWrap: { gap: spacing.sm },
  listTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  num: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(c.primary, 0.16),
    marginTop: 1,
  },
  numText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.primary },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary, marginTop: 9, marginLeft: 9 },
  itemText: { flex: 1, fontSize: fontSize.md, lineHeight: 23, color: c.textSoft },
  callout: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  calloutText: { flex: 1, fontSize: fontSize.sm, lineHeight: 21, color: c.text },
}));
