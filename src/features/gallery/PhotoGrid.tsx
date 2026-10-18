/**
 * One tile of the album grid, and the skeleton shown while an album loads. The tile is memoised and sized by its
 * parent, so a 300-photo album scrolls on a tuned FlatList without re-rendering tiles that did not change. The tile
 * loads the album's thumbnail (the API's own `thumbnailUrl` when it sends one), never the full-size file.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { makeStyles, radii } from '@/theme';
import { Skeleton } from '@/features/photographer/kit';

export type GridPhoto = { id: string; url?: string };

function PhotoCellImpl({ photo, size, position, total, onOpen, onHold }: { photo: GridPhoto; size: number; position: number; total: number; onOpen: (id: string) => void; onHold?: (id: string) => void }) {
  const styles = useStyles();
  return (
    <Pressable
      style={[styles.cell, { width: size, height: size }]}
      onPress={() => onOpen(photo.id)}
      onLongPress={onHold ? () => onHold(photo.id) : undefined}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo ${position} of ${total}`}
    >
      <Image
        source={{ uri: photo.url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
        recyclingKey={photo.id}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}
export const PhotoCell = memo(PhotoCellImpl);

/** Three rows of grey tiles with the footprint of the real grid, so nothing jumps when the photos arrive. */
export function PhotoGridSkeleton({ size, cols, gap }: { size: number; cols: number; gap: number }) {
  return (
    <View accessibilityLabel="Loading photos" style={{ gap }}>
      {[0, 1, 2].map((r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {Array.from({ length: cols }, (_, i) => (
            <View key={i} style={{ width: size, height: size, borderRadius: radii.sm, overflow: 'hidden' }}>
              <Skeleton height={size} radius={radii.sm} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  cell: { borderRadius: radii.sm, overflow: 'hidden', backgroundColor: c.surfaceMuted },
}));
