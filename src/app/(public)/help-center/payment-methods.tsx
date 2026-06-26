import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSize, spacing } from '@/theme';

export default function PaymentMethodsHelpScreen() {
  const [openSection, setOpenSection] = useState<string | null>('cards');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Payment Methods</Text>
          <Text style={styles.subtitle}>
            Complete guide to all accepted payment methods and how to use them securely
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('cards')}
          >
            <Text style={styles.accordionTitle}>Credit & Debit Cards</Text>
            <Text style={styles.accordionIcon}>{openSection === 'cards' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'cards' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                We accept all major credit and debit cards for fast and secure payments. Your card information is encrypted and processed through industry-leading payment gateways, ensuring maximum security for every transaction.
              </Text>

              <Text style={styles.sectionTitle}>Accepted Card Types</Text>
              <View style={[styles.card, { borderColor: '#F59E0B26', backgroundColor: '#F59E0B0A' }]}>
                <Text style={styles.listItem}>• Visa (Credit and Debit)</Text>
                <Text style={styles.listItem}>• Mastercard</Text>
                <Text style={styles.listItem}>• American Express</Text>
                <Text style={styles.listItem}>• Discover</Text>
                <Text style={styles.listItem}>• Local Cards (Interac, Maestro)</Text>
              </View>

              <Text style={styles.sectionTitle}>Card Security</Text>
              <View style={styles.card}>
                <Text style={styles.listItem}><Text style={styles.bold}>PCI-DSS Level 1:</Text> Highest security standard for card processing.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>Encryption:</Text> 256-bit SSL encryption.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>Tokenization:</Text> Card numbers replaced with secure tokens.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>3D Secure 2.0:</Text> Additional authentication layer.</Text>
              </View>

              <Text style={styles.sectionTitle}>Troubleshooting Card Issues</Text>
              <View style={[styles.card, { borderColor: '#EF444426', backgroundColor: '#EF44440A' }]}>
                <Text style={[styles.bold, { color: '#EF4444', marginBottom: 4 }]}>Card Declined</Text>
                <Text style={styles.listItem}>Contact your bank to ensure online transactions are enabled. Verify sufficient funds.</Text>

                <Text style={[styles.bold, { color: '#EF4444', marginBottom: 4, marginTop: 8 }]}>CVV Verification Failed</Text>
                <Text style={styles.listItem}>Double-check the 3-digit CVV code on the back of your card (4 digits on front for Amex).</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxxl },
  header: { backgroundColor: colors.primary, padding: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.textOnPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.textOnPrimary + 'CC' },
  content: { padding: spacing.md },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, padding: spacing.lg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  accordionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  accordionIcon: { fontSize: fontSize.xl, color: colors.textMuted },
  accordionContent: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  bodyText: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 24, marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  listItem: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 24, marginBottom: spacing.sm },
  bold: { fontWeight: '700', color: colors.text },
});
