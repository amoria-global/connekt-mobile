import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { spacing, fontSize, makeStyles } from '@/theme';

export default function SecurityHelpScreen() {
  const styles = useStyles();
  const [openSection, setOpenSection] = useState<string | null>('security');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Security</Text>
          <Text style={styles.subtitle}>
            Best practices for keeping your account and data safe
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('security')}
          >
            <Text style={styles.accordionTitle}>Account Security</Text>
            <Text style={styles.accordionIcon}>{openSection === 'security' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'security' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                We prioritize your security. Follow these guidelines to keep your account safe:
              </Text>
              <View style={[styles.card, { borderColor: '#EF444426', backgroundColor: '#EF44440A' }]}>
                <Text style={styles.listItem}>• Use a strong, unique password</Text>
                <Text style={styles.listItem}>• Enable Two-Factor Authentication (if available)</Text>
                <Text style={styles.listItem}>• Do not share your login details</Text>
                <Text style={styles.listItem}>• Beware of phishing attempts</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('privacy')}
          >
            <Text style={styles.accordionTitle}>Data Privacy</Text>
            <Text style={styles.accordionIcon}>{openSection === 'privacy' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'privacy' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Your data is securely stored and never shared with third parties without your consent. We comply with GDPR and CCPA standards.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: { paddingBottom: spacing.xxxl },
  header: { backgroundColor: c.primary, padding: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: c.textOnPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: c.textOnPrimary + 'CC' },
  content: { padding: spacing.md },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, padding: spacing.lg, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: spacing.sm },
  accordionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: c.text },
  accordionIcon: { fontSize: fontSize.xl, color: c.textMuted },
  accordionContent: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  bodyText: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 24, marginBottom: spacing.lg },
  card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  listItem: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 24, marginBottom: spacing.sm },
}));
