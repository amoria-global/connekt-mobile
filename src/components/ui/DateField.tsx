import { useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export type DateFieldProps = {
  label?: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (ymd: string) => void;
  error?: string;
  placeholder?: string;
  minimumDate?: Date;
};

function toYMD(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function fromYMD(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const pretty = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function DateField({ label, value, onChange, error, placeholder = 'Select a date', minimumDate }: DateFieldProps) {
  const date = fromYMD(value);
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState<Date>(date ?? new Date());

  const open = () => {
    setTemp(date ?? new Date());
    setShow(true);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={open} style={[styles.field, !!error && styles.fieldError]}>
        <Text style={[styles.value, !date && styles.placeholder]}>{date ? pretty(date) : placeholder}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Android shows a native dialog directly. */}
      {Platform.OS === 'android' && show ? (
        <DateTimePicker
          value={date ?? new Date()}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={(e: DateTimePickerEvent, d?: Date) => {
            setShow(false);
            if (e.type === 'set' && d) onChange(toYMD(d));
          }}
        />
      ) : null}

      {/* iOS: bottom-sheet spinner with Done/Cancel. */}
      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.backdrop} onPress={() => setShow(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHeader}>
                <Pressable onPress={() => setShow(false)} hitSlop={8}>
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.sheetTitle}>{label ?? 'Select date'}</Text>
                <Pressable
                  onPress={() => {
                    onChange(toYMD(temp));
                    setShow(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.done}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={temp}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                textColor={colors.text}
                onChange={(_e: DateTimePickerEvent, d?: Date) => {
                  if (d) setTemp(d);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSoft },
  field: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldError: { borderColor: colors.error },
  value: { fontSize: fontSize.md, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { fontSize: fontSize.xs, color: colors.error },

  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingBottom: spacing['2xl'],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  sheetTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  cancel: { fontSize: fontSize.md, color: colors.textMuted },
  done: { fontSize: fontSize.md, color: colors.primary, fontWeight: fontWeight.bold },
});
