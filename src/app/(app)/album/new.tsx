/**
 * Create Album — the normal (event / personal) album creator.
 *
 * Mobile port of salo-run's photographer "Create Album" modal:
 *   • Event Album    → tied to one of the photographer's events; photos go
 *     to the client. POST /photographer/albums (+ eventId).
 *   • Personal Album → standalone, either:
 *       – PAID   (monetized, face-search, price per image) or
 *       – FREE   (private email invite + access code).
 *
 * Content-library albums are created elsewhere (/content-album/new).
 * Type is Pragati Narrow throughout.
 */
import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { createEventAlbum, createFreeAlbum, createPaidAlbum } from '@/features/gallery/api';
import { listPhotographerEvents } from '@/features/events/api';
import { listCurrencies } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { pickMultipleFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import type { EventItem } from '@/features/events/types';
import { colors, fonts, radii, spacing } from '@/theme';

type Mode = 'event' | 'personal';
type PersonalType = 'PAID' | 'FREE';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shortDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NewAlbumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();

  const events = useAsync(useCallback(() => listPhotographerEvents(), []));
  const currencies = useAsync(useCallback(() => listCurrencies(), []));

  const [mode, setMode] = useState<Mode>('event');
  const [personalType, setPersonalType] = useState<PersonalType>('PAID');

  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');

  const [price, setPrice] = useState('');
  const [currencyId, setCurrencyId] = useState('');

  const [recipientEmail, setRecipientEmail] = useState('');
  const [maxFree, setMaxFree] = useState('');
  const [extraPrice, setExtraPrice] = useState('');

  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Default currency → RWF (or first).
  useEffect(() => {
    if (!currencyId && currencies.data?.length) {
      const rwf = currencies.data.find((c) => c.code === 'RWF');
      setCurrencyId((rwf ?? currencies.data[0]).id);
    }
  }, [currencies.data, currencyId]);

  const applyEvent = useCallback((ev: EventItem) => {
    setSelectedEvent(ev);
    setTitle((t) => t || `${ev.title} Album`);
    setDescription((d) => d || `Photo collection from ${ev.title}`);
    setCategory((c) => c || ev.category || '');
  }, []);

  // Preselect an event when opened from "Create Album" on an event.
  useEffect(() => {
    if (!params.eventId || selectedEvent || !events.data) return;
    const match = events.data.find((e) => e.id === params.eventId);
    if (match) {
      setMode('event');
      applyEvent(match);
    }
  }, [params.eventId, events.data, selectedEvent, applyEvent]);

  const addPhotos = async () => {
    const arr = await pickMultipleFromLibrary(40);
    if (arr.length) setImages((prev) => [...prev, ...arr]);
  };
  const removePhoto = (uri: string) => setImages((prev) => prev.filter((x) => x.uri !== uri));

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError('Add an album title.');
    if (!images.length) return setError('Add at least one photo.');

    if (mode === 'event') {
      if (!selectedEvent) return setError('Choose an event.');
    } else if (personalType === 'PAID') {
      if (!/^\d+$/.test(price) || Number(price) <= 0) return setError('Enter a price per image.');
      if (!currencyId) return setError('Pick a currency.');
    } else {
      if (!EMAIL_RE.test(recipientEmail.trim())) return setError('Enter the recipient email.');
    }

    setSubmitting(true);
    try {
      if (mode === 'event' && selectedEvent) {
        await createEventAlbum({
          eventId: selectedEvent.id,
          title,
          description: description || undefined,
          category: category || undefined,
          images,
        });
      } else if (personalType === 'PAID') {
        await createPaidAlbum({
          title,
          description: description || undefined,
          category: category || undefined,
          location: location || undefined,
          date: date || undefined,
          pricePerImage: price,
          currencyId,
          images,
        });
      } else {
        await createFreeAlbum({
          title,
          description: description || undefined,
          category: category || undefined,
          location: location || undefined,
          date: date || undefined,
          recipientEmail,
          maxFreeDownloads: maxFree || undefined,
          pricePerExtraImage: extraPrice || undefined,
          currencyId: extraPrice ? currencyId : undefined,
          images,
        });
      }
      router.back();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not create the album. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const eventList = events.data ?? [];

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>NEW COLLECTION</Text>
        <Text style={styles.h1}>Create Album</Text>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <ModeTab active={mode === 'event'} icon="calendar" label="Event Album" onPress={() => setMode('event')} />
          <ModeTab active={mode === 'personal'} icon="person" label="Personal Album" onPress={() => setMode('personal')} />
        </View>

        {mode === 'event' ? (
          <>
            <FieldLabel text="SELECT EVENT" required />
            <Pressable style={styles.select} onPress={() => setEventPickerOpen(true)}>
              <Text style={[styles.selectText, !selectedEvent && styles.selectPlaceholder]} numberOfLines={1}>
                {selectedEvent
                  ? `${selectedEvent.title}${selectedEvent.eventDate ? ` — ${shortDate(selectedEvent.eventDate)}` : ''}`
                  : 'Choose an event…'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>

            <FieldLabel text="ALBUM TITLE" required />
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Album title" placeholderTextColor={colors.textMuted} />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FieldLabel text="CATEGORY" />
                <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Concert" placeholderTextColor={colors.textMuted} />
              </View>
              <View style={styles.rowItem}>
                <FieldLabel text="CLIENT" />
                <View style={[styles.input, styles.readonly]}>
                  <Text style={styles.readonlyText} numberOfLines={1}>
                    {selectedEvent?.clientName || '—'}
                  </Text>
                </View>
              </View>
            </View>

            <FieldLabel text="DESCRIPTION" />
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="What's in this album?" placeholderTextColor={colors.textMuted} multiline />
          </>
        ) : (
          <>
            <View style={styles.note}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.noteText}>
                Personal albums can be <Text style={styles.bold}>PAID</Text> with facial recognition, or{' '}
                <Text style={[styles.bold, { color: '#047857' }]}>FREE</Text> with private email access.
              </Text>
            </View>

            <FieldLabel text="ALBUM TYPE" required />
            <View style={styles.typeRow}>
              <TypeCard
                active={personalType === 'PAID'}
                icon="search"
                tag="MONETIZED"
                title="PAID Album"
                lines={['Searchable via face recognition', '30% platform commission', 'Set price per image']}
                onPress={() => setPersonalType('PAID')}
              />
              <TypeCard
                active={personalType === 'FREE'}
                icon="mail"
                tag="PRIVATE INVITE"
                title="FREE Album"
                lines={['Private link + email verification', '0% commission (100% free)', 'Single recipient access']}
                onPress={() => setPersonalType('FREE')}
              />
            </View>

            <FieldLabel text="ALBUM TITLE" required />
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Enter album title" placeholderTextColor={colors.textMuted} />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FieldLabel text="CATEGORY" />
                <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={colors.textMuted} />
              </View>
              <View style={styles.rowItem}>
                <FieldLabel text="DATE" />
                <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
              </View>
            </View>

            <FieldLabel text="LOCATION" />
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Kigali, Rwanda" placeholderTextColor={colors.textMuted} />

            <FieldLabel text="DESCRIPTION" />
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Describe this album" placeholderTextColor={colors.textMuted} multiline />

            {personalType === 'PAID' ? (
              <>
                <View style={[styles.detailNote, styles.detailNoteInfo]}>
                  <Text style={styles.detailNoteTitle}>PAID Album Details</Text>
                  <Text style={styles.detailNoteText}>• Indexed for facial-recognition search</Text>
                  <Text style={styles.detailNoteText}>• Platform takes 30% commission on each sale</Text>
                  <Text style={styles.detailNoteText}>• Album expires in 60 days with a 7-day warning</Text>
                </View>

                <FieldLabel text="PRICE PER IMAGE" required />
                <View style={styles.row}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} placeholder="Enter price" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
                </View>
                <View style={styles.chips}>
                  {(currencies.data ?? []).map((c) => {
                    const active = currencyId === c.id;
                    return (
                      <Pressable key={c.id} onPress={() => setCurrencyId(c.id)} style={[styles.chip, active && styles.chipActive]}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.code}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.detailNote, styles.detailNoteWarn]}>
                  <Text style={styles.detailNoteText}>
                    <Text style={styles.bold}>Commission:</Text> You receive 70% of each photo sale. Platform takes 30%.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.detailNote, styles.detailNoteFree]}>
                  <Text style={[styles.detailNoteTitle, { color: '#047857' }]}>FREE Album Details</Text>
                  <Text style={styles.detailNoteText}>• NOT searchable via facial recognition</Text>
                  <Text style={styles.detailNoteText}>• Recipient gets an email with an access code</Text>
                  <Text style={styles.detailNoteText}>• Free downloads (or set a cap + price for extras)</Text>
                  <Text style={styles.detailNoteText}>• Album expires in 60 days with a 7-day warning</Text>
                </View>

                <FieldLabel text="RECIPIENT EMAIL" required />
                <TextInput style={styles.input} value={recipientEmail} onChangeText={setRecipientEmail} placeholder="recipient@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
                <Text style={styles.helper}>An invitation email with the access code is sent automatically.</Text>

                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <FieldLabel text="MAX FREE DOWNLOADS" />
                    <TextInput style={styles.input} value={maxFree} onChangeText={(t) => setMaxFree(t.replace(/[^0-9]/g, ''))} placeholder="Blank = all free" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
                  </View>
                  <View style={styles.rowItem}>
                    <FieldLabel text="PRICE PER EXTRA" />
                    <TextInput style={styles.input} value={extraPrice} onChangeText={(t) => setExtraPrice(t.replace(/[^0-9]/g, ''))} placeholder="Blank = no extras" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
                  </View>
                </View>
                <Text style={styles.helper}>
                  Leave both blank for a fully free album. Set a cap and the recipient gets that many free; extras charge the per-image price.
                </Text>
              </>
            )}
          </>
        )}

        {/* Photos */}
        <FieldLabel text="UPLOAD PHOTOS" required />
        <Pressable style={styles.uploadBox} onPress={addPhotos}>
          <View style={styles.uploadIcon}>
            <Ionicons name="cloud-upload" size={22} color="#fff" />
          </View>
          <Text style={styles.uploadTitle}>Click to upload photos</Text>
          <Text style={styles.helper}>Pick from your library</Text>
        </Pressable>
        {images.length ? (
          <View style={styles.thumbs}>
            {images.map((img) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable style={styles.thumbX} onPress={() => removePhoto(img.uri)} hitSlop={6}>
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.cancel]} onPress={() => router.back()} disabled={submitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.create]} onPress={onSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.createText}>Create Album</Text>}
          </Pressable>
        </View>
      </ScrollView>

      {/* Event picker */}
      <Modal visible={eventPickerOpen} transparent animationType="slide" onRequestClose={() => setEventPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setEventPickerOpen(false)}>
          <Pressable style={styles.picker} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Select event</Text>
            {events.loading && !events.data ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : eventList.length === 0 ? (
              <Text style={styles.helper}>No events found.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {eventList.map((ev) => (
                  <Pressable
                    key={ev.id}
                    style={styles.pickerRow}
                    onPress={() => {
                      applyEvent(ev);
                      setEventPickerOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerRowTitle} numberOfLines={1}>{ev.title}</Text>
                      <Text style={styles.pickerRowMeta}>
                        {[shortDate(ev.eventDate), ev.clientName].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {selectedEvent?.id === ev.id ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {text} {required ? <Text style={{ color: colors.accent }}>*</Text> : null}
    </Text>
  );
}

function ModeTab({ active, icon, label, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.modeTab, active && styles.modeTabActive]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TypeCard({
  active,
  icon,
  tag,
  title,
  lines,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  tag: string;
  title: string;
  lines: string[];
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.typeCard, active && styles.typeCardActive]} onPress={onPress}>
      <View style={styles.typeHead}>
        <View style={[styles.typeIcon, active && styles.typeIconActive]}>
          <Ionicons name={icon} size={18} color={active ? '#fff' : colors.textMuted} />
        </View>
        <View style={[styles.radio, active && styles.radioActive]}>
          {active ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
        </View>
      </View>
      <Text style={styles.typeTag}>{tag}</Text>
      <Text style={styles.typeTitle}>{title}</Text>
      {lines.map((l) => (
        <View key={l} style={styles.typeLine}>
          <Ionicons name="ellipse" size={5} color={colors.textMuted} />
          <Text style={styles.typeLineText}>{l}</Text>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 60, gap: spacing.sm },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent, letterSpacing: 1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, letterSpacing: -0.5, marginBottom: spacing.sm },

  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  modeTabActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  modeTabText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textMuted },
  modeTabTextActive: { color: colors.primary },

  fieldLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.accent, letterSpacing: 0.6, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { height: 90, textAlignVertical: 'top', paddingTop: 12 },
  readonly: { backgroundColor: colors.surfaceMuted, justifyContent: 'center' },
  readonlyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSoft },
  helper: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: colors.surface,
  },
  selectText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  selectPlaceholder: { color: colors.textMuted },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.infoBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSoft, lineHeight: 18 },
  bold: { fontFamily: fonts.bold, color: colors.primary },

  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: 4,
  },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  typeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  typeIconActive: { backgroundColor: colors.primary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeTag: { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 0.6 },
  typeTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: 2 },
  typeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeLineText: { flex: 1, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSoft },

  detailNote: { borderRadius: radii.md, padding: spacing.md, gap: 2, marginTop: spacing.sm },
  detailNoteInfo: { backgroundColor: colors.infoBg },
  detailNoteFree: { backgroundColor: '#ECFDF5' },
  detailNoteWarn: { backgroundColor: colors.warningBg },
  detailNoteTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginBottom: 2 },
  detailNoteText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSoft, lineHeight: 18 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: '#fff' },

  uploadBox: {
    borderWidth: 1.5,
    borderColor: colors.accentLight,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDF2F8',
  },
  uploadIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  uploadTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },

  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  thumbWrap: { width: 72, height: 72, borderRadius: radii.md, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbX: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: radii.full, backgroundColor: 'rgba(8,58,133,0.85)', alignItems: 'center', justifyContent: 'center' },

  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.error, textAlign: 'center', marginTop: spacing.sm },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, height: 50, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: colors.surfaceMuted },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSoft },
  create: { backgroundColor: colors.accent },
  createText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(4,10,26,0.55)', justifyContent: 'flex-end' },
  picker: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, gap: spacing.sm },
  pickerTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: spacing.xs },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  pickerRowTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  pickerRowMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
