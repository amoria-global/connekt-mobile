import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, onFill } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';

export type LiveTab = 'live' | 'wishes';

/** Section 4: Live and Wishes & Memories. Same props on web. */
export const EventTabs = memo(function EventTabs({
  value,
  onChange,
  wishCount,
}: {
  value: LiveTab;
  onChange: (tab: LiveTab) => void;
  /** Approved public wishes, shown as a count on the second tab when known. */
  wishCount?: number;
}) {
  const tabs: { key: LiveTab; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'wishes', label: wishCount ? `Wishes & Memories · ${wishCount}` : 'Wishes & Memories' },
  ];
  return (
    <View style={s.root} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.tab, on && s.tabOn]}
          >
            <Text style={[s.text, on && { color: onFill }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  tab: { minHeight: V.hit, paddingHorizontal: 16, borderRadius: V.hit / 2, justifyContent: 'center', backgroundColor: V.surfaceRaised, borderWidth: 1, borderColor: V.border },
  tabOn: { backgroundColor: V.primary, borderColor: V.primary },
  text: { fontFamily: fonts.bold, fontSize: 14, color: V.textSoft },
});
