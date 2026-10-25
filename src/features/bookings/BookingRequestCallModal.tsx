/**
 * Full-screen incoming direct booking request, like an incoming call: rings,
 * shows who is booking and for what, and takes Accept or Decline on the spot.
 *
 * Accept is a button here rather than on the lock screen on purpose: it
 * commits the photographer and starts the client's payment, so they see the
 * details first. Hybrid opportunities have their own screen
 * (IncomingOpportunityAlertModal).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from '@/utils/safeAudio';
import type { EventItem } from '@/features/events/types';
import { formatPrice } from '@/utils/format';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme, onFill } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

const RINGTONE = require('../../../assets/sounds/connekyt_ringtone.wav');
/** Stop ringing after this long even if nobody answers; the screen stays. */
const MAX_RING_MS = 30_000;

type Props = {
  event: EventItem | null;
  onAccept: (event: EventItem) => Promise<void>;
  onDecline: (event: EventItem, reason: string) => Promise<void>;
  onViewDetails: (event: EventItem) => void;
  onLater: (event: EventItem) => void;
};

function formatDate(d?: string) {
  if (!d) return 'Date to be confirmed';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const formatTime = (t?: string) => (t ? t.slice(0, 5) : undefined);

export function BookingRequestCallModal({ event, onAccept, onDecline, onViewDetails, onLater }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { tr } = useSharedT();

  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Ring while the screen is up; stop on any action.
  const player = useRef<AudioPlayer | null>(null);
  const stopRinging = useCallback(() => {
    player.current?.pause();
  }, []);
  const ringingFor = event?.id;
  useEffect(() => {
    if (!ringingFor || Platform.OS === 'web') return;
    let p: AudioPlayer | null = null;
    try {
      void setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
      });
      p = createAudioPlayer(RINGTONE);
      p.loop = true;
      p.play();
      player.current = p;
    } catch {
      // No audio: the screen still shows and vibrates
    }
    Vibration.vibrate([0, 500, 300, 500, 300, 500]);
    const cap = setTimeout(() => p?.pause(), MAX_RING_MS);
    return () => {
      clearTimeout(cap);
      Vibration.cancel();
      p?.remove();
      player.current = null;
    };
  }, [ringingFor]);

  if (!event) return null;

  const start = formatTime(event.startTime);
  const end = formatTime(event.endTime);
  const time = start ? (end ? `${start} to ${end}` : start) : tr('Time to be confirmed');
  const price = event.price != null && event.price > 0 ? formatPrice(event.price, event.currency) : undefined;
  const client = event.clientName || tr('Client');

  const act = async (kind: 'accept' | 'decline') => {
    stopRinging();
    setError(null);
    setBusy(kind);
    try {
      if (kind === 'accept') await onAccept(event);
      else await onDecline(event, reason);
    } catch (e: any) {
      setError(e?.message || tr('Try again'));
      setBusy(null);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => onLater(event)} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
        behavior={declining || Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>{tr('INCOMING BOOKING REQUEST')}</Text>

          <View style={styles.avatarRing}>
            {event.clientAvatar ? (
              <Image source={{ uri: event.clientAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{client.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          <Text style={styles.client} numberOfLines={2}>
            {client}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {event.title || tr('Event')}
          </Text>

          <View style={styles.details}>
            <Row icon="calendar-outline" text={formatDate(event.eventDate)} />
            <Row icon="time-outline" text={time} />
            {event.location ? <Row icon="location-outline" text={event.location} /> : null}
            {event.packageName ? (
              <Row icon="cube-outline" text={price ? `${event.packageName} · ${price}` : event.packageName} />
            ) : price ? (
              <Row icon="cash-outline" text={price} />
            ) : null}
            {event.notes ? <Row icon="chatbox-ellipses-outline" text={event.notes} /> : null}
          </View>

          <Pressable onPress={() => onViewDetails(event)} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>{tr('View full details')}</Text>
          </Pressable>
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {declining ? (
          <View style={styles.declineBox}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={tr('Reason (optional), e.g. already booked that day')}
              placeholderTextColor={colors.textMuted}
              style={styles.reason}
              multiline
              autoFocus
            />
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setDeclining(false)}
                disabled={busy !== null}
                accessibilityRole="button"
              >
                <Text style={styles.btnGhostText}>{tr('Back')}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDecline]}
                onPress={() => act('decline')}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={tr('Decline booking')}
              >
                {busy === 'decline' ? (
                  <ActivityIndicator color={onFill} />
                ) : (
                  <Text style={styles.btnText}>{tr('Decline booking')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              {tr("Accepting confirms you're available. The client is notified and asked to pay the deposit.")}
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnDecline]}
                onPress={() => {
                  stopRinging();
                  setDeclining(true);
                }}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={tr('Decline')}
              >
                <Ionicons name="close" size={22} color={onFill} />
                <Text style={styles.btnText}>{tr('Decline')}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnAccept]}
                onPress={() => act('accept')}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={tr('Accept')}
              >
                {busy === 'accept' ? (
                  <ActivityIndicator color={onFill} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={22} color={onFill} />
                    <Text style={styles.btnText}>{tr('Accept')}</Text>
                  </>
                )}
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                stopRinging();
                onLater(event);
              }}
              hitSlop={8}
              style={styles.later}
              accessibilityRole="button"
            >
              <Text style={styles.laterText}>{tr('Decide later')}</Text>
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background, paddingHorizontal: spacing.xl },
  body: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg },
  eyebrow: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.primary, letterSpacing: 1.2 },
  avatarRing: {
    marginTop: spacing.md,
    padding: 5,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: c.primary,
  },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  avatarFallback: { backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 40, fontWeight: fontWeight.bold, color: c.primary },
  client: { fontSize: 26, fontWeight: fontWeight.bold, color: c.text, textAlign: 'center' },
  title: { fontSize: fontSize.md, color: c.textSoft, textAlign: 'center' },
  details: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowText: { flex: 1, fontSize: fontSize.md, color: c.text },
  link: { color: c.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm, marginTop: spacing.xs },
  hint: { fontSize: fontSize.xs, color: c.textMuted, textAlign: 'center', marginBottom: spacing.md },
  error: { color: c.error, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md },
  btn: {
    flex: 1,
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  btnAccept: { backgroundColor: c.success },
  btnDecline: { backgroundColor: c.error },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnText: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  btnGhostText: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  later: { alignSelf: 'center', marginTop: spacing.md, padding: spacing.sm },
  laterText: { color: c.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  declineBox: { gap: spacing.md },
  reason: {
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    color: c.text,
    padding: spacing.md,
    fontSize: fontSize.md,
    textAlignVertical: 'top',
  },
}));
