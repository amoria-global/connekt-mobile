/**
 * In-app banner and sound for new booking and payment notifications while
 * the app is open.
 *
 * Booking changes only showed up on the bell: with the app open the phone's
 * banner depends on a push arriving, and on devices without working push
 * (no APNs credentials, Expo Go) nothing alerted at all. This polls the
 * notifications list while the app is in the foreground, checks right away
 * when a push lands, and for each new unread booking or payment notification
 * shows a banner (tap to open it) and plays the ringtone for a booking request
 * or the chime for other changes. See inAppAlerts.ts for the rules.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, Pressable, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer, setAudioModeAsync } from '@/utils/safeAudio';
import { Ionicons } from '@expo/vector-icons';
import { useRole } from '@/features/auth/role';
import { listNotifications, type AppNotification } from './api';
import { freshUnread, inAppAlertKind, type InAppAlertKind } from './inAppAlerts';
import { notificationTarget } from './routing';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme } from '@/theme';

const POLL_MS = 15_000;
const BANNER_MS = 6_000;

const SOUNDS: Record<InAppAlertKind, number> = {
  ring: require('../../../assets/sounds/connekyt_ringtone.wav'),
  chime: require('../../../assets/sounds/connekyt_chime.wav'),
};

function playOnce(kind: InAppAlertKind) {
  if (Platform.OS === 'web') return;
  try {
    void setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    });
    const player = createAudioPlayer(SOUNDS[kind]);
    player.play();
    // Release after the clip (ringtone 7.7 s, chime 3.9 s).
    setTimeout(() => player.remove(), 9_000);
    Vibration.vibrate(kind === 'ring' ? [0, 400, 200, 400] : 200);
  } catch {
    // No audio: the banner still shows
  }
}

export function InAppNotificationWatcher() {
  const { role } = useRole();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();

  const seen = useRef<Set<string> | null>(null);
  const [banner, setBanner] = useState<AppNotification | null>(null);
  const [slide] = useState(() => new Animated.Value(-160));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(slide, { toValue: -160, duration: 200, useNativeDriver: true }).start(() => setBanner(null));
  }, [slide]);

  const show = useCallback(
    (n: AppNotification) => {
      setBanner(n);
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, BANNER_MS);
    },
    [slide, hide],
  );

  const check = useCallback(async () => {
    try {
      const items = await listNotifications(role, 0, 20);
      const fresh = freshUnread(seen.current, items).filter((n) => inAppAlertKind(n) !== null);
      seen.current = new Set(items.map((n) => String(n.id)));
      if (fresh.length === 0) return;
      const kinds = fresh.map((n) => inAppAlertKind(n));
      playOnce(kinds.includes('ring') ? 'ring' : 'chime');
      show(fresh[0]);
    } catch {
      // Offline or signed out: try again on the next poll
    }
  }, [role, show]);

  useEffect(() => {
    void check();
    let timer: ReturnType<typeof setInterval> | null = setInterval(check, POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void check();
        if (!timer) timer = setInterval(check, POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    // A push just landed: look now instead of waiting for the next poll.
    const received =
      Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener(() => void check());
    return () => {
      if (timer) clearInterval(timer);
      appState.remove();
      received?.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [check]);

  if (!banner) return null;

  const ring = inAppAlertKind(banner) === 'ring';
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm, transform: [{ translateY: slide }] }]}
    >
      <Pressable
        style={[styles.card, ring && { borderColor: colors.primary }]}
        onPress={() => {
          hide();
          router.push(
            notificationTarget({
              type: banner.rawType,
              referenceId: banner.referenceId,
              link: banner.link,
            }),
          );
        }}
        accessibilityRole="button"
        accessibilityLabel={`${banner.title}. ${banner.message}. Open`}
      >
        <View style={[styles.icon, { backgroundColor: ring ? colors.primary : colors.surfaceMuted }]}>
          <Ionicons
            name={ring ? 'notifications' : 'checkmark-circle-outline'}
            size={18}
            color={ring ? '#FFFFFF' : colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {banner.message}
          </Text>
        </View>
        <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.elevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  message: { fontSize: fontSize.xs, color: c.textSoft, marginTop: 2 },
}));
