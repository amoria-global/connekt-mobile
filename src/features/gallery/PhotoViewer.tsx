/**
 * Full-screen photo viewer for an album: swipe left and right between photos (a paged, virtualised strip, so a
 * 300-photo album costs three mounted pages), the full-size file shown over its thumbnail while it loads, a counter,
 * and the same Save and Share actions the album had before. Save and Share receive the photo that is on screen.
 */
import { memo, useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, radii, spacing } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

export type ViewerPhoto = { id: string; url?: string; fullUrl?: string };

type Props = {
  photos: ViewerPhoto[];
  /** Index on screen, or -1 when the viewer is closed. */
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onSave: (p: ViewerPhoto) => void;
  onShare: (p: ViewerPhoto) => void;
  /** Present for non-photographers only. */
  onReport?: (p: ViewerPhoto) => void;
  saving?: boolean;
  /** Colour of the Save button: the client's accent, or the photographer's primary. */
  saveColor?: string;
};

const Page = memo(function Page({ photo, width }: { photo: ViewerPhoto; width: number }) {
  const styles = useStyles();
  const full = photo.fullUrl || photo.url;
  return (
    <View style={[styles.page, { width }]}>
      {full ? (
        <Image
          source={{ uri: full }}
          placeholder={photo.url && photo.url !== full ? { uri: photo.url } : undefined}
          style={styles.image}
          contentFit="contain"
          transition={180}
          recyclingKey={photo.id}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
});

export function PhotoViewer({ photos, index, onIndexChange, onClose, onSave, onShare, onReport, saving, saveColor }: Props) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<ViewerPhoto>>(null);
  const open = index >= 0 && index < photos.length;
  const current = open ? photos[index] : undefined;

  // Report the page the strip settles on after a swipe (the buttons report their own target).
  const onSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const to = Math.round(e.nativeEvent.contentOffset.x / width);
      if (to >= 0 && to < photos.length) onIndexChange(to);
    },
    [width, photos.length, onIndexChange],
  );

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= photos.length) return;
      listRef.current?.scrollToIndex({ index: to, animated: true });
      onIndexChange(to);
    },
    [photos.length, onIndexChange],
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {open ? (
          <FlatList
            ref={listRef}
            data={photos}
            keyExtractor={(p) => p.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
            initialNumToRender={1}
            windowSize={3}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            onMomentumScrollEnd={onSettle}
            renderItem={({ item }) => <Page photo={item} width={width} />}
          />
        ) : null}

        <View style={[styles.top, { paddingTop: Math.max(insets.top + 6, 18) }]} pointerEvents="box-none">
          <Pressable style={styles.glass} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close photo viewer">
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          {open ? (
            <Text style={styles.counter} accessibilityLiveRegion="polite">
              {index + 1} of {photos.length}
            </Text>
          ) : null}
          <View style={styles.topActions}>
            <Pressable style={styles.glass} onPress={() => current && onShare(current)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share photo">
              <Ionicons name="share-outline" size={18} color="#fff" />
            </Pressable>
            {onReport ? (
              <Pressable style={styles.glass} onPress={() => current && onReport(current)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Report photo">
                <Ionicons name="flag-outline" size={18} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + 8, 24) }]} pointerEvents="box-none">
          <View style={styles.pill}>
            <Pressable
              style={[styles.nav, index <= 0 && styles.navOff]}
              onPress={() => go(index - 1)}
              disabled={index <= 0}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              accessibilityState={{ disabled: index <= 0 }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={[styles.save, saveColor ? { backgroundColor: saveColor } : null, saving && styles.navOff]}
              onPress={() => current && onSave(current)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save to camera roll"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={17} color="#fff" />
                  <Text style={styles.saveText} maxFontSizeMultiplier={1.2}>
                    {tr('Save to Camera Roll')}
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.nav, index >= photos.length - 1 && styles.navOff]}
              onPress={() => go(index + 1)}
              disabled={index >= photos.length - 1}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              accessibilityState={{ disabled: index >= photos.length - 1 }}
            >
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  backdrop: { flex: 1, backgroundColor: '#050B14' },
  page: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15,29,47,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#fff', fontSize: 14, fontWeight: '700', backgroundColor: 'rgba(15,29,47,0.78)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.full, overflow: 'hidden' },
  topActions: { flexDirection: 'row', gap: spacing.sm },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.lg },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 6, borderRadius: radii.full, backgroundColor: 'rgba(15,29,47,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  nav: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navOff: { opacity: 0.35 },
  save: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radii.full, backgroundColor: '#F20C8F' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
}));
