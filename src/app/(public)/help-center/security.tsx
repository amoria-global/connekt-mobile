import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles, alpha, useTheme } from '@/theme';

export default function SecurityHelpScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>('security');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_hcCatSecurityName')}</Text>
          <Text style={styles.subtitle}>
            {t('b4_hcSecuritySubtitle')}
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('security')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcAccountSecurity')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'security' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'security' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcSecurityIntro')}
              </Text>
              <View style={[styles.card, { borderColor: alpha(colors.error, 0.15), backgroundColor: alpha(colors.error, 0.04) }]}>
                <Text style={styles.listItem}>{t('b4_hcSecBullet1')}</Text>
                <Text style={styles.listItem}>{t('b4_hcSecBullet2')}</Text>
                <Text style={styles.listItem}>{t('b4_hcSecBullet3')}</Text>
                <Text style={styles.listItem}>{t('b4_hcSecBullet4')}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('privacy')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcDataPrivacy')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'privacy' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'privacy' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcDataPrivacyBody')}
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
}));
