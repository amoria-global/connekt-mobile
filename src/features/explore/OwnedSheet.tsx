/**
 * "I already bought this": the unlock code from a receipt opens that purchase, with the original photos and full clips
 * for their owner. Allowed in every build (consuming what you already own), and it says nothing about where to buy.
 * Photos open from their viewing link; a clip is downloaded once to the phone and played from there, so watching it
 * and saving it spend one download between them.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import { Sheet } from '@/components/ui/Sheet';
import { GhostButton, PrimaryButton } from '@/components/ui/Button';
import { InsetField } from '@/components/ui/Input';
import { savePhotoToGallery } from '@/utils/gallerySaver';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing } from '@/theme';
import { recoverByEmail, unlockByCode, type Unlocked, type UnlockedItem } from './api';

export function OwnedSheet({ onClose, initialCode = '' }: { onClose: () => void; initialCode?: string }) {
  const { t } = useLanguage();
  const styles = useStyles();
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [library, setLibrary] = useState<Unlocked | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const open = async () => {
    setBusy(true); setError('');
    try { setLibrary(await unlockByCode(code)); }
    catch (e) { setError((e as { status?: number }).status === 429 ? t('explore_tooMany') : t('explore_codeInvalid')); }
    finally { setBusy(false); }
  };
  const recover = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t('explore_emailInvalid')); return; }
    setBusy(true); setError('');
    try { await recoverByEmail(email.trim()); setNote(t('explore_recoverSent')); } catch { setError(t('explore_errorBody')); } finally { setBusy(false); }
  };
  const savePhoto = async (it: UnlockedItem) => {
    if (!it.viewUrl) return;
    const r = await savePhotoToGallery(it.viewUrl, `connekyt-${it.id}.jpg`);
    setNote(r.success ? t('explore_saved2') : t('explore_errorBody'));
  };
  const watch = async (it: UnlockedItem) => {
    if (!it.downloadUrl) return;
    setBusy(true); setError('');
    try {
      const target = `${FileSystem.cacheDirectory}connekyt-${it.id}.mp4`;
      const done = await FileSystem.downloadAsync(it.downloadUrl, target);
      if (done.status !== 200) throw new Error('not ready');
      setPlaying(done.uri);
    } catch { setError(t('explore_errorBody')); } finally { setBusy(false); }
  };

  return (
    <Sheet title={t('explore_alreadyBought')} onClose={onClose} busy={busy}
      footer={!library ? <PrimaryButton title={t('explore_unlock')} loading={busy} disabled={code.trim().length < 4} onPress={() => void open()} /> : undefined}>
      {!library && (
        <View style={styles.stack}>
          <Text style={styles.hint}>{t('explore_codeHint')}</Text>
          <InsetField value={code} onChangeText={(v: string) => { setCode(v); setError(''); }} placeholder="ABCD1234" autoCapitalize="characters" autoCorrect={false} />
          <Text style={styles.sub}>{t('explore_recoverTitle')}</Text>
          <Text style={styles.hint}>{t('explore_recoverBody')}</Text>
          <InsetField value={email} onChangeText={(v: string) => { setEmail(v); setError(''); }} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <GhostButton title={t('explore_sendLink')} disabled={busy} onPress={() => void recover()} />
        </View>
      )}
      {library && (
        <View style={styles.stack}>
          <Text style={styles.sub}>{t('explore_library')}</Text>
          {library.items.length === 0 && <Text style={styles.hint}>{t('explore_libraryEmpty')}</Text>}
          {library.items.map(it => (
            <View key={it.id} style={styles.item}>
              {it.thumbnailUrl ? <Image source={{ uri: it.thumbnailUrl }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name} numberOfLines={1}>{it.title || (it.mediaType === 'VIDEO' ? t('explore_clip') : t('explore_photo'))}</Text>
                {it.mediaType === 'PHOTO'
                  ? <GhostButton title={t('explore_saveToPhone')} onPress={() => void savePhoto(it)} />
                  : <GhostButton title={t('explore_openLibrary')} onPress={() => void watch(it)} />}
              </View>
            </View>
          ))}
          {playing && <LocalClip uri={playing} />}
        </View>
      )}
      {note ? <Text style={styles.hint} accessibilityLiveRegion="polite">{note}</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </Sheet>
  );
}

function LocalClip({ uri }: { uri: string }) {
  const styles = useStyles();
  const player = useVideoPlayer(uri, p => { p.play(); });
  return <VideoView player={player} style={styles.clip} contentFit="contain" nativeControls />;
}

const useStyles = makeStyles((c) => ({
  stack: { gap: spacing.md },
  hint: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  sub: { color: c.text, fontFamily: fonts.bold, fontSize: fontSize.md },
  error: { color: c.accent, fontFamily: fonts.medium, fontSize: fontSize.sm, marginTop: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: c.surfaceMuted },
  name: { color: c.text, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  clip: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: c.surfaceMuted },
}));
