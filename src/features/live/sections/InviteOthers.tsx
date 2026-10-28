import { memo, useMemo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { fonts, lightPalette, onFill } from '@/theme';
import { qrMatrix } from '@/features/events/scanIntent';
import { wishLink } from '@/features/wishes/qrPng';
import { saveQrToPhotos } from '@/features/wishes/saveQr';
import { V } from '@/features/streams/viewer/viewerTheme';
import { PillButton, SectionCard } from './shared';

const QUIET = 2;
// The code is navy on white in either scheme, so it scans.
const NAVY = lightPalette.primary;

/**
 * Section 6: share the wish link, and save its QR as a PNG. The link opens the event on its wishes tab. Same props on web.
 */
export const InviteOthers = memo(function InviteOthers({ eventId, title, prominent }: { eventId: string; title: string; prominent?: boolean }) {
  const link = wishLink(eventId);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const path = useMemo(() => {
    const { size, dark } = qrMatrix(link);
    let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (dark[y * size + x]) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
    return { d, box: size + QUIET * 2 };
  }, [link]);

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
          <Svg width="100%" height="100%" viewBox={`0 0 ${path.box} ${path.box}`}>
            <Rect width={path.box} height={path.box} fill={onFill} />
            <Path d={path.d} fill={NAVY} />
          </Svg>
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
