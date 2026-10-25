import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles, useTheme, alpha } from '@/theme';

export default function TechSupportHelpScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>('issues');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_hcCatTechSupportName')}</Text>
          <Text style={styles.subtitle}>
            {t('b4_hcTechSubtitle')}
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('issues')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcCommonIssues')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'issues' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'issues' && (
            <View style={styles.accordionContent}>
              <View style={[styles.card, { borderColor: alpha(colors.primaryLight, 0.15), backgroundColor: alpha(colors.primaryLight, 0.04) }]}>
                <Text style={[styles.bold, { color: colors.primaryLight, marginBottom: 4 }]}>{t('b4_hcLoginIssuesTitle')}</Text>
                <Text style={styles.listItem}>{t('b4_hcLoginIssuesDesc')}</Text>

                <Text style={[styles.bold, { color: colors.primaryLight, marginBottom: 4, marginTop: 8 }]}>{t('b4_hcUploadErrorsTitle')}</Text>
                <Text style={styles.listItem}>{t('b4_hcUploadErrorsDesc')}</Text>

                <Text style={[styles.bold, { color: colors.primaryLight, marginBottom: 4, marginTop: 8 }]}>{t('b4_hcAppCrashingTitle')}</Text>
                <Text style={styles.listItem}>{t('b4_hcAppCrashingDesc')}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('contact')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcContactSupportTitle')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'contact' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'contact' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcContactSupportBody')}
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
