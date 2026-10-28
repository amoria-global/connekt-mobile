import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, onFill } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';
import { formatCount } from '@/features/streams/viewer/utils';

/** Section 3: title, tagline, location and host. Same props on web. */
export const EventInfo = memo(function EventInfo({
  title,
  tagline,
  location,
  hostName,
  live,
  viewerCount,
}: {
  title: string;
  tagline?: string;
  location?: string;
  hostName: string;
  live: boolean;
  viewerCount: number | null;
}) {
  const initial = hostName.trim().charAt(0).toUpperCase() || 'C';
  return (
    <View style={s.root}>
      <Text style={s.title} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
      {tagline ? (
        <Text style={s.tagline} numberOfLines={2}>
          {tagline}
        </Text>
      ) : null}
      <View style={s.row}>
        <View style={s.avatar} accessible={false}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <View style={s.meta}>
          <Text style={s.host} numberOfLines={1}>
            Hosted by {hostName}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {live ? 'Live now' : 'Not live'}
            {viewerCount != null ? ` · ${formatCount(viewerCount)} watching` : ''}
          </Text>
        </View>
      </View>
      {location ? (
        <View style={s.loc} accessible accessibilityLabel={`Location: ${location}`}>
          <Ionicons name="location-outline" size={15} color={V.textMuted} />
          <Text style={s.locText} numberOfLines={1}>
            {location}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  root: { paddingHorizontal: 14, paddingTop: 10, gap: 6 },
  title: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, color: V.text },
  tagline: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: V.textSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: V.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 15, color: onFill },
  meta: { flex: 1 },
  host: { fontFamily: fonts.bold, fontSize: 14, color: V.text },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: V.textMuted },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: V.textMuted },
});
