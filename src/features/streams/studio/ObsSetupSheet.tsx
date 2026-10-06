import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { S } from './theme';

const OBS_STEPS = [
  'Open OBS Studio → Settings → Stream.',
  'Set Service to "WHIP".',
  'Paste the WHIP URL below into Server.',
  'Leave Bearer Token empty (URL is self-authenticating).',
  'Click Apply, then Start Streaming in OBS.',
  'Once connected, tap GO LIVE to broadcast.',
];

const QUALITY_ROWS = [
  { speed: '5–10 Mbps', bitrate: '1500 Kbps', res: '854×480' },
  { speed: '10–25 Mbps', bitrate: '2500 Kbps', res: '1280×720' },
  { speed: '25–50 Mbps', bitrate: '4000 Kbps', res: '1280×720' },
  { speed: '50+ Mbps', bitrate: '6000 Kbps', res: '1920×1080' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  whipUrl?: string;
  copied: boolean;
  onCopy: () => void;
};

/** Existing OBS / external-encoder instructions, moved into a sheet. */
export function ObsSetupSheet({ visible, onClose, whipUrl, copied, onCopy }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="OBS / encoder setup" maxHeightRatio={0.86}>
      <View style={styles.steps}>
        {OBS_STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.label}>WHIP SERVER URL</Text>
      <View style={styles.urlBox}>
        <Text style={styles.url} selectable numberOfLines={3}>
          {whipUrl ?? 'Preparing…'}
        </Text>
        <Pressable
          onPress={onCopy}
          disabled={!whipUrl}
          style={styles.copy}
          accessibilityRole="button"
          accessibilityLabel="Share WHIP server URL"
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
          <Text style={styles.copyText}>{copied ? 'Done' : 'Copy'}</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { marginTop: 14 }]}>RECOMMENDED OUTPUT</Text>
      <View style={styles.table}>
        {QUALITY_ROWS.map((r) => (
          <View key={r.speed} style={styles.tr}>
            <Text style={[styles.td, styles.tdBold]}>{r.speed}</Text>
            <Text style={styles.td}>{r.bitrate}</Text>
            <Text style={styles.td}>{r.res}</Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 10, marginBottom: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.brand,
  },
  numText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: S.text },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, color: S.textFaint, marginBottom: 6 },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: S.sheetRow,
    borderRadius: 14,
    padding: 12,
  },
  url: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: S.textDim },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: S.go,
  },
  copyText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
  table: { backgroundColor: S.sheetRow, borderRadius: 14, overflow: 'hidden' },
  tr: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.sheetLine,
  },
  td: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: S.textDim },
  tdBold: { fontFamily: fonts.bold, color: S.text },
});
