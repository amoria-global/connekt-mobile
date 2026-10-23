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
import { useLanguage, type LanguageCode } from '@/store/language';
import type { EventItem } from '@/features/events/types';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

const I18N = {
  en: {
    backA11y: 'Back',
    eyebrow: 'CURATED COLLECTION',
    title: 'Create Photobook',
    bookDetails: 'BOOK DETAILS',
    photobookNameLabel: 'PHOTOBOOK NAME',
    photobookNamePlaceholder: 'e.g. Diana & Eric Wedding Photobook',
    coverDescLabel: 'COVER DESCRIPTION (OPTIONAL)',
    coverDescPlaceholder: 'A short editorial blurb that introduces this photobook…',
    coverUrlLabel: 'COVER PHOTO URL (OPTIONAL)',
    coverUrlPlaceholder: 'https://… (optional, defaults to first photo)',
    linkedEventTitle: 'LINKED EVENT (OPTIONAL)',
    clientPrefix: (name: string) => `Client: ${name}`,
    changeBtn: 'Change',
    attachPlaceholder: 'Attach to an event booking (or keep standalone)…',
    pageLayoutTitle: 'PAGE LAYOUT STYLE',
    layoutGridLabel: 'Classic Grid',
    layoutGridDesc: 'Even 3-column grid with balanced borders',
    layoutMagazineLabel: 'Editorial Magazine',
    layoutMagazineDesc: 'Mixed portrait and landscape magazine spread',
    layoutStoryLabel: 'Story Flow',
    layoutStoryDesc: 'Full-bleed vertical narrative scroll',
    curatedMediaTitle: 'CURATED PHOTO MEDIA IDS',
    photosReady: (count: number) => `${count} photos ready`,
    mediaIdsLabel: 'MEDIA IDS (PASTE FROM ALBUM)',
    mediaIdsPlaceholder: 'Paste photo UUIDs separated by commas or new lines…',
    hintText:
      'Copy media IDs from an uploaded event album to include high-resolution photos in this photobook.',
    cancel: 'Cancel',
    createBtn: 'Create Photobook',
    linkEventModalTitle: 'Link Event',
    standaloneTitle: 'Standalone Photobook',
    standaloneMeta: 'Not attached to an event booking',
    searchEventsPlaceholder: 'Search events by title or client…',
    noEventsMatching: 'No events matching search.',
    defaultBookSuffix: (eventTitle: string) => `${eventTitle} Photobook`,
    errNoName: 'Please provide a name for this photobook.',
    errNoMedia: 'Add at least one photo media ID to curate into this photobook.',
    errCreateFailed: 'Could not create the photobook. Please try again.',
  },
  fr: {
    backA11y: 'Retour',
    eyebrow: 'COLLECTION SÉLECTIONNÉE',
    title: 'Créer un livre photo',
    bookDetails: 'DÉTAILS DU LIVRE',
    photobookNameLabel: 'NOM DU LIVRE PHOTO',
    photobookNamePlaceholder: 'ex. Livre photo du mariage de Diana & Eric',
    coverDescLabel: 'DESCRIPTION DE COUVERTURE (OPTIONNEL)',
    coverDescPlaceholder: 'Un court texte éditorial qui présente ce livre photo…',
    coverUrlLabel: 'URL DE LA PHOTO DE COUVERTURE (OPTIONNEL)',
    coverUrlPlaceholder: 'https://… (optionnel, par défaut la première photo)',
    linkedEventTitle: 'ÉVÉNEMENT LIÉ (OPTIONNEL)',
    clientPrefix: (name: string) => `Client : ${name}`,
    changeBtn: 'Modifier',
    attachPlaceholder: 'Associer à une réservation d’événement (ou laisser indépendant)…',
    pageLayoutTitle: 'STYLE DE MISE EN PAGE',
    layoutGridLabel: 'Grille classique',
    layoutGridDesc: 'Grille équilibrée à 3 colonnes avec bordures',
    layoutMagazineLabel: 'Magazine éditorial',
    layoutMagazineDesc: 'Double page magazine mêlant portraits et paysages',
    layoutStoryLabel: 'Flux narratif',
    layoutStoryDesc: 'Défilement narratif vertical plein écran',
    curatedMediaTitle: 'IDS MÉDIA DES PHOTOS SÉLECTIONNÉES',
    photosReady: (count: number) => `${count} photos prêtes`,
    mediaIdsLabel: 'IDS MÉDIA (COLLER DEPUIS L’ALBUM)',
    mediaIdsPlaceholder: 'Collez les UUID des photos séparés par des virgules ou des sauts de ligne…',
    hintText:
      'Copiez les IDs média depuis un album d’événement téléversé pour inclure des photos haute résolution dans ce livre photo.',
    cancel: 'Annuler',
    createBtn: 'Créer un livre photo',
    linkEventModalTitle: 'Lier un événement',
    standaloneTitle: 'Livre photo indépendant',
    standaloneMeta: 'Non rattaché à une réservation d’événement',
    searchEventsPlaceholder: 'Rechercher des événements par titre ou client…',
    noEventsMatching: 'Aucun événement ne correspond à la recherche.',
    defaultBookSuffix: (eventTitle: string) => `Livre photo ${eventTitle}`,
    errNoName: 'Veuillez indiquer un nom pour ce livre photo.',
    errNoMedia: 'Ajoutez au moins un ID média photo à inclure dans ce livre photo.',
    errCreateFailed: 'Impossible de créer le livre photo. Veuillez réessayer.',
  },
  es: {
    backA11y: 'Atrás',
    eyebrow: 'COLECCIÓN SELECCIONADA',
    title: 'Crear fotolibro',
    bookDetails: 'DETALLES DEL LIBRO',
    photobookNameLabel: 'NOMBRE DEL FOTOLIBRO',
    photobookNamePlaceholder: 'ej. Fotolibro de boda de Diana y Eric',
    coverDescLabel: 'DESCRIPCIÓN DE PORTADA (OPCIONAL)',
    coverDescPlaceholder: 'Una breve reseña editorial que presenta este fotolibro…',
    coverUrlLabel: 'URL DE FOTO DE PORTADA (OPCIONAL)',
    coverUrlPlaceholder: 'https://… (opcional, por defecto la primera foto)',
    linkedEventTitle: 'EVENTO VINCULADO (OPCIONAL)',
    clientPrefix: (name: string) => `Cliente: ${name}`,
    changeBtn: 'Cambiar',
    attachPlaceholder: 'Vincular a una reserva de evento (o mantener independiente)…',
    pageLayoutTitle: 'ESTILO DE DISEÑO DE PÁGINA',
    layoutGridLabel: 'Cuadrícula clásica',
    layoutGridDesc: 'Cuadrícula uniforme de 3 columnas con bordes equilibrados',
    layoutMagazineLabel: 'Revista editorial',
    layoutMagazineDesc: 'Pliego de revista mixto en vertical y horizontal',
    layoutStoryLabel: 'Flujo narrativo',
    layoutStoryDesc: 'Desplazamiento narrativo vertical a sangre completa',
    curatedMediaTitle: 'IDS DE MEDIOS DE FOTOS SELECCIONADAS',
    photosReady: (count: number) => `${count} fotos listas`,
    mediaIdsLabel: 'IDS DE MEDIOS (PEGAR DESDE EL ÁLBUM)',
    mediaIdsPlaceholder: 'Pega los UUID de las fotos separados por comas o saltos de línea…',
    hintText:
      'Copia los IDs de medios de un álbum de evento subido para incluir fotos de alta resolución en este fotolibro.',
    cancel: 'Cancelar',
    createBtn: 'Crear fotolibro',
    linkEventModalTitle: 'Vincular evento',
    standaloneTitle: 'Fotolibro independiente',
    standaloneMeta: 'No vinculado a una reserva de evento',
    searchEventsPlaceholder: 'Buscar eventos por título o cliente…',
    noEventsMatching: 'No hay eventos que coincidan con la búsqueda.',
    defaultBookSuffix: (eventTitle: string) => `Fotolibro de ${eventTitle}`,
    errNoName: 'Por favor proporciona un nombre para este fotolibro.',
    errNoMedia: 'Agrega al menos un ID de medio de foto para este fotolibro.',
    errCreateFailed: 'No se pudo crear el fotolibro. Inténtalo de nuevo.',
  },
} as const;

