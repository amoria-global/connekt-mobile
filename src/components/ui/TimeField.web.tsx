import { Input } from './Input';
import type { TimeFieldProps } from './TimeField';

/** Web fallback: a typed HH:mm field (the native picker isn't used on web). */
export function TimeField({ label, value, onChange, error, placeholder = 'HH:mm' }: TimeFieldProps) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      autoCapitalize="none"
      keyboardType="numbers-and-punctuation"
      error={error}
    />
  );
}
