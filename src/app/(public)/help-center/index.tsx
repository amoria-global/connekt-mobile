import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { spacing, fontSize, makeStyles, useTheme } from '@/theme';

const categories = [
  {
    id: 'my-account',
    name: 'My Account',
    icon: 'person-outline', // Note: replace with Ionicons if available, or just generic text if not. Assuming we can just rely on typography or generic icons. Actually, since we don't know the exact icon set, we'll use text or basic emojis if icons fail. Or use Expo vector icons. Let's use simple shapes or leave out complex icons if not installed.
    articles: 12,
    description: 'Manage your account settings',
    color: '#3B82F6',
  },
  {
    id: 'payment',
    name: 'Payment',
    articles: 8,
    description: 'Payment and billing information',
    color: '#10B981',
  },
  {
    id: 'security',
    name: 'Security',
    articles: 6,
    description: 'Keep your account secure',
    color: '#EF4444',
  },
  {
    id: 'payment-methods',
    name: 'Payment Methods',
    articles: 5,
    description: 'Available payment options',
    color: '#F59E0B',
  },
  {
    id: 'booking',
    name: 'Booking',
    articles: 10,
    description: 'Book and manage photographers',
    color: '#B83AB6',
  },
  {
    id: 'technical-support',
    name: 'Technical Support',
    articles: 7,
    description: 'Technical help and support',
    color: '#6366F1',
  },
];

export default function HelpCenterScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [searchTerm, setSearchTerm] = useState('');

  const handleCategoryPress = (id: string) => {
    router.push(`/help-center/${id}` as unknown as any);
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.title}>How can we help you today?</Text>
          <Text style={styles.subtitle}>
            Search articles, get answers, or jump into a conversation.
          </Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for articles..."
              placeholderTextColor={colors.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>
        </View>

        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>48+</Text>
            <Text style={styles.statLabel}>Articles</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>24/7</Text>
            <Text style={styles.statLabel}>Support</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>&lt;2h</Text>
            <Text style={styles.statLabel}>Response</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, { borderColor: cat.color + '33' }]}
              onPress={() => handleCategoryPress(cat.id)}
            >
              <View style={[styles.iconContainer, { backgroundColor: cat.color + '1A' }]}>
                <View style={[styles.iconPlaceholder, { backgroundColor: cat.color }]} />
              </View>
              <Text style={styles.cardTitle}>{cat.name}</Text>
              <Text style={styles.cardDesc}>{cat.description}</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.articleCount, { color: cat.color }]}>
                  {cat.articles} articles
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Still need help? — contact / feedback (web parity). */}
        <View style={styles.helpFooter}>
          <Text style={styles.helpFooterTitle}>Still need help?</Text>
          <Text style={styles.helpFooterText}>
            Can&apos;t find what you&apos;re looking for? Reach our team or send feedback.
          </Text>
          <View style={styles.helpFooterRow}>
            <TouchableOpacity
              style={[styles.helpFooterBtn, styles.helpFooterBtnPrimary]}
              onPress={() => router.push('/contact_us' as unknown as any)}
            >
              <Text style={styles.helpFooterBtnPrimaryText}>Contact us</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.helpFooterBtn}
              onPress={() => router.push('/feedback' as unknown as any)}
            >
              <Text style={styles.helpFooterBtnText}>Send feedback</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  container: {
    paddingBottom: spacing.xxxl,
  },
  hero: {
    backgroundColor: c.primary,
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: c.textOnPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: c.textOnPrimary + 'CC',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  searchContainer: {
    width: '100%',
    backgroundColor: c.background,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: c.text,
    paddingVertical: spacing.xs,
  },
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: -spacing.xl,
    backgroundColor: c.card,
    borderRadius: 16,
    ...e(2),
  },
  statItem: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: c.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
    fontWeight: '600',
  },
  grid: {
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  helpFooter: {
    margin: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.xl,
    backgroundColor: c.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.sm,
  },
  helpFooterTitle: { fontSize: fontSize.lg, fontWeight: '800', color: c.text },
  helpFooterText: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
  helpFooterRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  helpFooterBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  helpFooterBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: c.text },
  helpFooterBtnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
  helpFooterBtnPrimaryText: { fontSize: fontSize.sm, fontWeight: '700', color: c.textOnPrimary },
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    ...e(1),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginBottom: spacing.md,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: spacing.sm,
  },
  articleCount: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
}));
