import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles, useTheme, alpha } from '@/theme';

export default function PaymentMethodsHelpScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>('cards');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_hcCatPaymentMethodsName')}</Text>
          <Text style={styles.subtitle}>
            {t('b4_hcPmSubtitle')}
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('cards')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcPmCreditDebitCards')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'cards' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'cards' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcPmCardsIntro')}
              </Text>

              <Text style={styles.sectionTitle}>{t('b4_hcPmAcceptedTypes')}</Text>
              <View style={[styles.card, { borderColor: alpha(colors.pending, 0.15), backgroundColor: alpha(colors.pending, 0.04) }]}>
                <Text style={styles.listItem}>{t('b4_hcPmVisa')}</Text>
                <Text style={styles.listItem}>{t('b4_hcPmMastercard')}</Text>
                <Text style={styles.listItem}>{t('b4_hcPmAmex')}</Text>
                <Text style={styles.listItem}>{t('b4_hcPmDiscover')}</Text>
                <Text style={styles.listItem}>{t('b4_hcPmLocalCards')}</Text>
              </View>

              <Text style={styles.sectionTitle}>{t('b4_hcPmCardSecurity')}</Text>
              <View style={styles.card}>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcPmPciTitle')}</Text> {t('b4_hcPmPciDesc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcPmEncryptionTitle')}</Text> {t('b4_hcPmEncryptionDesc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcPmTokenizationTitle')}</Text> {t('b4_hcPmTokenizationDesc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcPm3dsTitle')}</Text> {t('b4_hcPm3dsDesc')}</Text>
              </View>

              <Text style={styles.sectionTitle}>{t('b4_hcPmTroubleshooting')}</Text>
              <View style={[styles.card, { borderColor: alpha(colors.error, 0.15), backgroundColor: alpha(colors.error, 0.04) }]}>
                <Text style={[styles.bold, { color: colors.error, marginBottom: 4 }]}>{t('b4_hcPmCardDeclinedTitle')}</Text>
                <Text style={styles.listItem}>{t('b4_hcPmCardDeclinedDesc')}</Text>

                <Text style={[styles.bold, { color: colors.error, marginBottom: 4, marginTop: 8 }]}>{t('b4_hcPmCvvFailedTitle')}</Text>
                <Text style={styles.listItem}>{t('b4_hcPmCvvFailedDesc')}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: { paddingBottom: spacing.xxxl },
  header: { backgroundColor: c.primary, padding: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: c.textOnPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: c.textOnPrimary + 'CC' },
  content: { padding: spacing.md },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, padding: spacing.lg, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: spacing.sm },
  accordionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: c.text },
  accordionIcon: { fontSize: fontSize.xl, color: c.textMuted },
  accordionContent: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  bodyText: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 24, marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.md, marginTop: spacing.md },
  card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  listItem: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 24, marginBottom: spacing.sm },
  bold: { fontWeight: '700', color: c.text },
}));
