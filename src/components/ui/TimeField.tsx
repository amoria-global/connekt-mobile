import { useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export type TimeFieldProps = {
  label?: string;
  /** HH:mm */
  value: string;
  onChange: (hhmm: string) => void;
  error?: string;
  placeholder?: string;
};

function toHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fromHM(s?: string): Date | null {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
const pretty = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function TimeField({ label, value, onChange, error, placeholder = 'Select a time' }: TimeFieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const time = fromHM(value);
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState<Date>(time ?? new Date());

  const open = () => {
    setTemp(time ?? new Date());
    setShow(true);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={open} style={[styles.field, !!error && styles.fieldError]}>
        <Text style={[styles.value, !time && styles.placeholder]}>{time ? pretty(time) : placeholder}</Text>
        <Ionicons name="time-outline" size={20} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS === 'android' && show ? (
        <DateTimePicker
          value={time ?? new Date()}
          mode="time"
          display="default"
          onChange={(e: DateTimePickerEvent, d?: Date) => {
            setShow(false);
            if (e.type === 'set' && d) onChange(toHM(d));
          }}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.backdrop} onPress={() => setShow(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHeader}>
                <Pressable onPress={() => setShow(false)} hitSlop={8}>
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.sheetTitle}>{label ?? 'Select time'}</Text>
                <Pressable
                  onPress={() => {
                    onChange(toHM(temp));
                    setShow(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.done}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={temp}
                mode="time"
                display="spinner"
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

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  field: {
    height: 52,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldError: { borderColor: c.error },
  value: { fontSize: fontSize.md, color: c.text },
  placeholder: { color: c.textMuted },
  error: { fontSize: fontSize.xs, color: c.error },

  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
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
    borderBottomColor: c.borderSoft,
  },
  sheetTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  cancel: { fontSize: fontSize.md, color: c.textMuted },
  done: { fontSize: fontSize.md, color: c.primary, fontWeight: fontWeight.bold },
}));
