/**
 * The referral sheet: code and link (Copy), WhatsApp, More apps, Save QR, progress to the lower fee and the list of
 * referrals (names only). Loading, empty and error states are designed; every string is in the five languages.
 */
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { copyText } from '@/utils/copyText';
import { BrandedQr } from '@/features/qr/BrandedQrView';
import { saveQrToPhotos } from '@/features/wishes/saveQr';
import { useRouter, type Href } from 'expo-router';
import { Sheet } from '@/components/ui/Sheet';
import { GhostButton } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { makeStyles, radii, spacing } from '@/theme';
import { fetchMyReferral, fill, progressParts, referralLink, useReferralStrings, type ReferralStats } from './referral';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: ReferralStats };

const TONE: Record<string, ChipTone> = { qualified: 'success', pending: 'pending', under_review: 'accent', revoked: 'error' };

export function ReferralSheet({ visible, onClose, onAddCode }: { visible: boolean; onClose: () => void; onAddCode?: () => void }) {
  const s = useReferralStrings();
  const styles = useStyles();
  const router = useRouter();
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    setState({ status: 'loading' });
    fetchMyReferral()
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error' }));
  }, []);
  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const data = state.status === 'ready' ? state.data : null;
  const link = data?.code ? referralLink(data.code) : '';
  const message = data?.code ? fill(s.ui.shareMessage, { code: data.code, link }) : '';

  const copy = async (what: 'code' | 'link', text: string) => {
    const r = await copyText(text);
    if (r === 'copied') {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    }
  };
  const saveQr = async () => {
    if (!data?.code) return;
    try {
      const ok = await saveQrToPhotos(link, data.code);
      setNote(ok ? s.ui.copied : s.field.error);
    } catch {
      setNote(s.field.error);
    }
  };

  const body = () => {
    if (state.status === 'loading') {
      return (
        <View style={styles.stack} accessibilityLabel="Loading">
          <Skeleton height={64} radius={radii.lg} />
          <Skeleton height={44} radius={radii.lg} />
          <Skeleton height={110} radius={radii.lg} />
        </View>
      );
    }
    if (state.status === 'error' || !data) {
      return <ErrorState card={false} title={s.ui.loadError} message="" onRetry={load} />;
    }
    const p = progressParts(data);
    const line =
      p.kind === 'unlock' ? fill(s.ui.progressToUnlock, { n: p.n })
      : p.kind === 'fee' ? fill(s.ui.yourFee, { fee: p.fee ?? 0, n: p.n })
      : s.ui.complete;
    return (
      <View style={styles.stack}>
        <View>
          <Text style={styles.cap}>{s.ui.yourCode}</Text>
          <View style={styles.row}>
            <Text style={styles.code} selectable testID="referral-code" accessibilityLabel={`${s.ui.yourCode} ${data.code}`}>{data.code}</Text>
            <GhostButton title={copied === 'code' ? s.ui.copied : s.ui.copy} onPress={() => copy('code', data.code || '')} />
          </View>
          <Text style={[styles.cap, { marginTop: spacing.sm }]}>{s.ui.yourLink}</Text>
          <View style={styles.row}>
            <Text style={styles.link} numberOfLines={1} selectable>{link}</Text>
            <GhostButton title={copied === 'link' ? s.ui.copied : s.ui.copy} onPress={() => copy('link', link)} />
          </View>
        </View>

        <View style={styles.actions}>
          <GhostButton title={s.ui.whatsapp} onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`).catch(() => {})} />
          <GhostButton title={s.ui.moreApps} onPress={() => Share.share({ message }).catch(() => {})} />
          <GhostButton title={s.ui.saveQr} onPress={saveQr} />
        </View>

        <View style={styles.qrWrap}>
          <BrandedQr value={link} size={132} accessibilityLabel="QR" />
        </View>
        {note ? <Text style={styles.cap} accessibilityLiveRegion="polite">{note}</Text> : null}

        <View>
          <Text style={styles.progress} testID="referral-progress-text">{line}</Text>
          <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 20, now: Math.min(data.qualifying, 20) }}>
            <View style={[styles.barFill, { width: `${p.pct}%` }]} />
          </View>
        </View>

        <View>
          <Text style={styles.heading}>{s.ui.referralsTitle}</Text>
          {data.referrals.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{s.ui.emptyTitle}</Text>
              <Text style={styles.emptyBody}>{s.ui.emptyBody}</Text>
            </View>
          ) : (
            data.referrals.map((r, i) => (
              <View key={i} style={styles.refRow}>
                <Text style={styles.refName} numberOfLines={1}>{r.name}</Text>
                <StatusChip
                  compact
                  tone={TONE[r.status] ?? 'neutral'}
                  label={`${r.status === 'qualified' ? s.ui.statusQualified : r.status === 'under_review' ? s.ui.statusUnderReview : r.status === 'revoked' ? s.ui.statusRevoked : s.ui.statusPending} · ${String(r.date).slice(0, 10)}`}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Pressable accessibilityRole="link" hitSlop={10} onPress={() => { onClose(); router.push('/referral-program' as Href); }}>
            <Text style={styles.linkText}>{s.field.policy}</Text>
          </Pressable>
          {data.hasReferrer ? (
            <Text style={styles.cap}>{fill(s.ui.referredBy, { name: data.referrerName || '' })}</Text>
          ) : onAddCode ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onAddCode}>
              <Text style={styles.linkText}>{s.ui.addCode}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Sheet visible={visible} title={s.ui.sheetTitle} onClose={onClose}>
      {body()}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  stack: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cap: { fontSize: 12, color: c.textMuted },
  code: { flex: 1, fontSize: 28, fontWeight: '800', letterSpacing: 4, color: c.text, fontVariant: ['tabular-nums'] },
  link: { flex: 1, fontSize: 13.5, color: c.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  qrWrap: { alignSelf: 'center', padding: spacing.sm, borderRadius: radii.lg },
  progress: { fontSize: 14.5, fontWeight: '700', color: c.text },
  bar: { height: 10, borderRadius: 999, backgroundColor: c.surfaceMuted, overflow: 'hidden', marginTop: spacing.sm },
  barFill: { height: '100%', backgroundColor: c.primary },
  heading: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: spacing.sm },
  empty: { alignItems: 'center', gap: 4, paddingVertical: spacing.md },
  emptyTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
  emptyBody: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  refName: { flex: 1, fontSize: 14, color: c.text },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  linkText: { fontSize: 13.5, fontWeight: '700', color: c.primary },
}));
