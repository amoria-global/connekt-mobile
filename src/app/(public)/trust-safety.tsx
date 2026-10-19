import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles } from '@/theme';

export default function TrustSafetyScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  const sections = [
    { title: t('b4_trustSec1Title'), content: t('b4_trustSec1Content') },
    { title: t('b4_trustSec2Title'), content: t('b4_trustSec2Content') },
    { title: t('b4_trustSec3Title'), content: t('b4_trustSec3Content') },
    { title: t('b4_trustSec4Title'), content: t('b4_trustSec4Content') },
    { title: t('b4_trustSec5Title'), content: t('b4_trustSec5Content') },
    { title: t('b4_trustSec6Title'), content: t('b4_trustSec6Content') },
  ];
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_trustTitle')}</Text>
          <Text style={styles.subtitle}>{t('b4_trustSubtitle')}</Text>
        </View>

        {sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.bodyText}>{section.content}</Text>
          </View>
        ))}
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
}));
