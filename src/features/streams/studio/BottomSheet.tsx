import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts } from '@/theme';
import { S } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Cap for auto-height sheets (fraction of window height). */
  maxHeightRatio?: number;
  /** Fixed height (fraction of window height), for list + composer sheets. */
  fixedHeightRatio?: number;
  /** Lift the sheet above the software keyboard. */
  avoidKeyboard?: boolean;
  /** Wrap children in a ScrollView (default true; false when children scroll themselves). */
  scroll?: boolean;
  headerRight?: ReactNode;
};

/**
 * In-tree bottom sheet (NOT a native Modal): it lives inside the studio
 * screen so the camera/WebView underneath is never remounted, and the
 * preview stays visible above the sheet. Swipe the handle/header down to
 * dismiss, or tap the dimmed area.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightRatio = 0.78,
  fixedHeightRatio,
  avoidKeyboard,
  scroll = true,
  headerRight,
}: Props) {
  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { tr } = useSharedT();
  const translateY = useRef(new Animated.Value(H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: H, duration: 200, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, H, translateY, backdrop]);

  useEffect(() => {
    if (!avoidKeyboard || !visible) {
      setKb(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates.height));
    const b = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, [avoidKeyboard, visible]);

  // Keep latest onClose for the PanResponder without recreating it.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => translateY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 90 || g.vy > 0.8) {
            Keyboard.dismiss();
            closeRef.current();
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [translateY],
  );

  if (!mounted) return null;

  const sheetStyle = fixedHeightRatio
    ? { height: Math.min(H * fixedHeightRatio, H - kb - insets.top - 8) }
    : { maxHeight: Math.min(H * maxHeightRatio, H - kb - insets.top - 8) };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          sheetStyle,
          { bottom: kb, paddingBottom: kb > 0 ? 8 : Math.max(insets.bottom, 12), transform: [{ translateY }] },
        ]}
      >
        <View {...pan.panHandlers} style={styles.dragZone}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                {tr(title)}
              </Text>
              <View style={styles.headerRight}>
                {headerRight}
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${title}`}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={S.textDim} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {scroll ? (
          <ScrollView
            style={fixedHeightRatio ? styles.flex : undefined}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{children}</View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 40, elevation: 40 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  flex: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    backgroundColor: S.sheetBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  dragZone: { paddingTop: 8 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 20, color: S.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  content: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
});
