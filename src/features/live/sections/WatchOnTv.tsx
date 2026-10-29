import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Sheet } from '@/components/ui/Sheet';
import { listTvDevices, sendEventToTv } from '@/features/tv/api';
import type { TvDevice } from '@/features/tv/types';
import { useAuth, isApiError } from '@/store/auth';
import { makeStyles, spacing, fontSize, fontWeight, radii, useTheme } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';

/**
 * Send to TV: a TV icon in the live page header. It opens a sheet where the viewer picks one of their connected TVs
 * and the Connekyt TV app opens this stream. Needs an account, because the TVs belong to one. With no TV connected
 * the sheet leads to the pairing screen.
 */
export const WatchOnTv = memo(function WatchOnTv({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Watch on TV" style={s.icon}>
        <Ionicons name="tv-outline" size={20} color={V.text} />
      </Pressable>
      {open ? (
        <TvPickerSheet
          eventId={eventId}
          title={title}
          onClose={() => setOpen(false)}
          onConnect={() => {
            setOpen(false);
            router.push('/connect-to-tv' as Href);
          }}
          onSignIn={() => {
            setOpen(false);
            router.push('/login' as Href);
          }}
        />
      ) : null}
    </>
  );
});

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; devices: TvDevice[] };

function TvPickerSheet({
  eventId,
  title,
  onClose,
  onConnect,
  onSignIn,
}: {
  eventId: string;
  title: string;
  onClose: () => void;
  onConnect: () => void;
  onSignIn: () => void;
}) {
  const signedIn = useAuth((st) => st.status === 'authenticated');
  const styles = useStyles();
  const { colors } = useTheme();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      setLoad({ state: 'ready', devices: await listTvDevices() });
    } catch (err) {
      setLoad({ state: 'error', message: isApiError(err) ? err.message : 'Could not load your TVs.' });
    }
  }, []);

  useEffect(() => {
    if (signedIn) void fetchDevices();
  }, [fetchDevices, signedIn]);

  const send = async (device: TvDevice) => {
    setSendingId(device.id);
    setProblem(null);
    setSentTo(null);
    try {
      await sendEventToTv(device.id, eventId);
      setSentTo(device.deviceLabel);
    } catch (err) {
      setProblem(isApiError(err) ? err.message : 'Could not send it to your TV. Please try again.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Sheet title="Send to your TV" subtitle={title} onClose={onClose} busy={sendingId !== null}>
      {!signedIn ? (
        <View style={styles.center}>
          <Ionicons name="tv-outline" size={32} color={colors.textMuted} />
          <Text style={styles.heading}>Sign in to use your TV</Text>
          <Text style={styles.body}>Your TVs are connected to your account. Sign in, then send this stream to the TV.</Text>
          <Pressable onPress={onSignIn} accessibilityRole="button" style={styles.primary}>
            <Text style={styles.primaryText}>Sign in</Text>
          </Pressable>
        </View>
      ) : load.state === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : load.state === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.body}>{load.message}</Text>
          <Pressable onPress={fetchDevices} accessibilityRole="button" style={styles.link}>
            <Text style={styles.linkText}>Try again</Text>
          </Pressable>
        </View>
      ) : load.devices.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="tv-outline" size={32} color={colors.textMuted} />
          <Text style={styles.heading}>No TV connected yet</Text>
          <Text style={styles.body}>Open the Connekyt app on your TV, then scan the code it shows.</Text>
          <Pressable onPress={onConnect} accessibilityRole="button" style={styles.primary}>
            <Text style={styles.primaryText}>Connect a TV</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {load.devices.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => send(d)}
              disabled={sendingId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Send to ${d.deviceLabel}`}
              style={({ pressed }) => [styles.device, pressed && { opacity: 0.8 }, sendingId !== null && sendingId !== d.id && { opacity: 0.5 }]}
            >
              <Ionicons name="tv-outline" size={22} color={colors.primary} />
              <Text style={styles.deviceName} numberOfLines={1}>
                {d.deviceLabel}
              </Text>
              {sendingId === d.id ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="paper-plane-outline" size={18} color={colors.textMuted} />}
            </Pressable>
          ))}
          {sentTo ? (
            <Text style={styles.ok} accessibilityLiveRegion="polite">
              Sent to {sentTo}. It opens on your TV in a few seconds.
            </Text>
          ) : null}
          {problem ? (
            <Text style={styles.err} accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}
          <Text style={styles.hint}>
            If nothing opens, make sure the TV app is on. A TV connected a long time ago may need to be connected again from Manage TVs.
          </Text>
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  icon: { width: V.hit, height: V.hit, borderRadius: V.hit / 2, alignItems: 'center', justifyContent: 'center' },
});

const useStyles = makeStyles((c) => ({
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  heading: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  body: { fontSize: fontSize.sm, lineHeight: 20, color: c.textSoft, textAlign: 'center' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  linkText: { color: c.primary, fontWeight: fontWeight.bold },
  primary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xl, borderRadius: radii.full, backgroundColor: c.primary, marginTop: spacing.sm },
  primaryText: { color: c.textOnPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  list: { gap: spacing.sm },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  deviceName: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  ok: { fontSize: fontSize.sm, color: c.success, lineHeight: 20 },
  err: { fontSize: fontSize.sm, color: c.error, lineHeight: 20 },
  hint: { fontSize: fontSize.xs, color: c.textMuted, lineHeight: 17, marginTop: spacing.xs },
}));
