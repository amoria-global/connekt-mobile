/**
 * Bottom sheet that shows a published event's QR code, for the owner,
 * coordinator and assigned photographer alike. Mirrors the dashboards'
 * EventQrWizard: same link, so every role shares one code.
 *
 * Renders nothing unless the event is published. There is no native print
 * here (expo-print is a native module and would need a new store build), so
 * "Share" hands the link to the system sheet, which includes print targets.
 */
import { useMemo } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventQrLink, qrMatrix } from '@/features/events/scanIntent';
import { fontSize, fontWeight, radii, spacing, useTheme } from '@/theme';

const QUIET = 2; // modules of white margin around the code
const NAVY = '#083A85';

export function EventQrSheet({
  visible,
  onClose,
  eventId,
  title,
  published,
  justPublished = false,
}: {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  title: string;
  published: boolean;
  justPublished?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const link = eventQrLink(eventId);

  const path = useMemo(() => {
    if (!visible || !published) return null;
    const { size, dark } = qrMatrix(link);
    let d = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (dark[y * size + x]) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
      }
    }
    return { size: size + QUIET * 2, d };
  }, [visible, published, link]);

  if (!published) return null;

  const onShare = () => {
    Share.share({ title, message: `Scan or open to view "${title}" on Connekyt\n${link}` }).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close QR code" />
      <View style={[styles.sheet, { backgroundColor: colors.elevated, paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>
              {justPublished ? 'Your event is live' : 'Event QR code'}
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.codeBox}>
          {path ? (
            <Svg width="100%" height="100%" viewBox={`0 0 ${path.size} ${path.size}`}>
              <Rect width={path.size} height={path.size} fill="#fff" />
              <Path d={path.d} fill={NAVY} />
            </Svg>
          ) : null}
        </View>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Anyone who scans this opens the event page. On a phone they are asked to open the Connekyt app.
        </Text>

        <Pressable
          onPress={onShare}
          style={[styles.btn, { backgroundColor: NAVY }]}
          accessibilityRole="button"
          accessibilityLabel="Share event link"
        >
          <Ionicons name="share-social" size={18} color="#fff" />
          <Text style={styles.btnText}>Share link</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,8,18,0.6)' },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm, marginTop: 2 },
  codeBox: {
    alignSelf: 'center',
    width: '78%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hint: { fontSize: fontSize.sm, textAlign: 'center', marginVertical: spacing.md },
  btn: {
    minHeight: 48,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  btnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
