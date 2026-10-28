/**
 * The wish form, moved out of the event page unchanged in behaviour: the same identity rules (a signed-in user is sent as
 * their account, a guest is asked once and remembered), validation messages, text and video submit calls. `variant="card"`
 * is the compact form inside the Wishes & memories card (Send wish is a secondary button); `variant="page"` is the shared
 * wish page, where Send wish is the one raised action.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { accountIdentity, isEmail, loadGuestIdentity, saveGuestIdentity } from '@/features/events/guestIdentity';
import { sendEventVideoWish, sendEventWish } from '@/features/streams/api';
import { pickShortVideo } from '@/features/streams/pickShortVideo';
import { isApiError, useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

export function WishForm({ eventId, variant = 'card' }: { eventId: string; variant?: 'card' | 'page' }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const currentUser = useAuth((s) => s.user);
  const [wishName, setWishName] = useState('');
  const [wishEmail, setWishEmail] = useState('');
  const [wishMessage, setWishMessage] = useState('');
  const [wishBusy, setWishBusy] = useState(false);
  const [wishVideoBusy, setWishVideoBusy] = useState(false);
  const [wishError, setWishError] = useState<string | null>(null);
  const [wishSuccess, setWishSuccess] = useState<string | null>(null);
  const account = accountIdentity(currentUser);
  useEffect(() => {
    if (account) return;
    loadGuestIdentity().then((g) => {
      if (g.name) setWishName((n) => n || g.name!);
      if (g.email) setWishEmail((e) => e || g.email!);
    });
  }, [account]);

  /** Who the wish comes from, or null with the reason shown. */
  const wishIdentity = (): { name: string; email: string } | null => {
    const who = account ?? { name: wishName.trim(), email: wishEmail.trim() };
    if (!who.name) {
      setWishError('Please enter your name.');
      return null;
    }
    if (!isEmail(who.email)) {
      setWishError('Please enter a valid email.');
      return null;
    }
    return who;
  };
  const onSendWish = async () => {
    const who = wishIdentity();
    if (!who) return;
    if (!wishMessage.trim()) {
      setWishError('Please write your message.');
      return;
    }
    setWishBusy(true);
    setWishError(null);
    setWishSuccess(null);
    try {
      await sendEventWish(eventId, { ...who, message: wishMessage.trim() });
      setWishSuccess(t('b4_wishSentSuccess'));
      setWishMessage('');
      if (!account) void saveGuestIdentity(who);
    } catch (e) {
      setWishError(isApiError(e) ? e.message : t('b4_wishSendError'));
    } finally {
      setWishBusy(false);
    }
  };
  const onSendVideoWish = async () => {
    const who = wishIdentity();
    if (!who) return;
    setWishError(null);
    setWishSuccess(null);
    try {
      const video = await pickShortVideo();
      if (!video) return;
      setWishVideoBusy(true);
      await sendEventVideoWish(eventId, { ...who, message: wishMessage, video });
      setWishSuccess('Your video wish was sent to the event organizer!');
      setWishMessage('');
      if (!account) void saveGuestIdentity(who);
    } catch (e) {
      setWishError(isApiError(e) ? e.message : 'Could not send your video wish. Please try again.');
    } finally {
      setWishVideoBusy(false);
    }
  };

  const page = variant === 'page';
  const send = (
    <Button
      title={wishBusy ? t('b4_sending') : t('b4_sendWishBtn')}
      variant={page ? 'primary' : 'outline'}
      raised={page}
      onPress={onSendWish}
      loading={wishBusy}
      style={page ? undefined : styles.flex}
    />
  );
  const video = (
    <Pressable
      style={({ pressed }) => [styles.video, !page && styles.flex, (pressed || wishVideoBusy) && { opacity: 0.7 }]}
      onPress={onSendVideoWish}
      disabled={wishVideoBusy || wishBusy}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel="Record a 1 minute video wish"
      accessibilityState={{ busy: wishVideoBusy }}
    >
      {wishVideoBusy ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="videocam-outline" size={16} color={colors.accent} />}
      <Text style={styles.videoText} numberOfLines={1}>
        {wishVideoBusy ? 'Sending your video…' : page ? 'Record a 1-minute video wish' : 'Video · 1 min'}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.form}>
      {account ? (
        <Text style={styles.note}>{`Sending as ${account.name} (${account.email})`}</Text>
      ) : (
        <View style={page ? styles.col : styles.row}>
          <View style={styles.flex}>
            <Input
              placeholder={t('b4_yourNamePlaceholder')}
              accessibilityLabel="Your name"
              value={wishName}
              onChangeText={(v) => {
                setWishName(v);
                setWishError(null);
              }}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.flex}>
            <Input
              placeholder={t('b4_emailPlaceholder')}
              accessibilityLabel="Your email"
              value={wishEmail}
              onChangeText={(v) => {
                setWishEmail(v);
                setWishError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>
      )}
      <TextInput
        value={wishMessage}
        onChangeText={setWishMessage}
        placeholder={t('b4_writeMessagePlaceholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Your message"
        multiline
        style={styles.textarea}
      />
      {wishError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {wishError}
        </Text>
      ) : null}
      {wishSuccess ? (
        <View style={styles.success} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.successText}>{wishSuccess}</Text>
        </View>
      ) : null}
      {page ? (
        <>
          {send}
          {video}
        </>
      ) : (
        <View style={styles.row}>
          {send}
          {video}
        </View>
      )}
      <Text style={styles.note}>{page ? 'With a video, your message becomes its caption. Videos can be up to 1 minute.' : 'With a video, your message becomes its caption.'}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    form: { gap: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    col: { gap: spacing.sm },
    flex: { flex: 1 },
    textarea: {
      minHeight: 76,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.stroke,
      backgroundColor: c.well,
      color: c.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textAlignVertical: 'top',
      fontSize: fontSize.sm,
    },
    video: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: c.accent,
      paddingHorizontal: spacing.md,
    },
    videoText: { color: c.accent, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    note: { fontSize: fontSize.xs, color: c.textMuted },
    error: { color: c.error, fontSize: 12, fontWeight: fontWeight.semibold },
    success: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    successText: { color: c.success, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },
  }),
);
