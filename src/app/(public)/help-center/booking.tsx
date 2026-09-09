import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { spacing, fontSize, makeStyles } from '@/theme';

const tips = [
  { title: 'Book Early', desc: 'Reserve popular photographers 4-8 weeks in advance, especially for weddings and peak seasons.' },
  { title: 'Clear Communication', desc: 'Discuss your vision, must-have shots, and expectations upfront to ensure alignment.' },
  { title: 'Realistic Timeline', desc: 'Allow 14-21 days for photo editing and delivery. Rush delivery may incur additional fees.' },
  { title: 'Written Agreement', desc: 'Review the booking terms carefully including cancellation policy, usage rights, and deliverables.' },
  { title: 'Location Details', desc: 'Provide exact venue address, parking information, and contact person for the event day.' },
  { title: 'Shot List', desc: 'Share a list of important people to photograph and specific moments you want captured.' },
];

export default function BookingHelpScreen() {
  const styles = useStyles();
  const [openSection, setOpenSection] = useState<string | null>('booking');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Booking & Management</Text>
          <Text style={styles.subtitle}>
            Everything you need to know about booking photographers and managing your sessions
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('booking')}
          >
            <Text style={styles.accordionTitle}>How to Book</Text>
            <Text style={styles.accordionIcon}>{openSection === 'booking' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'booking' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Booking a photographer on Amoria Connekyt is simple and secure. Our platform connects you with professional photographers who match your specific needs, budget, and style preferences.
              </Text>

              <Text style={styles.sectionTitle}>Finding Your Photographer</Text>
              <View style={styles.card}>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>1. Location & Availability:</Text> Use the location filter to find photographers in your area. Check their calendar for available dates.
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>2. Photography Style:</Text> Browse portfolios to find photographers whose style matches your vision.
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>3. Budget Range:</Text> Set your budget using the price filter to view photographers within your price range.
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>4. Reviews & Ratings:</Text> Read reviews from previous clients to assess quality and reliability.
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.bold}>5. Package Comparison:</Text> Compare different photography packages and inclusions.
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Making Your Booking</Text>
              <View style={[styles.card, styles.cardGreen]}>
                <Text style={styles.listItem}>• Click "Book Now" on your chosen photographer's profile</Text>
                <Text style={styles.listItem}>• Select your preferred date, time, and package</Text>
                <Text style={styles.listItem}>• Provide event details and specific requests</Text>
                <Text style={styles.listItem}>• Review the total cost including fees and taxes</Text>
                <Text style={styles.listItem}>• Complete secure payment through escrow</Text>
                <Text style={styles.listItem}>• Receive instant booking confirmation via email</Text>
                <Text style={styles.listItem}>• Communicate directly via messaging to finalize details</Text>
              </View>

              <Text style={styles.sectionTitle}>Booking Tips for Best Results</Text>
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
