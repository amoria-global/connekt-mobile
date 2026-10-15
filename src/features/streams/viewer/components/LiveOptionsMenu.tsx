import { memo } from 'react';
import { SheetRow, ViewerSheet } from './ViewerSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  reducedMotion: boolean;
  chatOpen: boolean;
  canGift: boolean;
  onShare: () => void;
  onToggleChat: () => void;
  onRefresh: () => void;
  onGift: () => void;
};

/** Only actions the app already supports (no report/follow/block endpoints exist here). */
export const LiveOptionsMenu = memo(function LiveOptionsMenu(p: Props) {
  const run = (fn: () => void) => () => {
    p.onClose();
    fn();
  };
  return (
    <ViewerSheet visible={p.visible} onClose={p.onClose} title="Options" reducedMotion={p.reducedMotion}>
      <SheetRow icon="share-social-outline" label="Share" onPress={run(p.onShare)} />
      {p.canGift ? <SheetRow icon="gift-outline" label="Send a gift" onPress={run(p.onGift)} /> : null}
      <SheetRow
        icon={p.chatOpen ? 'chatbubble-outline' : 'chatbubbles-outline'}
        label={p.chatOpen ? 'Hide chat' : 'Show chat'}
        onPress={run(p.onToggleChat)}
      />
      <SheetRow icon="refresh-outline" label="Refresh stream" onPress={run(p.onRefresh)} />
    </ViewerSheet>
  );
});
