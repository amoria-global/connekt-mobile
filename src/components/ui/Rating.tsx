import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { fontSize, makeStyles } from '@/theme';

export function Rating({ value, count }: { value?: number; count?: number }) {
  const styles = useStyles();
  if (value == null) return null;
  return (
    <View style={styles.wrap}>
      <Ionicons name="star" size={14} color="#F5A623" />
      <Text style={styles.value}>{value.toFixed(1)}</Text>
      {count != null ? <Text style={styles.count}>({count})</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  value: { fontSize: fontSize.sm, fontWeight: '700', color: c.text },
  count: { fontSize: fontSize.xs, color: c.textMuted },
}));
