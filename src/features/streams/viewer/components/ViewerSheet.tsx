import { memo, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme';
import { V } from '../viewerTheme';
import type { IconName } from '../types';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

/** Minimal bottom-sheet shell (scrim tap closes). Reduced motion -> no slide. */
export const ViewerSheet = memo(function ViewerSheet({
  visible,
  onClose,
  title,
  reducedMotion,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GlassScrim onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <GlassSheetHost style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {children}
      </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
});

export const SheetRow = memo(function SheetRow({
  icon,
  label,
  onPress,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: V.surfaceRaised }]}
    >
      <Ionicons name={icon} size={22} color={color ?? V.text} />
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: V.border, marginBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: V.text, paddingHorizontal: 20, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 52, paddingHorizontal: 20 },
  rowText: { fontFamily: fonts.regular, fontSize: 16, color: V.text },
});
