import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts, onFill, onMedia, paper } from '@/theme';
import { S } from './theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** Safe choice, shown first, visually primary. */
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  destructive?: boolean;
};

/** In-tree confirmation dialog (keeps the camera mounted behind it). */
export function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
  destructive = true,
}: Props) {
  const { tr } = useSharedT();
  if (!visible) return null;
  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
      />
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          {tr(title)}
        </Text>
        <Text style={styles.message}>{tr(message)}</Text>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.btn, styles.btnSafe, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        >
          <Text style={styles.btnSafeText}>{tr(cancelLabel)}</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            destructive ? styles.btnDanger : styles.btnGo,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          accessibilityState={{ busy, disabled: busy }}
        >
          {busy ? <ActivityIndicator color={onFill} /> : <Text style={styles.btnDangerText}>{tr(confirmLabel)}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    elevation: 60,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    backgroundColor: S.sheetBg,
    padding: 22,
    gap: 10,
  },
  title: { fontFamily: fonts.bold, fontSize: 24, color: S.text, textAlign: 'center' },
  message: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: S.textDim,
    textAlign: 'center',
    marginBottom: 8,
  },
  btn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  btnSafe: { backgroundColor: onMedia.text },
  btnSafeText: { fontFamily: fonts.bold, fontSize: 18, color: paper.ink },
  btnDanger: { backgroundColor: 'rgba(220,38,38,0.9)' },
  btnGo: { backgroundColor: S.go },
  btnDangerText: { fontFamily: fonts.bold, fontSize: 18, color: onFill },
});
