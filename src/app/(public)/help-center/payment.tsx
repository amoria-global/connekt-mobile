import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles, alpha, useTheme } from '@/theme';

export default function PaymentHelpScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>('escrow');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_hcCatPaymentName')}</Text>
          <Text style={styles.subtitle}>
            {t('b4_hcPaymentSubtitle')}
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('escrow')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcHowEscrowWorks')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'escrow' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'escrow' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcEscrowIntro')}
              </Text>
              <View style={[styles.card, { borderColor: alpha(colors.success, 0.15), backgroundColor: alpha(colors.success, 0.04) }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcEscrowStep1Title')}</Text> {t('b4_hcEscrowStep1Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcEscrowStep2Title')}</Text> {t('b4_hcEscrowStep2Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcEscrowStep3Title')}</Text> {t('b4_hcEscrowStep3Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcEscrowStep4Title')}</Text> {t('b4_hcEscrowStep4Desc')}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('refunds')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcRefundsCancellations')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'refunds' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'refunds' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcRefundsBody')}
              </Text>
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
  card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  listItem: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 24, marginBottom: spacing.sm },
  bold: { fontWeight: '700', color: c.text },
}));
