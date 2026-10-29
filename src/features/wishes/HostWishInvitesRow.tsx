/**
 * The host's own view of the Wish invites setting: "Wish invites: On" with a shortcut to change it. It only controls what
 * viewers see; the host can always share the event themselves. Changing it needs no form and works while live.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEvent, setWishInvites } from '@/features/events/api';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { invitesOn, wishInvitesStatus } from './wishInvites';

export function HostWishInvitesRow({ eventId, initial, asCoordinator = false }: { eventId: string; initial?: boolean; asCoordinator?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [value, setValue] = useState<boolean | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The screen may not have the event yet (the stream controls load the stream, not the event): read it once.
  useEffect(() => {
    if (initial !== undefined) {
      setValue(initial);
      return;
    }
    let live = true;
    getEvent(eventId, asCoordinator)
      .then((e) => live && setValue(invitesOn(e.allowWishInvites)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [eventId, initial, asCoordinator]);

  if (value === undefined) return null;
  const on = invitesOn(value);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    const next = !on;
    setValue(next);
    try {
      await setWishInvites(eventId, next, asCoordinator);
    } catch (e) {
      setValue(on);
      setError((e as { message?: string })?.message || 'Could not change wish invites. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name={on ? 'people' : 'people-outline'} size={16} color={on ? colors.active : colors.textMuted} />
        <Text style={styles.text} accessibilityLiveRegion="polite">
          {wishInvitesStatus(value)}
        </Text>
        <Pressable
          onPress={toggle}
          disabled={busy}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={on ? 'Turn off wish invites' : 'Turn on wish invites'}
        >
          <Text style={styles.btnText}>{on ? 'Turn off' : 'Turn on'}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={styles.err} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
    text: { flex: 1, color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    btn: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radii.full, borderWidth: 1, borderColor: c.stroke, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: c.link, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    err: { color: c.error, fontSize: fontSize.xs },
  }),
);
