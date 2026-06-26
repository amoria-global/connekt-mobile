import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSize, spacing } from '@/theme';

export default function MyAccountHelpScreen() {
  const [openSection, setOpenSection] = useState<string | null>('create');

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Account</Text>
          <Text style={styles.subtitle}>
            Complete guide to creating, managing, and optimizing your Amoria Connekyt account
          </Text>
        </View>

        <View style={styles.content}>
          {/* Section 1: Creating Your Account */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('create')}
          >
            <Text style={styles.accordionTitle}>Creating Your Account</Text>
            <Text style={styles.accordionIcon}>{openSection === 'create' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'create' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Create your Amoria Connekyt account in minutes and join our vibrant photography community. Our streamlined registration process ensures you can start booking photographers or accepting bookings quickly and securely.
              </Text>

              <Text style={styles.sectionTitle}>Registration Steps:</Text>
              <View style={[styles.card, { borderColor: '#083A8526', backgroundColor: '#083A850A' }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>1. Navigate to Sign Up:</Text> Click "Sign Up" on the app.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>2. Choose Account Type:</Text> Select Photographer or Client.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>3. Enter Info:</Text> Provide your email, name, and secure password.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>4. Verification:</Text> Check your email for a verification link.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>5. Complete Profile:</Text> Upload a profile picture and bio.</Text>
              </View>

              <Text style={styles.sectionTitle}>Account Types</Text>
              <View style={styles.card}>
                <Text style={[styles.bold, { color: '#083A85', fontSize: fontSize.md }]}>Client Account</Text>
                <Text style={styles.listItem}>Perfect for individuals and businesses looking to hire professional photographers.</Text>
              </View>
              <View style={styles.card}>
                <Text style={[styles.bold, { color: '#10B981', fontSize: fontSize.md }]}>Photographer Account</Text>
                <Text style={styles.listItem}>Designed for professional photographers to showcase work and earn income.</Text>
              </View>
            </View>
          )}

          {/* Section 2: Managing Your Profile */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('manage')}
          >
            <Text style={styles.accordionTitle}>Managing Your Profile</Text>
            <Text style={styles.accordionIcon}>{openSection === 'manage' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'manage' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Your profile is your digital identity on Amoria Connekyt. Keeping it up-to-date ensures you make the best impression.
              </Text>

              <Text style={styles.sectionTitle}>Updating Your Profile:</Text>
              <View style={[styles.card, { borderColor: '#10B98126', backgroundColor: '#10B9810A' }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>1. Access Settings:</Text> Navigate to "My Account" and tap "Edit Profile".</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>2. Update Info:</Text> Modify your name, location, and contact details.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>3. Upload Picture:</Text> Use a high-quality professional headshot.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>4. Bio:</Text> Highlight your experience or specific event needs.</Text>
              </View>

              <Text style={styles.sectionTitle}>Photographer Portfolio</Text>
              <Text style={styles.bodyText}>
                Upload your best 20-30 photos. Quality always trumps quantity. Organize photos by event type to help clients find relevant work quickly.
              </Text>
            </View>
          )}

          {/* Section 3: Account Verification */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('verify')}
          >
            <Text style={styles.accordionTitle}>Account Verification</Text>
            <Text style={styles.accordionIcon}>{openSection === 'verify' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'verify' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Becoming a verified photographer significantly increases your credibility, visibility, and booking rates. Verified accounts receive exclusive benefits.
              </Text>

              <Text style={styles.sectionTitle}>Verification Requirements</Text>
              <View style={[styles.card, { borderColor: '#3B82F626', backgroundColor: '#3B82F60A' }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>1. Complete Profile:</Text> Fill all required fields.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>2. Submit ID:</Text> Upload a clear photo of your government-issued ID.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>3. Portfolio Samples:</Text> Upload 5-10 high-quality portfolio samples.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>4. Wait for Review:</Text> Our team will review within 3-5 business days.</Text>
              </View>
            </View>
          )}

          {/* Section 4: Notification Preferences */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('notifications')}
          >
            <Text style={styles.accordionTitle}>Notification Preferences</Text>
            <Text style={styles.accordionIcon}>{openSection === 'notifications' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'notifications' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Customize how and when you receive notifications to stay informed without being overwhelmed.
              </Text>
              <View style={styles.card}>
                <Text style={styles.listItem}><Text style={styles.bold}>Push Notifications:</Text> Real-time alerts on your device.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>Email:</Text> Daily digests or important updates directly to your inbox.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>In-App:</Text> See notifications within the dashboard.</Text>
              </View>
            </View>
          )}

          {/* Section 5: Account Settings & Privacy */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('settings')}
          >
            <Text style={styles.accordionTitle}>Account Settings & Privacy</Text>
            <Text style={styles.accordionIcon}>{openSection === 'settings' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'settings' && (
            <View style={styles.accordionContent}>
              <Text style={styles.bodyText}>
                Take full control of your account security and privacy preferences.
              </Text>
              <View style={[styles.card, { borderColor: '#EF444426', backgroundColor: '#EF44440A' }]}>
                <Text style={styles.listItem}><Text style={styles.bold}>Profile Visibility:</Text> Control who can view your profile.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>Contact Info:</Text> Choose whether to display details publicly.</Text>
                <Text style={styles.listItem}><Text style={styles.bold}>Portfolio Privacy:</Text> Restrict to logged-in users or keep public.</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textOnPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textOnPrimary + 'CC',
  },
  content: {
    padding: spacing.md,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  accordionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  accordionIcon: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
  },
  accordionContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  listItem: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
});
