/**
 * Account deletion screen — satisfies Google Play's mandatory in-app
 * account-deletion requirement. The user must type DELETE to confirm; on
 * success the backend anonymizes all personal data and permanently disables
 * login, then we sign the user out (the root guard routes back to auth).
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { ListRow } from '@/features/client/studio';
import { ActionButton, Card, SectionHeader } from '@/features/photographer/kit';
import { deleteAccount } from '@/features/profile/api';
import { isApiError, useAuth } from '@/store/auth';
import { useLanguage, type TranslationKey } from '@/store/language';
import { spacing, fontSize, fonts, makeStyles } from '@/theme';

const CONFIRM_WORD = 'DELETE';

const CONSEQUENCE_KEYS: TranslationKey[] = [
  'b1_deleteConsequence1',
  'b1_deleteConsequence2',
  'b1_deleteConsequence3',
  'b1_deleteConsequence4',
];

export default function DeleteAccountScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
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
      setError(isApiError(err) ? err.message : t('b1_deleteErr'));
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <UserHeaderBand eyebrow="ACCOUNT" title={t('b1_deleteTitle')} subtitle={t('b1_deleteSubtitle')} duplicatesHeader />

        <SectionHeader title="What happens" />
        <Card style={styles.card}>
          {CONSEQUENCE_KEYS.map((key, index) => (
            <ListRow key={key} icon="close-circle" tone="error" title={t(key)} divider={index < CONSEQUENCE_KEYS.length - 1} />
          ))}
        </Card>
        <Text style={styles.note}>{t('b1_deleteNote')}</Text>

        <View style={styles.danger}>
          <Text style={styles.dangerEyebrow}>DANGER ZONE</Text>
          <Text style={styles.confirmLabel}>
            {t('b1_deleteTypePrefix')} <Text style={styles.confirmWord}>{CONFIRM_WORD}</Text> {t('b1_deleteTypeSuffix')}
          </Text>
          <Input
            value={confirm}
            onChangeText={setConfirm}
            placeholder={CONFIRM_WORD}
            autoCapitalize="characters"
            autoCorrect={false}
            error={error ?? undefined}
          />
          <ActionButton
            variant="destructive"
            icon="trash-outline"
            label={t('b1_deleteBtn')}
            onPress={onDelete}
            busy={submitting}
            disabled={!canDelete || submitting}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  card: { padding: 0 },
  note: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.textMuted, lineHeight: 18 },
  danger: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: spacing.lg,
  },
  dangerEyebrow: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: c.error, letterSpacing: 1 },
  confirmLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
  confirmWord: { fontFamily: fonts.bold, color: c.error },
}));
