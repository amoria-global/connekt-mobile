import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { getStream, joinStream, tipStream } from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const TIP_AMOUNTS = [500, 1000, 2000, 5000];

export default function StreamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error } = useAsync(useCallback(() => getStream(id), [id]));
  const [joining, setJoining] = useState(false);
  const [tipping, setTipping] = useState<number | null>(null);

  const onJoin = async () => {
    setJoining(true);
    try {
      const url = (await joinStream(id)) ?? data?.playbackUrl;
      if (url) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        Alert.alert('Stream unavailable', 'This stream cannot be opened right now.');
      }
    } catch {
      Alert.alert('Could not join', 'Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const onTip = async (amount: number) => {
    setTipping(amount);
    try {
      await tipStream(id, amount);
      Alert.alert('Thank you!', 'Your tip has been sent.');
    } catch {
      Alert.alert('Tip failed', 'Please try again.');
    } finally {
      setTipping(null);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Ionicons name="videocam" size={40} color={colors.textOnPrimary} />
          {data?.isLive ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title}>{data?.title}</Text>
        {data?.photographerName ? <Text style={styles.meta}>{data.photographerName}</Text> : null}

        <Button title={data?.isLive ? 'Join stream' : 'Watch'} onPress={onJoin} loading={joining} />

        <View style={styles.tipSection}>
          <Text style={styles.tipTitle}>Send a tip</Text>
          <View style={styles.tipRow}>
            {TIP_AMOUNTS.map((a) => (
              <Pressable
                key={a}
                style={({ pressed }) => [styles.tipChip, pressed && styles.pressed]}
                onPress={() => onTip(a)}
                disabled={tipping != null}
              >
                {tipping === a ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.tipText}>{a.toLocaleString()}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  hero: {
    height: 180,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  liveBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  liveText: { color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.extrabold },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  meta: { fontSize: fontSize.md, color: colors.textMuted, marginTop: -spacing.sm },
  tipSection: { gap: spacing.md, marginTop: spacing.sm },
  tipTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  tipRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  tipChip: {
    flexGrow: 1,
    minWidth: 70,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  tipText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
