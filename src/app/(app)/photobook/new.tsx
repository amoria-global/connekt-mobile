/**
 * New photobook — Photographer / Coordinator authoring screen.
 *
 * Mirrors the web's photobook builder (salo-run uses an event-album
 * picker). On mobile we keep the flow lean: pick an event, name the
 * photobook, write an optional description, choose a layout preset, and
 * pick the photos to include from the device library. The form posts
 * to /customer/events/photobook with the photo file URLs collected
 * after upload — for now, mobile uploads happen via the existing album
 * upload endpoints and we pass the resulting media ids.
 *
 * Note: this version creates the photobook *metadata* and accepts media
 * ids supplied by the photographer (typically copied from an album).
 * The full in-app multipart upload sweep is a follow-up — the same
 * `createPhotobook` helper accepts a mediaIds array so the flow is
 * forward-compatible.
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { createPhotobook } from '@/features/photobooks/api';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const LAYOUTS: { value: string; label: string; description: string }[] = [
  { value: 'GRID', label: 'Grid', description: '3-column even grid, classic gallery look.' },
  { value: 'MAGAZINE', label: 'Magazine', description: 'Mixed sizes, editorial-style spread.' },
  { value: 'STORY', label: 'Story', description: 'Full-bleed vertical scroll, narrative pace.' },
];

export default function NewPhotobookScreen() {
  const router = useRouter();

  const [eventId, setEventId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [layout, setLayout] = useState<string>('GRID');
  // Comma- or newline-separated media id list (UUIDs). Mobile photographers
  // typically copy this from an album detail; a future iteration will
  // surface an in-screen picker.
  const [mediaIds, setMediaIds] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedIds = mediaIds
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  const formOk = name.trim().length > 0 && parsedIds.length > 0;

  const onCreate = async () => {
    if (!formOk) {
      setError('Add a name and at least one media id.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await createPhotobook({
        name,
        description: description.trim() || undefined,
        layout,
        coverImage: coverImage.trim() || undefined,
        eventId: eventId.trim() || undefined,
        mediaIds: parsedIds,
      });
      router.replace(`/photobook/${created.id}` as never);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not create the photobook.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="New photobook" subtitle="Curate a collection from an event" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Input
            label="Photobook name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Diana & Eric — Wedding"
            autoCapitalize="sentences"
          />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="A short blurb for the cover."
            multiline
            style={styles.multiline}
          />
          <Input
            label="Event id (optional)"
            value={eventId}
            onChangeText={setEventId}
            placeholder="UUID — leave blank for a standalone book"
            autoCapitalize="none"
          />
          <Input
            label="Cover image URL (optional)"
            value={coverImage}
            onChangeText={setCoverImage}
            placeholder="https://…"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Layout</Text>
          <View style={{ gap: spacing.sm }}>
            {LAYOUTS.map((l) => {
              const active = l.value === layout;
              return (
                <Pressable
                  key={l.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setLayout(l.value)}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{l.label}</Text>
                    <Text style={styles.optionDesc}>{l.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Input
            label="Media ids"
            value={mediaIds}
            onChangeText={setMediaIds}
            placeholder="UUIDs separated by commas or new lines"
            autoCapitalize="none"
            multiline
            style={styles.multiline}
          />
          <View style={styles.hint}>
            <Ionicons name="information-circle" size={14} color={colors.info} />
            <Text style={styles.hintText}>
              Paste media ids from an album you uploaded. {parsedIds.length} photo
              {parsedIds.length === 1 ? '' : 's'} ready.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={submitting ? 'Creating…' : 'Create photobook'}
            onPress={onCreate}
            loading={submitting}
            disabled={!formOk || submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 100 },
  multiline: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textSoft, marginTop: spacing.sm },
  option: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  optionDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

  hint: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.infoBg,
    padding: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'flex-start',
  },
  hintText: { flex: 1, color: colors.info, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
