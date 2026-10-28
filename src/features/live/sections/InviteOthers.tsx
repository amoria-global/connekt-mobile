import { memo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { BrandedQr } from '@/features/qr/BrandedQrView';
import { fonts } from '@/theme';
import { wishLink } from '@/features/wishes/qrPng';
import { saveQrToPhotos } from '@/features/wishes/saveQr';
import { V } from '@/features/streams/viewer/viewerTheme';
import { PillButton, SectionCard } from './shared';

/**
 * Section 6: share the wish link, and save its QR as a PNG. The link opens the event on its wishes tab. Same props on web.
 */
export const InviteOthers = memo(function InviteOthers({ eventId, title, prominent }: { eventId: string; title: string; prominent?: boolean }) {
  const link = wishLink(eventId);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onShare = async () => {
    setNote(null);
    try {
      await Share.share({ title, message: `Send a wish for "${title}":\n${link}` });
    } catch {
      /* dismissed */
    }
  };

  const onSave = async () => {
    setSaving(true);
    setNote(null);
    try {
      setNote((await saveQrToPhotos(link, eventId)) ? 'QR saved to your photos.' : 'Allow access to photos to save the QR.');
    } catch {
      setNote('Could not save the QR. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Invite others" subtitle={prominent ? 'Share the link so guests can send you wishes.' : 'Share the link or the QR code.'}>
      <View style={s.row}>
        <View style={s.actions}>
          <PillButton label="Share link" icon="share-social-outline" onPress={onShare} tone={prominent ? 'primary' : 'quiet'} />
          <PillButton label="Save QR" icon="download-outline" onPress={onSave} busy={saving} />
        </View>
        <View style={s.qr} accessible accessibilityRole="image" accessibilityLabel="QR code for the wish link">
          <BrandedQr value={link} size="100%" accessibilityLabel="QR code for the wish link" />
        </View>
      </View>
      {note ? (
        <Text style={s.note} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
    </SectionCard>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flex: 1, gap: 8 },
  qr: { width: 96, height: 96, borderRadius: 10, overflow: 'hidden', backgroundColor: V.text },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: V.textSoft },
});
