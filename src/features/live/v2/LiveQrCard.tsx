/**
 * Share this live: the event cover with LIVE and the title, the branded QR, the link, then WhatsApp, More apps, Save QR
 * and TV. There is no clipboard module in the installed build, so "Copy" opens the system share sheet, which has Copy.
 */
import { memo, useState } from 'react';
import { ImageBackground, Linking, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';
import { BrandedQr } from '@/features/qr/BrandedQrView';
import { saveQrToPhotos } from '@/features/wishes/saveQr';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

export const LiveQrCard = memo(function LiveQrCard({
  visible,
  onClose,
  eventId,
  title,
  link,
  cover,
  live,
  onTv,
}: {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  title: string;
  link: string;
  cover?: string;
  live: boolean;
  onTv: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);
  const message = `Watch "${title}" live on Connekyt\n${link}`;
  const share = () => Share.share({ title, message }).catch(() => undefined);
  const whatsapp = () => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(share);
  const save = async () => {
    try {
      setNote((await saveQrToPhotos(link, eventId)) ? 'QR saved to your photos.' : 'Allow access to photos to save the QR.');
    } catch {
      setNote('Could not save the QR. Please try again.');
    }
  };
  const actions: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { key: 'wa', icon: 'logo-whatsapp', label: 'WhatsApp', onPress: whatsapp },
    { key: 'more', icon: 'share-social-outline', label: 'More apps', onPress: share },
    { key: 'save', icon: 'download-outline', label: 'Save QR', onPress: save },
    { key: 'tv', icon: 'tv-outline', label: 'TV', onPress: () => { onClose(); onTv(); } },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GlassScrim onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <GlassSheetHost style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.head}>
            <Pressable onPress={onClose} style={s.back} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6}>
              <Ionicons name="chevron-back" size={20} color={V.text} />
            </Pressable>
            <Text style={s.headTitle}>Share this live</Text>
          </View>
          <View style={s.card}>
            <ImageBackground source={cover ? { uri: cover } : undefined} style={s.cover} imageStyle={s.coverImg}>
              <View style={s.coverShade}>
                {live ? (
                  <View style={s.live}>
                    <View style={s.dot} />
                    <Text style={s.liveText}>LIVE</Text>
                  </View>
                ) : null}
                <Text style={s.title} numberOfLines={2}>{title}</Text>
              </View>
            </ImageBackground>
            <View style={s.qrWrap}>
              <View style={s.qr}>{visible ? <BrandedQr value={link} size="100%" accessibilityLabel="QR code for this live" /> : null}</View>
              <Text style={s.hint}>Scan to watch on any phone or TV browser</Text>
              <View style={s.link}>
                <Text style={s.linkText} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
                <Pressable onPress={share} style={s.copy} accessibilityRole="button" accessibilityLabel="Copy link" hitSlop={6}>
                  <Ionicons name="copy-outline" size={14} color={V.text} />
                  <Text style={s.copyText}>Copy</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <View style={s.actions}>
            {actions.map((a) => (
              <Pressable key={a.key} onPress={a.onPress} style={s.action} accessibilityRole="button" accessibilityLabel={a.label}>
                <View style={s.actionIco}>
                  <Ionicons name={a.icon} size={22} color={V.text} />
                </View>
                <Text style={s.actionText}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          {note ? <Text style={s.note}>{note}</Text> : null}
        </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
});

const s = StyleSheet.create({
  sheet: { padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: V.border, alignItems: 'center', justifyContent: 'center' },
  headTitle: { color: V.text, fontFamily: fonts.bold, fontSize: 17 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: V.border, overflow: 'hidden', backgroundColor: V.surface },
  cover: { height: 110, backgroundColor: V.surfaceRaised },
  coverImg: { opacity: 0.7 },
  coverShade: { flex: 1, justifyContent: 'flex-end', padding: 12, gap: 6 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: V.live },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: V.text },
  liveText: { color: V.text, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 },
  title: { color: V.text, fontFamily: fonts.bold, fontSize: 18 },
  qrWrap: { alignItems: 'center', padding: 16, gap: 10 },
  qr: { width: 180, height: 180, borderRadius: 16, overflow: 'hidden' },
  hint: { color: V.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  link: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 6, height: 44, borderRadius: 12, borderWidth: 1, borderColor: V.border },
  linkText: { flex: 1, color: V.textSoft, fontFamily: fonts.regular, fontSize: 12.5 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: V.surfaceRaised },
  copyText: { color: V.text, fontFamily: fonts.semibold, fontSize: 12.5 },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: 6, minWidth: 64 },
  actionIco: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: V.border, backgroundColor: V.surfaceRaised },
  actionText: { color: V.textSoft, fontFamily: fonts.medium, fontSize: 12 },
  note: { color: V.textSoft, fontFamily: fonts.regular, fontSize: 12.5, textAlign: 'center' },
});
