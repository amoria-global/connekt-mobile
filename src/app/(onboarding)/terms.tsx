/**
 * Terms & Conditions — shown ONCE on first install (persisted via
 * onboarding.termsAccepted). The user must scroll and accept before the
 * app routes anywhere else. The root route guard forces this screen while
 * `termsAccepted === false`.
 */
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from '@/store/onboarding';
import { spacing, radii, fonts, makeStyles } from '@/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Acceptance',
    body: 'By creating an account or using Connekyt you agree to these Terms & Conditions and our Privacy Policy. If you do not agree, please do not use the app.',
  },
  {
    title: '2. Your account',
    body: 'You are responsible for the accuracy of the information you provide and for keeping your login secure. You must be old enough to enter a binding contract in your country.',
  },
  {
    title: '3. Bookings & payments',
    body: 'Payments are processed by our payment partners. Booking deposits may be held in escrow and released to photographers on event completion. Fees and commissions are shown before you pay.',
  },
  {
    title: '4. Content & albums',
    body: 'Photographers retain rights to their work. Purchased photos are licensed to you for personal use. Do not upload content you do not have the rights to, and respect others’ privacy.',
  },
  {
    title: '5. Live streams',
    body: 'Live chat and reactions must remain respectful. We may remove content or restrict accounts that breach community standards or applicable law.',
  },
  {
    title: '6. Refunds & disputes',
    body: 'If a paid service is not delivered, you may be eligible for a refund per our policy. Contact support to raise a dispute; escrowed funds help protect both parties.',
  },
  {
    title: '7. Changes',
    body: 'We may update these terms from time to time. Continued use after an update means you accept the revised terms.',
  },
];

export default function TermsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const acceptTerms = useOnboarding((s) => s.acceptTerms);

  const onAccept = async () => {
    await acceptTerms();
    // Onboarding still runs each launch — head to the splash/intro next.
    router.replace('/splash');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="document-text" size={22} color="#fff" />
        </View>
        <Text style={styles.eyebrow}>BEFORE YOU START</Text>
        <Text style={styles.title}>Terms &amp; Conditions</Text>
        <Text style={styles.subtitle}>Please review and accept to continue.</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Pressable style={({ pressed }) => [styles.accept, pressed && { opacity: 0.9 }]} onPress={onAccept}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.acceptText}>I agree &amp; continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background, paddingHorizontal: spacing.xl },
  header: { gap: 4, marginBottom: spacing.md },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted },

  scroll: { flex: 1 },
  scrollContent: { paddingVertical: spacing.md, gap: spacing.lg },
  section: { gap: 4 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.text },
  sectionBody: { fontFamily: fonts.regular, fontSize: 14, color: c.textSoft, lineHeight: 21 },

  footer: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSoft },
  accept: {
    height: 54,
    borderRadius: radii.full,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
}));
