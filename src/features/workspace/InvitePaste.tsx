/**
 * "Have a workspace invitation link?": the way into an invitation from the email on a phone, where the link opens in
 * the browser rather than the app. Paste the link (or just its id) and the screen carries on as it would for a
 * link the app opened itself. Collapsed until it is wanted, so it does not crowd the sign-in form.
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fontSize, fontWeight, spacing, makeStyles, onFill } from '@/theme';

export function InvitePaste({ onAdopt }: { onAdopt: (text: string) => boolean }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const go = () => {
    if (onAdopt(text)) {
      setOpen(false);
      setText('');
      setProblem(null);
    } else {
      setProblem('That does not look like a workspace invitation link. Paste the link from the email.');
    }
  };

  if (!open) {
    return (
      <Pressable style={styles.row} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Have a workspace invitation link?" hitSlop={8}>
        <Ionicons name="link-outline" size={18} color={onFill} />
        <Text style={styles.rowText}>Have a workspace invitation link?</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.box}>
      <Input
        glass
        label="Invitation link"
        value={text}
        onChangeText={(t) => { setText(t); setProblem(null); }}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Paste the link from your email"
        error={problem ?? undefined}
        onSubmitEditing={go}
        returnKeyType="go"
      />
      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" onPress={() => { setOpen(false); setText(''); setProblem(null); }} style={styles.flex} />
        <Button title="Continue" onPress={go} disabled={!text.trim()} style={styles.flex} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 36 },
  rowText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: onFill },
  box: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
}));
