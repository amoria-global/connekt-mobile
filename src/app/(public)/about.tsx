import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { spacing, fontSize, makeStyles } from '@/theme';
import { useLanguage } from '@/hooks/useLanguage';

export default function AboutScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  const values = [
    { title: t('b4_valInnovationTitle'), desc: t('b4_valInnovationDesc') },
    { title: t('b4_valTrustTitle'), desc: t('b4_valTrustDesc') },
    { title: t('b4_valExcellenceTitle'), desc: t('b4_valExcellenceDesc') },
    { title: t('b4_valWellnessTitle'), desc: t('b4_valWellnessDesc') },
    { title: t('b4_valGrowthTitle'), desc: t('b4_valGrowthDesc') },
  ];
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_aboutTitle')}</Text>
          <Text style={styles.subtitle}>{t('b4_aboutSubtitle')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('b4_aboutMissionTitle')}</Text>
          <Text style={styles.bodyText}>
            {t('b4_aboutMissionBody')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('b4_aboutVisionTitle')}</Text>
          <Text style={styles.bodyText}>
            {t('b4_aboutVisionBody')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('b4_aboutJourneyTitle')}</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>{t('b4_aboutJourney1Title')}</Text> {t('b4_aboutJourney1Body')}{'\n\n'}
            <Text style={styles.bold}>{t('b4_aboutJourney2Title')}</Text> {t('b4_aboutJourney2Body')}{'\n\n'}
            <Text style={styles.bold}>{t('b4_aboutJourney3Title')}</Text> {t('b4_aboutJourney3Body')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('b4_aboutCoreValuesTitle')}</Text>
          {values.map((v, i) => (
            <View key={i} style={styles.valueCard}>
              <Text style={styles.valueTitle}>{v.title}</Text>
              <Text style={styles.valueDesc}>{v.desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: c.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: c.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.md,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: c.textMuted,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
    color: c.text,
  },
  valueCard: {
    backgroundColor: c.card,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  valueTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.xs,
  },
  valueDesc: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
  },
}));
