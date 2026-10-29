import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { HELP_ARTICLE_COUNT, HELP_CATEGORIES, searchHelp } from '@/content/helpCenter';
import { helpTone } from '@/features/support/helpTone';
import { alpha, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

export default function HelpCenterScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim().length > 0;

  const openCategory = (id: string, article?: string) =>
    router.push({ pathname: '/help-center/[category]', params: article ? { category: id, article } : { category: id } } as unknown as any);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.title} accessibilityRole="header">How can we help?</Text>
          <Text style={styles.subtitle}>
            {HELP_ARTICLE_COUNT} guides covering every part of the app. Search, or pick a topic.
          </Text>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search, for example withdraw or go live"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search the Help Center"
            />
            {searching ? (
              <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {searching ? (
          <View style={styles.results}>
            {hits.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nothing matches &quot;{query.trim()}&quot;</Text>
                <Text style={styles.emptyText}>Try fewer or different words, or browse the topics below.</Text>
              </View>
            ) : (
              hits.map(({ category, article }) => (
                <Pressable
                  key={`${category.id}/${article.id}`}
                  style={styles.hit}
                  onPress={() => openCategory(category.id, article.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${article.title}, in ${category.title}`}
                >
                  <View style={styles.flex}>
                    <Text style={styles.hitCat}>{category.title}</Text>
                    <Text style={styles.hitTitle}>{article.title}</Text>
                    <Text style={styles.hitSummary}>{article.summary}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <View style={styles.grid}>
            {HELP_CATEGORIES.map((cat) => {
              const tone = helpTone(cat.tone, colors);
              return (
                <Pressable
                  key={cat.id}
                  style={({ pressed }) => [styles.card, { borderColor: alpha(tone, 0.3) }, pressed && styles.pressed]}
                  onPress={() => openCategory(cat.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${cat.title}. ${cat.articles.length} guides`}
                >
                  <View style={[styles.iconTile, { backgroundColor: alpha(tone, 0.16) }]}>
                    <Ionicons name={cat.icon} size={22} color={tone} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{cat.title}</Text>
                    <Text style={styles.cardDesc}>{cat.blurb}</Text>
                    <Text style={[styles.count, { color: tone }]}>
                      {cat.articles.length} {cat.articles.length === 1 ? 'guide' : 'guides'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Still need help?</Text>
          <Text style={styles.footerText}>Send us a message with what you were doing and any reference number, and we will get back to you in the app and by email.</Text>
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.push('/contact_us' as unknown as any)}
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>Contact us</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => router.push('/feedback' as unknown as any)}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>Send feedback</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  container: { paddingBottom: spacing.xxxl },
  hero: {
    backgroundColor: c.primary,
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: spacing.sm,
  },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: c.textOnPrimary },
  subtitle: { fontSize: fontSize.md, lineHeight: 22, color: alpha(c.textOnPrimary, 0.85), marginBottom: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.background,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: c.text, paddingVertical: spacing.sm },

  grid: { padding: spacing.lg, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: c.card,
  },
  iconTile: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  cardDesc: { fontSize: fontSize.sm, lineHeight: 19, color: c.textMuted, marginTop: 2 },
  count: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: spacing.xs },

  results: { padding: spacing.lg, gap: spacing.sm },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  hitCat: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.primary, textTransform: 'uppercase' },
  hitTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text, marginTop: 2 },
  hitSummary: { fontSize: fontSize.sm, color: c.textMuted, marginTop: 2, lineHeight: 19 },
  empty: { alignItems: 'center', gap: spacing.xs, padding: spacing.xl },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text, textAlign: 'center' },
  emptyText: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center' },

  footer: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: c.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.sm,
  },
  footerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  footerText: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
  footerRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  btn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  btnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  btnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
  btnPrimaryText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.textOnPrimary },
}));
