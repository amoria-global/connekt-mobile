/**
 * The Wishes & memories card on the event page: one card, two tabs. "Send my wish" is the existing form (WishForm);
 * "Invite loved ones" shows the QR for the wish page with Share link and Save QR. The heartfelt line sits under the card.
 * Copy is left to the share sheet: the installed app has no clipboard module, so a Copy button would need a new build.
 */
import { useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { accountIdentity, loadGuestIdentity } from '@/features/events/guestIdentity';
import { qrMatrix } from '@/features/events/scanIntent';
import { useAuth } from '@/store/auth';
import { fontSize, fontWeight, lightPalette, makeStyles, onFill, radii, spacing, useTheme } from '@/theme';
import { WishForm } from './WishForm';
import { saveQrToPhotos } from './saveQr';
import { HEARTFELT_LINE, sanitizeFrom, wishLink } from './wishPage';

const QUIET = 2;
type Tab = 'send' | 'invite';

export function WishesMemoriesCard({ eventId, title }: { eventId: string; title: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [tab, setTab] = useState<Tab>('send');
  return (
    <>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name="heart" size={16} color={onFill} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.title} accessibilityRole="header">
              Wishes & memories
            </Text>
            <Text style={styles.sub}>Shown on screen during the event</Text>
          </View>
        </View>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { label: 'Send my wish', value: 'send' },
            { label: 'Invite loved ones', value: 'invite' },
          ]}
        />
        {tab === 'send' ? <WishForm eventId={eventId} variant="card" /> : <InviteTab eventId={eventId} title={title} />}
      </View>
      <View style={styles.heartfelt}>
        <Ionicons name="heart-outline" size={16} color={colors.accent} style={styles.heartIcon} />
        <Text style={styles.heartfeltText}>{HEARTFELT_LINE}</Text>
      </View>
    </>
  );
}

function InviteTab({ eventId, title }: { eventId: string; title: string }) {
  const styles = useStyles();
  const user = useAuth((s) => s.user);
  const account = accountIdentity(user);
  const [guestName, setGuestName] = useState('');
  useEffect(() => {
    if (account) return;
    loadGuestIdentity().then((g) => setGuestName(g.name ?? ''));
  }, [account]);
  // The sharer's first name goes in the link so the page can say who invited you.
  const from = sanitizeFrom((account?.name ?? guestName).split(' ')[0]);
  const link = wishLink(eventId, from);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const qr = useMemo(() => {
    const { size, dark } = qrMatrix(link);
    let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (dark[y * size + x]) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
    return { d, box: size + QUIET * 2 };
  }, [link]);

  const onShare = async () => {
    setNote(null);
    try {
      await Share.share({ title, message: `Send a wish for "${title}":\n${link}` });
    } catch {
      /* dismissed */
    }
  };
  const onSave = async () => {
    setSaving(true);
    setNote(null);
    try {
      setNote((await saveQrToPhotos(link, eventId)) ? 'QR saved to your photos.' : 'Allow access to photos to save the QR.');
    } catch {
      setNote('Could not save the QR. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.invite}>
      <View style={styles.inviteRow}>
        <View style={styles.qr} accessible accessibilityRole="image" accessibilityLabel="QR code for wish link">
          <Svg width="100%" height="100%" viewBox={`0 0 ${qr.box} ${qr.box}`}>
            <Rect width={qr.box} height={qr.box} fill={onFill} />
            <Path d={qr.d} fill={lightPalette.primary} />
          </Svg>
        </View>
        <View style={styles.flex}>
          <Text style={styles.sub}>They scan or open the link, see this event, and send their wish. No account needed.</Text>
          <Button
            title="Share link"
            variant="outline"
            onPress={onShare}
            icon={<Ionicons name="share-outline" size={16} color={lightPalette.link} />}
            style={styles.shareBtn}
          />
        </View>
      </View>
      <Button title="Save QR" variant="outline" onPress={onSave} loading={saving} />
      {note ? (
        <Text style={styles.sub} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.stroke,
      backgroundColor: c.surface,
      padding: spacing.md,
      gap: spacing.sm,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
    sub: { fontSize: fontSize.xs, color: c.textMuted },
    heartfelt: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xs },
    heartIcon: { marginTop: 2 },
    heartfeltText: { flex: 1, fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
    invite: { gap: spacing.sm },
    inviteRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    qr: { width: 104, height: 104, borderRadius: radii.md, overflow: 'hidden', backgroundColor: onFill },
    shareBtn: { marginTop: spacing.sm },
  }),
);
