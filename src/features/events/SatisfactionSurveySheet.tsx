/**
 * Client satisfaction survey, shown after a client chooses "Completed".
 *
 * Answering it is what releases the photographer's survey-held fee, so it is
 * deliberately not skippable on the completion path — "Request changes"
 * bypasses it instead. Every question must be answered before submitting,
 * because the server scores an omitted answer as its worst value.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import type { SatisfactionLevel, SatisfactionSurvey, ServiceDelivery } from './survey';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (answers: SatisfactionSurvey) => void;
  submitting?: boolean;
};

type Choice<T> = { label: string; value: T };

const YES_NO: Choice<boolean>[] = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

const DELIVERY: Choice<ServiceDelivery>[] = [
  { label: 'Yes', value: 'YES' },
  { label: 'Partially', value: 'PARTIALLY' },
  { label: 'No', value: 'NO' },
];

const SATISFACTION: Choice<SatisfactionLevel>[] = [
  { label: 'Very satisfied', value: 'VERY_SATISFIED' },
  { label: 'Satisfied', value: 'SATISFIED' },
  { label: 'Not satisfied', value: 'NOT_SATISFIED' },
];

const RECEIVED: Choice<boolean>[] = [
  { label: 'Yes', value: true },
  { label: 'Not yet', value: false },
];

function Question<T>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  const { tr } = useSharedT();
  return (
    <View style={styles.question}>
      <Text style={styles.questionLabel}>{tr(label)}</Text>
      <View style={styles.optionRow}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.option, active && styles.optionActive]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{tr(o.label)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SatisfactionSurveySheet({ visible, onClose, onSubmit, submitting }: Props) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const [attendedEvent, setAttendedEvent] = useState<boolean | null>(null);
  const [serviceDelivery, setServiceDelivery] = useState<ServiceDelivery | null>(null);
  const [satisfactionLevel, setSatisfactionLevel] = useState<SatisfactionLevel | null>(null);
  const [deliverablesReceived, setDeliverablesReceived] = useState<boolean | null>(null);
  const [wouldBookAgain, setWouldBookAgain] = useState<boolean | null>(null);
  const [issuesDescription, setIssuesDescription] = useState('');

  // Reopening for a different event must not inherit the last answers.
  useEffect(() => {
    if (visible) {
      setAttendedEvent(null);
      setServiceDelivery(null);
      setSatisfactionLevel(null);
      setDeliverablesReceived(null);
      setWouldBookAgain(null);
      setIssuesDescription('');
    }
  }, [visible]);

  const complete =
    attendedEvent !== null &&
    serviceDelivery !== null &&
    satisfactionLevel !== null &&
    deliverablesReceived !== null &&
    wouldBookAgain !== null;

  const submit = () => {
    if (!complete || submitting) return;
    onSubmit({
      attendedEvent,
      serviceDelivery,
      satisfactionLevel,
      deliverablesReceived,
      wouldBookAgain,
      issuesDescription: issuesDescription.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{tr('How did it go?')}</Text>
            <Text style={styles.hint}>
              {tr("Your answers confirm the job was done and release the photographer's final payment. It takes about a minute.")}
            </Text>

            <Question
              label="Did the event take place as planned?"
              options={YES_NO}
              value={attendedEvent}
              onChange={setAttendedEvent}
            />
            <Question
              label="Did the photographer deliver the service agreed?"
              options={DELIVERY}
              value={serviceDelivery}
              onChange={setServiceDelivery}
            />
            <Question
              label="How satisfied are you with the work?"
              options={SATISFACTION}
              value={satisfactionLevel}
              onChange={setSatisfactionLevel}
            />
            <Question
              label="Have you received your photos and albums?"
              options={RECEIVED}
              value={deliverablesReceived}
              onChange={setDeliverablesReceived}
            />
            <Question
              label="Would you book this photographer again?"
              options={YES_NO}
              value={wouldBookAgain}
              onChange={setWouldBookAgain}
            />

            <View style={styles.question}>
              <Text style={styles.questionLabel}>{tr('Anything we should know? (optional)')}</Text>
              <Input
                placeholder="Tell us about any issues"
                value={issuesDescription}
                onChangeText={setIssuesDescription}
                multiline
                style={styles.notes}
              />
            </View>

            <Button
              title="Submit and complete"
              onPress={submit}
              loading={submitting}
              disabled={!complete}
            />
            <Pressable style={styles.cancel} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>{tr('Not now')}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  hint: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  question: { marginBottom: spacing.md },
  questionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
    marginBottom: 6,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  optionActive: { backgroundColor: c.primary, borderColor: c.primary },
  optionText: { fontSize: fontSize.xs, color: c.textSoft, fontWeight: fontWeight.semibold },
  optionTextActive: { color: c.textOnPrimary },
  notes: { marginTop: 4 },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: c.textMuted, fontSize: fontSize.sm },
}));
