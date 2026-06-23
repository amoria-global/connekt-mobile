import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, fontSize, spacing } from '@/theme';
import { useLocalSearchParams } from 'expo-router';

const numColumns = 3;

export default function BrowsePhotosAlbumScreen() {
  const { slug } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  // Live width — re-renders on rotation / split-screen / web resize.
  const { width } = useResponsive();
  const imageSize = (width - spacing.md * 2 - (numColumns - 1) * spacing.sm) / numColumns;
  
  // Mock data for the album and its photos
  const [album, setAlbum] = useState({
    title: 'Sample Album',
    description: 'Beautiful moments captured perfectly.',
    photographerName: 'John Doe',
    photoCount: 12,
    listingPrice: 5.0,
    listingCurrency: 'USD',
  });
  
  const [photos, setPhotos] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Simulating API fetch based on slug
    setTimeout(() => {
      setPhotos(Array(12).fill(null).map((_, i) => ({
        id: `img-${i}`,
        url: `https://picsum.photos/seed/${slug || 'default'}-${i}/300/300`,
        price: 5.0,
      })));
      setLoading(false);
    }, 1000);
  }, [slug]);

  const toggleCart = (id: string) => {
    setCart(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const cartCount = Object.values(cart).filter(Boolean).length;
  const cartTotal = cartCount * (album.listingPrice || 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.title}>{album.title}</Text>
          <Text style={styles.description}>{album.description}</Text>
          
          <View style={styles.metaRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{album.photographerName.charAt(0)}</Text>
            </View>
            <Text style={styles.metaText}>{album.photographerName}</Text>
            <Text style={styles.metaText}> • {album.photoCount} photos</Text>
            <Text style={styles.metaText}> • ${album.listingPrice}/photo</Text>
          </View>
        </View>

        {/* Photo Grid */}
        <View style={styles.grid}>
          {loading ? (
            <Text style={styles.loadingText}>Loading album photos...</Text>
          ) : (
            photos.map((photo) => (
              <TouchableOpacity 
                key={photo.id} 
                style={[styles.photoCard, { width: imageSize, height: imageSize }, cart[photo.id] && styles.photoCardSelected]}
                onPress={() => toggleCart(photo.id)}
              >
                <Image source={{ uri: photo.url }} style={styles.photoImage} />
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>${photo.price}</Text>
                </View>
                {cart[photo.id] && (
                  <View style={styles.checkOverlay}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Cart Footer */}
      {cartCount > 0 && (
        <View style={styles.cartFooter}>
          <View>
            <Text style={styles.cartCount}>{cartCount} photos selected</Text>
            <Text style={styles.cartTotal}>Total: ${cartTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn}>
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100, // Space for cart footer
  },
  hero: {
    backgroundColor: colors.primary,
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textOnPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.textOnPrimary + 'CC',
    marginBottom: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.sm,
    borderRadius: 50,
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.textOnPrimary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.primary, fontSize: fontSize.xs, fontWeight: '700',
  },
  metaText: {
    color: colors.textOnPrimary, fontSize: fontSize.sm, fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  photoCard: {
    // width/height applied inline via the responsive imageSize.
    backgroundColor: colors.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoCardSelected: {
    borderColor: colors.primary,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  priceTag: {
    position: 'absolute',
    top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  priceText: {
    color: 'white', fontSize: 10, fontWeight: '700',
  },
  checkOverlay: {
    position: 'absolute',
    top: 4, left: 4,
    backgroundColor: colors.primary,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  checkIcon: {
    color: 'white', fontSize: 12, fontWeight: '700',
  },
  loadingText: {
    width: '100%', textAlign: 'center', marginTop: spacing.xl, color: colors.textMuted,
  },
  cartFooter: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10,
  },
  cartCount: {
    fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600',
  },
  cartTotal: {
    fontSize: fontSize.lg, fontWeight: '800', color: colors.text,
  },
  checkoutBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: 8,
  },
  checkoutText: {
    color: colors.textOnPrimary, fontWeight: '700', fontSize: fontSize.md,
  },
});
