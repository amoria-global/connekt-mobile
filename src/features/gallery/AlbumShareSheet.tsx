/**
 * Bottom sheet for sharing an album that is live on Find My Photos: the branded QR code to scan or print, the code, Share
 * link and Save QR. The dashboard offers the same three (AlbumShareCard), with the same link, so a QR saved on either
 * platform scans to the same place. Copy is left to the share sheet: the installed app has no clipboard module.
 */
import { useState } from 'react';
import { Modal, Pressable, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { BrandedQr } from '@/features/qr/BrandedQrView';
import { saveQrToPhotos } from '@/features/wishes/saveQr';
import { compactSheet, fontSize, fontWeight, lightPalette, onFill, radii, spacing, useTheme } from '@/theme';

const NAVY = lightPalette.primary;

export function AlbumShareSheet({
  visible,
  onClose,
  albumId,
  title,
  link,
  code,
  justPublished = false,
}: {
  visible: boolean;
  onClose: () => void;
  albumId: string;
  title: string;
  link: string;
  code?: string;
  justPublished?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onShare = async () => {
    setNote(null);
    try {
      await Share.share({ title, message: `Find your photos from "${title}" on Connekyt:\n${link}` });
    } catch {
      /* dismissed */
    }
  };
  const onSave = async () => {
    setSaving(true);
    setNote(null);
    try {
      setNote((await saveQrToPhotos(link, albumId)) ? 'QR saved to your photos.' : 'Allow access to photos to save the QR.');
    } catch {
      setNote('Could not save the QR. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GlassScrim onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <GlassSheetHost style={[styles.sheet, { backgroundColor: colors.elevated, paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                {justPublished ? 'Live on Find My Photos' : 'Share this album'}
              </Text>
              <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={2}>
                {title}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.codeBox} accessible accessibilityRole="image" accessibilityLabel="QR code for this album on Find My Photos">
            <BrandedQr value={link} size="100%" />
          </View>
          {code ? <Text style={[styles.code, { color: colors.text }]}>{code}</Text> : null}
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Attendees scan the code or open the link, take a selfie and find their photos.
          </Text>

          <Pressable onPress={onShare} style={[styles.btn, { backgroundColor: NAVY }]} accessibilityRole="button" accessibilityLabel="Share link">
            <Ionicons name="share-social" size={18} color={onFill} />
            <Text style={styles.btnText}>Share link</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={[styles.btn, styles.btnOutline, { borderColor: colors.stroke, opacity: saving ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Save QR"
          >
            <Ionicons name="download-outline" size={18} color={colors.text} />
            <Text style={[styles.btnText, { color: colors.text }]}>{saving ? 'Saving…' : 'Save QR'}</Text>
          </Pressable>
          {note ? (
            <Text style={[styles.note, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
              {note}
            </Text>
          ) : null}
        </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
}

const styles = compactSheet({
  sheet: { padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xs },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm, marginTop: 2 },
  codeBox: {
    alignSelf: 'center',
    width: '66%',
    aspectRatio: 1,
    backgroundColor: onFill,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: lightPalette.border,
  },
  code: { textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: 4 },
  hint: { fontSize: fontSize.sm, textAlign: 'center' },
  btn: { minHeight: 48, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  btnOutline: { borderWidth: 1 },
  btnText: { color: onFill, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  note: { fontSize: fontSize.xs, textAlign: 'center' },
});
