import { Input } from './Input';
import type { DateFieldProps } from './DateField';

/** Web fallback: a typed YYYY-MM-DD field (the native picker isn't used on web). */
export function DateField({ label, value, onChange, error, placeholder = 'YYYY-MM-DD' }: DateFieldProps) {
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
