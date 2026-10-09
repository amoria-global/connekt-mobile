/**
 * What "Explore events" opens: two clear choices instead of going straight to
 * the public feed.
 *
 *   Post my event        create the event and get the best recommended
 *                        photographer (Post My Event).
 *   Explore and watch    browse public events and live streams.
 *
 * A guest who picks the first is sent to sign in; the wizard opens on the
 * home screen once they are in (see pendingPostEvent).
 */
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { MODE_META } from './hybridUi';

let pendingPost = false;

/** Remembered across the sign-in screen, for this app session only. */
export const pendingPostEvent = {
  set: () => { pendingPost = true; },
  take: (): boolean => { const v = pendingPost; pendingPost = false; return v; },
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Whether someone is signed in (as a client or coordinator who can post). */
  signedIn: boolean;
  /** Open the wizard in place instead of navigating to its screen. */
  onPostEvent?: () => void;
};

export function ExploreChoiceSheet({ visible, onClose, signedIn, onPostEvent }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const post = () => {
    onClose();
    if (!signedIn) {
      pendingPostEvent.set();
      setTimeout(() => router.push('/login' as never), 150);
      return;
    }
    setTimeout(() => (onPostEvent ? onPostEvent() : router.push('/event/hybrid-wizard' as never)), 150);
  };

  const explore = () => {
    onClose();
    setTimeout(() => router.push('/explore-events' as never), 150);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">What would you like to do?</Text>

          <Pressable onPress={post} style={({ pressed }) => [styles.option, { borderColor: MODE_META.HYBRID.color }, pressed && styles.pressed]}
            accessibilityRole="button" accessibilityLabel="Post my event and get the best recommended photographer">
            <View style={[styles.icon, { backgroundColor: MODE_META.HYBRID.soft }]}><Ionicons name="radio-outline" size={24} color={MODE_META.HYBRID.color} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: MODE_META.HYBRID.color }]}>POST MY EVENT</Text>
              <Text style={styles.optionTitle}>Get the best photographer for my event</Text>
              <Text style={styles.optionText}>
                Create your event and we alert the best-matched photographers near you who are free for the whole time. You choose from those who say yes.
              </Text>
              {!signedIn ? <Text style={[styles.optionText, { fontWeight: fontWeight.bold }]}>You'll sign in first.</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={MODE_META.HYBRID.color} />
          </Pressable>

          <Pressable onPress={explore} style={({ pressed }) => [styles.option, { borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button" accessibilityLabel="Explore and watch events">
            <View style={[styles.icon, { backgroundColor: 'rgba(239,68,68,0.10)' }]}><Ionicons name="videocam-outline" size={24} color="#EF4444" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: '#EF4444' }]}>EXPLORE</Text>
              <Text style={styles.optionTitle}>Explore and watch events</Text>
              <Text style={styles.optionText}>Browse public events and join live streams.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  scrim: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], padding: spacing.lg, gap: spacing.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.xl, borderWidth: 2, backgroundColor: c.card },
  pressed: { opacity: 0.85 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10.5, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  optionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text, marginTop: 2 },
  optionText: { fontSize: fontSize.xs, color: c.textMuted, lineHeight: 17, marginTop: 2 },
}));
