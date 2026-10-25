import { compactSheet } from '@/theme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { PHOTOGRAPHER_COVER_PLACEHOLDER } from '@/utils/placeholders';

const COVER_SLIDE_INTERVAL_MS = 3000;

export type CoverCarouselProps = {
  images: string[];
  width: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function CoverCarousel({
  images,
  width,
  style,
  imageStyle,
}: CoverCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set());
  const [animating, setAnimating] = useState<{
    prevIdx: number;
    nextIdx: number;
  } | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef(false);
  const currentIdxRef = useRef(0);
  currentIdxRef.current = currentIndex;

  const loadedUrlsRef = useRef<Set<string>>(new Set());
  loadedUrlsRef.current = loadedUrls;

  // Filter valid URLs and cap at 5 unique entries to optimize bandwidth and memory
  const validImages = useMemo(() => {
    return images
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0 && !u.includes('/null'))
      .slice(0, 5);
  }, [images]);

  const total = validImages.length;

  // Prefetch all images immediately to disk/memory cache
  useEffect(() => {
    if (validImages.length === 0) return;
    Image.prefetch(validImages, 'memory-disk').catch(() => {});
  }, [validImages]);

  const markLoaded = useCallback((url: string) => {
    setLoadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  useEffect(() => {
    if (total <= 1) return;

    const interval = setInterval(() => {
      if (isAnimatingRef.current) return;

      const prevIdx = currentIdxRef.current;
      const nextIdx = (prevIdx + 1) % total;
      const nextUrl = validImages[nextIdx];

      // Only trigger slide if the incoming image is ALREADY LOADED.
      // If it is still loading from network, do NOT slide to a blank frame.
      if (!loadedUrlsRef.current.has(nextUrl)) {
        return;
      }

      isAnimatingRef.current = true;
      setAnimating({ prevIdx, nextIdx });
      slideAnim.setValue(0);

      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setCurrentIndex(nextIdx);
          setAnimating(null);
          slideAnim.setValue(0);
        }
        isAnimatingRef.current = false;
      });
    }, COVER_SLIDE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      slideAnim.stopAnimation();
    };
  }, [total, validImages, slideAnim]);

  if (total === 0) {
    return (
      <View style={[StyleSheet.absoluteFill, style]}>
        <Image
          source={PHOTOGRAPHER_COVER_PLACEHOLDER}
          style={[styles.coverImage, imageStyle]}
          contentFit="cover"
        />
      </View>
    );
  }

  const currentUrl = validImages[currentIndex] || validImages[0];
  const safeWidth = width > 0 ? width : 400;

  const outgoingX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -safeWidth],
  });

  const incomingX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [safeWidth, 0],
  });

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      {/* Pre-mount all images invisibly so native decoder buffers them into memory cache */}
      <View style={styles.hiddenPreloadContainer} pointerEvents="none">
        {validImages.map((uri) => (
          <Image
            key={`preload-${uri}`}
            source={{ uri }}
            cachePolicy="memory-disk"
            priority="high"
            onLoad={() => markLoaded(uri)}
            style={styles.hiddenPreloadImage}
          />
        ))}
      </View>

      {/* BASE LAYER: Permanently mounted underneath. Never unmounts,
          guaranteeing there is NEVER a blank or flashing background frame. */}
      <Image
        source={{ uri: currentUrl }}
        placeholder={PHOTOGRAPHER_COVER_PLACEHOLDER}
        placeholderContentFit="cover"
        style={[styles.coverImage, imageStyle]}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
        onLoad={() => markLoaded(currentUrl)}
      />

      {/* SLIDE TRANSITION: Smooth right-to-left slide when transitioning */}
      {animating !== null && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Outgoing slide moving from 0 to -width */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: outgoingX }] },
            ]}
          >
            <Image
              source={{ uri: validImages[animating.prevIdx] }}
              style={[styles.coverImage, imageStyle]}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
            />
          </Animated.View>

          {/* Incoming slide moving from +width to 0 */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: incomingX }] },
            ]}
          >
            <Image
              source={{ uri: validImages[animating.nextIdx] }}
              placeholder={validImages[animating.prevIdx]}
              placeholderContentFit="cover"
              style={[styles.coverImage, imageStyle]}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = compactSheet({
  coverImage: {
    width: '100%',
    height: '100%',
  },
  hiddenPreloadContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenPreloadImage: {
    width: 1,
    height: 1,
  },
});
