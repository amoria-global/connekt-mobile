/**
 * Bottom sheet that shows a published event's QR code, for the owner,
 * coordinator and assigned photographer alike. Mirrors the dashboards'
 * EventQrWizard: same link, so every role shares one code.
 *
 * Renders nothing unless the event is published. There is no native print
 * here (expo-print is a native module and would need a new store build), so
 * "Share" hands the link to the system sheet, which includes print targets.
 */
import { Modal, Pressable, Share, Text, View } from 'react-native';
import { BrandedQr } from '@/features/qr/BrandedQrView';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventQrLink } from '@/features/events/scanIntent';
import { compactSheet, fontSize, fontWeight, lightPalette, radii, spacing, useTheme, onFill } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

// The code is always navy on white, so it scans in either scheme.
const NAVY = lightPalette.primary;

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
  const { tr } = useSharedT();
  const link = eventQrLink(eventId);

  if (!published) return null;

  const onShare = () => {
    Share.share({ title, message: `Scan or open to view "${title}" on Connekyt\n${link}` }).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GlassScrim onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <GlassSheetHost style={[styles.sheet, { backgroundColor: colors.elevated, paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>
              {justPublished ? tr('Your event is live') : tr('Event QR code')}
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr('Close')}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.codeBox}>
          {visible && published ? <BrandedQr value={link} size="100%" accessibilityLabel="QR code for the event page" /> : null}
        </View>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {tr('Anyone who scans this opens the event page. On a phone they are asked to open the Connekyt app.')}
        </Text>

        <Pressable
          onPress={onShare}
          style={[styles.btn, { backgroundColor: NAVY }]}
          accessibilityRole="button"
          accessibilityLabel={tr('Share link')}
        >
          <Ionicons name="share-social" size={18} color={onFill} />
          <Text style={styles.btnText}>{tr('Share link')}</Text>
        </Pressable>
      </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
}

const styles = compactSheet({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,8,18,0.6)' },
  sheet: {
    padding: spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm, marginTop: 2 },
  codeBox: {
    alignSelf: 'center',
    width: '78%',
    aspectRatio: 1,
    backgroundColor: onFill,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: lightPalette.border,
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
  btnText: { color: onFill, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
