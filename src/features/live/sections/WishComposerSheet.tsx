import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Sheet } from '@/components/ui/Sheet';
import { PrimaryButton, GhostButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { isApiError, useAuth } from '@/store/auth';
import { accountIdentity, loadGuestIdentity, saveGuestName } from '@/features/events/guestIdentity';
import { sendEventVideoWish, sendEventWish } from '@/features/streams/api';
import { pickShortVideo, type PickedVideo } from '@/features/streams/pickShortVideo';
import { canSend, formatClock, remainingChars, sentNotice, validateDraft, type ComposerDraft } from '@/features/wishes/composer';
import { MAX_WISH_TEXT, MAX_WISH_VIDEO_SECONDS, type WishVisibility } from '@/features/wishes/types';

function ClipPreview({ uri }: { uri: string }) {
  const styles = useStyles();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.preview} nativeControls contentFit="contain" accessibilityLabel="Preview of your video wish" />;
}

function VisibilityChoice({ value, onChange, error }: { value: WishVisibility | null; onChange: (v: WishVisibility) => void; error?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const opts: { key: WishVisibility; label: string; hint: string; icon: 'globe-outline' | 'lock-closed-outline' }[] = [
    { key: 'public', label: 'Public', hint: 'Shown in the feed after the host approves it', icon: 'globe-outline' },
    { key: 'private', label: 'Private', hint: 'Only the host sees it', icon: 'lock-closed-outline' },
  ];
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      <Text style={styles.label}>Who can see this wish?</Text>
      <View style={styles.row}>
        {opts.map((o) => {
          const on = value === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${o.label}. ${o.hint}`}
              style={[styles.choice, on && styles.choiceOn]}
            >
              <Ionicons name={o.icon} size={18} color={on ? colors.primary : colors.textMuted} />
              <Text style={[styles.choiceTitle, on && { color: colors.primary }]}>{o.label}</Text>
              <Text style={styles.choiceHint}>{o.hint}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/**
 * The wish composer, for a text or a video wish. A signed-in person is sent as their account; a guest is asked for a
 * name and email once. Visibility has no default and Send waits for it. A video is previewed before it is sent.
 */
export function WishComposerSheet({ eventId, kind, onClose, onSent }: { eventId: string; kind: 'text' | 'video'; onClose: () => void; onSent?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const account = accountIdentity(user);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<WishVisibility | null>(null);
  const [clip, setClip] = useState<PickedVideo | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (account) return;
    loadGuestIdentity().then((g) => {
      if (g.name) setName((n) => n || g.name!);
    });
  }, [account]);

  const draft: ComposerDraft = { kind, name, message, visibility, durationSeconds: clip?.durationSeconds ?? null, hasVideo: !!clip };
  const errors = validateDraft(draft, account);
  const ready = canSend(errors);

  const choose = async () => {
    setError(null);
    try {
      const picked = await pickShortVideo();
      if (!picked) return;
      if (picked.durationSeconds && picked.durationSeconds > MAX_WISH_VIDEO_SECONDS) {
        setClip(null);
        setError(`That clip is ${formatClock(picked.durationSeconds)}. A video wish can be at most ${MAX_WISH_VIDEO_SECONDS} seconds.`);
        return;
      }
      setClip(picked);
    } catch {
      setError('Could not open the camera or your library. Please try again.');
    }
  };

  const send = async () => {
    setTried(true);
    if (!ready || !visibility) return;
    const who = { name: (account?.name ?? name).trim() };
    setBusy(true);
    setError(null);
    try {
      if (kind === 'text') await sendEventWish(eventId, { ...who, message: message.trim(), visibility });
      else await sendEventVideoWish(eventId, { ...who, message, visibility, durationSeconds: clip?.durationSeconds, video: clip! });
      if (!account) void saveGuestName(who.name);
      setSent(sentNotice(visibility));
      onSent?.();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not send your wish. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const shown = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  if (sent) {
    return (
      <Sheet title="Wish sent" onClose={onClose} footer={<PrimaryButton title="Done" onPress={onClose} />}>
        <Text style={styles.sentText} accessibilityLiveRegion="polite">
          {sent}
        </Text>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={kind === 'video' ? 'Video wish' : 'Text wish'}
      subtitle={kind === 'video' ? `Record or upload up to ${MAX_WISH_VIDEO_SECONDS} seconds` : undefined}
      onClose={onClose}
      busy={busy}
      footer={<PrimaryButton title="Send wish" onPress={send} loading={busy} disabled={tried && !ready} />}
    >
      {kind === 'video' ? (
        <View style={styles.group}>
          {clip ? (
            <>
              <ClipPreview uri={clip.uri} />
              <View style={styles.row}>
                <Text style={styles.meta}>{clip.durationSeconds ? formatClock(clip.durationSeconds) : 'Ready to send'}</Text>
                <GhostButton title="Choose another" onPress={choose} />
              </View>
            </>
          ) : (
            <GhostButton title="Record or upload a video" onPress={choose} icon={<Ionicons name="videocam-outline" size={18} color={colors.text} />} />
          )}
          {shown('video') ? <Text style={styles.error}>{shown('video')}</Text> : null}
        </View>
      ) : null}

      {!account ? (
        <>
          <Input label="Your name" value={name} onChangeText={setName} autoCapitalize="words" error={shown('name')} />
        </>
      ) : null}

      <View style={styles.group}>
        <Input
          label={kind === 'video' ? 'Caption (optional)' : 'Your wish'}
          value={message}
          onChangeText={(t) => setMessage(t.slice(0, MAX_WISH_TEXT))}
          multiline
          numberOfLines={4}
          maxLength={MAX_WISH_TEXT}
          textAlignVertical="top"
          error={shown('message')}
        />
        <Text style={styles.meta} accessibilityLabel={`${remainingChars(message)} characters left`}>
          {remainingChars(message)} left
        </Text>
      </View>

      <VisibilityChoice value={visibility} onChange={setVisibility} error={shown('visibility')} />

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  meta: { color: c.textMuted, fontSize: fontSize.sm },
  error: { color: c.error, fontSize: fontSize.sm },
  sentText: { color: c.text, fontSize: fontSize.md, lineHeight: 22 },
  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md, overflow: 'hidden' },
  choice: { flex: 1, gap: 4, padding: spacing.md, minHeight: 88, borderRadius: radii.md, borderWidth: 1, borderColor: c.border },
  choiceOn: { borderColor: c.primary },
  choiceTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  choiceHint: { color: c.textMuted, fontSize: fontSize.xs },
}));
