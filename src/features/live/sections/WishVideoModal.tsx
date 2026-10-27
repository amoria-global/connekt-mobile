import { memo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Wish } from '@/features/wishes/types';
import { onMedia } from '@/theme';

function Clip({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" accessibilityLabel="Video wish" />;
}

/** Plays a video wish full screen. Used by the viewer's feed and the host's moderation queue. */
export const WishVideoModal = memo(function WishVideoModal({ wish, onClose }: { wish: Wish | null; onClose: () => void }) {
  const reduced = useReducedMotion();
  return (
    <Modal visible={!!wish} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <View style={s.player}>
        {wish?.videoUrl ? <Clip uri={wish.videoUrl} /> : null}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close video" style={s.close}>
          <Ionicons name="close" size={24} color={onMedia.text} />
        </Pressable>
      </View>
    </Modal>
  );
});

const s = StyleSheet.create({
  player: { flex: 1, backgroundColor: onMedia.black, justifyContent: 'center' },
  close: { position: 'absolute', top: 44, right: 12, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: onMedia.smoke },
});
