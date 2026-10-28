import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, onFill } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';
import { formatClock } from '@/features/wishes/composer';
import type { Wish } from '@/features/wishes/types';
import { PillButton, SectionCard, SkelBlock, StateNote } from './shared';

export type FeedState = 'loading' | 'error' | 'ready';

function WishCard({ wish, onPlay, onMenu }: { wish: Wish; onPlay: (w: Wish) => void; onMenu: (w: Wish) => void }) {
  const initial = wish.authorName.trim().charAt(0).toUpperCase() || 'G';
  return (
    <View style={s.card}>
      {wish.type === 'video' ? (
        <Pressable onPress={() => onPlay(wish)} accessibilityRole="button" accessibilityLabel={`Play video wish from ${wish.authorName}`} style={s.thumb}>
          {wish.thumbnailUrl ? <Image source={{ uri: wish.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <Ionicons name="play" size={22} color={onFill} />
          {wish.durationSeconds ? (
            <View style={s.duration}>
              <Text style={s.durationText}>{formatClock(wish.durationSeconds)}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <View style={s.avatar} accessible={false}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
      )}
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>
          {wish.authorName}
        </Text>
        {wish.message && wish.message !== '[Video Wish]' ? (
          <Text style={s.message} numberOfLines={wish.type === 'video' ? 2 : 4}>
            {wish.message}
          </Text>
        ) : (
          <Text style={s.message}>Video wish</Text>
        )}
      </View>
      <Pressable onPress={() => onMenu(wish)} accessibilityRole="button" accessibilityLabel={`More options for the wish from ${wish.authorName}`} style={s.menu}>
        <Ionicons name="ellipsis-horizontal" size={18} color={V.textSoft} />
      </Pressable>
    </View>
  );
}

/**
 * Sections 8 (viewer): approved public wishes. `variant="preview"` shows the latest few with See all; `"full"` shows the
 * whole feed. Video items show a thumbnail and duration, text items the avatar, name and message, and every item has an
 * overflow menu (report, or hide your own). Loading, empty and error states are built in. Same props on web.
 */
export const WishesFeed = memo(function WishesFeed({
  state,
  wishes,
  variant,
  total,
  onRetry,
  onSeeAll,
  onLoadMore,
  hasMore,
  onPlay,
  onMenu,
}: {
  state: FeedState;
  wishes: Wish[];
  variant: 'preview' | 'full';
  total?: number;
  onRetry: () => void;
  onSeeAll?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onPlay: (w: Wish) => void;
  onMenu: (w: Wish) => void;
}) {
  const shown = variant === 'preview' ? wishes.slice(0, 3) : wishes;
  return (
    <SectionCard title="Wishes & Memories" subtitle={variant === 'preview' ? 'Approved by the host' : undefined}>
      {state === 'loading' ? (
        <View style={s.skel} accessibilityRole="progressbar" accessibilityLabel="Loading wishes">
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.skelRow}>
              <SkelBlock width={44} height={44} radius={22} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkelBlock width="40%" height={12} />
                <SkelBlock width="85%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : state === 'error' ? (
        <StateNote icon="cloud-offline-outline" text="Could not load the wishes." actionLabel="Try again" onAction={onRetry} />
      ) : shown.length === 0 ? (
        <StateNote icon="sparkles-outline" text="No wishes yet. Be the first to send one." />
      ) : (
        <View style={s.list}>
          {shown.map((w) => (
            <WishCard key={w.id} wish={w} onPlay={onPlay} onMenu={onMenu} />
          ))}
          {variant === 'preview' && (total ?? wishes.length) > shown.length ? <PillButton label="See all" icon="arrow-forward" onPress={() => onSeeAll?.()} /> : null}
          {variant === 'full' && hasMore ? <PillButton label="Load more" onPress={() => onLoadMore?.()} /> : null}
        </View>
      )}
    </SectionCard>
  );
});

const s = StyleSheet.create({
  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: V.surfaceRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  duration: { position: 'absolute', right: 4, bottom: 4, paddingHorizontal: 5, height: 18, borderRadius: 9, justifyContent: 'center', backgroundColor: V.chipStrong },
  durationText: { fontFamily: fonts.bold, fontSize: 11, color: onFill },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: V.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 17, color: onFill },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: V.text },
  message: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: V.textSoft },
  menu: { width: V.hit, height: V.hit, alignItems: 'center', justifyContent: 'center' },
  skel: { gap: 12 },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