const LOCALE_MAP: Record<LanguageCode, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  rw: 'rw-RW',
  sw: 'sw-TZ',
};

function shortDate(iso?: string, lang: LanguageCode = 'en') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

import { buildKinyarwandaDict } from '@/i18n/kinyarwanda';
import { buildSwahiliDict } from '@/i18n/swahili';
const PB_NEW_RW = buildKinyarwandaDict(I18N.en);
const PB_NEW_SW = buildSwahiliDict(I18N.en);

export default function NewPhotobookScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const tr = language === 'rw' ? PB_NEW_RW : language === 'sw' ? PB_NEW_SW : (I18N as any)[language] || I18N.en;

  const layouts: { value: string; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] =
    useMemo(
      () => [
        { value: 'GRID', label: tr.layoutGridLabel, description: tr.layoutGridDesc, icon: 'grid-outline' },
        {
          value: 'MAGAZINE',
          label: tr.layoutMagazineLabel,
          description: tr.layoutMagazineDesc,
          icon: 'newspaper-outline',
        },
        { value: 'STORY', label: tr.layoutStoryLabel, description: tr.layoutStoryDesc, icon: 'book-outline' },
      ],
      [tr],
    );

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
      setError(tr.errNoName);
      return;
    }
    if (parsedIds.length === 0) {
      setError(tr.errNoMedia);
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
      setError(isApiError(e) ? e.message : tr.errCreateFailed);
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
              accessibilityLabel={tr.backA11y}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.eyebrow}>{tr.eyebrow}</Text>
              <Text style={styles.h1}>{tr.title}</Text>
            </View>
          </View>

          {/* Form Card 1: Details */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{tr.bookDetails}</Text>

            <FieldLabel text={tr.photobookNameLabel} required />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={tr.photobookNamePlaceholder}
              placeholderTextColor={colors.textMuted}
            />

            <FieldLabel text={tr.coverDescLabel} />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder={tr.coverDescPlaceholder}
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <FieldLabel text={tr.coverUrlLabel} />
            <TextInput
              style={styles.input}
              value={coverImage}
              onChangeText={setCoverImage}
              placeholder={tr.coverUrlPlaceholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Form Card 2: Event Association */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{tr.linkedEventTitle}</Text>
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
                      shortDate(selectedEvent.eventDate, language),
                      selectedEvent.clientName ? tr.clientPrefix(selectedEvent.clientName) : '',
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
                  <Text style={styles.changeEventText}>{tr.changeBtn}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.select} onPress={() => setEventPickerOpen(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.selectPlaceholder} numberOfLines={1}>
                    {tr.attachPlaceholder}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Form Card 3: Layout Style Preset */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{tr.pageLayoutTitle}</Text>
            <View style={{ gap: spacing.sm, marginTop: 4 }}>
              {layouts.map((l) => {
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
              <Text style={styles.sectionTitle}>{tr.curatedMediaTitle}</Text>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{tr.photosReady(parsedIds.length)}</Text>
              </View>
            </View>

            <FieldLabel text={tr.mediaIdsLabel} required />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={mediaIds}
              onChangeText={setMediaIds}
              placeholder={tr.mediaIdsPlaceholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />

            <View style={styles.hintBox}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.hintText}>
                {tr.hintText}
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
              <Text style={styles.cancelText}>{tr.cancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.create, (!formOk || submitting) && styles.btnDisabled]}
              onPress={onCreate}
              disabled={!formOk || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createText}>{tr.createBtn}</Text>
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
              <Text style={styles.pickerTitle}>{tr.linkEventModalTitle}</Text>
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
                <Text style={styles.pickerRowTitle}>{tr.standaloneTitle}</Text>
                <Text style={styles.pickerRowMeta}>{tr.standaloneMeta}</Text>
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
                placeholder={tr.searchEventsPlaceholder}
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
                <Text style={styles.hintText}>{tr.noEventsMatching}</Text>
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
                        setName((n) => n || tr.defaultBookSuffix(ev.title));
                        setEventPickerOpen(false);
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.pickerRowTitle} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={styles.pickerRowMeta}>
                          {[
                            shortDate(ev.eventDate, language),
                            ev.clientName ? tr.clientPrefix(ev.clientName) : '',
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
