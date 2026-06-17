import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Text, Pressable, useWindowDimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchBrowsePhotos, type BrowseRow } from '@/features/photos/api';
import { colors, spacing } from '@/theme';

export default function BrowsePhotosScreen() {
  const [items, setItems] = useState<BrowseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<BrowseRow | null>(null);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const numColumns = width > 600 ? 3 : 2;
  const gap = spacing.sm;
  const contentPadding = spacing.md;
  const cellWidth = (width - (contentPadding * 2) - (gap * (numColumns - 1))) / numColumns;

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchBrowsePhotos(0, 50);
      setItems(data);
    } catch (err) {
      console.error('Failed to load browse photos', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: BrowseRow }) => {
    return (
      <Pressable 
        style={[styles.card, { width: cellWidth, height: cellWidth * 1.2, marginBottom: gap }]}
        onPress={() => setPreviewing(item)}
      >
        <Image 
          source={{ uri: item.fileUrl }} 
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.gradient}
        />
        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.photographerName}</Text>
          <Text style={styles.cardPrice}>{item.buyerCurrency === 'USD' ? '$' : ''}{item.buyerPrice}</Text>
        </View>
        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>PREVIEW</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <LinearGradient colors={['#052047', '#052047', '#103E83']} style={StyleSheet.absoluteFillObject} />
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFF" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.imageId}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={{
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom + spacing.xl, 100),
            paddingHorizontal: contentPadding,
          }}
          columnWrapperStyle={numColumns > 1 ? { gap } : undefined}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>No photos found.</Text>
            </View>
          }
        />
      )}

      {/* Lightbox Preview */}
      <Modal visible={!!previewing} transparent animationType="fade">
        <View style={styles.lightboxContainer}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewing(null)} />
          <View style={[styles.lightboxContent, { marginTop: insets.top, marginBottom: insets.bottom }]}>
            <View style={styles.lightboxHeader}>
              <Pressable onPress={() => setPreviewing(null)} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#FFF" />
              </Pressable>
            </View>
            
            {previewing && (
              <View style={styles.lightboxImageContainer}>
                <Image 
                  source={{ uri: previewing.fileUrl }} 
                  style={styles.lightboxImage} 
                  contentFit="contain" 
                />
                <View style={styles.lightboxWatermarkBand}>
                  <Text style={styles.lightboxWatermarkText}>
                    PREVIEW · {previewing.photographerName.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}

            {previewing && (
              <View style={styles.lightboxFooter}>
                <Text style={styles.lightboxTitle} numberOfLines={2}>
                  {previewing.title || 'Untitled'}
                </Text>
                <Text style={styles.lightboxPhotographer}>By {previewing.photographerName}</Text>
                <View style={styles.buyButtonPlaceholder}>
                  <Text style={styles.buyButtonText}>
                    Checkout is coming soon for mobile ({previewing.buyerCurrency === 'USD' ? '$' : ''}{previewing.buyerPrice})
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#052047' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  cardFooter: { position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardTitle: { color: '#FFF', fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  cardPrice: { color: '#FFF', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  watermark: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  watermarkText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 15 },
  lightboxContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  lightboxContent: { flex: 1 },
  lightboxHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.md, zIndex: 10 },
  closeButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  lightboxImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxWatermarkBand: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, paddingHorizontal: 100, transform: [{ rotate: '-45deg' }], borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  lightboxWatermarkText: { color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  lightboxFooter: { padding: spacing.xl },
  lightboxTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  lightboxPhotographer: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 24 },
  buyButtonPlaceholder: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 12, alignItems: 'center' },
  buyButtonText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
});
