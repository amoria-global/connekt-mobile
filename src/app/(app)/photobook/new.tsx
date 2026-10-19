/**
 * New photobook — Photographer / Coordinator authoring screen.
 *
 * 20/20 Master-Grade Design:
 *   • Top Navigation Bar: Circular back button, collection eyebrow, and display title.
 *   • Interactive Event Picker: Select from photographer's live bookings or create standalone.
 *   • Visual Layout Preset Cards: Classic Grid, Magazine Spread, and Story Flow with visual indicators.
 *   • Photo Media & Curation Section: High-contrast media input with helper chip, photo count,
 *     and cover image selector.
 *   • Anchored Action Footer: Cancel and primary Create Photobook CTA with loading state.
 *   • NO LinearGradient, NO top-tear accents — pure solid theme tokens.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { listPhotographerEvents } from '@/features/events/api';
import { createPhotobook } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import type { EventItem } from '@/features/events/types';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

const LAYOUTS: { value: string; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'GRID', label: 'Classic Grid', description: 'Even 3-column grid with balanced borders', icon: 'grid-outline' },
  { value: 'MAGAZINE', label: 'Editorial Magazine', description: 'Mixed portrait and landscape magazine spread', icon: 'newspaper-outline' },
  { value: 'STORY', label: 'Story Flow', description: 'Full-bleed vertical narrative scroll', icon: 'book-outline' },
];

function shortDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NewPhotobookScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const events = useAsync(useCallback(() => listPhotographerEvents(), []));

  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [layout, setLayout] = useState<string>('GRID');
  const [mediaIds, setMediaIds] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedIds = useMemo(() => {
    return mediaIds
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean);
  }, [mediaIds]);

  const filteredEvents = useMemo(() => {
    const list = events.data ?? [];
    const q = eventSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.clientName ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q),
    );
  }, [events.data, eventSearch]);

  const formOk = name.trim().length > 0 && parsedIds.length > 0;

  const onCreate = async () => {
    if (!name.trim()) {
      setError('Please provide a name for this photobook.');
      return;
    }
    if (parsedIds.length === 0) {
      setError('Add at least one photo media ID to curate into this photobook.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await createPhotobook({
        name: name.trim(),
        description: description.trim() || undefined,
        layout,
        coverImage: coverImage.trim() || undefined,
        eventId: selectedEvent?.id || undefined,
        mediaIds: parsedIds,
      });
      router.replace(`/photobook/${created.id}` as never);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not create the photobook. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 40, 60) },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.eyebrow}>CURATED COLLECTION</Text>
              <Text style={styles.h1}>Create Photobook</Text>
            </View>
          </View>

          {/* Form Card 1: Details */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>BOOK DETAILS</Text>

            <FieldLabel text="PHOTOBOOK NAME" required />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Diana & Eric Wedding Photobook"
              placeholderTextColor={colors.textMuted}
            />

            <FieldLabel text="COVER DESCRIPTION (OPTIONAL)" />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="A short editorial blurb that introduces this photobook…"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <FieldLabel text="COVER PHOTO URL (OPTIONAL)" />
            <TextInput
              style={styles.input}
              value={coverImage}
              onChangeText={setCoverImage}
              placeholder="https://… (optional, defaults to first photo)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Form Card 2: Event Association */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>LINKED EVENT (OPTIONAL)</Text>
            {selectedEvent ? (
              <View style={styles.selectedEventCard}>
                <View style={styles.selectedEventIconBox}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.selectedEventTitle} numberOfLines={1}>
                    {selectedEvent.title}
                  </Text>
                  <Text style={styles.selectedEventMeta}>
                    {[
                      shortDate(selectedEvent.eventDate),
                      selectedEvent.clientName ? `Client: ${selectedEvent.clientName}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Pressable
                  style={styles.changeEventBtn}
                  onPress={() => setEventPickerOpen(true)}
                  hitSlop={8}
                >
                  <Text style={styles.changeEventText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.select} onPress={() => setEventPickerOpen(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.selectPlaceholder} numberOfLines={1}>
                    Attach to an event booking (or keep standalone)…
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Form Card 3: Layout Style Preset */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>PAGE LAYOUT STYLE</Text>
            <View style={{ gap: spacing.sm, marginTop: 4 }}>
              {LAYOUTS.map((l) => {
                const active = l.value === layout;
                return (
                  <Pressable
                    key={l.value}
                    style={[styles.layoutOption, active && styles.layoutOptionActive]}
                    onPress={() => setLayout(l.value)}
                  >
                    <View style={[styles.layoutIconBox, active && styles.layoutIconBoxActive]}>
                      <Ionicons
                        name={l.icon}
                        size={18}
                        color={active ? '#fff' : colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.layoutName, active && styles.layoutNameActive]}>
                        {l.label}
                      </Text>
                      <Text style={styles.layoutDesc}>{l.description}</Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Form Card 4: Curated Photos / Media IDs */}
          <View style={styles.cardSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>CURATED PHOTO MEDIA IDS</Text>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{parsedIds.length} photos ready</Text>
              </View>
            </View>

            <FieldLabel text="MEDIA IDS (PASTE FROM ALBUM)" required />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={mediaIds}
              onChangeText={setMediaIds}
              placeholder="Paste photo UUIDs separated by commas or new lines…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />

            <View style={styles.hintBox}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.hintText}>
                Copy media IDs from an uploaded event album to include high-resolution photos in this photobook.
              </Text>
            </View>
          </View>

          {/* Error message */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.cancel]}
              onPress={() => router.back()}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.create, (!formOk || submitting) && styles.btnDisabled]}
              onPress={onCreate}
              disabled={!formOk || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createText}>Create Photobook</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Event Picker Modal */}
      <Modal
        visible={eventPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEventPickerOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setEventPickerOpen(false)}>
          <Pressable style={styles.picker} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Link Event</Text>
              <Pressable onPress={() => setEventPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Standalone Option */}
            <Pressable
              style={[styles.pickerRow, !selectedEvent && styles.pickerRowSelected]}
              onPress={() => {
                setSelectedEvent(null);
                setEventPickerOpen(false);
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.pickerRowTitle}>Standalone Photobook</Text>
                <Text style={styles.pickerRowMeta}>Not attached to an event booking</Text>
              </View>
              {!selectedEvent ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : null}
            </Pressable>

            {/* Event Search */}
            <View style={styles.pickerSearch}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={eventSearch}
                onChangeText={setEventSearch}
                placeholder="Search events by title or client…"
                placeholderTextColor={colors.textMuted}
                style={styles.pickerSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {eventSearch ? (
                <Pressable onPress={() => setEventSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {events.loading && !events.data ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
            ) : filteredEvents.length === 0 ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                <Text style={styles.hintText}>No events matching search.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {filteredEvents.map((ev) => {
                  const isSelected = selectedEvent?.id === ev.id;
                  return (
                    <Pressable
                      key={ev.id}
                      style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                      onPress={() => {
                        setSelectedEvent(ev);
                        setName((n) => n || `${ev.title} Photobook`);
                        setEventPickerOpen(false);
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.pickerRowTitle} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={styles.pickerRowMeta}>
                          {[
                            shortDate(ev.eventDate),
                            ev.clientName ? `Client: ${ev.clientName}` : '',
                            ev.category,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  const styles = useStyles();
  return (
    <Text style={styles.fieldLabel}>
      {text} {required ? <Text style={styles.requiredStar}>*</Text> : null}
    </Text>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.xs,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.primary, letterSpacing: 1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 24, color: c.text, letterSpacing: -0.5 },

  // Card Container Sections
  cardSection: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
    letterSpacing: 0.8,
  },
  badgePill: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgePillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },

  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textSoft,
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  requiredStar: { color: c.primary },
  input: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: c.text,
    backgroundColor: c.background,
  },
  multiline: { height: 76, textAlignVertical: 'top', paddingTop: 10 },

  // Event Picker
  selectedEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
    marginTop: spacing.xs,
  },
  selectedEventIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEventTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: c.text },
  selectedEventMeta: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  changeEventBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: c.surface,
  },
  changeEventText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: c.background,
    marginTop: spacing.xs,
  },
  selectPlaceholder: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted },

  // Layout Option
  layoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.background,
  },
  layoutOptionActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  layoutIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutIconBoxActive: {
    backgroundColor: c.primary,
  },
  layoutName: { fontFamily: fonts.bold, fontSize: 14.5, color: c.text },
  layoutNameActive: { color: c.primary },
  layoutDesc: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },

  // Hint box
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: c.tint,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  hintText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: c.textSoft, lineHeight: 17 },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.error },

  // Actions
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: c.surfaceMuted },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: c.textSoft },
  create: { backgroundColor: c.primary },
  createText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  btnDisabled: { opacity: 0.6 },

  // Modal
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(4,10,26,0.6)', justifyContent: 'flex-end' },
  picker: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  pickerTitle: { fontFamily: fonts.bold, fontSize: 18, color: c.text },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  pickerSearchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: c.text, padding: 0 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  pickerRowSelected: { backgroundColor: c.tint },
  pickerRowTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.text },
  pickerRowMeta: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, marginTop: 1 },
}));
