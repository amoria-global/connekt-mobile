import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';
import { formatClock } from '@/features/wishes/composer';
import type { Wish } from '@/features/wishes/types';
import type { FeedState } from './WishesFeed';
import { PillButton, SectionCard, SkelBlock, StateNote } from './shared';

const statusText = (w: Wish) =>
  w.visibility === 'private' ? 'Private, only you see it' : w.status === 'approved' ? 'Approved, shown in the feed' : w.status === 'hidden' ? 'Hidden' : 'Waiting for your decision';

/**
 * Section 8 (host): every wish for the event with Approve and Hide. A private wish can be read and hidden but not
 * approved, because it never goes to the feed. Same props on web.
 */
export const ModerationQueue = memo(function ModerationQueue({
  state,
  wishes,
  busyId,
  onApprove,
  onHide,
  onRetry,
  onPlay,
}: {
  state: FeedState;
  wishes: Wish[];
  busyId?: string | null;
  onApprove: (w: Wish) => void;
  onHide: (w: Wish) => void;
  onRetry: () => void;
  onPlay: (w: Wish) => void;
}) {
  const waiting = wishes.filter((w) => w.visibility === 'public' && w.status === 'pending').length;
  return (
    <SectionCard title="Wishes" subtitle={state === 'ready' && waiting > 0 ? `${waiting} waiting for your decision` : 'Approve public wishes to show them in the feed'}>
      {state === 'loading' ? (
        <View style={{ gap: 12 }} accessibilityRole="progressbar" accessibilityLabel="Loading wishes">
          {[0, 1].map((i) => (
            <View key={i} style={{ gap: 8 }}>
              <SkelBlock width="40%" height={12} />
              <SkelBlock width="90%" height={12} />
            </View>
          ))}
        </View>
      ) : state === 'error' ? (
        <StateNote icon="cloud-offline-outline" text="Could not load the wishes." actionLabel="Try again" onAction={onRetry} />
      ) : wishes.length === 0 ? (
        <StateNote icon="mail-open-outline" text="No wishes yet. Share your invite link to collect some." />
      ) : (
        <View style={{ gap: 12 }}>
          {wishes.map((w) => (
            <View key={w.id} style={s.item}>
              <View style={s.top}>
                <Text style={s.name} numberOfLines={1}>
                  {w.authorName}
                </Text>
                <Text style={s.status}>{statusText(w)}</Text>
              </View>
              <Text style={s.message} numberOfLines={4}>
                {w.type === 'video' ? `Video wish${w.durationSeconds ? ` (${formatClock(w.durationSeconds)})` : ''}${w.message && w.message !== '[Video Wish]' ? `: ${w.message}` : ''}` : w.message}
              </Text>
              <View style={s.actions}>
                {w.type === 'video' ? <PillButton label="Watch" icon="play" onPress={() => onPlay(w)} /> : null}
                {w.visibility === 'public' && w.status !== 'approved' ? (
                  <PillButton label="Approve" icon="checkmark" tone="primary" onPress={() => onApprove(w)} busy={busyId === w.id} />
                ) : null}
                {w.status !== 'hidden' ? <PillButton label="Hide" icon="eye-off-outline" onPress={() => onHide(w)} busy={busyId === w.id} /> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
});

const s = StyleSheet.create({
  item: { gap: 6, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: V.border },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: V.text },
  status: { fontFamily: fonts.regular, fontSize: 12, color: V.textMuted },
  message: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: V.textSoft },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
