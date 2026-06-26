import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSize, spacing } from '@/theme';

export default function TechSupportHelpScreen() {
  const [openSection, setOpenSection] = useState<string | null>('issues');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Technical Support</Text>
          <Text style={styles.subtitle}>
            Troubleshoot common issues and get technical help
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('issues')}
          >
            <Text style={styles.accordionTitle}>Common Issues</Text>
            <Text style={styles.accordionIcon}>{openSection === 'issues' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'issues' && (
            <View style={styles.accordionContent}>
              <View style={[styles.card, { borderColor: '#6366F126', backgroundColor: '#6366F10A' }]}>
                <Text style={[styles.bold, { color: '#6366F1', marginBottom: 4 }]}>Login Issues</Text>
                <Text style={styles.listItem}>Ensure your email and password are correct. Try resetting your password if you forgot it.</Text>

                <Text style={[styles.bold, { color: '#6366F1', marginBottom: 4, marginTop: 8 }]}>Upload Errors</Text>
                <Text style={styles.listItem}>Check if your photo exceeds the 20MB limit or is not in JPG/PNG format.</Text>

                <Text style={[styles.bold, { color: '#6366F1', marginBottom: 4, marginTop: 8 }]}>App Crashing</Text>
                <Text style={styles.listItem}>Ensure you have the latest version of the Amoria Connekyt app installed.</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('contact')}
          >
            <Text style={styles.accordionTitle}>Contact Support</Text>
            <Text style={styles.accordionIcon}>{openSection === 'contact' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'contact' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                If you still need help, please reach out to us at support@amoriaconnekyt.com or use the Contact Us page.
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
