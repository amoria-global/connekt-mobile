import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TERMS_SECTIONS } from '@/content/termsOfService';
import { spacing, fontSize, makeStyles } from '@/theme';

export default function TermsOfServiceScreen() {
  const styles = useStyles();
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Terms & Conditions</Text>
          <Text style={styles.subtitle}>The agreement that governs your use of Connekyt</Text>
          <Text style={styles.updated}>Amoria Global Tech Ltd. (Rwanda)</Text>
        </View>

        {TERMS_SECTIONS.map((section, idx) => (
          <View key={section.id ?? idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.bodyText}>{section.content}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  header: { marginBottom: spacing.xxl, alignItems: 'center' },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: c.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: { fontSize: fontSize.md, color: c.primary, fontWeight: '600', textAlign: 'center' },
  updated: { fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.md,
  },
  bodyText: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 24 },
}));
