/**
 * Create Album — event and personal photo album creator for photographers.
 *
 * 20/20 Master-Grade Design:
 *   • Confident Editorial Header: Clean navigation bar with back chevron,
 *     collection eyebrow, and prominent title.
 *   • Seamless Segmented Mode Switcher: Event Album (booking-linked) vs
 *     Personal Album (monetized or private invite).
 *   • Grouped Form Cards: Polished container cards with crisp typography,
 *     floating-style field labels, and focused inputs.
 *   • Interactive Event Picker: Slide-up modal sheet with live search, clean metadata,
 *     and selected checkmark states.
 *   • Visual Personal Album Cards: Side-by-side selection between PAID (facial recognition)
 *     and FREE (private code invite) with transparent commission breakdowns.
 *   • Modern Photo Drop-Zone: High-contrast upload box, live counter, and rounded
 *     thumbnail mosaic with one-tap removal.
 *   • Resilient Flow: Photos are optional at creation (photographers can create
 *     an album shell and upload photos later).
 *   • NO LinearGradient, NO top-tear accents — pure solid theme tokens.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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
import { Alert } from '@/components/ui/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import {
  createEventAlbum,
  createFreeAlbum,
  createPaidAlbum,
  type AlbumCreateResult,
} from '@/features/gallery/api';
import { listPhotographerEvents } from '@/features/events/api';
import { listCurrencies } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { pickMultipleFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import type { EventItem } from '@/features/events/types';
import { spacing, radii, fonts, makeStyles, useTheme, onFill } from '@/theme';

import { useLanguage } from '@/hooks/useLanguage';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { glassTile } from '@/components/ui/GlassCard';
const ALB_MAP: Record<string, { fr: string; es: string }> = {
  'Cancel': { fr: 'Annuler', es: 'Cancelar' },
  'Change': { fr: 'Modifier', es: 'Cambiar' },
  'Choose an event booking…': { fr: 'Choisir une réservation d’événement…', es: 'Elegir una reserva de evento…' },
  'Clear all': { fr: 'Tout effacer', es: 'Borrar todo' },
  'Create Album': { fr: 'Créer l’album', es: 'Crear álbum' },
  'Event Album': { fr: 'Album d’événement', es: 'Álbum de evento' },
  'FREE': { fr: 'GRATUIT', es: 'GRATIS' },
  'FREE Album Details': { fr: 'Détails de l’album GRATUIT', es: 'Detalles del álbum GRATIS' },
  'NEW COLLECTION': { fr: 'NOUVELLE COLLECTION', es: 'NUEVA COLECCIÓN' },
  'PAID': { fr: 'PAYANT', es: 'DE PAGO' },
  'PAID Album Details': { fr: 'Détails de l’album PAYANT', es: 'Detalles del álbum DE PAGO' },
  'Personal Album': { fr: 'Album personnel', es: 'Álbum personal' },
  'Select Event': { fr: 'Sélectionner un événement', es: 'Seleccionar evento' },
  '• Album expires in 60 days with warning': { fr: '• L’album expire dans 60 jours avec avertissement', es: '• El álbum caduca en 60 días con aviso' },
  '• Full-resolution downloads enabled': { fr: '• Téléchargements haute résolution activés', es: '• Descargas en alta resolución habilitadas' },
  '• Indexed for facial-recognition search': { fr: '• Indexé pour la recherche par reconnaissance faciale', es: '• Indexado para búsqueda por reconocimiento facial' },
  '• NOT indexed on public face search': { fr: '• NON indexé dans la recherche faciale publique', es: '• NO indexado en la búsqueda facial pública' },
  '• Platform takes 30% commission per sale': { fr: '• La plateforme prélève 30 % de commission par vente', es: '• La plataforma toma un 30% de comisión por venta' },
  '• Recipient receives email with access code': { fr: '• Le destinataire reçoit un e-mail avec le code d’accès', es: '• El destinatario recibe un correo con el código de acceso' },
  'ALBUM DETAILS': { fr: 'DÉTAILS DE L’ALBUM', es: 'DETALLES DEL ÁLBUM' },
  'ALBUM TITLE': { fr: 'TITRE DE L’ALBUM', es: 'TÍTULO DEL ÁLBUM' },
  'DESCRIPTION (OPTIONAL)': { fr: 'DESCRIPTION (OPTIONNEL)', es: 'DESCRIPCIÓN (OPCIONAL)' },
  'EVENT BOOKING': { fr: 'RÉSERVATION D’ÉVÉNEMENT', es: 'RESERVA DE EVENTO' },
  'ALBUM TYPE': { fr: 'TYPE D’ALBUM', es: 'TIPO DE ÁLBUM' },
  'PRICING & ACCESS': { fr: 'TARIFICATION ET ACCÈS', es: 'PRECIOS Y ACCESO' },
  'PRICE PER PHOTO': { fr: 'PRIX PAR PHOTO', es: 'PRECIO POR FOTO' },
  'CURRENCY': { fr: 'DEVISE', es: 'MONEDA' },
  'RECIPIENT EMAIL': { fr: 'E-MAIL DU DESTINATAIRE', es: 'CORREO DEL DESTINATARIO' },
  'RECIPIENT NAME (OPTIONAL)': { fr: 'NOM DU DESTINATAIRE (OPTIONNEL)', es: 'NOMBRE DEL DESTINATARIO (OPCIONAL)' },
  'COVER PHOTO (OPTIONAL)': { fr: 'PHOTO DE COUVERTURE (OPTIONNEL)', es: 'FOTO DE PORTADA (OPCIONAL)' },
  'ALBUM PHOTOS': { fr: 'PHOTOS DE L’ALBUM', es: 'FOTOS DEL ÁLBUM' },
  'Ready to upload': { fr: 'Prêt à téléverser', es: 'Listo para subir' },
  'Add Photos': { fr: 'Ajouter des photos', es: 'Añadir fotos' },
  'Album Options': { fr: 'Options de l’album', es: 'Opciones del álbum' },
  'Copy public web viewing link': { fr: 'Copier le lien public de visionnage', es: 'Copiar enlace público de visualización' },
  'Couldn&apos;t load album': { fr: 'Impossible de charger l’album', es: 'No se pudo cargar el álbum' },
  'Delete Album': { fr: 'Supprimer l’album', es: 'Eliminar álbum' },
  'Email gallery access link directly': { fr: 'Envoyer le lien d’accès par e-mail', es: 'Enviar enlace de acceso por correo' },
  'Face-AI Indexing': { fr: 'Indexation IA faciale', es: 'Indexación facial con IA' },
  'LOCKED': { fr: 'VERROUILLÉ', es: 'BLOQUEADO' },
  'Loading album…': { fr: 'Chargement de l’album…', es: 'Cargando álbum…' },
  'Locked': { fr: 'Verrouillé', es: 'Bloqueado' },
  'PHOTOS': { fr: 'PHOTOS', es: 'FOTOS' },
  'Permanently remove this collection': { fr: 'Supprimer définitivement cette collection', es: 'Eliminar permanentemente esta colección' },
  'Photographer': { fr: 'Photographe', es: 'Fotógrafo' },
  'Photos are in cold storage. Contact support to restore this album.': { fr: 'Les photos sont archivées. Contactez le support pour restaurer cet album.', es: 'Las fotos están archivadas. Contacta con soporte para restaurar este álbum.' },
  'Publish to Connekt stock catalog': { fr: 'Publier dans le catalogue Connekt', es: 'Publicar en el catálogo de Connekt' },
  'Retry': { fr: 'Réessayer', es: 'Reintentar' },
  'Save to Camera Roll': { fr: 'Enregistrer dans la pellicule', es: 'Guardar en el carrete' },
  'Send to Client': { fr: 'Envoyer au client', es: 'Enviar al cliente' },
  'Share': { fr: 'Partager', es: 'Compartir' },
  'Share Album Link': { fr: 'Partager le lien de l’album', es: 'Compartir enlace del álbum' },
  'Submit for Review': { fr: 'Soumettre pour examen', es: 'Enviar a revisión' },
  'This album has no photos': { fr: 'Cet album ne contient aucune photo', es: 'Este álbum no tiene fotos' },
  'This album is locked': { fr: 'Cet album est verrouillé', es: 'Este álbum está bloqueado' },
  'Unlock this album to view and download all high-resolution photos.': { fr: 'Déverrouillez cet album pour voir et télécharger toutes les photos haute résolution.', es: 'Desbloquea este álbum para ver y descargar todas las fotos en alta resolución.' },
  'Upload Photos': { fr: 'Téléverser des photos', es: 'Subir fotos' }
};
import { translateSharedRw } from '@/i18n/kinyarwanda';
import { translateSharedSw } from '@/i18n/swahili';
const trAlb = (s: string) => {
  const lang = useLanguage.getState().language;
  if (lang === 'en') return s;
  if (lang === 'rw') return translateSharedRw(s);
  if (lang === 'sw') return translateSharedSw(s);
  return (ALB_MAP[s] as Record<string, string> | undefined)?.[lang] ?? s;
};

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
  useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ eventId?: string }>();

  const events = useAsync(useCallback(() => listPhotographerEvents(), []));
  const currencies = useAsync(useCallback(() => listCurrencies(), []));

  const [mode, setMode] = useState<Mode>('event');
  const [personalType, setPersonalType] = useState<PersonalType>('PAID');

  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState('');

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
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Default currency → RWF (or first available)
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

  // Preselect event when opened from "Create Album" on an event
  useEffect(() => {
    if (!params.eventId || selectedEvent || !events.data) return;
    const match = events.data.find((e) => e.id === params.eventId);
    if (match) {
      setMode('event');
      applyEvent(match);
    }
  }, [params.eventId, events.data, selectedEvent, applyEvent]);

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

  const addPhotos = async () => {
    const arr = await pickMultipleFromLibrary(40);
    if (arr.length) setImages((prev) => [...prev, ...arr]);
  };

  const removePhoto = (uri: string) => {
    setImages((prev) => prev.filter((x) => x.uri !== uri));
  };

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      return setError('Please enter an album title.');
    }

    if (mode === 'event') {
      if (!selectedEvent) {
        return setError('Please choose an event for this album.');
      }
    } else if (personalType === 'PAID') {
      if (!/^\d+$/.test(price) || Number(price) <= 0) {
        return setError('Please enter a valid price per image.');
      }
      if (!currencyId) {
        return setError('Please select a currency.');
      }
    } else {
      if (!EMAIL_RE.test(recipientEmail.trim())) {
        return setError('Please enter a valid recipient email address.');
      }
    }

    setSubmitting(true);
    setUploadStatus(
      images.length > 0
        ? `Creating album & uploading ${images.length} photos…`
        : 'Creating album…',
    );

    try {
      let result: AlbumCreateResult;
      if (mode === 'event' && selectedEvent) {
        result = await createEventAlbum({
          eventId: selectedEvent.id,
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          images,
        });
      } else if (personalType === 'PAID') {
        result = await createPaidAlbum({
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          location: location.trim() || undefined,
          date: date.trim() || undefined,
          pricePerImage: price,
          currencyId,
          images,
        });
      } else {
        result = await createFreeAlbum({
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          location: location.trim() || undefined,
          date: date.trim() || undefined,
          recipientEmail: recipientEmail.trim(),
          maxFreeDownloads: maxFree || undefined,
          pricePerExtraImage: extraPrice || undefined,
          currencyId: extraPrice ? currencyId : undefined,
          images,
        });
      }

      if (personalType === 'FREE' && mode === 'personal' && result.accessCode) {
        Alert.alert(
          'Album Created Successfully',
          `Access Code: ${result.accessCode}\n\nAn invitation email has also been sent to ${recipientEmail.trim()}.`,
          [
            {
              text: 'View Album',
              onPress: () => router.replace(`/album/${result.id}` as Href),
            },
          ],
        );
      } else {
        router.replace(`/album/${result.id}` as Href);
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not create the album. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  return (
    <Screen padded={false} edges={[]}>
      {/* Pinned above the scroll so the close control never scrolls out of reach. */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14), paddingBottom: 8, paddingHorizontal: spacing.lg }]}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={styles.eyebrow}>{trAlb('NEW COLLECTION')}</Text>
          <Text style={styles.h1}>{trAlb('Create Album')}</Text>
        </View>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={submitting}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >

        {/* Seamless Segmented Mode Switcher */}
        <View style={styles.modeContainer}>
          <Pressable
            style={[styles.modeTab, mode === 'event' && styles.modeTabActive]}
            onPress={() => setMode('event')}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={mode === 'event' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.modeTabText, mode === 'event' && styles.modeTabTextActive]}>
              {trAlb('Event Album')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.modeTab, mode === 'personal' && styles.modeTabActive]}
            onPress={() => setMode('personal')}
          >
            <Ionicons
              name="person"
              size={16}
              color={mode === 'personal' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.modeTabText, mode === 'personal' && styles.modeTabTextActive]}>
              {trAlb('Personal Album')}
            </Text>
          </Pressable>
        </View>

        {mode === 'event' ? (
          <View style={styles.formSection}>
            {/* Event selection */}
            <FieldLabel text="SELECT EVENT" required />
            {selectedEvent ? (
              <View style={styles.selectedEventCard}>
                <View style={styles.selectedEventIconBox}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.selectedEventTitle} numberOfLines={2}>
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
                  <Text style={styles.changeEventText}>{trAlb('Change')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.select} onPress={() => setEventPickerOpen(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.selectPlaceholder} numberOfLines={1}>
                    {trAlb('Choose an event booking…')}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            )}

            <FieldLabel text={trAlb('ALBUM TITLE')} required />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Wedding Ceremony, Main Session"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FieldLabel text="CATEGORY" />
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g. Wedding, Concert"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.rowItem}>
                <FieldLabel text="CLIENT" />
                <View style={[styles.input, styles.readonly]}>
                  <Text style={styles.readonlyText} numberOfLines={2}>
                    {selectedEvent?.clientName || 'Select an event'}
                  </Text>
                </View>
              </View>
            </View>

            <FieldLabel text="DESCRIPTION" />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what is in this album…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>
        ) : (
          <View style={styles.formSection}>
            <View style={styles.note}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={styles.noteText}>
                Personal albums can be <Text style={styles.bold}>{trAlb('PAID')}</Text> with facial
                recognition search, or{' '}
                <Text style={[styles.bold, { color: colors.success }]}>{trAlb('FREE')}</Text> with private email
                invite access.
              </Text>
            </View>

            <FieldLabel text={trAlb('ALBUM TYPE')} required />
            <View style={styles.typeRow}>
              <TypeCard
                active={personalType === 'PAID'}
                icon="scan"
                tag="MONETIZED"
                title="PAID Album"
                lines={[
                  'Facial recognition search',
                  'Set price per image',
                  '70% photographer payout',
                ]}
                onPress={() => setPersonalType('PAID')}
              />
              <TypeCard
                active={personalType === 'FREE'}
                icon="mail"
                tag="PRIVATE INVITE"
                title="FREE Album"
                lines={[
                  'Private access code invite',
                  'Client downloads free',
                  'Single recipient email',
                ]}
                onPress={() => setPersonalType('FREE')}
              />
            </View>

            <FieldLabel text={trAlb('ALBUM TITLE')} required />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Kigali Fashion Shoot"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FieldLabel text="CATEGORY" />
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g. Portrait, Studio"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.rowItem}>
                <FieldLabel text="DATE" />
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <FieldLabel text="LOCATION" />
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Kigali, Rwanda"
              placeholderTextColor={colors.textMuted}
            />

            <FieldLabel text="DESCRIPTION" />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe this photo collection…"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            {personalType === 'PAID' ? (
              <>
                <View style={[styles.detailNote, styles.detailNoteInfo]}>
                  <Text style={styles.detailNoteTitle}>{trAlb('PAID Album Details')}</Text>
                  <Text style={styles.detailNoteText}>{trAlb('• Indexed for facial-recognition search')}</Text>
                  <Text style={styles.detailNoteText}>{trAlb('• Platform takes 30% commission per sale')}</Text>
                  <Text style={styles.detailNoteText}>{trAlb('• Album expires in 60 days with warning')}</Text>
                </View>

                <FieldLabel text="PRICE PER IMAGE" required />
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                  placeholder="Enter price per photo"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />

                <FieldLabel text={trAlb('CURRENCY')} required />
                <View style={styles.chips}>
                  {(currencies.data ?? []).map((c) => {
                    const active = currencyId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setCurrencyId(c.id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {c.code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={[styles.detailNote, styles.detailNoteFree]}>
                  <Text style={[styles.detailNoteTitle, { color: colors.success }]}>
                    {trAlb('FREE Album Details')}
                  </Text>
                  <Text style={styles.detailNoteText}>{trAlb('• NOT indexed on public face search')}</Text>
                  <Text style={styles.detailNoteText}>{trAlb('• Recipient receives email with access code')}</Text>
                  <Text style={styles.detailNoteText}>{trAlb('• Full-resolution downloads enabled')}</Text>
                </View>

                <FieldLabel text={trAlb('RECIPIENT EMAIL')} required />
                <TextInput
                  style={styles.input}
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                  placeholder="client@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <FieldLabel text="MAX FREE DOWNLOADS" />
                    <TextInput
                      style={styles.input}
                      value={maxFree}
                      onChangeText={(t) => setMaxFree(t.replace(/[^0-9]/g, ''))}
                      placeholder="Blank = all free"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <FieldLabel text="PRICE PER EXTRA" />
                    <TextInput
                      style={styles.input}
                      value={extraPrice}
                      onChangeText={(t) => setExtraPrice(t.replace(/[^0-9]/g, ''))}
                      placeholder="Blank = no extras"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Photos upload section */}
        <View style={styles.formSection}>
          <FieldLabel text="ALBUM PHOTOS (OPTIONAL)" />
          <Pressable style={styles.uploadBox} onPress={addPhotos}>
            <View style={styles.uploadIcon}>
              <Ionicons name="images" size={22} color={onFill} />
            </View>
            <Text style={styles.uploadTitle}>
              {images.length > 0 ? 'Add more photos' : 'Select photos from library'}
            </Text>
            <Text style={styles.helper}>
              {images.length > 0
                ? `${images.length} photo${images.length === 1 ? '' : 's'} selected`
                : 'Upload high-resolution images now or add them later.'}
            </Text>
          </Pressable>

          {images.length ? (
            <View style={styles.thumbsContainer}>
              <View style={styles.thumbsHeader}>
                <Text style={styles.thumbsTitle}>{images.length} photos ready to upload</Text>
                <Pressable onPress={() => setImages([])} hitSlop={8}>
                  <Text style={styles.clearPhotosText}>{trAlb('Clear all')}</Text>
                </Pressable>
              </View>

              <View style={styles.thumbs}>
                {images.map((img) => (
                  <View key={img.uri} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                    <Pressable
                      style={styles.thumbX}
                      onPress={() => removePhoto(img.uri)}
                      hitSlop={6}
                      accessibilityLabel="Remove photo"
                    >
                      <Ionicons name="close" size={11} color={onFill} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Upload status message */}
        {uploadStatus ? (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>{uploadStatus}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.cancel]}
            onPress={() => router.back()}
            disabled={submitting}
          >
            <Text style={styles.cancelText}>{trAlb('Cancel')}</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.create, submitting && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={onFill} />
            ) : (
              <Text style={styles.createText}>{trAlb('Create Album')}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Event Picker Modal */}
      <Modal
        visible={eventPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEventPickerOpen(false)}
      >
        <GlassScrim style={styles.pickerBackdrop} onPress={() => setEventPickerOpen(false)}>
          <GlassSheetHost style={styles.picker}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{trAlb('Select Event')}</Text>
              <Pressable onPress={() => setEventPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

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
                <Text style={styles.helper}>
                  {eventSearch ? 'No events matching search.' : 'No events found.'}
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {filteredEvents.map((ev) => {
                  const isSelected = selectedEvent?.id === ev.id;
                  return (
                    <Pressable
                      key={ev.id}
                      style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                      onPress={() => {
                        applyEvent(ev);
                        setEventPickerOpen(false);
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.pickerRowTitle} numberOfLines={2}>
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
          </GlassSheetHost>
        </GlassScrim>
      </Modal>
    </Screen>
  );
}

// ─── Presentational Components ──────────────────────────────────────────

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  const styles = useStyles();
  return (
    <Text style={styles.fieldLabel}>
      {text} {required ? <Text style={styles.requiredStar}>*</Text> : null}
    </Text>
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
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={[styles.typeCard, active && styles.typeCardActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.typeHead}>
        <View style={[styles.typeIcon, active && styles.typeIconActive]}>
          <Ionicons name={icon} size={18} color={active ? onFill : colors.textMuted} />
        </View>
        <View style={[styles.radio, active && styles.radioActive]}>
          {active ? <Ionicons name="checkmark" size={11} color={onFill} /> : null}
        </View>
      </View>
      <Text style={styles.typeTag}>{tag}</Text>
      <Text style={styles.typeTitle}>{title}</Text>
      {lines.map((l) => (
        <View key={l} style={styles.typeLine}>
          <Ionicons name="checkmark" size={12} color={active ? colors.primary : colors.textMuted} />
          <Text style={styles.typeLineText}>{l}</Text>
        </View>
      ))}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
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

  // Mode segmented control
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.lg,
    padding: 3,
    gap: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  modeTabActive: {
    backgroundColor: c.surface,
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  modeTabText: { fontFamily: fonts.bold, fontSize: 13.5, color: c.textMuted },
  modeTabTextActive: { color: c.primary },

  // Form Section Card
  formSection: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.xs,
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
  readonly: { backgroundColor: c.surfaceMuted, justifyContent: 'center' },
  readonlyText: { fontFamily: fonts.regular, fontSize: 14, color: c.textSoft },
  helper: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, lineHeight: 16 },

  // Selected event card
  selectedEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary,
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

  // Select trigger
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
  },
  selectPlaceholder: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: c.tint,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  noteText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: c.textSoft, lineHeight: 17 },
  bold: { fontFamily: fonts.bold, color: c.primary },

  // Type row
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: c.background,
    gap: 4,
  },
  typeCardActive: { borderColor: c.primary, backgroundColor: c.tint },
  typeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconActive: { backgroundColor: c.primary },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: c.primary, borderColor: c.primary },
  typeTag: { fontFamily: fonts.bold, fontSize: 12, color: c.textMuted, letterSpacing: 0.6 },
  typeTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: c.text, marginBottom: 2 },
  typeLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeLineText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: c.textSoft },

  detailNote: { borderRadius: radii.md, padding: spacing.md, gap: 2, marginTop: spacing.xs },
  detailNoteInfo: { backgroundColor: c.tint },
  detailNoteFree: { backgroundColor: c.surfaceMuted },
  detailNoteTitle: { fontFamily: fonts.bold, fontSize: 13, color: c.primary, marginBottom: 2 },
  detailNoteText: { fontFamily: fonts.regular, fontSize: 12, color: c.textSoft, lineHeight: 17 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontFamily: fonts.bold, fontSize: 12.5, color: c.textSoft },
  chipTextActive: { color: c.textOnPrimary },

  // Upload box
  uploadBox: {
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.background,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  uploadTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: c.text },

  // Thumbs
  thumbsContainer: {
    backgroundColor: c.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  thumbsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumbsTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: c.text },
  clearPhotosText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: 62, height: 62, borderRadius: radii.md, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbX: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error & Status
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.error },

  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.tint,
  },
  statusText: { fontFamily: fonts.bold, fontSize: 13, color: c.primary },

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
  createText: { fontFamily: fonts.bold, fontSize: 14, color: c.textOnPrimary },
  btnDisabled: { opacity: 0.6 },

  // Event Picker Modal
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end' },
  picker: {
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
    ...glassTile(c),
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
