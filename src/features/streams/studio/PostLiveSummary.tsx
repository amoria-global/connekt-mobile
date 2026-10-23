import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts } from '@/theme';
import { ConfirmDialog } from './ConfirmDialog';
import { S } from './theme';
import { formatDurationWords, type LiveSummary } from './viewModel';

type Props = {
  eventTitle: string;
  summary: LiveSummary;
  resetting: boolean;
  onDone: () => void;
  onStartNew: () => void;
};

function Stat({ label, value }: { label: string; value: string }) {
  const { tr } = useSharedT();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{tr(label)}</Text>
    </View>
  );
}

/**
 * Post-live summary. Only shows numbers the existing app already has:
 * peak viewers + current viewers (config), duration (on-air timer), comments
 * (polled chat list).
 */
export function PostLiveSummary({ eventTitle, summary, resetting, onDone, onStartNew }: Props) {
  const insets = useSafeAreaInsets();
  const { tr } = useSharedT();
  const [confirmNew, setConfirmNew] = useState(false);
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={34} color="#fff" />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {tr('LIVE ended')}
        </Text>
        <Text style={styles.sub}>{tr('Your broadcast has ended.')}</Text>
        <Text style={styles.event} numberOfLines={2}>
          {eventTitle}
        </Text>

        <View style={styles.grid}>
          <Stat label="Peak viewers" value={summary.peakViewers.toLocaleString()} />
          {summary.durationSec != null ? (
            <Stat label="Duration" value={formatDurationWords(summary.durationSec)} />
          ) : null}
          <Stat label="Comments" value={summary.comments.toLocaleString()} />
        </View>
      </ScrollView>

      <View
        style={[
          styles.actions,
          { paddingBottom: Math.max(insets.bottom, 16), paddingLeft: insets.left + 20, paddingRight: insets.right + 20 },
        ]}
      >
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneText}>{tr('Done')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setConfirmNew(true)}
          disabled={resetting}
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel="Start a new broadcast"
        >
          {resetting ? (
            <ActivityIndicator color={S.textDim} />
          ) : (
            <Text style={styles.secondaryText}>{tr('Start a new broadcast')}</Text>
          )}
        </Pressable>
      </View>

      <ConfirmDialog
        visible={confirmNew}
        title="Start a new broadcast?"
        message="This rotates your stream credentials. If you use OBS, update the server URL before reconnecting."
        cancelLabel="Cancel"
        confirmLabel="Reset & start new"
        destructive={false}
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          onStartNew();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0D12' },
  content: { alignItems: 'center', paddingHorizontal: 20, gap: 6 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.brand,
    marginBottom: 12,
  },
  title: { fontFamily: fonts.bold, fontSize: 34, color: S.text },
  sub: { fontFamily: fonts.regular, fontSize: 18, color: S.textDim },
  event: { fontFamily: fonts.bold, fontSize: 16, color: S.textFaint, textAlign: 'center', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 26, width: '100%', maxWidth: 420 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: S.sheetBg,
    borderRadius: 16,
    padding: 16,
  },
  statValue: { fontFamily: fonts.bold, fontSize: 26, color: S.text },
  statLabel: { fontFamily: fonts.regular, fontSize: 15, color: S.textFaint, marginTop: 2 },
  actions: { gap: 6, alignItems: 'stretch', maxWidth: 520, width: '100%', alignSelf: 'center' },
  done: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.go,
  },
  doneText: { fontFamily: fonts.bold, fontSize: 20, color: '#fff' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bold, fontSize: 16, color: S.textDim },
});
