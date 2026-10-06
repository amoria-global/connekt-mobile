import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { SheetRow, SheetSection } from './SheetParts';
import { S } from './theme';
import { CONNECTION_COPY, formatDuration, type ConnectionState } from './viewModel';

type Props = {
  visible: boolean;
  onClose: () => void;
  eventTitle: string;
  statusLabel: string;
  viewerCount: number;
  peakViewers: number;
  seconds: number;
  connection: ConnectionState;
  streamHealth?: string;
  uploadSpeed?: string;
  inviteToken?: string;
  onShare: () => void;
  onShareInvite: () => void;
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

/** Read-only stream info. Shows only values the existing config already provides. */
export function StreamInfoSheet(p: Props) {
  return (
    <BottomSheet visible={p.visible} onClose={p.onClose} title="Stream info">
      <View style={styles.titleBox}>
        <Text style={styles.titleLabel}>LIVE TITLE</Text>
        <Text style={styles.title}>{p.eventTitle}</Text>
        <Text style={styles.status}>{p.statusLabel}</Text>
      </View>

      <View style={styles.grid}>
        <Tile label="Viewers" value={p.viewerCount.toLocaleString()} />
        <Tile label="Peak" value={p.peakViewers.toLocaleString()} />
        <Tile label="On air" value={formatDuration(p.seconds)} />
        <Tile label="Connection" value={CONNECTION_COPY[p.connection].label} />
        {p.streamHealth ? <Tile label="Health" value={p.streamHealth} /> : null}
        {p.uploadSpeed ? <Tile label="Upload" value={p.uploadSpeed} /> : null}
      </View>

      <SheetSection title="Share">
        <SheetRow icon="paper-plane-outline" label="Share live link" onPress={p.onShare} last={!p.inviteToken} />
        {p.inviteToken ? (
          <SheetRow
            icon="key-outline"
            label="Viewer access code"
            value={p.inviteToken}
            onPress={p.onShareInvite}
            last
          />
        ) : null}
      </SheetSection>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleBox: { backgroundColor: S.sheetRow, borderRadius: 14, padding: 14, marginBottom: 10, gap: 2 },
  titleLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, color: S.textFaint },
  title: { fontFamily: fonts.bold, fontSize: 22, color: S.text },
  status: { fontFamily: fonts.regular, fontSize: 15, color: S.textDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    backgroundColor: S.sheetRow,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tileValue: { fontFamily: fonts.bold, fontSize: 20, color: S.text },
  tileLabel: { fontFamily: fonts.regular, fontSize: 13, color: S.textFaint, marginTop: 1 },
});
