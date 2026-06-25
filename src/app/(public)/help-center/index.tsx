import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSize, spacing } from '@/theme';

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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxxl,
  },
  hero: {
    backgroundColor: colors.primary,
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
    color: colors.textOnPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textOnPrimary + 'CC',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  searchContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: -spacing.xl,
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
    fontWeight: '600',
  },
  grid: {
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  articleCount: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
