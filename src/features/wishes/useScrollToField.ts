import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';

/**
 * Scrolls a long form to a field that blocked a submit. The field can sit inside nested views, so its position is read in
 * window coordinates and added to how far the form is already scrolled.
 */
export function useScrollToField() {
  const scrollRef = useRef<ScrollView>(null);
  const fieldRef = useRef<View>(null);
  const offset = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  };
  const scrollToField = () => {
    fieldRef.current?.measureInWindow((_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(offset.current + y - 120, 0), animated: true });
    });
  };
  return { scrollRef, fieldRef, onScroll, scrollToField };
}
