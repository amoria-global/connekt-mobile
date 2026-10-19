import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles, useTheme } from '@/theme';

export default function HelpCenterScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    {
      id: 'my-account',
      name: t('b4_hcCatMyAccountName'),
      icon: 'person-outline',
      articles: 12,
      description: t('b4_hcCatMyAccountDesc'),
      color: '#3B82F6',
    },
    {
      id: 'payment',
      name: t('b4_hcCatPaymentName'),
      articles: 8,
      description: t('b4_hcCatPaymentDesc'),
      color: '#10B981',
    },
    {
      id: 'security',
      name: t('b4_hcCatSecurityName'),
      articles: 6,
      description: t('b4_hcCatSecurityDesc'),
      color: '#EF4444',
    },
    {
      id: 'payment-methods',
      name: t('b4_hcCatPaymentMethodsName'),
      articles: 5,
      description: t('b4_hcCatPaymentMethodsDesc'),
      color: '#F59E0B',
    },
    {
      id: 'booking',
      name: t('b4_hcCatBookingName'),
      articles: 10,
      description: t('b4_hcCatBookingDesc'),
      color: '#B83AB6',
    },
    {
      id: 'technical-support',
      name: t('b4_hcCatTechSupportName'),
      articles: 7,
      description: t('b4_hcCatTechSupportDesc'),
      color: '#6366F1',
    },
  ];

  const handleCategoryPress = (id: string) => {
    router.push(`/help-center/${id}` as unknown as any);
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.title}>{t('b4_hcHeroTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('b4_hcHeroSubtitle')}
          </Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('b4_hcSearchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>
        </View>

        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>48+</Text>
            <Text style={styles.statLabel}>{t('b4_hcStatArticles')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>24/7</Text>
            <Text style={styles.statLabel}>{t('b4_hcStatSupport')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>&lt;2h</Text>
            <Text style={styles.statLabel}>{t('b4_hcStatResponse')}</Text>
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
                  {t('b4_hcArticleCount').replace('{count}', String(cat.articles))}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Still need help? — contact / feedback (web parity). */}
        <View style={styles.helpFooter}>
          <Text style={styles.helpFooterTitle}>{t('b4_hcStillNeedHelpTitle')}</Text>
          <Text style={styles.helpFooterText}>
            {t('b4_hcStillNeedHelpText')}
          </Text>
          <View style={styles.helpFooterRow}>
            <TouchableOpacity
              style={[styles.helpFooterBtn, styles.helpFooterBtnPrimary]}
              onPress={() => router.push('/contact_us' as unknown as any)}
            >
              <Text style={styles.helpFooterBtnPrimaryText}>{t('b4_hcContactUsBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.helpFooterBtn}
              onPress={() => router.push('/feedback' as unknown as any)}
            >
              <Text style={styles.helpFooterBtnText}>{t('b4_hcSendFeedbackBtn')}</Text>
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
