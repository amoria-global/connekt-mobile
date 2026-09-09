/**
 * Account deletion screen — satisfies Google Play's mandatory in-app
 * account-deletion requirement. The user must type DELETE to confirm; on
 * success the backend anonymizes all personal data and permanently disables
 * login, then we sign the user out (the root guard routes back to auth).
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { deleteAccount } from '@/features/profile/api';
import { isApiError, useAuth } from '@/store/auth';
import { colors, spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

const CONFIRM_WORD = 'DELETE';

const CONSEQUENCES = [
  'Your profile, name, email, and phone number are permanently removed.',
  'You lose access to your bookings, purchased photos, and streams.',
  'Your photos and identity documents are deleted from your account.',
  'This cannot be undone — you will need to create a new account to return.',
];

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const logout = useAuth((s) => s.logout);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canDelete = confirm.trim().toUpperCase() === CONFIRM_WORD;

  const onDelete = async () => {
    if (!canDelete || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteAccount();
      // Clear the local session; the app's root guard redirects to sign-in.
      await logout();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not delete your account. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Ionicons name="warning-outline" size={30} color={colors.error} />
        </View>

        <Text style={styles.title}>Delete your account</Text>
        <Text style={styles.subtitle}>
          Deleting your Connekyt account is permanent. Please read what happens before you continue.
        </Text>

        <View style={styles.card}>
          {CONSEQUENCES.map((c) => (
            <View key={c} style={styles.bulletRow}>
              <Ionicons name="close-circle" size={16} color={colors.error} style={{ marginTop: 2 }} />
              <Text style={styles.bulletText}>{c}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Some transaction records may be retained where required by law, but they are no longer
          linked to your personal information.
        </Text>

        <Text style={styles.confirmLabel}>
          Type <Text style={styles.confirmWord}>{CONFIRM_WORD}</Text> to confirm
        </Text>
        <Input
          value={confirm}
          onChangeText={setConfirm}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
          error={error ?? undefined}
        />

        <Button
          title="Permanently delete my account"
          onPress={onDelete}
          loading={submitting}
          disabled={!canDelete}
          variant="danger"
        />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { gap: spacing.md, paddingVertical: spacing.lg },
  iconWrap: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: c.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: c.text, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bulletText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
  note: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.textMuted, lineHeight: 18 },
  confirmLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted, marginTop: spacing.sm },
  confirmWord: { fontFamily: fonts.bold, color: c.error },
}));
