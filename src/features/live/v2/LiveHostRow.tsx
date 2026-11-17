/**
 * The host row under the player in the new live layout: avatar with a live ring, title, the host's real name and the
 * viewer count, then Gift (magenta) and Like. Gift and Like only call the screen's existing handlers.
 */
import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';
import { formatCount } from '@/features/streams/viewer/utils';

export const LiveHostRow = memo(function LiveHostRow({
  title,
  hostName,
  avatar,
  live,
  viewerCount,
  onGift,
  onLike,
}: {
  title: string;
  hostName: string;
  avatar?: string;
  live: boolean;
  viewerCount: number | null;
  onGift?: () => void;
  onLike: () => void;
}) {
  const sub = [hostName, viewerCount != null && viewerCount > 0 ? `${formatCount(viewerCount)} watching` : null].filter(Boolean).join(' · ');
  return (
    <View style={s.row}>
      <View style={[s.ring, live && s.ringLive]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={s.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[s.avatar, s.avatarEmpty]}>
            <Ionicons name="person" size={20} color={V.textMuted} />
          </View>
        )}
      </View>
      <View style={s.meta}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Text style={s.sub} numberOfLines={1}>{sub}</Text>
      </View>
      {onGift ? (
        <Pressable onPress={onGift} style={s.gift} accessibilityRole="button" accessibilityLabel="Send a gift" hitSlop={4}>
          <Ionicons name="gift" size={16} color={V.text} />
          <Text style={s.giftText}>Gift</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onLike} style={s.like} accessibilityRole="button" accessibilityLabel="Like" hitSlop={4}>
        <Ionicons name="heart-outline" size={20} color={V.accent} />
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ring: { width: 52, height: 52, borderRadius: 26, padding: 2, borderWidth: 2, borderColor: 'transparent' },
  ringLive: { borderColor: V.live },
  avatar: { width: '100%', height: '100%', borderRadius: 24 },
  avatarEmpty: { backgroundColor: V.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0 },
  title: { color: V.text, fontFamily: fonts.bold, fontSize: 17 },
  sub: { color: V.textSoft, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  gift: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: V.accent },
  giftText: { color: V.text, fontFamily: fonts.bold, fontSize: 14 },
  like: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: V.border, alignItems: 'center', justifyContent: 'center' },
});
