import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles } from '@/theme';

export default function BookingHelpScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>('booking');

  const tips = [
    { title: t('b4_hcTip1Title'), desc: t('b4_hcTip1Desc') },
    { title: t('b4_hcTip2Title'), desc: t('b4_hcTip2Desc') },
    { title: t('b4_hcTip3Title'), desc: t('b4_hcTip3Desc') },
    { title: t('b4_hcTip4Title'), desc: t('b4_hcTip4Desc') },
    { title: t('b4_hcTip5Title'), desc: t('b4_hcTip5Desc') },
    { title: t('b4_hcTip6Title'), desc: t('b4_hcTip6Desc') },
  ];

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_hcBookingTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('b4_hcBookingSubtitle')}
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('booking')}
          >
            <Text style={styles.accordionTitle}>{t('b4_hcHowToBook')}</Text>
            <Text style={styles.accordionIcon}>{openSection === 'booking' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'booking' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                {t('b4_hcBookingIntro')}
              </Text>

              <Text style={styles.sectionTitle}>{t('b4_hcFindingPhotographer')}</Text>
              <View style={styles.card}>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>{t('b4_hcFindStep1Title')}</Text> {t('b4_hcFindStep1Desc')}
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>{t('b4_hcFindStep2Title')}</Text> {t('b4_hcFindStep2Desc')}
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>{t('b4_hcFindStep3Title')}</Text> {t('b4_hcFindStep3Desc')}
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>{t('b4_hcFindStep4Title')}</Text> {t('b4_hcFindStep4Desc')}
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>{t('b4_hcFindStep5Title')}</Text> {t('b4_hcFindStep5Desc')}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>{t('b4_hcMakingBooking')}</Text>
              <View style={[styles.card, styles.cardGreen]}>
                <Text style={styles.listItem}>{t('b4_hcMakeBullet1')}</Text>
                <Text style={styles.listItem}>{t('b4_hcMakeBullet2')}</Text>
                <Text style={styles.listItem}>{t('b4_hcMakeBullet3')}</Text>
                <Text style={styles.listItem}>{t('b4_hcMakeBullet4')}</Text>
                <Text style={styles.listItem}>{t('b4_hcMakeBullet5')}</Text>
                <Text style={styles.listItem}>{t('b4_hcMakeBullet6')}</Text>
                <Text style={styles.listItem}>{t('b4_hcMakeBullet7')}</Text>
              </View>

              <Text style={styles.sectionTitle}>{t('b4_hcBookingTipsTitle')}</Text>
              {tips.map((tip, idx) => (
                <View key={idx} style={styles.tipCard}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipDesc}>{tip.desc}</Text>
                </View>
              ))}
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
    backgroundColor: c.primary + '0A',
    borderColor: c.primary + '26',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardGreen: {
    backgroundColor: '#10B9810A',
    borderColor: '#10B98126',
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
  tipCard: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tipTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
  },
}));
