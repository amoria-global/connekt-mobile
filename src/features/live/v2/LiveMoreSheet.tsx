/**
 * The More sheet on the live screen: Watch on TV, Share with QR code, Invite viewers (only when the host allows
 * invites), Refresh. Video quality and Report stream are not offered yet; picture in picture is not available for this
 * player on phones, so it is left out rather than shown disabled.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';
import { ViewerSheet } from '@/features/streams/viewer/components/ViewerSheet';

type Row = { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void };

export const LiveMoreSheet = memo(function LiveMoreSheet({
  visible,
  onClose,
  reducedMotion,
  onTv,
  onQr,
  onInvite,
  onRefresh,
}: {
  visible: boolean;
  onClose: () => void;
  reducedMotion: boolean;
  onTv: () => void;
  onQr: () => void;
  onInvite?: () => void;
  onRefresh?: () => void;
}) {
  const after = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const rows: Row[] = [
    { key: 'tv', icon: 'tv-outline', label: 'Watch on TV', hint: 'Send this live to a paired TV', onPress: after(onTv) },
    { key: 'qr', icon: 'qr-code-outline', label: 'Share with QR code', hint: 'Link, QR, WhatsApp', onPress: after(onQr) },
    ...(onInvite ? [{ key: 'inv', icon: 'person-add-outline' as const, label: 'Invite viewers', hint: 'Allowed by the host', onPress: after(onInvite) }] : []),
    ...(onRefresh ? [{ key: 'ref', icon: 'refresh-outline' as const, label: 'Refresh stream', hint: 'Reconnect the video', onPress: after(onRefresh) }] : []),
  ];
  return (
    <ViewerSheet visible={visible} onClose={onClose} title="More" reducedMotion={reducedMotion}>
      {rows.map((r) => (
        <Pressable key={r.key} onPress={r.onPress} style={s.row} accessibilityRole="button" accessibilityLabel={r.label}>
          <View style={s.ico}>
            <Ionicons name={r.icon} size={18} color={V.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{r.label}</Text>
            <Text style={s.hint}>{r.hint}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={V.textMuted} />
        </Pressable>
      ))}
    </ViewerSheet>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: V.border, backgroundColor: V.surfaceRaised },
  ico: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: V.surface },
  label: { color: V.text, fontFamily: fonts.semibold, fontSize: 14.5 },
  hint: { color: V.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
});
