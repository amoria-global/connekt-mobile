/**
 * Shared contact / feedback form — mobile port of knockout's contact_us
 * page. Used by both the Contact and Feedback screens (the backend has a
 * single /public/contact-us endpoint that serves both). Tappable contact
 * channels + a name / email / phone / subject / message form.
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput, type PhoneValue } from '@/components/ui/PhoneInput';
import { submitContactMessage } from '@/features/support/api';
import { isApiError } from '@/store/auth';
import { colors, spacing, radii, fontSize, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

const CHANNELS: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; href: string }[] = [
  { key: 'phone', icon: 'call-outline', label: 'Phone', value: '+250 788 437 347', href: 'tel:+250788437347' },
  { key: 'email', icon: 'mail-outline', label: 'Email', value: 'info@connekyt.com', href: 'mailto:info@connekyt.com' },
  { key: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', value: '+250 788 437 347', href: 'https://wa.me/250788437347' },
  { key: 'office', icon: 'location-outline', label: 'Office', value: 'EVA PLAZA, KK 84B St, Kicukiro, Kigali', href: 'https://maps.google.com/?q=EVA+PLAZA+Kigali' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  defaultSubject?: string;
  /** Lock the subject (e.g. a Feedback screen) so it reads as a fixed topic. */
  lockSubject?: boolean;
  submitLabel?: string;
  formTitle?: string;
};

export function ContactForm({
  eyebrow,
  title,
  subtitle,
  defaultSubject = '',
  lockSubject = false,
  submitLabel = 'Send message',
  formTitle = 'Send us a message',
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState<PhoneValue | null>(null);
  // Remounts PhoneInput after a successful send (it owns its digits state).
  const [phoneKey, setPhoneKey] = useState(0);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!fullName.trim()) return setError(tr('Please enter your full name.'));
    if (!EMAIL_RE.test(email)) return setError(tr('Please enter a valid email address.'));
    // Phone stays optional — but if digits were typed, they must be valid.
    if (phone && phone.nsn && !phone.isValid) return setError(tr('Please enter a valid phone number.'));
    if (!subject.trim()) return setError(tr('Please give your message a subject.'));
    if (!message.trim()) return setError(tr('Please tell us how we can help.'));
    setBusy(true);
    try {
      // Wire format: full international digits ("250788123456"); '-' keeps
      // the backend's blank-phone convention.
      await submitContactMessage({ fullName, email, phone: phone?.digits || '-', subject, message });
      setSent(true);
      setFullName('');
      setEmail('');
      setPhone(null);
      setPhoneKey((k) => k + 1);
      setSubject(defaultSubject);
      setMessage('');
    } catch (e) {
      setError(isApiError(e) ? e.message : tr('Could not send your message. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const open = (href: string) => Linking.openURL(href).catch(() => {});

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{tr(eyebrow)}</Text>
        <Text style={styles.title}>{tr(title)}</Text>
        <Text style={styles.subtitle}>{tr(subtitle)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr('Reach us your way')}</Text>
        <View style={styles.channels}>
          {CHANNELS.map((c) => (
            <Pressable key={c.key} style={styles.channel} onPress={() => open(c.href)}>
              <View style={styles.channelIcon}>
                <Ionicons name={c.icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.channelLabel}>{tr(c.label)}</Text>
                <Text style={styles.channelValue} numberOfLines={4}>
                  {c.value}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr(formTitle)}</Text>
        {sent ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.successText}>
              {tr('Message sent')}
            </Text>
            <Pressable onPress={() => setSent(false)}>
              <Text style={styles.sendAnother}>{tr('Send another')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" autoCapitalize="words" />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <PhoneInput
              key={phoneKey}
              label="Phone (optional)"
              defaultIso2="RW"
              onChange={setPhone}
            />
            {!lockSubject ? (
              <Input label="Subject" value={subject} onChangeText={setSubject} placeholder="What is this about?" />
            ) : null}
            <Input
              label="Message"
              value={message}
              onChangeText={setMessage}
              placeholder="How can we help?"
              multiline
              style={styles.messageInput}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button title={busy ? 'Sending…' : submitLabel} onPress={onSubmit} loading={busy} />
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: {
    alignItems: 'center',
    backgroundColor: c.primary,
    padding: spacing.xxl,
    borderRadius: 24,
  },
  eyebrow: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 32, fontWeight: '800', color: c.textOnPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 24 },

  card: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: c.text, marginBottom: spacing.sm },

  channels: { gap: spacing.md },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: c.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  channelIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: c.textMuted,
    fontWeight: '700',
    marginBottom: 2,
  },
  channelValue: { fontSize: fontSize.sm, color: c.text, fontWeight: '600' },

  messageInput: { height: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  errorText: { color: c.error, fontSize: fontSize.sm },

  successBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  successText: { color: c.text, fontSize: fontSize.md, textAlign: 'center', lineHeight: 22 },
  sendAnother: { color: c.primary, fontWeight: '700', fontSize: fontSize.sm, marginTop: spacing.sm },
}));
