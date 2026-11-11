/**
 * A horizontally scrolling row of chips whose right edge fades out while more chips wait off screen, so a chip is never
 * cut mid-word with nothing to say it scrolls. Solid theme tokens only (stacked slices of the background colour at
 * rising opacity), no gradient.
 */
import { useState, type ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { alpha, useTheme } from '@/theme';

export const FADE_STEPS = [0.2, 0.4, 0.6, 0.8, 0.95] as const;
const SLICE = 8;

/** True while some content is still hidden to the right of the visible window. */
export function hasMoreToRight(contentWidth: number, layoutWidth: number, offsetX: number): boolean {
  return layoutWidth > 0 && contentWidth - layoutWidth - offsetX > 4;
}

export function FadedChipRow({ children, contentContainerStyle }: { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [content, setContent] = useState(0);
  const [layout, setLayout] = useState(0);
  const [offset, setOffset] = useState(0);
  const more = hasMoreToRight(content, layout, offset);
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        onContentSizeChange={(w) => setContent(w)}
        onLayout={(e) => setLayout(e.nativeEvent.layout.width)}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>
      {more ? (
        <View pointerEvents="none" testID="chip-fade" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
          {FADE_STEPS.map((o) => (
            <View key={o} style={{ width: SLICE, backgroundColor: alpha(colors.background, o) }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
