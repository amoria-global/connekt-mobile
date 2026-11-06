import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, TextInput, View } from 'react-native';

/**
 * Scrolls a long form to the field that blocked a submit, by name, and focuses it when it is a text input. Each field
 * registers its wrapper with `holder(key)` (and its input with `input(key)`); positions are read in window coordinates
 * and added to how far the form is already scrolled, because a field can sit inside nested views.
 */
export function useScrollToKey<K extends string>() {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const holders = useRef(new Map<K, View | null>());
  const inputs = useRef(new Map<K, TextInput | null>());

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  };
  const holder = (key: K) => (node: View | null) => {
    holders.current.set(key, node);
  };
  const input = (key: K) => (node: TextInput | null) => {
    inputs.current.set(key, node);
  };
  const scrollTo = (key: K) => {
    const node = holders.current.get(key);
    if (!node) return;
    node.measureInWindow((_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(offset.current + y - 120, 0), animated: true });
    });
    // Let the scroll settle, then put the cursor in the field.
    const field = inputs.current.get(key);
    if (field) setTimeout(() => field.focus(), 300);
  };
  return { scrollRef, onScroll, holder, input, scrollTo };
}
