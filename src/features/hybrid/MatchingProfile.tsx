/**
 * The photographer's matching profile: Instagram username or link, and base
 * city when Connekyt can't tell it from their address. Same copy and rules as
 * the web dashboard and the connekyt.com onboarding.
 *
 * MatchingProfilePrompt asks registered photographers once; "Remind me later"
 * hides it for a week on this device. MatchingProfileCard is the same form on
 * the profile screen.
 *
 * Midnight Glass (design/profile.png): a glass panel with a magenta icon tile and a Live chip
 * once Instagram is connected; the connected account sits in an inset well with Change; the
 * reasons are a checked list; Save changes is the screen's one raised (magenta) button and
 * Remove clears the account, the same as emptying the field and saving.
 */
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedT } from '@/i18n/sharedStrings';
import { storage } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { darkPalette, fonts, fontSize, makeStyles, radii, shadows, spacing, useTheme } from '@/theme';
import { AccentButton, GhostButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { getHybridOptions, getHybridProfile, saveHybridProfile } from './api';
import type { HybridProfile } from './types';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { SheetCornerClose } from '@/components/ui/SheetCloseButton';

export const INSTAGRAM_WHY = [
  'Clients who use Post My Event are matched with photographers automatically. A public Instagram profile helps Connekyt recommend you.',
  'We read only your public bio, follower and following counts, and profile photo. We never post, message or ask for your password.',
  'It is optional and you can remove it at any time.',
];

const SNOOZE_KEY = 'matchingPrompt.dismissedAt';
const SNOOZE_DAYS = 7;

const STATUS_TEXT: Record<HybridProfile['instagramStatus'], string | null> = {
  CONNECTED: 'Connected. Your profile is used for matching.',
  PENDING: "Saved. We'll check it shortly.",
  NOT_FOUND: "We couldn't find that profile. Check the username and that the account is public.",
  NONE: null,
};

export function MatchingProfileForm({
  onSaved,
  onLoaded,
  showWhy = true,
}: {
  onSaved?: (p: HybridProfile) => void;
  /** The profile as read and after each save, so a host can show its state (the card's Live chip). */
  onLoaded?: (p: HybridProfile) => void;
  showWhy?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<HybridProfile | null>(null);
  const [handle, setHandle] = useState('');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    getHybridProfile()
      .then((p) => { setProfile(p); onLoaded?.(p); setHandle(p.instagramHandle ? `@${p.instagramHandle}` : ''); setCity(p.city || ''); })
      .catch((e) => setError(isApiError(e) ? e.message : 'Could not load your matching profile.'));
    getHybridOptions().then((o) => setCities(o.cities.map((c) => c.name))).catch(() => {});
  }, []);

  const save = async (nextHandle = handle) => {
    setSaving(true);
    setError(null);
    try {
      const update: { instagramHandle?: string; city?: string } = { instagramHandle: nextHandle.trim() };
      if (city || profile?.needsCity) update.city = city;
      const p = await saveHybridProfile(update);
      setProfile(p);
      setHandle(p.instagramHandle ? `@${p.instagramHandle}` : '');
      setEditing(false);
      onLoaded?.(p);
      onSaved?.(p);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const status = profile ? STATUS_TEXT[profile.instagramStatus] : null;
  const askCity = !!profile && (profile.needsCity || !!profile.city);
  // A connected account shows as a row with Change; the field comes back to edit it.
  const showConnected = !!profile?.instagramHandle && profile.instagramStatus === 'CONNECTED' && !editing;

  return (
    <View style={{ gap: spacing.md }}>
      {showWhy ? INSTAGRAM_WHY.map((w, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Ionicons name="checkmark" size={16} color={colors.accentLight} style={{ marginTop: 2 }} />
          <Text style={[styles.body, { flex: 1 }]}>{tr(w)}</Text>
        </View>
      )) : null}
      {showConnected ? (
        <View style={styles.connected}>
          <IconTile icon="logo-instagram" tone="accent" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.connectedHandle} numberOfLines={1}>
              @{profile?.instagramHandle}
            </Text>
            <Text style={styles.hint}>{tr('Instagram · Used for matching')}</Text>
          </View>
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={tr('Change Instagram account')} style={styles.change}>
            <Text style={styles.changeText}>{tr('Change')}</Text>
          </Pressable>
        </View>
      ) : (
      <View>
        <Text style={styles.label}>{tr('Instagram')}</Text>
        <Text style={styles.hint}>{tr('Your username or a link, e.g. @yourstudio or instagram.com/yourstudio')}</Text>
        <View style={styles.inputRow}>
          <Ionicons name="logo-instagram" size={18} color={colors.textMuted} />
          <TextInput value={handle} onChangeText={setHandle} placeholder="@yourstudio" placeholderTextColor={colors.textMuted}
            autoCapitalize="none" autoCorrect={false} style={styles.input} accessibilityLabel="Instagram username or link" />
        </View>
      </View>
      )}
      {askCity ? (
        <View>
          <Text style={styles.label}>{tr('Where are you based?')}</Text>
          <Text style={styles.hint}>{profile?.resolvedCity && !profile.city ? `From your address we think ${profile.resolvedCity}.` : tr('So we can send you events near you.')}</Text>
          <Pressable onPress={() => setCityOpen(true)} style={styles.inputRow} accessibilityRole="button" accessibilityLabel={`City ${city || 'not chosen'}`}>
            <Ionicons name="location-outline" size={18} color={colors.link} />
            <Text style={[styles.input, !city && { color: colors.textMuted }]}>{city || tr('Choose your city')}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {/* Connected says itself in the row above and the card's Live chip; other states still explain. */}
      {error ? <Text style={styles.error}>{tr(error)}</Text> : status && !showConnected ? <Text style={styles.status}>{tr(status)}</Text> : null}
      <View style={styles.actions}>
        <AccentButton title="Save changes" onPress={() => save()} loading={saving} disabled={!profile} style={styles.grow} />
        {profile?.instagramHandle ? (
          <GhostButton title="Remove" onPress={() => save('')} disabled={saving} />
        ) : null}
      </View>

      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <GlassScrim style={styles.scrim} onPress={() => setCityOpen(false)}>
          <GlassSheetHost style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <SheetCornerClose onPress={() => setCityOpen(false)} />
            <Text style={styles.label}>{tr(tr('Your city'))}</Text>
            <FlatList data={cities} keyExtractor={(c) => c} style={{ maxHeight: 380 }} renderItem={({ item }) => (
              <Pressable onPress={() => { setCity(item); setCityOpen(false); }} style={[styles.row, item === city && { backgroundColor: colors.tint }]}
                accessibilityRole="radio" accessibilityState={{ checked: item === city }}>
                <Text style={styles.body}>{item}</Text>
                {item === city ? <Ionicons name="checkmark" size={18} color={colors.link} /> : null}
              </Pressable>
            )} />
          </GlassSheetHost>
        </GlassScrim>
      </Modal>
    </View>
  );
}

export function MatchingProfileCard() {
  const styles = useStyles();
  const { tr } = useSharedT();
  const [live, setLive] = useState(false);
  return (
    <GlassCard style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconTile icon="radio-outline" tone="accent" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{tr('Matching profile')}</Text>
          <Text style={styles.hint}>{tr('Get Post My Event opportunities')}</Text>
        </View>
        {live ? <StatusChip label={tr('Live')} tone="active" dot /> : null}
      </View>
      <MatchingProfileForm onLoaded={(p) => setLive(p.instagramStatus === 'CONNECTED')} />
    </GlassCard>
  );
}

/** Asks once; snoozed for a week on "Remind me later". */
export function MatchingProfilePrompt() {
  const styles = useStyles();
  const { tr } = useSharedT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const at = Number((await storage.get(SNOOZE_KEY)) || 0);
        if (at > 0 && Date.now() - at < SNOOZE_DAYS * 86400000) return;
        const p = await getHybridProfile();
        if (!cancelled && (p.needsInstagram || p.needsCity)) setTimeout(() => !cancelled && setOpen(true), 2500);
      } catch {
        // nothing to ask
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const later = () => {
    storage.set(SNOOZE_KEY, String(Date.now())).catch(() => {});
    setOpen(false);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={later}>
      <GlassScrim style={styles.scrim} onPress={later}>
        <GlassSheetHost style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconTile icon="logo-instagram" tone="accent" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} accessibilityRole="header">{tr('Get matched with more events')}</Text>
              <Text style={styles.hint}>{tr('Takes 20 seconds')}</Text>
            </View>
          </View>
          <MatchingProfileForm onSaved={(p) => { if (!p.needsCity) setTimeout(() => setOpen(false), 1200); }} />
          <Pressable onPress={later} style={{ alignSelf: 'center', padding: spacing.sm }} accessibilityRole="button">
            <Text style={styles.later}>{tr('Remind me later')}</Text>
          </Pressable>
        </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 18, fontFamily: fonts.display, color: c.text },
  label: { fontSize: fontSize.sm, fontFamily: fonts.semibold, color: c.text },
  hint: { fontSize: 13, fontFamily: fonts.regular, color: c.textMuted, lineHeight: 18 },
  body: { fontSize: 14, fontFamily: fonts.regular, color: c.textSoft, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    marginTop: 6,
    backgroundColor: c.well,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
  },
  input: { flex: 1, fontSize: fontSize.md, fontFamily: fonts.regular, color: c.text, paddingVertical: 10 },
  connected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
  },
  connectedHandle: { fontSize: 16, fontFamily: fonts.display, color: c.text },
  change: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  changeText: { fontSize: 15, fontFamily: fonts.semibold, color: c.link },
  error: { color: c.error, backgroundColor: c.errorBg, padding: spacing.sm, borderRadius: radii.md, fontSize: fontSize.sm, fontFamily: fonts.regular },
  status: { color: c.textSoft, backgroundColor: c.tint, padding: spacing.sm, borderRadius: radii.md, fontSize: fontSize.sm, fontFamily: fonts.regular },
  actions: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  grow: { flex: 1 },
  later: { color: c.textMuted, fontFamily: fonts.semibold },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radii.md },
}));
