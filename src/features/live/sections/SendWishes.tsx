import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';
import { MAX_WISH_VIDEO_SECONDS } from '@/features/wishes/types';
import type { IconName } from '@/features/streams/viewer/types';
import { PillButton, SectionCard } from './shared';
import { WishComposerSheet } from './WishComposerSheet';

function Option({ icon, title, hint, action, onPress }: { icon: IconName; title: string; hint: string; action: string; onPress: () => void }) {
  return (
    <View style={s.option}>
      <View style={s.optionHead}>
        <Ionicons name={icon} size={18} color={V.accent} />
        <Text style={s.optionTitle}>{title}</Text>
      </View>
      <Text style={s.hint}>{hint}</Text>
      <PillButton label={action} onPress={onPress} />
    </View>
  );
}

/**
 * Section 5: send a video wish (record or upload, up to 60 seconds) or a text wish. Each opens the composer, where the
 * sender picks public or private before sending. Same props on web.
 */
export const SendWishes = memo(function SendWishes({
  eventId,
  closed,
  onSent,
}: {
  eventId: string;
  /** Wishes are closed once the event has ended. */
  closed?: boolean;
  onSent?: () => void;
}) {
  const [kind, setKind] = useState<'text' | 'video' | null>(null);
  if (closed) {
    return (
      <SectionCard title="Send your wishes">
        <Text style={s.hint}>Wishes are closed for this event.</Text>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Send your wishes">
      <View style={s.pair}>
        <Option icon="videocam-outline" title="Video wish" hint={`Up to ${MAX_WISH_VIDEO_SECONDS} seconds`} action="Record / upload" onPress={() => setKind('video')} />
        <Option icon="chatbubble-ellipses-outline" title="Text wish" hint="A short message" action="Write a wish" onPress={() => setKind('text')} />
      </View>
      {kind ? <WishComposerSheet eventId={eventId} kind={kind} onClose={() => setKind(null)} onSent={onSent} /> : null}
    </SectionCard>
  );
});

const s = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, gap: 8, padding: 10, borderRadius: 12, backgroundColor: V.bg, borderWidth: 1, borderColor: V.border },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionTitle: { fontFamily: fonts.bold, fontSize: 14, color: V.text },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: V.textMuted },
});
