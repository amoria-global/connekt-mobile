import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

const GOLD = '#F59E0B';

/** Read-only star display. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={GOLD} />
      ))}
    </View>
  );
}

/** Tappable star rating input. */
export function StarInput({
  value,
  onChange,
  size = 34,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={4}>
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={size} color={GOLD} />
        </Pressable>
      ))}
    </View>
  );
}
