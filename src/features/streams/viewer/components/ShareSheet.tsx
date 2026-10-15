import { memo, useCallback } from 'react';
import { Linking, Share } from 'react-native';
import { SheetRow, ViewerSheet } from './ViewerSheet';
import { buildStreamShareUrl } from '../utils';

type Props = {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  title: string;
  reducedMotion: boolean;
};

/** Share targets built from the real stream URL (same one used before the redesign). */
export const ShareSheet = memo(function ShareSheet({ visible, onClose, eventId, title, reducedMotion }: Props) {
  const url = buildStreamShareUrl(eventId);
  const text = `Watch "${title || 'Live Stream'}" live on Connekt:`;

  const open = useCallback(
    async (target: string) => {
      onClose();
      try {
        await Linking.openURL(target);
      } catch {
        /* app/browser unavailable */
      }
    },
    [onClose],
  );

  const native = useCallback(async () => {
    onClose();
    try {
      await Share.share({ title: title || 'Live Stream', message: `${text}\n${url}` });
    } catch {
      /* dismissed */
    }
  }, [onClose, title, text, url]);

  return (
    <ViewerSheet visible={visible} onClose={onClose} title="Share" reducedMotion={reducedMotion}>
      <SheetRow icon="share-outline" label="Share via…" onPress={native} />
      <SheetRow
        icon="logo-whatsapp"
        label="WhatsApp"
        onPress={() => open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`)}
      />
      <SheetRow
        icon="paper-plane-outline"
        label="Telegram"
        onPress={() =>
          open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
        }
      />
      <SheetRow
        icon="logo-twitter"
        label="X"
        onPress={() =>
          open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)
        }
      />
    </ViewerSheet>
  );
});
