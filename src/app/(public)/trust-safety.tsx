import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSize, spacing } from '@/theme';

const SECTIONS = [
  {
    title: 'Trust & Safety',
    content: `Safety, security, and trust are the foundations of the Amoria Connekyt community. We are committed to creating an environment where clients feel secure booking creative services and professionals feel safe delivering them.`
  },
  {
    title: 'Identity Verification (KYC)',
    content: `We require identity verification for creators receiving payments and for high-value client transactions to prevent fraud and build a trustworthy community. This includes verifying government-issued IDs and cross-referencing information.`
  },
  {
    title: 'Secure Payments',
    content: `Our Hold & Release payment model ensures that funds are held securely during the service and only released upon successful completion. We partner with licensed, secure payment gateways to process all transactions safely.`
  },
  {
    title: 'Community Guidelines',
    content: `We expect all users to act with professionalism and respect. Harassment, discrimination, fraud, or abuse will not be tolerated and may result in immediate account suspension or termination.`
  },
  {
    title: 'Dispute Resolution',
    content: `In the rare event of a disagreement, our dedicated support team provides impartial mediation. We use platform communication and booking details to reach fair resolutions based on our policies.`
  },
  {
    title: 'Reporting Issues',
    content: `If you encounter suspicious behavior, inappropriate content, or feel unsafe at any point, you can report the issue directly through our platform. Our Trust & Safety team reviews all reports promptly.`
  }
];

export default function TrustSafetyScreen() {
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Trust & Safety</Text>
          <Text style={styles.subtitle}>Protecting our community</Text>
        </View>

        {SECTIONS.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.bodyText}>{section.content}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    lineHeight: 24,
  },
});
