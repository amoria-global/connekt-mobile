import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { HelpBlocks } from '@/components/help/HelpBlocks';
import { findCategory } from '@/content/helpCenter';
import { alpha, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { helpTone } from '@/features/support/helpTone';

/** One Help Center category: every article in it, each opening to its full guide. */
export default function HelpCategoryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { category: id, article } = useLocalSearchParams<{ category: string; article?: string }>();
  const category = findCategory(id);
  const [open, setOpen] = useState<string | null>(article ?? category?.articles[0]?.id ?? null);

  if (!category) {
    return (
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'Help Center' }} />
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>We could not find that help topic</Text>
          <Pressable onPress={() => router.replace('/help-center')} accessibilityRole="button" style={styles.back}>
            <Text style={styles.backText}>Back to Help Center</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const tone = helpTone(category.tone, colors);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: category.title }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={[styles.headIcon, { backgroundColor: alpha(tone, 0.16) }]}>
            <Ionicons name={category.icon} size={26} color={tone} />
          </View>
          <Text style={styles.title} accessibilityRole="header">{category.title}</Text>
          <Text style={styles.blurb}>{category.blurb}</Text>
        </View>

        <View style={styles.list}>
          {category.articles.map((a) => {
            const isOpen = open === a.id;
            return (
              <View key={a.id} style={[styles.item, isOpen && { borderColor: alpha(tone, 0.5) }]}>
                <Pressable
                  onPress={() => setOpen(isOpen ? null : a.id)}
                  style={styles.itemHead}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={a.title}
                >
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>{a.title}</Text>
                    {!isOpen ? <Text style={styles.itemSummary}>{a.summary}</Text> : null}
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                </Pressable>
                {isOpen ? (
                  <View style={styles.itemBody}>
                    <HelpBlocks blocks={a.blocks} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.more}>
          <Text style={styles.moreTitle}>Did this answer your question?</Text>
          <Text style={styles.moreText}>If not, tell us what you were trying to do and we will help.</Text>
          <Pressable
            style={styles.contact}
            onPress={() => router.push('/contact_us' as unknown as any)}
            accessibilityRole="button"
          >
            <Text style={styles.contactText}>Contact us</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  head: { gap: spacing.sm },
  headIcon: { width: 48, height: 48, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: c.text },
  blurb: { fontSize: fontSize.md, lineHeight: 22, color: c.textSoft },
  list: { gap: spacing.sm },
  item: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 56 },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  itemSummary: { fontSize: fontSize.sm, color: c.textMuted, marginTop: 2, lineHeight: 19 },
  itemBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  more: { gap: spacing.xs, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  moreTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  moreText: { fontSize: fontSize.sm, color: c.textSoft, lineHeight: 20 },
  contact: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    justifyContent: 'center',
  },
  contactText: { color: c.textOnPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  missingTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text, textAlign: 'center' },
  back: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  backText: { color: c.primary, fontWeight: fontWeight.bold },
}));
