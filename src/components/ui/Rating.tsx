import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '@/theme';

export function Rating({ value, count }: { value?: number; count?: number }) {
  if (value == null) return null;
  return (
    <View style={styles.wrap}>
      <Ionicons name="star" size={14} color="#F5A623" />
      <Text style={styles.value}>{value.toFixed(1)}</Text>
      {count != null ? <Text style={styles.count}>({count})</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  value: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  count: { fontSize: fontSize.xs, color: colors.textMuted },
});
