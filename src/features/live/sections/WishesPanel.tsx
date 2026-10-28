import { memo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { reportContent, reportPublicChatMessage } from '@/features/moderation/api';
import { SheetRow, ViewerSheet } from '@/features/streams/viewer/components/ViewerSheet';
import { useAuth } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWishFeed } from '@/features/wishes/useWishFeed';
import type { Wish } from '@/features/wishes/types';
import { WishVideoModal } from './WishVideoModal';
import { InviteOthers } from './InviteOthers';
import { PrivacyNote } from './PrivacyNote';
import { SendWishes } from './SendWishes';
import { WishesFeed } from './WishesFeed';

/** The Wishes & Memories tab: sections 5, 6, 7 and the full feed (8). Same sections, same order, as the web's sidebar plus tab. */
export const WishesPanel = memo(function WishesPanel({
  eventId,
  title,
  closed,
  viewerId,
  bottomInset = 0,
}: {
  eventId: string;
  title: string;
  closed?: boolean;
  /** The anonymous viewer id the live chat already holds; lets a guest report a wish. */
  viewerId?: string | null;
  bottomInset?: number;
}) {
  const feed = useWishFeed(eventId);
  const signedIn = useAuth((s) => !!s.user);
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState<Wish | null>(null);
  const [report, setReport] = useState<Wish | null>(null);
  const [playing, setPlaying] = useState<Wish | null>(null);
  const canReport = signedIn || !!viewerId;

  const doHide = async (w: Wish) => {
    setMenu(null);
    try {
      await feed.hideOwn(w);
    } catch (e) {
      Alert.alert('Could not hide it', e instanceof Error ? e.message : (e as { message?: string })?.message || 'Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={[s.body, { paddingBottom: bottomInset + 16 }]} keyboardShouldPersistTaps="handled">
      <SendWishes eventId={eventId} closed={closed} onSent={feed.reload} />
      <InviteOthers eventId={eventId} title={title} />
      <PrivacyNote />
      <WishesFeed
        state={feed.state}
        wishes={feed.wishes}
        variant="full"
        total={feed.total}
        hasMore={feed.hasMore}
        onLoadMore={feed.loadMore}
        onRetry={feed.reload}
        onPlay={setPlaying}
        onMenu={setMenu}
      />

      <ViewerSheet visible={!!menu} onClose={() => setMenu(null)} title="Wish" reducedMotion={reduced}>
        {menu?.mine ? <SheetRow icon="eye-off-outline" label="Hide my wish" onPress={() => doHide(menu)} /> : null}
        {menu && !menu.mine && canReport ? (
          <SheetRow
            icon="flag-outline"
            label="Report"
            onPress={() => {
              setReport(menu);
              setMenu(null);
            }}
          />
        ) : null}
        {menu && !menu.mine && !canReport ? <SheetRow icon="information-circle-outline" label="Sign in to report a wish" onPress={() => setMenu(null)} /> : null}
      </ViewerSheet>

      <ReportSheet
        visible={!!report}
        onClose={() => setReport(null)}
        targetType="STREAM_CHAT"
        subject={report?.authorName}
        submit={async (reason, description) =>
          signedIn
            ? reportContent('STREAM_CHAT', report!.id, reason, description)
            : reportPublicChatMessage(eventId, report!.id, viewerId!, await getDeviceId(), reason, description)
        }
      />

      <WishVideoModal wish={playing} onClose={() => setPlaying(null)} />
    </ScrollView>
  );
});

const s = StyleSheet.create({
  body: { gap: 12, paddingHorizontal: 14, paddingTop: 4 },
});
