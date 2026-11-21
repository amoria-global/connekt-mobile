/**
 * The invite share sheet: one line on when a referral counts, the code and link (Copy), WhatsApp, More apps, Save QR
 * and the QR itself. The referral list and progress live on the Milestones screen. Loading and error states are
 * designed; the wording is the shared copy, in the five languages.
 */
import { useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { copyText } from '@/utils/copyText';
import { BrandedQr } from '@/features/qr/BrandedQrView';
import { saveQrToPhotos } from '@/features/wishes/saveQr';
import { Sheet } from '@/components/ui/Sheet';
import { GhostButton } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { fonts, makeStyles, radii, spacing } from '@/theme';
import { HowItCountsSheet } from './HowReferralsCount';
import { fill, referralLink, useMilestoneCopy, useReferralStats, useReferralStrings } from './referral';

export function ReferralSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useReferralStrings();
  const m = useMilestoneCopy();
  const styles = useStyles();
  const { stats, status, reload } = useReferralStats(visible);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [note, setNote] = useState('');
  const [how, setHow] = useState(false);

  const code = stats?.code ?? null;
  const link = code ? referralLink(code) : '';
  const message = code ? fill(s.ui.shareMessage, { code, link }) : '';

  const copy = async (what: 'code' | 'link', text: string) => {
    const r = await copyText(text);
    if (r === 'copied') {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    }
  };
  const saveQr = async () => {
    if (!code) return;
    try {
      setNote((await saveQrToPhotos(link, code)) ? m.copied : s.field.error);
    } catch {
      setNote(s.field.error);
    }
  };

  const body = () => {
    if (status === 'loading' && !stats) {
      return (
        <View style={styles.stack} accessibilityLabel="Loading" testID="invite-loading">
          <Skeleton height={20} radius={radii.sm} />
          <Skeleton height={64} radius={radii.lg} />
          <Skeleton height={44} radius={radii.lg} />
        </View>
      );
    }
    if (!stats) return <ErrorState card={false} title={m.loadError} message="" onRetry={reload} />;
    if (!code) {
      return <Text style={styles.share} testID="invite-max">{m.maxTitle}</Text>;
    }
    return (
      <View style={styles.stack}>
        <Text style={styles.share} testID="invite-share-line">{m.shareLine}</Text>
        <Pressable onPress={() => setHow(true)} accessibilityRole="link" hitSlop={10} testID="invite-how">
          <Text style={styles.link}>{m.howTitle}</Text>
        </Pressable>
        <View>
          <Text style={styles.cap}>{s.ui.yourCode}</Text>
          <View style={styles.row}>
            <Text style={styles.code} selectable testID="referral-code" accessibilityLabel={`${s.ui.yourCode} ${code}`}>{code}</Text>
            <GhostButton title={copied === 'code' ? m.copied : m.copy} onPress={() => copy('code', code)} />
          </View>
          <Text style={[styles.cap, { marginTop: spacing.sm }]}>{s.ui.yourLink}</Text>
          <View style={styles.row}>
            <Text style={styles.linkText} numberOfLines={1} selectable>{link}</Text>
            <GhostButton title={copied === 'link' ? m.copied : m.copy} onPress={() => copy('link', link)} />
          </View>
        </View>
        <View style={styles.actions}>
          <GhostButton title={m.whatsapp} onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`).catch(() => {})} />
          <GhostButton title={m.moreApps} onPress={() => Share.share({ message }).catch(() => {})} />
          <GhostButton title={m.saveQr} onPress={saveQr} />
        </View>
        <View style={styles.qrWrap}>
          <BrandedQr value={link} size={132} accessibilityLabel="QR" />
        </View>
        {note ? <Text style={styles.cap} accessibilityLiveRegion="polite">{note}</Text> : null}
      </View>
    );
  };

  return (
    <Sheet visible={visible} title={m.invite} onClose={onClose}>
      {body()}
      <HowItCountsSheet visible={how} onClose={() => setHow(false)} minUsd={stats?.minQualifyingUsd} />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  stack: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cap: { fontSize: 12, color: c.textMuted },
  share: { fontSize: 13.5, lineHeight: 19, color: c.text },
  code: { flex: 1, fontFamily: fonts.display, fontSize: 28, fontWeight: '800', letterSpacing: 4, color: c.text, fontVariant: ['tabular-nums'] },
  linkText: { flex: 1, fontSize: 13.5, color: c.text },
  link: { fontSize: 13, fontWeight: '700', color: c.link },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  qrWrap: { alignSelf: 'center', padding: spacing.sm, borderRadius: radii.lg },
}));
