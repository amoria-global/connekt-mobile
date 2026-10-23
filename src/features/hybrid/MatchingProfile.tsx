/**
 * The photographer's matching profile: Instagram username or link, and base
 * city when Connekyt can't tell it from their address. Same copy and rules as
 * the web dashboard and the connekyt.com onboarding.
 *
 * MatchingProfilePrompt asks registered photographers once; "Remind me later"
 * hides it for a week on this device. MatchingProfileCard is the same form on
 * the profile screen.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedT } from '@/i18n/sharedStrings';
import { storage } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { getHybridOptions, getHybridProfile, saveHybridProfile } from './api';
import type { HybridProfile } from './types';
import { MODE_META } from './hybridUi';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

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

export function MatchingProfileForm({ onSaved, showWhy = true }: { onSaved?: (p: HybridProfile) => void; showWhy?: boolean }) {
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

  useEffect(() => {
    getHybridProfile()
      .then((p) => { setProfile(p); setHandle(p.instagramHandle ? `@${p.instagramHandle}` : ''); setCity(p.city || ''); })
      .catch((e) => setError(isApiError(e) ? e.message : 'Could not load your matching profile.'));
    getHybridOptions().then((o) => setCities(o.cities.map((c) => c.name))).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const update: { instagramHandle?: string; city?: string } = { instagramHandle: handle.trim() };
      if (city || profile?.needsCity) update.city = city;
      const p = await saveHybridProfile(update);
      setProfile(p);
      onSaved?.(p);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const status = profile ? STATUS_TEXT[profile.instagramStatus] : null;
  const askCity = !!profile && (profile.needsCity || !!profile.city);

  return (
    <View style={{ gap: spacing.md }}>
      {showWhy ? INSTAGRAM_WHY.map((w, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Ionicons name={(['sparkles-outline', 'eye-outline', 'toggle-outline'] as const)[i]} size={15} color={MODE_META.HYBRID.color} style={{ marginTop: 2 }} />
          <Text style={[styles.body, { flex: 1 }]}>{tr(w)}</Text>
        </View>
      )) : null}
      <View>
        <Text style={styles.label}>{tr('Instagram')}</Text>
        <Text style={styles.hint}>{tr('Your username or a link, e.g. @yourstudio or instagram.com/yourstudio')}</Text>
        <View style={styles.inputRow}>
          <Ionicons name="logo-instagram" size={18} color={colors.textMuted} />
          <TextInput value={handle} onChangeText={setHandle} placeholder="@yourstudio" placeholderTextColor={colors.textMuted}
            autoCapitalize="none" autoCorrect={false} style={styles.input} accessibilityLabel="Instagram username or link" />
        </View>
      </View>
      {askCity ? (
        <View>
          <Text style={styles.label}>{tr('Where are you based?')}</Text>
          <Text style={styles.hint}>{profile?.resolvedCity && !profile.city ? `From your address we think ${profile.resolvedCity}.` : tr('So we can send you events near you.')}</Text>
          <Pressable onPress={() => setCityOpen(true)} style={styles.inputRow} accessibilityRole="button" accessibilityLabel={`City ${city || 'not chosen'}`}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={[styles.input, !city && { color: colors.textMuted }]}>{city || tr('Choose your city')}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{tr(error)}</Text> : status ? <Text style={styles.status}>{tr(status)}</Text> : null}
      <Pressable onPress={save} disabled={saving || !profile} style={[styles.save, (saving || !profile) && { opacity: 0.6 }]} accessibilityRole="button">
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{tr('Save')}</Text>}
      </Pressable>

      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <GlassScrim style={styles.scrim} onPress={() => setCityOpen(false)}>
          <GlassSheetHost style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.label}>{tr(tr('Your city'))}</Text>
            <FlatList data={cities} keyExtractor={(c) => c} style={{ maxHeight: 380 }} renderItem={({ item }) => (
              <Pressable onPress={() => { setCity(item); setCityOpen(false); }} style={[styles.row, item === city && { backgroundColor: colors.tint }]}
                accessibilityRole="radio" accessibilityState={{ checked: item === city }}>
                <Text style={styles.body}>{item}</Text>
                {item === city ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
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
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={styles.icon}><Ionicons name="radio-outline" size={18} color={MODE_META.HYBRID.color} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{tr('Matching profile')}</Text>
          <Text style={styles.hint}>{tr('Used to send you Post My Event opportunities')}</Text>
        </View>
      </View>
      <MatchingProfileForm />
    </View>
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
            <View style={[styles.icon, { backgroundColor: MODE_META.HYBRID.color }]}><Ionicons name="logo-instagram" size={22} color="#fff" /></View>
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
  card: { backgroundColor: c.card, borderRadius: radii.xl, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(242,12,143,0.10)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  hint: { fontSize: fontSize.xs, color: c.textMuted, lineHeight: 17, marginBottom: 6 },
  body: { fontSize: fontSize.sm, color: c.textSoft, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1.5, borderColor: c.border, borderRadius: radii.md, paddingHorizontal: spacing.md, minHeight: 48, backgroundColor: c.card },
  input: { flex: 1, fontSize: fontSize.md, color: c.text, paddingVertical: 10 },
  error: { color: c.error, backgroundColor: c.errorBg, padding: spacing.sm, borderRadius: radii.md, fontSize: fontSize.sm },
  status: { color: c.textSoft, backgroundColor: c.infoBg, padding: spacing.sm, borderRadius: radii.md, fontSize: fontSize.sm },
  save: { minHeight: 48, borderRadius: radii.md, backgroundColor: MODE_META.HYBRID.color, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontWeight: fontWeight.extrabold, fontSize: fontSize.md },
  later: { color: c.textMuted, fontWeight: fontWeight.bold },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radii.md },
}));
