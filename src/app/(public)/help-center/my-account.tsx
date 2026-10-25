import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles, useTheme, alpha } from '@/theme';

export default function MyAccountHelpScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>('create');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_hcCatMyAccountName')}</Text>
          <Text style={styles.subtitle}>
            {t('b4_hcMyAccountSubtitle')}
          </Text>
        </View>

        <View style={styles.content}>
          {/* Section 1: Creating Your Account */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('create')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcCreatingAccount')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'create' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'create' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcCreateIntro')}
              </Text>

              <Text style={styles.sectionTitle}>{t('b4_hcRegStepsTitle')}</Text>
              <View style={[styles.card, { borderColor: alpha(colors.primary, 0.15), backgroundColor: alpha(colors.primary, 0.04) }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcRegStep1Title')}</Text> {t('b4_hcRegStep1Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcRegStep2Title')}</Text> {t('b4_hcRegStep2Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcRegStep3Title')}</Text> {t('b4_hcRegStep3Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcRegStep4Title')}</Text> {t('b4_hcRegStep4Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcRegStep5Title')}</Text> {t('b4_hcRegStep5Desc')}</Text>
              </View>

              <Text style={styles.sectionTitle}>{t('b4_hcAccountTypesTitle')}</Text>
              <View style={styles.card}>
                <Text style={[styles.bold, { color: colors.primary, fontSize: fontSize.md }]}>{t('b4_hcClientAccountTitle')}</Text>
                <Text style={styles.listItem}>{t('b4_hcClientAccountDesc')}</Text>
              </View>
              <View style={styles.card}>
                <Text style={[styles.bold, { color: colors.success, fontSize: fontSize.md }]}>{t('b4_hcPhotographerAccountTitle')}</Text>
                <Text style={styles.listItem}>{t('b4_hcPhotographerAccountDesc')}</Text>
              </View>
            </View>
          )}

          {/* Section 2: Managing Your Profile */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('manage')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcManagingProfile')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'manage' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'manage' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcManageIntro')}
              </Text>

              <Text style={styles.sectionTitle}>{t('b4_hcUpdatingProfileTitle')}</Text>
              <View style={[styles.card, { borderColor: alpha(colors.success, 0.15), backgroundColor: alpha(colors.success, 0.04) }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcUpdateStep1Title')}</Text> {t('b4_hcUpdateStep1Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcUpdateStep2Title')}</Text> {t('b4_hcUpdateStep2Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcUpdateStep3Title')}</Text> {t('b4_hcUpdateStep3Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcUpdateStep4Title')}</Text> {t('b4_hcUpdateStep4Desc')}</Text>
              </View>

              <Text style={styles.sectionTitle}>{t('b4_hcPhotographerPortfolioTitle')}</Text>
              <Text style={styles.bodyText}>
                {t('b4_hcPhotographerPortfolioBody')}
              </Text>
            </View>
          )}

          {/* Section 3: Account Verification */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('verify')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcAccountVerification')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'verify' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'verify' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcVerifyIntro')}
              </Text>

              <Text style={styles.sectionTitle}>{t('b4_hcVerifyReqTitle')}</Text>
              <View style={[styles.card, { borderColor: alpha(colors.primary, 0.15), backgroundColor: alpha(colors.primary, 0.04) }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcVerifyStep1Title')}</Text> {t('b4_hcVerifyStep1Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcVerifyStep2Title')}</Text> {t('b4_hcVerifyStep2Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcVerifyStep3Title')}</Text> {t('b4_hcVerifyStep3Desc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcVerifyStep4Title')}</Text> {t('b4_hcVerifyStep4Desc')}</Text>
              </View>
            </View>
          )}

          {/* Section 4: Notification Preferences */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('notifications')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcNotificationPreferences')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'notifications' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'notifications' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcNotifIntro')}
              </Text>
              <View style={styles.card}>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcNotifPushTitle')}</Text> {t('b4_hcNotifPushDesc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcNotifEmailTitle')}</Text> {t('b4_hcNotifEmailDesc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcNotifInAppTitle')}</Text> {t('b4_hcNotifInAppDesc')}</Text>
              </View>
            </View>
          )}

          {/* Section 5: Account Settings & Privacy */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('settings')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcSettingsPrivacy')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'settings' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'settings' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcSettingsIntro')}
              </Text>
              <View style={[styles.card, { borderColor: alpha(colors.error, 0.15), backgroundColor: alpha(colors.error, 0.04) }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcPrivacyVisTitle')}</Text> {t('b4_hcPrivacyVisDesc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcPrivacyContactTitle')}</Text> {t('b4_hcPrivacyContactDesc')}</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>{t('b4_hcPrivacyPortfolioTitle')}</Text> {t('b4_hcPrivacyPortfolioDesc')}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    backgroundColor: c.primary,
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: c.textOnPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: c.textOnPrimary + 'CC',
  },
  content: {
    padding: spacing.md,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.card,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.sm,
  },
  accordionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: c.text,
  },
  accordionIcon: {
    fontSize: fontSize.xl,
    color: c.textMuted,
  },
  accordionContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: c.textMuted,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: c.card,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  listItem: {
    fontSize: fontSize.md,
    color: c.textMuted,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  bold: {
    fontWeight: '700',
    color: c.text,
  },
}));
