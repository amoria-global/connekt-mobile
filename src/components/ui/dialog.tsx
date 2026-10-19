/**
 * Themed confirmation dialog with the same call shape as React Native's `Alert.alert`.
 *
 * Why: the native alert cannot be restyled. On Android it follows the OS dialog theme, on iOS it is a system sheet, so
 * on a photographer screen it looks like a different app. Photographer sessions therefore get this dialog, drawn from
 * the app's own tokens. Every other role keeps the native alert, unchanged.
 *
 * Usage: `import { Alert } from '@/components/ui/dialog'` then `Alert.alert(title, message, buttons)` as before.
 * `<DialogHost />` must be mounted once, inside the ThemeProvider (the signed-in layout does this).
 */
import { useSyncExternalStore } from 'react';
import { Alert as NativeAlert, Modal, Pressable, ScrollView, Text, View, type AlertButton, type AlertOptions } from 'react-native';
import { useAuth } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';

type Request = { id: number; title: string; message?: string; buttons: AlertButton[]; cancelable: boolean };

let nextId = 1;
let current: Request | null = null;
const queue: Request[] = [];
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isPhotographerSession(): boolean {
  const raw = useAuth.getState().user?.customerType;
  return typeof raw === 'string' && raw.toLowerCase() === 'photographer';
}

/** Whether a host is mounted to show the dialog. Without one the native alert is used, so a message is never lost. */
function hasHost(): boolean {
  return listeners.size > 0;
}

function alert(...args: [title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions]) {
  // Forward exactly what was given, so the native fallback is indistinguishable from calling it directly.
  if (!isPhotographerSession() || !hasHost()) {
    NativeAlert.alert(...args);
    return;
  }
  const [title, message, buttons, options] = args;
  const req: Request = {
    id: nextId++,
    title,
    message,
    buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
    cancelable: options?.cancelable !== false,
  };
  if (current) queue.push(req);
  else current = req;
  publish();
}

/** Closes the current dialog and shows the next queued one. */
function dismiss(id: number) {
  if (current?.id !== id) return;
  current = queue.shift() ?? null;
  publish();
}

/** Drop-in for `import { Alert } from 'react-native'`. `prompt` stays the platform's own (iOS only). */
export const Alert = { alert, prompt: NativeAlert.prompt };

/** Pure helper, exported for tests: the button that Back and a backdrop tap should trigger. */
export function cancelButton(buttons: AlertButton[]): AlertButton | undefined {
  return buttons.find((b) => b.style === 'cancel');
}

export function DialogHost() {
  const styles = useStyles();
  const req = useSyncExternalStore(subscribe, () => current, () => null);

  if (!req) return null;

  const press = (b: AlertButton) => {
    dismiss(req.id);
    b.onPress?.();
  };
  const cancel = cancelButton(req.buttons);
  // Back and a backdrop tap act as Cancel when the dialog has one, and otherwise close it only when it is cancelable.
  const onBack = () => {
    if (cancel) press(cancel);
    else if (req.cancelable) dismiss(req.id);
  };
  const stacked = req.buttons.length > 2 || req.buttons.some((b) => (b.text ?? '').length > 14);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onBack} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onBack} accessibilityLabel="Dismiss dialog" accessibilityRole="button">
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {req.title}
          </Text>
          {req.message ? (
            <ScrollView style={styles.messageBox} bounces={false}>
              <Text style={styles.message}>{req.message}</Text>
            </ScrollView>
          ) : null}
          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {req.buttons.map((b, i) => {
              const destructive = b.style === 'destructive';
              const quiet = b.style === 'cancel';
              return (
                <Pressable
                  key={`${i}-${b.text}`}
                  onPress={() => press(b)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.btn,
                    stacked ? styles.btnStacked : styles.btnRow,
                    quiet ? styles.btnQuiet : destructive ? styles.btnDanger : styles.btnPrimary,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.btnText, quiet ? styles.btnTextQuiet : destructive ? styles.btnTextDanger : styles.btnTextOn]} numberOfLines={2}>
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: c.elevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  messageBox: { maxHeight: 260 },
  message: { color: c.textSoft, fontSize: fontSize.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionsStacked: { flexDirection: 'column-reverse' },
  btn: { minHeight: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  btnRow: { flex: 1 },
  btnStacked: { alignSelf: 'stretch' },
  btnPrimary: { backgroundColor: c.primary },
  // Destructive is outlined, not filled: white on the dark palette's light red would fail contrast.
  btnDanger: { backgroundColor: c.errorBg, borderWidth: 1.25, borderColor: c.error },
  btnQuiet: { backgroundColor: 'transparent', borderWidth: 1.25, borderColor: c.border },
  btnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textAlign: 'center' },
  btnTextOn: { color: c.textOnPrimary },
  btnTextDanger: { color: c.error },
  btnTextQuiet: { color: c.textSoft },
  pressed: { opacity: 0.85 },
}));
