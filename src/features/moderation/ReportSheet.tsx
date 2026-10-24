/**
 * One report sheet for every content surface.
 *
 * Reasons come from REPORT_REASONS keyed by target type, so a photo offers
 * photo reasons and a chat message offers harassment reasons. The caller
 * supplies a `submit` function rather than a target id, so the same sheet
 * serves both the authenticated endpoint and the anonymous-viewer one.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { useRouter, type Href } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { spacing, fontSize, fontWeight, makeStyles } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { REPORT_REASONS, REPORT_TARGET_LABEL, type ReportTarget } from './api';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { glassTile } from '@/components/ui/GlassCard';

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  /** Submits the report. Resolves with the message to show the user. */
  submit: (reason: string, description: string) => Promise<string>;
  /** Shown under the title, e.g. the author's name. */
  subject?: string;
};

function isApiError(e: unknown): e is { status?: number; message: string } {
  return !!e && typeof e === 'object' && 'message' in e;
}

export function ReportSheet({ visible, onClose, targetType, submit, subject }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const { tr } = useSharedT();
  const reasons = REPORT_REASONS[targetType];
  const [reason, setReason] = useState<string>(reasons[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reopening the sheet for different content must not inherit the last
  // report's reason or notes.
  useEffect(() => {
    if (visible) {
      setReason(reasons[0]);
      setDescription('');
    }
  }, [visible, reasons]);

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const message = await submit(reason, description);
      onClose();
      Alert.alert(tr('Thanks for telling us'), message);
    } catch (e) {
      // Photos and streams are browsable signed-out, but only live chat has an
      // anonymous report path. Everything else needs an account, so say that
      // rather than surfacing a bare 401.
      if (isApiError(e) && e.status === 401) {
        onClose();
        Alert.alert(
          tr('Sign in to report'),
          tr('You need a Connekyt account to report this. Signing in lets our team follow up with you.'),
          [
            { text: tr('Not now'), style: 'cancel' },
            { text: tr('Sign in'), onPress: () => router.push('/login' as Href) },
          ],
        );
        return;
      }
      Alert.alert(
        tr('Could not submit report'),
        isApiError(e) ? e.message : tr('Try again'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const label = REPORT_TARGET_LABEL[targetType];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <GlassScrim style={styles.backdrop} onPress={onClose}>
        <GlassSheetHost style={styles.sheet}>
          <Text style={styles.title}>{tr(`Report ${label}`)}</Text>
          <Text style={styles.hint}>
            {subject ? `${subject} — ` : ''}{tr('Pick a reason so our team can review it. We look at every report within 24 hours.')}
          </Text>

          <View style={styles.chipRow}>
            {reasons.map((r) => {
              const active = r === reason;
              return (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{tr(r)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            placeholder="Add details (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.input}
          />

          <Button
            title="Submit report"
            variant="danger"
            onPress={onSubmit}
            loading={submitting}
          />
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={submitting} />
        </GlassSheetHost>
      </GlassScrim>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  hint: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 16,
    ...glassTile(c),
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: fontSize.xs, color: c.textSoft, fontWeight: fontWeight.semibold },
  chipTextActive: { color: c.textOnPrimary },
  input: { marginTop: spacing.sm, marginBottom: spacing.sm },
}));
