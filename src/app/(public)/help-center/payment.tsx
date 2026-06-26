import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSize, spacing } from '@/theme';

export default function PaymentHelpScreen() {
  const [openSection, setOpenSection] = useState<string | null>('escrow');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Payment</Text>
          <Text style={styles.subtitle}>
            Learn how payments, escrow, refunds, and earnings work on Amoria Connekyt
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('escrow')}
          >
            <Text style={styles.accordionTitle}>How Escrow Works</Text>
            <Text style={styles.accordionIcon}>{openSection === 'escrow' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'escrow' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Our escrow system ensures both clients and photographers are protected throughout the booking process.
              </Text>
              <View style={[styles.card, { borderColor: '#10B98126', backgroundColor: '#10B9810A' }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>1. Payment is Held:</Text> The client pays upfront, and funds are held safely.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>2. Services Rendered:</Text> The photographer completes the shoot.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>3. Approval:</Text> The client approves the delivered photos.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>4. Funds Released:</Text> The photographer receives payment.</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('refunds')}
          >
            <Text style={styles.accordionTitle}>Refunds & Cancellations</Text>
            <Text style={styles.accordionIcon}>{openSection === 'refunds' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'refunds' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Refunds are handled based on the photographer's cancellation policy. If a photographer cancels, clients receive a full refund.
              </Text>
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
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  listItem: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 24, marginBottom: spacing.sm },
  bold: { fontWeight: '700', color: colors.text },
});
