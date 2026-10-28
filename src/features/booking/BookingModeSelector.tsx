/**
 * BookingModeSelector: the fork at the top of booking, and the Post My Event
 * wizard behind it.
 *
 *   Find a Photographer (Direct)  browse and book directly.
 *   Post My Event (Matched)       describe the event, available photographers
 *                                 who fit say yes, pick one.
 *
 * Mirrors the web dashboard: the same names, colours, steps and choices, all
 * from GET /public/hybrid/options. Every answer is a choice from a list except
 * the event name, the venue and optional notes. The live count is the
 * server's, from the same engine that sends the alerts.
 */
import { WishInvitesField } from '@/features/wishes/WishInvitesField';
import { useScrollToField } from '@/features/wishes/useScrollToField';
import { wishInvitesError } from '@/features/wishes/wishInvites';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { ProgressTrack } from '@/features/client/studio';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { createMatchRequest, getHybridOptions, getMatchPreview } from '@/features/hybrid/api';
import type { HybridOptions, LocationCoverage, MatchPreviewResult, PhotographerType } from '@/features/hybrid/types';
import {
  Chip, MODE_META, OptionCard, budgetLabel, durationBetween, durationText,
} from '@/features/hybrid/hybridUi';
import { createEvent } from '@/features/events/api';
import { useRole } from '@/features/auth/role';
import { useAuth, isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { translateSharedRw } from '@/i18n/kinyarwanda';
import { translateSharedSw } from '@/i18n/swahili';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme, onFill } from '@/theme';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { SheetCornerClose } from '@/components/ui/SheetCloseButton';
import { glassTile } from '@/components/ui/GlassCard';

const BMS_I18N: Record<'fr' | 'es' | 'rw', Record<string, string>> = {
  fr: {
    'Could not load the event options.': "Impossible de charger les options de l'événement.",
    'Choose the type of event.': "Choisissez le type d'événement.",
    'Give your event a name.': 'Donnez un nom à votre événement.',
    'Choose the event date.': "Choisissez la date de l'événement.",
    'That date has passed. Choose a future date.': 'Cette date est passée. Choisissez une date future.',
    'That start time has passed. Choose a later time.': 'Cette heure de début est passée. Choisissez une heure ultérieure.',
    'Add the venue or address so photographers know where to go.': 'Ajoutez le lieu ou l’adresse pour que les photographes sachent où aller.',
    'Could not post your event. Please try again.': 'Impossible de publier votre événement. Veuillez réessayer.',
    "Couldn't count photographers right now": 'Impossible de compter les photographes pour le moment',
    'photographer fits right now': 'photographe correspond actuellement',
    'photographers fit right now': 'photographes correspondent actuellement',
    'You can still continue; we check again when you post.': 'Vous pouvez continuer ; nous vérifions à nouveau à la publication.',
    'of any type': 'de tout type',
    'are studios': 'sont des studios',
    'are freelancers': 'sont indépendants',
    'any budget': 'tout budget',
    'fit your budget': 'correspondent à votre budget',
    'anywhere in Rwanda': 'partout au Rwanda',
    'Try widening your request:': "Essayez d'élargir votre demande :",
    'Include nearby cities': 'Inclure les villes proches',
    'Anywhere in Rwanda': 'Partout au Rwanda',
    'Any type': 'Tout type',
    'Any specialty': 'Toute spécialité',
    'Flexible budget': 'Budget flexible',
    'Browse Photographers': 'Parcourir les photographes',
    Direct: 'Direct',
    'Look through portfolios, compare packages, and reach out directly to the photographer you want.': 'Parcourez les portfolios, comparez les forfaits et contactez directement le photographe de votre choix.',
    'See photos, reviews, and package prices': 'Voir les photos, avis et tarifs des forfaits',
    'Message and book directly with the creator': 'Envoyer un message et réserver directement avec le créateur',
    'Post Your Event': 'Publier votre événement',
    Faster: 'Plus rapide',
    'Share your event date, location, and budget. Photographers who are free will reply, and you choose who you like.': 'Partagez la date, le lieu et le budget. Les photographes disponibles répondront et vous choisirez celui qui vous plaît.',
    'Photographers who are actually free respond to you': 'Les photographes réellement disponibles vous répondent',
    'Saves time — no need to message people one by one': 'Gagnez du temps — inutile de contacter chacun individuellement',
    'Post My Event is paused right now. Use Find a Photographer to book directly.': 'Publier mon événement est temporairement suspendu. Utilisez Trouver un photographe pour réserver directement.',
    'What kind of event is it?': "Quel type d'événement est-ce ?",
    'Event name': "Nom de l'événement",
    'What guests and photographers will see.': 'Ce que verront les invités et les photographes.',
    'e.g. Birthday Celebration': "ex. Fête d'anniversaire",
    'When is it?': 'Quand a-t-il lieu ?',
    Tomorrow: 'Demain',
    'This Saturday': 'Ce samedi',
    'Next Saturday': 'Samedi prochain',
    'Pick a date': 'Choisir une date',
    Starts: 'Début',
    Ends: 'Fin',
    ' (+1 day)': ' (+1 jour)',
    ' · ends next day': ' · se termine le lendemain',
    City: 'Ville',
    Country: 'Pays',
    'Venue or address': 'Lieu ou adresse',
    'A venue name, street or landmark.': 'Un nom de lieu, une rue ou un point de repère.',
    'e.g. Kigali Convention Centre': 'ex. Kigali Convention Centre',
    'Notes for photographers': 'Notes pour les photographes',
    'Optional: shots you want, indoor or outdoor, dress code.': 'Facultatif : photos souhaitées, intérieur ou extérieur, code vestimentaire.',
    'Photographer type': 'Type de photographe',
    Budget: 'Budget',
    'Photographers whose packages fit this range are alerted.': 'Les photographes dont les forfaits correspondent à cette fourchette sont alertés.',
    'Photographer specialty': 'Spécialité du photographe',
    'Choose one only if it must be a specialist.': "N'en choisissez une que s'il faut un spécialiste.",
    'Where can the photographer come from?': 'D’où peut venir le photographe ?',
    'Collect answers for': 'Recueillir les réponses pendant',
    'After this, you choose from whoever said yes.': 'Ensuite, vous choisissez parmi ceux qui ont dit oui.',
    EVENT: 'ÉVÉNEMENT',
    WHEN: 'QUAND',
    WHERE: 'OÙ',
    'LOOKING FOR': 'RECHERCHE',
    BUDGET: 'BUDGET',
    Flexible: 'Flexible',
    'COLLECT ANSWERS FOR': 'RECUEILLIR LES RÉPONSES PENDANT',
    'What happens next': 'Ce qui se passe ensuite',
    'Only photographers who said yes appear for you, grouped as top, good and possible matches, three of each.': 'Seuls les photographes qui ont dit oui vous sont présentés, regroupés par pertinence.',
    'You choose one and pay 50%, 70% or 100% upfront. Connekyt holds it until delivery.': 'Vous en choisissez un et payez 50 %, 70 % ou 100 % d’avance. Connekyt conserve le montant jusqu’à la livraison.',
    'Your event stays private. It only appears publicly once a photographer is booked.': "Votre événement reste privé. Il n'apparaît publiquement qu'une fois un photographe réservé.",
    'Saved, but nobody fits right now': 'Enregistré, mais personne ne correspond pour le moment',
    'Your event is saved privately. Post it again with a wider area or budget, or use Find a Photographer to book one yourself.': 'Votre événement est enregistré en privé. Republiez-le avec une zone ou un budget plus large, ou utilisez Trouver un photographe.',
    "We'll notify you each time a photographer says yes.": "Nous vous informerons chaque fois qu'un photographe dira oui.",
    'How would you like to book?': 'Comment souhaitez-vous réserver ?',
    'Tell us about your event': 'Parlez-nous de votre événement',
    'Who should we look for?': 'Qui devons-nous rechercher ?',
    'Review and post': 'Vérifier et publier',
    'Your event is posted': 'Votre événement est publié',
    'Pick someone yourself, or let available photographers come to you.': 'Choisissez vous-même, ou laissez les photographes disponibles venir à vous.',
    'Follow the answers': 'Suivre les réponses',
    Done: 'Terminé',
    Continue: 'Continuer',
    'Widen your request first': "Élargissez d'abord votre demande",
    'Post and alert photographers': 'Publier et alerter les photographes',
    'Start time': 'Heure de début',
    'End time': 'Heure de fin',
    ' (next day)': ' (lendemain)',
  },
  es: {
    'Could not load the event options.': 'No se pudieron cargar las opciones del evento.',
    'Choose the type of event.': 'Elige el tipo de evento.',
    'Give your event a name.': 'Dale un nombre a tu evento.',
    'Choose the event date.': 'Elige la fecha del evento.',
    'That date has passed. Choose a future date.': 'Esa fecha ya pasó. Elige una fecha futura.',
    'That start time has passed. Choose a later time.': 'Esa hora de inicio ya pasó. Elige una hora posterior.',
    'Add the venue or address so photographers know where to go.': 'Agrega el lugar o la dirección para que los fotógrafos sepan a dónde ir.',
    'Could not post your event. Please try again.': 'No se pudo publicar tu evento. Inténtalo de nuevo.',
    "Couldn't count photographers right now": 'No se pudo contar los fotógrafos ahora mismo',
    'photographer fits right now': 'fotógrafo encaja ahora mismo',
    'photographers fit right now': 'fotógrafos encajan ahora mismo',
    'You can still continue; we check again when you post.': 'Aún puedes continuar; volvemos a verificar al publicar.',
    'of any type': 'de cualquier tipo',
    'are studios': 'son estudios',
    'are freelancers': 'son independientes',
    'any budget': 'cualquier presupuesto',
    'fit your budget': 'se ajustan a tu presupuesto',
    'anywhere in Rwanda': 'en cualquier lugar de Ruanda',
    'Try widening your request:': 'Intenta ampliar tu solicitud:',
    'Include nearby cities': 'Incluir ciudades cercanas',
    'Anywhere in Rwanda': 'En cualquier lugar de Ruanda',
    'Any type': 'Cualquier tipo',
    'Any specialty': 'Cualquier especialidad',
    'Flexible budget': 'Presupuesto flexible',
    'Browse Photographers': 'Explorar fotógrafos',
    Direct: 'Directo',
    'Look through portfolios, compare packages, and reach out directly to the photographer you want.': 'Explora portafolios, compara paquetes y contacta directamente al fotógrafo que deseas.',
    'See photos, reviews, and package prices': 'Ver fotos, reseñas y precios de paquetes',
    'Message and book directly with the creator': 'Envía mensajes y reserva directamente con el creador',
    'Post Your Event': 'Publicar tu evento',
    Faster: 'Más rápido',
    'Share your event date, location, and budget. Photographers who are free will reply, and you choose who you like.': 'Comparte la fecha, lugar y presupuesto de tu evento. Los fotógrafos libres responderán y tú eliges.',
    'Photographers who are actually free respond to you': 'Los fotógrafos realmente disponibles te responden',
    'Saves time — no need to message people one by one': 'Ahorra tiempo — sin escribir uno por uno',
    'Post My Event is paused right now. Use Find a Photographer to book directly.': 'Publicar mi evento está en pausa ahora mismo. Usa Buscar un fotógrafo para reservar directamente.',
    'What kind of event is it?': '¿Qué tipo de evento es?',
    'Event name': 'Nombre del evento',
    'What guests and photographers will see.': 'Lo que verán los invitados y fotógrafos.',
    'e.g. Birthday Celebration': 'ej. Celebración de cumpleaños',
    'When is it?': '¿Cuándo es?',
    Tomorrow: 'Mañana',
    'This Saturday': 'Este sábado',
    'Next Saturday': 'El próximo sábado',
    'Pick a date': 'Elegir una fecha',
    Starts: 'Empieza',
    Ends: 'Termina',
    ' (+1 day)': ' (+1 día)',
    ' · ends next day': ' · termina al día siguiente',
    City: 'Ciudad',
    Country: 'País',
    'Venue or address': 'Lugar o dirección',
    'A venue name, street or landmark.': 'Nombre del lugar, calle o punto de referencia.',
    'e.g. Kigali Convention Centre': 'ej. Kigali Convention Centre',
    'Notes for photographers': 'Notas para los fotógrafos',
    'Optional: shots you want, indoor or outdoor, dress code.': 'Opcional: tomas que deseas, interior o exterior, código de vestimenta.',
    'Photographer type': 'Tipo de fotógrafo',
    Budget: 'Presupuesto',
    'Photographers whose packages fit this range are alerted.': 'Se alerta a los fotógrafos cuyos paquetes se ajustan a este rango.',
    'Photographer specialty': 'Especialidad del fotógrafo',
    'Choose one only if it must be a specialist.': 'Elige una solo si debe ser un especialista.',
    'Where can the photographer come from?': '¿De dónde puede venir el fotógrafo?',
    'Collect answers for': 'Recibir respuestas durante',
    'After this, you choose from whoever said yes.': 'Después de esto, eliges entre quienes dijeron que sí.',
    EVENT: 'EVENTO',
    WHEN: 'CUÁNDO',
    WHERE: 'DÓNDE',
    'LOOKING FOR': 'BUSCANDO',
    BUDGET: 'PRESUPUESTO',
    Flexible: 'Flexible',
    'COLLECT ANSWERS FOR': 'RECIBIR RESPUESTAS DURANTE',
    'What happens next': 'Qué sucede después',
    'Only photographers who said yes appear for you, grouped as top, good and possible matches, three of each.': 'Solo aparecen los fotógrafos que dijeron que sí, agrupados por mejores coincidencias.',
    'You choose one and pay 50%, 70% or 100% upfront. Connekyt holds it until delivery.': 'Eliges uno y pagas el 50%, 70% o 100% por adelantado. Connekyt lo retiene hasta la entrega.',
    'Your event stays private. It only appears publicly once a photographer is booked.': 'Tu evento permanece privado. Solo aparece públicamente cuando se reserva un fotógrafo.',
    'Saved, but nobody fits right now': 'Guardado, pero nadie encaja ahora mismo',
    'Your event is saved privately. Post it again with a wider area or budget, or use Find a Photographer to book one yourself.': 'Tu evento se guardó en privado. Publícalo de nuevo con un área o presupuesto más amplio, o usa Buscar un fotógrafo.',
    "We'll notify you each time a photographer says yes.": 'Te notificaremos cada vez que un fotógrafo diga que sí.',
    'How would you like to book?': '¿Cómo te gustaría reservar?',
    'Tell us about your event': 'Cuéntanos sobre tu evento',
    'Who should we look for?': '¿A quién debemos buscar?',
    'Review and post': 'Revisar y publicar',
    'Your event is posted': 'Tu evento está publicado',
    'Pick someone yourself, or let available photographers come to you.': 'Elige a alguien tú mismo, o deja que los fotógrafos disponibles vengan a ti.',
    'Follow the answers': 'Seguir las respuestas',
    Done: 'Listo',
    Continue: 'Continuar',
    'Widen your request first': 'Amplía tu solicitud primero',
    'Post and alert photographers': 'Publicar y alertar a fotógrafos',
    'Start time': 'Hora de inicio',
    'End time': 'Hora de finalización',
    ' (next day)': ' (día siguiente)',
  },
  rw: {
    'Could not load the event options.': 'Ntibishobotse gufungura amahitamo y’igikorwa.',
    'Choose the type of event.': 'Hitamo ubwoko bw’igikorwa.',
    'Give your event a name.': 'Ha igikorwa cyawe izina.',
    'Choose the event date.': 'Hitamo itariki y’igikorwa.',
    'That date has passed. Choose a future date.': 'Iyo tariki yararenze. Hitamo itariki iri imbere.',
    'That start time has passed. Choose a later time.': 'Iyo saha yo gutangira yararenze. Hitamo isaha iri imbere.',
    'Add the venue or address so photographers know where to go.': 'Ongeraho aho bibera cyangwa aderesi kugira ngo abafotozi bamenye aho bajya.',
    'Could not post your event. Please try again.': 'Ntibishobotse gutangaza igikorwa cyawe. Ongera ugerageze.',
    "Couldn't count photographers right now": 'Ntibishobotse kubara abafotozi aka kanya',
    'photographer fits right now': 'gafotozi ahuye n’ibisabwa ubu',
    'photographers fit right now': 'abafotozi bahuye n’ibisabwa ubu',
    'You can still continue; we check again when you post.': 'Ushobora gukomeza; tuzongera tugenzure nutangaza igikorwa.',
    'of any type': 'b’ubwoko bwose',
    'are studios': 'ni za sitidiyo',
    'are freelancers': 'ni abigenga',
    'any budget': 'ingengo y’imari yose',
    'fit your budget': 'bahuye n’ingengo y’imari yawe',
    'anywhere in Rwanda': 'ahari ho hose mu Rwanda',
    'Try widening your request:': 'Gerageza kwagura ibyo usaba:',
    'Include nearby cities': 'Ongeramo imijyi ya hafi',
    'Anywhere in Rwanda': 'Ahari ho hose mu Rwanda',
    'Any type': 'Ubwoko bwose',
    'Any specialty': 'Umwihariko wose',
    'Flexible budget': 'Ingengo y’imari ihinduka',
    'Browse Photographers': 'Shakisha abafotozi',
    Direct: 'Ako kanya',
    'Look through portfolios, compare packages, and reach out directly to the photographer you want.': 'Reba ibikorwa byabo, gereranya amapaki, maze uvugishe gafotozi ushaka ako kanya.',
    'See photos, reviews, and package prices': 'Reba amafoto, ibitekerezo, n’ibiciro by’amapaki',
    'Message and book directly with the creator': 'Andikira kandi ufate umwanya ako kanya ku muhanzi',
    'Post Your Event': 'Tangaza igikorwa cyawe',
    Faster: 'Byihuse',
    'Share your event date, location, and budget. Photographers who are free will reply, and you choose who you like.': 'Sangiza itariki, aho bibera, n’ingengo y’imari. Abafotozi baboneka bazagusubiza, uhitemo uwo ukunze.',
    'Photographers who are actually free respond to you': 'Abafotozi baboneka koko nibo bagusubiza',
    'Saves time — no need to message people one by one': 'Birokora igihe — ntukeneye kwandikira buri wese ukwe',
    'Post My Event is paused right now. Use Find a Photographer to book directly.': 'Gutangaza igikorwa bihagaze gato. Koresha Shaka Gafotozi ufate umwanya ako kanya.',
    'What kind of event is it?': 'Ni bwoko ki bw’igikorwa?',
    'Event name': 'Izina ry’igikorwa',
    'What guests and photographers will see.': 'Icyo abatumirwa n’abafotozi bazabona.',
    'e.g. Birthday Celebration': 'urugero: Ibirori by’isabukuru',
    'When is it?': 'Bizaba ryari?',
    Tomorrow: 'Ejo hazaza',
    'This Saturday': 'Ku wa Gatandatu utaha',
    'Next Saturday': 'Ku wa Gatandatu ukurikira',
    'Pick a date': 'Hitamo itariki',
    Starts: 'Bitangira',
    Ends: 'Birangira',
    ' (+1 day)': ' (+umunsi 1)',
    ' · ends next day': ' · birangira bucyeye',
    City: 'Umujyi',
    Country: 'Igihugu',
    'Venue or address': 'Aho bibera cyangwa aderesi',
    'A venue name, street or landmark.': 'Izina ry’ahantu, umuhanda cyangwa ikimenyetso.',
    'e.g. Kigali Convention Centre': 'urugero: Kigali Convention Centre',
    'Notes for photographers': 'Ibisobanuro ku bafotozi',
    'Optional: shots you want, indoor or outdoor, dress code.': 'Si itegeko: amafoto wifuza, imbere cyangwa hanze, imyambarire.',
    'Photographer type': 'Ubwoko bwa gafotozi',
    Budget: 'Ingengo y’imari',
    'Photographers whose packages fit this range are alerted.': 'Abafotozi bafite amapaki ajyanye n’iyi ngengo y’imari baramenyeshwa.',
    'Photographer specialty': 'Umwihariko wa gafotozi',
    'Choose one only if it must be a specialist.': 'Hitamo kimwe gusa niba ukeneye inzobere yihariye.',
    'Where can the photographer come from?': 'Gafotozi ashobora kuva he?',
    'Collect answers for': 'Kusanya ibisubizo mu gihe cya',
    'After this, you choose from whoever said yes.': 'Nyuma y’ibi, uhitamo mu bavuze ko baboneka.',
    EVENT: 'IGIKORWA',
    WHEN: 'IGIHE',
    WHERE: 'AHO BIBERA',
    'LOOKING FOR': 'IBISHAKISHWA',
    BUDGET: 'INGENGO Y’IMARI',
    Flexible: 'Ihinduka',
    'COLLECT ANSWERS FOR': 'KUSANYA IBISUBIZO MU GIHE CYA',
    'What happens next': 'Igikurikiraho ni iki',
    'Only photographers who said yes appear for you, grouped as top, good and possible matches, three of each.': 'Abafotozi bavuze ko baboneka bonyine nibo bagaragara, bagabanyije mu byiciro by’abahuye kurusha abandi.',
    'You choose one and pay 50%, 70% or 100% upfront. Connekyt holds it until delivery.': 'Uhitamo umwe ukishyura 50%, 70% cyangwa 100% mbere. Connekyt iyabika kugeza amafoto atanzwe.',
    'Your event stays private. It only appears publicly once a photographer is booked.': 'Igikorwa cyawe kiguma ari ibanga. Kigaragara ku mugaragaro gusa iyo gafotozi amaze kwemezwa.',
    'Saved, but nobody fits right now': 'Byabitswe, ariko nta we uhuye n’ibisabwa aka kanya',
    'Your event is saved privately. Post it again with a wider area or budget, or use Find a Photographer to book one yourself.': 'Igikorwa cyawe cyabitswe mu ibanga. Ongera ugitangaze waguye agace cyangwa ingengo y’imari, cyangwa ukoreshe Shaka Gafotozi.',
    "We'll notify you each time a photographer says yes.": 'Tuzakumenyesha buri uko gafotozi avuze ko aboneka.',
    'How would you like to book?': 'Urifuza gufata umwanya ute?',
    'Tell us about your event': 'Tubwire ibyerekeye igikorwa cyawe',
    'Who should we look for?': 'Dushakishe nde?',
    'Review and post': 'Suzuma maze utangaze',
    'Your event is posted': 'Igikorwa cyawe cyatangajwe',
    'Pick someone yourself, or let available photographers come to you.': 'Hitamo uwo ushaka ubwawe, cyangwa ureke abafotozi baboneka bakugane.',
    'Follow the answers': 'Kurikirana ibisubizo',
    Done: 'Byarangiye',
    Continue: 'Komeza',
    'Widen your request first': 'Banza wagure ibyo usaba',
    'Post and alert photographers': 'Tangaza kandi umenyeshe abafotozi',
    'Start time': 'Isaha yo gutangira',
    'End time': 'Isaha yo kurangira',
    ' (next day)': ' (bucyeye)',
  },
};

export type BookingStep = 'select' | 1 | 2 | 3;

/** The three named steps shown on the progress track. */
const WIZARD_STEPS = [
  { n: 1, label: 'Event' },
  { n: 2, label: 'Talent' },
  { n: 3, label: 'Review' },
] as const;

export type ExistingHybridEvent = {
  id: string;
  title?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  city?: string;
  venue?: string;
};

export type BookingModeSelectorProps = {
  visible: boolean;
  onClose: () => void;
  /** Optional custom navigation callback */
  onSelectDirect?: () => void;
  onSelectHybrid?: () => void;
  /** Initial step when sheet mounts (defaults to 'select') */
  initialStep?: BookingStep;
  /** Post an existing event (a Direct one, or one whose matching ended) instead of creating one. */
  existingEvent?: ExistingHybridEvent | null;
  /** Called after posting, before navigating to the answers screen. */
  onPosted?: (eventId: string) => void;
};

type Step = BookingStep | 'done';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (iso: string) => {
  const t = Date.parse(`${iso}T00:00:00`);
  const lang = useLanguage.getState().language;
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : iso;
};
function nextWeekday(weekday: number, weeksAhead = 0): Date {
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + weeksAhead * 7);
  return d;
}
function timeSlots(step: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

export function BookingModeSelector({
  visible,
  onClose,
  onSelectDirect,
  onSelectHybrid,
  initialStep = 'select',
  existingEvent,
  onPosted,
}: BookingModeSelectorProps) {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const tr = useCallback(
    (s: string) =>
      language === 'en'
        ? s
        : language === 'rw'
        ? translateSharedRw(s)
        : language === 'sw'
        ? translateSharedSw(s)
        : (BMS_I18N as Record<string, Record<string, string>>)[language]?.[s] ?? s,
    [language],
  );
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isCoordinator } = useRole();
  const user = useAuth((s) => s.user);

  const [step, setStep] = useState<Step>(initialStep);
  const [options, setOptions] = useState<HybridOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Step 1
  const [eventTypeId, setEventTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('22:00');
  const [city, setCity] = useState('Kigali');
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');
  // Wish invites: no default, so the choice is required before step 1 can continue.
  const [wishInvites, setWishInvites] = useState<boolean | null>(null);
  const [wishInvitesErr, setWishInvitesErr] = useState<string | null>(null);
  const { scrollRef, fieldRef, onScroll, scrollToField } = useScrollToField();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [listSheet, setListSheet] = useState<null | 'start' | 'end' | 'city'>(null);

  // Step 2
  const [photographerType, setPhotographerType] = useState<PhotographerType>('ANY');
  const [budgetIndex, setBudgetIndex] = useState(1);
  const [specialty, setSpecialty] = useState('ANY');
  const [coverage, setCoverage] = useState<LocationCoverage>('SAME_CITY');
  const [windowHours, setWindowHours] = useState(24);

  const [preview, setPreview] = useState<MatchPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; invited: number; status?: string } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep(existingEvent ? 2 : initialStep);
    setError(null);
    setResult(null);
    setCreatedEventId(existingEvent?.id ?? null);
    if (existingEvent) {
      if (existingEvent.title) setTitle(existingEvent.title);
      if (existingEvent.eventDate) setDate(existingEvent.eventDate.slice(0, 10));
      if (existingEvent.startTime) setStartTime(existingEvent.startTime.slice(0, 5));
      if (existingEvent.endTime) setEndTime(existingEvent.endTime.slice(0, 5));
      if (existingEvent.city) setCity(existingEvent.city);
      if (existingEvent.venue) setVenue(existingEvent.venue);
    }
    getHybridOptions()
      .then((o) => { setOptions(o); setWindowHours(o.defaultMatchWindowHours); setOptionsError(null); })
      .catch((e) => setOptionsError(isApiError(e) ? e.message : tr('Could not load the event options.')));
  }, [visible, initialStep, existingEvent]);

  const eventType = options?.eventTypes.find((t) => t.id === eventTypeId);
  const cityInfo = options?.cities.find((c) => c.name === city);
  const minutes = durationBetween(startTime, endTime);
  const overnight = endTime <= startTime;
  const slots = useMemo(() => timeSlots(options?.timeStepMinutes || 30), [options]);
  const preset = options?.budgetPresets[budgetIndex];

  const fetchPreview = useCallback(async () => {
    if (!date) return;
    setPreviewLoading(true);
    try {
      const res = await getMatchPreview({
        eventDate: date,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        city,
        latitude: cityInfo?.latitude,
        longitude: cityInfo?.longitude,
        minBudget: preset?.min ?? undefined,
        maxBudget: preset?.max ?? undefined,
        currency: 'RWF',
        photographerType,
        specialty: eventType?.name,
        photographerSpecialty: specialty,
        locationCoverage: coverage,
        eventId: existingEvent?.id,
      });
      setPreview(res);
      setPreviewFailed(false);
    } catch {
      setPreview(null);
      setPreviewFailed(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [date, startTime, endTime, city, cityInfo, preset, photographerType, eventType, specialty, coverage, existingEvent]);

  useEffect(() => {
    if (!visible || (step !== 2 && step !== 3)) return;
    const t = setTimeout(fetchPreview, 400);
    return () => clearTimeout(t);
  }, [visible, step, fetchPreview]);

  const close = () => {
    onClose();
  };

  const goDirect = () => {
    close();
    setTimeout(() => (onSelectDirect ? onSelectDirect() : router.push('/photographers' as never)), 150);
  };

  const goHybrid = () => {
    if (onSelectHybrid) {
      close();
      setTimeout(onSelectHybrid, 150);
    } else {
      setStep(1);
    }
  };

  const validate1 = (): string | null => {
    if (!eventTypeId) return tr('Choose the type of event.');
    if (!title.trim()) return tr('Give your event a name.');
    if (!date) return tr('Choose the event date.');
    const today = isoDate(new Date());
    if (date < today) return tr('That date has passed. Choose a future date.');
    if (date === today) {
      const now = new Date();
      if (startTime <= `${pad(now.getHours())}:${pad(now.getMinutes())}`) return tr('That start time has passed. Choose a later time.');
    }
    if (!venue.trim()) return tr('Add the venue or address so photographers know where to go.');
    const missing = wishInvitesError(wishInvites);
    if (missing) {
      setWishInvitesErr(missing);
      scrollToField();
      return missing;
    }
    return null;
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      const e = validate1();
      if (e) return setError(e);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const back = () => {
    setError(null);
    if (step === 1) setStep('select');
    else if (step === 2 && !existingEvent) setStep(1);
    else if (step === 3) setStep(2);
  };

  const publish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let eventId = createdEventId;
      if (!eventId) {
        const ev = await createEvent(
          {
            title: title.trim(),
            category: eventType?.name || 'Event',
            eventCategoryId: eventTypeId || undefined,
            eventDate: date,
            startTime,
            endTime,
            location: [venue.trim(), city, options?.country].filter(Boolean).join(', '),
            description: notes.trim() || undefined,
            organizer: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.organizationName || 'Organizer',
            // Not PRIVATE: here that means a self-streamed event that must charge at
            // least 100 RWF, and the backend refused every post. The backend keeps a
            // posted event off public listings until a photographer is booked.
            eventVisibility: 'PUBLIC',
            allowWishInvites: wishInvites === true,
          },
          isCoordinator,
        );
        eventId = ev.id;
        setCreatedEventId(eventId);
      }
      let posted;
      try {
        posted = await createMatchRequest(eventId, {
          minBudget: preset?.min ?? undefined,
          maxBudget: preset?.max ?? undefined,
          currency: 'RWF',
          photographerType,
          specialty: eventType?.name,
          photographerSpecialty: specialty,
          locationCoverage: coverage,
          expirationHours: windowHours,
          instructions: notes.trim() || undefined,
          city,
          country: options?.country,
          venue: venue.trim() || undefined,
          latitude: cityInfo?.latitude,
          longitude: cityInfo?.longitude,
        });
      } catch (e) {
        throw { message: `Your event was saved, but photographers weren't alerted: ${isApiError(e) ? e.message : 'please try again'}. Tap Post again to retry.` };
      }
      setResult({ eventId, invited: posted?.invitedCount ?? 0, status: posted?.status });
      setStep('done');
      onPosted?.(eventId);
    } catch (e: any) {
      setError(e?.message || tr('Could not post your event. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    const id = result?.eventId;
    close();
    if (id && result?.invited) setTimeout(() => router.push(`/event/candidates?id=${id}` as never), 200);
  };

  const accent = MODE_META.HYBRID.color;
  const count = preview?.matchCount;
  const zero = count === 0 && !previewLoading;

  // ───────── pieces ─────────

  const Label = ({ text, hint, required }: { text: string; hint?: string; required?: boolean }) => (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.label}>{tr(text)}{required ? <Text style={{ color: accent }}> *</Text> : null}</Text>
      {hint ? <Text style={styles.hint}>{tr(hint)}</Text> : null}
    </View>
  );

  const SelectButton = ({ value, onPress, icon, a11y }: { value: string; onPress: () => void; icon: keyof typeof Ionicons.glyphMap; a11y: string }) => (
    <Pressable onPress={onPress} style={styles.select} accessibilityRole="button" accessibilityLabel={a11y}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.selectText} numberOfLines={1}>{value}</Text>
      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
    </Pressable>
  );

  const MatchPanel = (
    <View style={[styles.matchPanel, zero && { borderColor: colors.pending, backgroundColor: colors.warningBg }]} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ minWidth: 48, alignItems: 'center' }}>
          {previewLoading ? <ActivityIndicator color={colors.primary} /> : (
            <Text style={[styles.matchCount, zero && { color: colors.pending }]}>{count ?? '–'}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle}>
            {previewFailed ? tr("Couldn't count photographers right now") : count === 1 ? tr('photographer fits right now') : tr('photographers fit right now')}
          </Text>
          <Text style={styles.hint}>
            {previewFailed
              ? tr('You can still continue; we check again when you post.')
              : language === 'fr'
                ? `Disponibles pour toute la durée (${durationText(minutes) || 'événement'}). Vérifié à nouveau à la publication.`
                : language === 'es'
                  ? `Libres durante todo el ${durationText(minutes) || 'evento'}. Se verifica de nuevo al publicar.`
                  : language === 'rw'
                    ? `Baboneka igihe cyose (${durationText(minutes) || 'igikorwa'}). Byongera kugenzurwa nutangaza.`
                    : `Free for the whole ${durationText(minutes) || 'event'}. Checked again when you post.`}
          </Text>
        </View>
      </View>
      {preview?.breakdown && !previewLoading ? (
        <View style={{ marginTop: spacing.sm, gap: 4 }}>
          {([
            [preview.breakdown.availableForFullEvent, language === 'fr' ? `disponibles pour toute la durée (${durationText(minutes) || 'événement'})` : language === 'es' ? `libres todo el ${durationText(minutes) || 'evento'}` : language === 'rw' ? `baboneka igihe cyose (${durationText(minutes) || 'igikorwa'})` : `free for the full ${durationText(minutes) || 'event'}`],
            [preview.breakdown.typeMatched, photographerType === 'ANY' ? tr('of any type') : photographerType === 'STUDIO' ? tr('are studios') : tr('are freelancers')],
            [preview.breakdown.withinBudget, preset?.min == null && preset?.max == null ? tr('any budget') : tr('fit your budget')],
            [preview.breakdown.inCoverage, coverage === 'ANY' ? tr('anywhere in Rwanda') : language === 'fr' ? `autour de ${city}` : language === 'es' ? `alrededor de ${city}` : language === 'rw' ? `hafi ya ${city}` : `around ${city}`],
            ...(specialty !== 'ANY' ? [[preview.breakdown.specialtyMatched, `${specialty} specialists`]] : []),
          ] as [number | undefined, string][]).map(([n, l]) => (
            <Text key={l} style={styles.breakdown}>
              <Ionicons name="checkmark-circle" size={13} color={colors.success} /> <Text style={{ fontWeight: fontWeight.bold, color: colors.text }}>{n ?? 0}</Text> {l}
            </Text>
          ))}
          {preview.breakdown.nearbyFallback ? <Text style={styles.breakdown}>Nobody is free in {city}, so nearby cities are included.</Text> : null}
        </View>
      ) : null}
      {zero && options ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[styles.label, { marginBottom: spacing.sm }]}>{tr('Try widening your request:')}</Text>
          <View style={styles.wrap}>
            {coverage !== 'ANY' && <Chip selected={false} icon="location-outline" label={coverage === 'SAME_CITY' ? tr('Include nearby cities') : tr('Anywhere in Rwanda')} onPress={() => setCoverage(coverage === 'SAME_CITY' ? 'NEARBY_CITY' : 'ANY')} />}
            {photographerType !== 'ANY' && <Chip selected={false} icon="people-outline" label={tr('Any type')} onPress={() => setPhotographerType('ANY')} />}
            {specialty !== 'ANY' && <Chip selected={false} icon="camera-outline" label={tr('Any specialty')} onPress={() => setSpecialty('ANY')} />}
            {(preset?.min != null || preset?.max != null) && <Chip selected={false} icon="cash-outline" label={tr('Flexible budget')} onPress={() => setBudgetIndex(options.budgetPresets.length - 1)} />}
          </View>
        </View>
      ) : null}
    </View>
  );

  // ───────── body ─────────

  let body: React.ReactNode = null;
  if (step === 'select') {
    body = (
      <View style={{ gap: spacing.md }}>
        {/* Option 1: Direct Selection */}
        <Pressable
          onPress={goDirect}
          accessibilityRole="button"
          accessibilityLabel={tr('Browse Photographers')}
          style={({ pressed }) => [
            styles.modeCard,
            pressed && styles.modeCardPressed,
          ]}
        >
          <View style={styles.modeCardHeader}>
            <View style={[styles.modeIconBox, { backgroundColor: colors.tint }]}>
              <Ionicons name="camera" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.modeCardTitle}>{tr('Browse Photographers')}</Text>
                <View style={[styles.modeTypePill, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSoft }]}>
                  <Text style={[styles.modeTypePillText, { color: colors.textMuted }]}>{tr('Direct')}</Text>
                </View>
              </View>
              <Text style={styles.modeCardDesc}>
                {tr('Look through portfolios, compare packages, and reach out directly to the photographer you want.')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>

          <View style={styles.modeFeatureList}>
            <View style={styles.modeFeatureItem}>
              <Ionicons name="images-outline" size={14} color={colors.textMuted} />
              <Text style={styles.modeFeatureText}>{tr('See photos, reviews, and package prices')}</Text>
            </View>
            <View style={styles.modeFeatureItem}>
              <Ionicons name="chatbubbles-outline" size={14} color={colors.textMuted} />
              <Text style={styles.modeFeatureText}>{tr('Message and book directly with the creator')}</Text>
            </View>
          </View>
        </Pressable>

        {/* Option 2: Post My Event (Smart Matching) */}
        <Pressable
          onPress={goHybrid}
          accessibilityRole="button"
          accessibilityLabel={tr('Post Your Event')}
          style={({ pressed }) => [
            styles.modeCard,
            styles.modeCardFeatured,
            pressed && styles.modeCardPressed,
          ]}
        >
          <View style={styles.modeCardHeader}>
            <View style={[styles.modeIconBox, { backgroundColor: isDark ? 'rgba(242, 12, 143, 0.16)' : 'rgba(242, 12, 143, 0.08)' }]}>
              <Ionicons name="calendar" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.modeCardTitle}>{tr('Post Your Event')}</Text>
                <View style={[styles.modeTypePill, styles.modeTypePillFeatured]}>
                  <Ionicons name="flash" size={8} color={colors.accent} />
                  <Text style={[styles.modeTypePillText, { color: colors.accent }]}>{tr('Faster')}</Text>
                </View>
              </View>
              <Text style={styles.modeCardDesc}>
                {tr('Share your event date, location, and budget. Photographers who are free will reply, and you choose who you like.')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>

          <View style={styles.modeFeatureList}>
            <View style={styles.modeFeatureItem}>
              <Ionicons name="notifications-outline" size={14} color={colors.textMuted} />
              <Text style={styles.modeFeatureText}>{tr('Photographers who are actually free respond to you')}</Text>
            </View>
            <View style={styles.modeFeatureItem}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.modeFeatureText}>{tr('Saves time — no need to message people one by one')}</Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  } else if (!options && !optionsError) {
    body = <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  } else if (optionsError) {
    body = <Text style={styles.error}>{optionsError}</Text>;
  } else if (options && !options.enabled) {
    body = <Text style={styles.hint}>{tr('Post My Event is paused right now. Use Find a Photographer to book directly.')}</Text>;
  } else if (step === 1 && options) {
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return isoDate(d); })();
    const sat = isoDate(nextWeekday(6));
    const nextSat = isoDate(nextWeekday(6, 1));
    body = (
      <View style={{ gap: spacing.lg }}>
        <View>
          <Label text="What kind of event is it?" required />
          <View style={styles.wrap}>
            {options.eventTypes.map((t) => <Chip key={t.id} selected={eventTypeId === t.id} label={t.name} onPress={() => setEventTypeId(t.id)} />)}
          </View>
        </View>
        <View>
          <Label text="Event name" hint="What guests and photographers will see." required />
          <TextInput value={title} onChangeText={setTitle} maxLength={120} style={styles.input} placeholderTextColor={colors.textMuted}
            placeholder={eventType ? `e.g. ${eventType.name} celebration` : tr('e.g. Birthday Celebration')} returnKeyType="done" />
          {eventType && !title ? (
            <View style={[styles.wrap, { marginTop: spacing.sm }]}>
              {[`${eventType.name} celebration`, `${eventType.name} party`, `Our ${eventType.name.toLowerCase()}`].map((s) => (
                <Chip key={s} selected={false} icon="flash-outline" label={s} onPress={() => setTitle(s)} />
              ))}
            </View>
          ) : null}
        </View>
        <View>
          <Label text="When is it?" required />
          <View style={styles.wrap}>
            <Chip selected={date === tomorrow} label={tr('Tomorrow')} onPress={() => setDate(tomorrow)} />
            <Chip selected={date === sat} label={tr('This Saturday')} onPress={() => setDate(sat)} />
            <Chip selected={date === nextSat} label={tr('Next Saturday')} onPress={() => setDate(nextSat)} />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <SelectButton icon="calendar-outline" value={date ? prettyDate(date) : tr('Pick a date')} onPress={() => setDatePickerOpen(true)} a11y={tr('Pick a date')} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Label text="Starts" required />
            <SelectButton icon="time-outline" value={startTime} onPress={() => setListSheet('start')} a11y={`${tr('Starts')} ${startTime}`} />
          </View>
          <View style={{ flex: 1 }}>
            <Label text="Ends" required />
            <SelectButton icon="time-outline" value={`${endTime}${overnight ? tr(' (+1 day)') : ''}`} onPress={() => setListSheet('end')} a11y={`${tr('Ends')} ${endTime}`} />
          </View>
        </View>
        <View style={styles.durationPill}>
          <Ionicons name="hourglass-outline" size={15} color={accent} />
          <Text style={{ color: accent, fontWeight: fontWeight.extrabold }}>{durationText(minutes)}{overnight ? tr(' · ends next day') : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Label text="City" required />
            <SelectButton icon="location-outline" value={city} onPress={() => setListSheet('city')} a11y={`${tr('City')} ${city}`} />
          </View>
          <View style={{ flex: 1 }}>
            <Label text="Country" />
            <View style={[styles.select, { opacity: 0.7 }]}><Ionicons name="flag-outline" size={16} color={colors.primary} /><Text style={styles.selectText}>{options.country}</Text></View>
          </View>
        </View>
        <View>
          <Label text="Venue or address" hint="A venue name, street or landmark." required />
          <TextInput value={venue} onChangeText={setVenue} maxLength={200} style={styles.input} placeholder={tr('e.g. Kigali Convention Centre')} placeholderTextColor={colors.textMuted} />
        </View>
        <View>
          <Label text="Notes for photographers" hint="Optional: shots you want, indoor or outdoor, dress code." />
          <TextInput value={notes} onChangeText={setNotes} maxLength={600} multiline style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholderTextColor={colors.textMuted} />
        </View>
        <WishInvitesField
          value={wishInvites}
          containerRef={fieldRef}
          error={wishInvitesErr}
          onChange={(v) => {
            setWishInvites(v);
            setWishInvitesErr(null);
            setError(null);
          }}
        />
      </View>
    );
  } else if (step === 2 && options) {
    body = (
      <View style={{ gap: spacing.lg }}>
        {MatchPanel}
        <View>
          <Label text="Photographer type" />
          <View style={{ gap: spacing.sm }}>
            {options.photographerTypes.map((t) => (
              <OptionCard key={t.value} selected={photographerType === t.value} onPress={() => setPhotographerType(t.value)} title={t.label} description={t.description}
                icon={t.value === 'STUDIO' ? 'business-outline' : t.value === 'FREELANCER' ? 'person-outline' : 'people-outline'} />
            ))}
          </View>
        </View>
        <View>
          <Label text="Budget" hint="Photographers whose packages fit this range are alerted." />
          <View style={styles.wrap}>
            {options.budgetPresets.map((p, i) => <Chip key={p.label} selected={budgetIndex === i} label={p.label} onPress={() => setBudgetIndex(i)} />)}
          </View>
        </View>
        <View>
          <Label text="Photographer specialty" hint="Choose one only if it must be a specialist." />
          <View style={styles.wrap}>
            {options.photographerSpecialties.map((s) => <Chip key={s.value} selected={specialty === s.value} label={s.label} onPress={() => setSpecialty(s.value)} />)}
          </View>
        </View>
        <View>
          <Label text="Where can the photographer come from?" />
          <View style={{ gap: spacing.sm }}>
            {options.coverageOptions.map((c) => (
              <OptionCard key={c.value} selected={coverage === c.value} onPress={() => setCoverage(c.value)}
                title={c.value === 'SAME_CITY' ? `${city} only` : c.label} description={c.description}
                icon={c.value === 'SAME_CITY' ? 'location-outline' : c.value === 'NEARBY_CITY' ? 'git-branch-outline' : 'map-outline'} />
            ))}
          </View>
        </View>
        <View>
          <Label text="Collect answers for" hint="After this, you choose from whoever said yes." />
          <View style={styles.wrap}>
            {options.matchWindowHours.map((h) => <Chip key={h} selected={windowHours === h} label={language === 'fr' ? `${h} heures` : language === 'es' ? `${h} horas` : language === 'rw' ? `amasaha ${h}` : `${h} hours`} onPress={() => setWindowHours(h)} />)}
          </View>
        </View>
      </View>
    );
  } else if (step === 3 && options) {
    const typeLabel = options.photographerTypes.find((t) => t.value === photographerType)?.label;
    const coverageLabel = options.coverageOptions.find((c) => c.value === coverage)?.label;
    const rows: [keyof typeof Ionicons.glyphMap, string, string][] = [
      ['sparkles-outline', tr('EVENT'), `${title}${eventType ? ` · ${eventType.name}` : ''}`],
      ['calendar-outline', tr('WHEN'), `${prettyDate(date)} · ${startTime}–${endTime} · ${durationText(minutes)}${overnight ? tr(' · ends next day') : ''}`],
      ['location-outline', tr('WHERE'), `${venue}, ${city}, ${options.country}`],
      ['person-outline', tr('LOOKING FOR'), `${typeLabel}${specialty !== 'ANY' ? ` · ${specialty} specialist` : ''} · ${coverageLabel}`],
      ['cash-outline', tr('BUDGET'), budgetLabel(preset?.min, preset?.max) || tr('Flexible')],
      ['time-outline', tr('COLLECT ANSWERS FOR'), language === 'fr' ? `${windowHours} heures` : language === 'es' ? `${windowHours} horas` : language === 'rw' ? `amasaha ${windowHours}` : `${windowHours} hours`],
    ];
    body = (
      <View style={{ gap: spacing.lg }}>
        <View style={styles.summary}>
          {rows.map(([icon, k, v]) => (
            <View key={k} style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: 6 }}>
              <Ionicons name={icon} size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryKey}>{k}</Text>
                <Text style={styles.summaryVal}>{v}</Text>
              </View>
            </View>
          ))}
        </View>
        {MatchPanel}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>{tr('What happens next')}</Text>
          {([
            ['radio-outline', language === 'fr' ? `Les photographes les mieux adaptés (jusqu'à ${options.firstBatchSize}) sont alertés immédiatement.` : language === 'es' ? `Los fotógrafos que mejor encajan (hasta ${options.firstBatchSize}) reciben una alerta de inmediato.` : language === 'rw' ? `Abafotozi bahuye neza n'ibyo usaba (kugeza kuri ${options.firstBatchSize}) bamenyeshwa ako kanya.` : `The best-matched photographers (up to ${options.firstBatchSize}) are alerted right away.`],
            ['thumbs-up-outline', language === 'fr' ? `Chacun dispose de ${durationText(options.inviteWindowMinutes)} pour dire oui ; tout refus est remplacé par le suivant.` : language === 'es' ? `Cada uno tiene ${durationText(options.inviteWindowMinutes)} para decir que sí; quien pase es reemplazado por el siguiente.` : language === 'rw' ? `Buri wese afite ${durationText(options.inviteWindowMinutes)} yo kwemeza; utabyemeye asimburwa n'ukurikiraho.` : `Each has ${durationText(options.inviteWindowMinutes)} to say yes; anyone who passes is replaced by the next best match.`],
            ['people-outline', tr('Only photographers who said yes appear for you, grouped as top, good and possible matches, three of each.')],
            ['shield-checkmark-outline', tr('You choose one and pay 50%, 70% or 100% upfront. Connekyt holds it until delivery.')],
          ] as [keyof typeof Ionicons.glyphMap, string][]).map(([icon, t]) => (
            <View key={t} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={styles.nextIcon}><Ionicons name={icon} size={14} color={colors.primary} /></View>
              <Text style={[styles.modeStep, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
          <Text style={styles.hint}>{tr('Your event stays private. It only appears publicly once a photographer is booked.')}</Text>
        </View>
      </View>
    );
  } else if (step === 'done' && result) {
    const failed = !result.invited || result.status === 'MATCHING_FAILED';
    body = (
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl }}>
        <View style={[styles.doneIcon, { backgroundColor: failed ? colors.warningBg : MODE_META.HYBRID.soft }]}>
          <Ionicons name={failed ? 'alert' : 'radio-outline'} size={34} color={failed ? colors.pending : accent} />
        </View>
        <Text style={styles.doneTitle}>
          {failed
            ? tr('Saved, but nobody fits right now')
            : language === 'fr'
              ? `${result.invited} photographe${result.invited === 1 ? ' a été alerté' : 's ont été alertés'}`
              : language === 'es'
                ? `Se alertó a ${result.invited} fotógrafo${result.invited === 1 ? '' : 's'}`
                : language === 'rw'
                  ? `${result.invited === 1 ? 'Gafotozi 1 yamenyeshejwe' : `Abafotozi ${result.invited} bamenyeshejwe`}`
                  : `${result.invited} photographer${result.invited === 1 ? ' was' : 's were'} alerted`}
        </Text>
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          {failed
            ? tr('Your event is saved privately. Post it again with a wider area or budget, or use Find a Photographer to book one yourself.')
            : tr("We'll notify you each time a photographer says yes.")}
        </Text>
      </View>
    );
  }

  const headerTitle = step === 'select' ? tr('How would you like to book?') : step === 1 ? tr('Tell us about your event')
    : step === 2 ? tr('Who should we look for?') : step === 3 ? tr('Review and post') : tr('Your event is posted');
  const canPublish = !submitting && count !== 0 && options?.enabled !== false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={step === 'done' ? finish : close}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Native Sheet Grab Handle */}
        <View style={styles.sheetHandleContainer}>
          <View style={styles.sheetHandle} />
        </View>

        <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? insets.top + spacing.sm : spacing.xs }]}>
          <View style={{ flex: 1, gap: 2 }}>
            {typeof step === 'number' && (
              <Text style={[styles.eyebrow, { color: accent }]}>
                {language === 'fr' ? `ÉTAPE ${step} SUR 3` : language === 'es' ? `PASO ${step} DE 3` : language === 'rw' ? `INTAMBWE YA ${step} KURI 3` : `STEP ${step} OF 3`}
              </Text>
            )}
            <Text style={styles.headerTitle} accessibilityRole="header">{headerTitle}</Text>
            {step === 'select' && (
              <Text style={styles.headerSubtitle}>{tr('Pick someone yourself, or let available photographers come to you.')}</Text>
            )}
          </View>
          <Pressable onPress={step === 'done' ? finish : close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={colors.textSoft} />
          </Pressable>
        </View>
        {typeof step === 'number' && (
          <View style={styles.progress}>
            <ProgressTrack
              label="Posting your event"
              steps={WIZARD_STEPS.map((s) => ({ key: s.label, label: s.label, state: step > s.n ? 'done' : step === s.n ? 'current' : 'todo' }))}
            />
          </View>
        )}
        <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md }} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {body}
        </ScrollView>
        {step !== 'select' && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {step === 'done' ? (
              <Pressable onPress={finish} style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.primary }]} accessibilityRole="button">
                <Text style={styles.primaryText}>{result?.invited ? tr('Follow the answers') : tr('Done')}</Text>
              </Pressable>
            ) : (
              <>
                {!(existingEvent && step === 2) && (
                  <Pressable onPress={back} style={styles.secondaryBtn} accessibilityRole="button" accessibilityLabel="Back">
                    <Ionicons name="arrow-back" size={18} color={colors.textSoft} />
                  </Pressable>
                )}
                {step !== 3 ? (
                  <Pressable onPress={next} disabled={!options} style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.primary }]} accessibilityRole="button">
                    <Text style={styles.primaryText}>{tr('Continue')}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={publish} disabled={!canPublish} accessibilityRole="button" accessibilityState={{ disabled: !canPublish }}
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: canPublish ? accent : colors.surfaceMuted }]}>
                    {submitting ? <ActivityIndicator color={onFill} /> : (
                      <Text style={[styles.primaryText, !canPublish && { color: colors.textMuted }]}>
                        {count === 0 ? tr('Widen your request first') : tr('Post and alert photographers')}
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        <DateTimePickerModal
          isVisible={datePickerOpen}
          mode="date"
          minimumDate={new Date()}
          date={date ? new Date(`${date}T12:00:00`) : new Date()}
          onConfirm={(d) => { setDatePickerOpen(false); setDate(isoDate(d)); }}
          onCancel={() => setDatePickerOpen(false)}
        />

        <Modal visible={listSheet !== null} transparent animationType="fade" onRequestClose={() => setListSheet(null)}>
          <GlassScrim style={styles.scrim} onPress={() => setListSheet(null)}>
            <GlassSheetHost style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
              <SheetCornerClose onPress={() => setListSheet(null)} />
              <Text style={[styles.label, { marginBottom: spacing.sm }]}>
                {listSheet === 'start' ? tr('Start time') : listSheet === 'end' ? tr('End time') : tr('City')}
              </Text>
              <FlatList
                data={listSheet === 'city' ? (options?.cities.map((c) => c.name) ?? []) : listSheet === 'end' ? slots.filter((s) => s !== startTime) : slots}
                keyExtractor={(s) => s}
                initialScrollIndex={undefined}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => {
                  const on = (listSheet === 'start' && item === startTime) || (listSheet === 'end' && item === endTime) || (listSheet === 'city' && item === city);
                  const extra = listSheet === 'end' ? ` · ${durationText(durationBetween(startTime, item))}${item <= startTime ? tr(' (next day)') : ''}` : '';
                  return (
                    <Pressable
                      onPress={() => {
                        if (listSheet === 'start') setStartTime(item);
                        else if (listSheet === 'end') setEndTime(item);
                        else setCity(item);
                        setListSheet(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.listRow, on && { backgroundColor: colors.tint }]}
                    >
                      <Text style={[styles.listText, on && { color: colors.primary, fontWeight: fontWeight.bold }]}>{item}{extra}</Text>
                      {on && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </Pressable>
                  );
                }}
              />
            </GlassSheetHost>
          </GlassScrim>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  sheetHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: c.borderSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.9,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    ...glassTile(c),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  progress: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 19,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  hint: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 17,
  },
  error: {
    color: c.error,
    backgroundColor: c.errorBg,
    padding: spacing.md,
    borderRadius: radii.md,
    fontSize: fontSize.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.card,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    backgroundColor: c.card,
  },
  selectText: {
    flex: 1,
    fontSize: fontSize.md,
    color: c.text,
    fontWeight: fontWeight.semibold,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242,12,143,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  matchPanel: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...e(1),
  },
  matchCount: {
    fontSize: 34,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    fontVariant: ['tabular-nums'],
  },
  matchTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  breakdown: {
    fontSize: fontSize.xs,
    color: c.textSoft,
  },

  // Redesigned Mode Cards
  modeCard: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.card,
    ...e(1),
  },
  modeCardFeatured: {
    borderColor: 'rgba(242, 12, 143, 0.28)',
    backgroundColor: c.card,
    ...e(1),
  },
  modeCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modeIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeCardTitle: {
    fontSize: 16.5,
    fontWeight: fontWeight.bold,
    color: c.text,
    letterSpacing: -0.3,
  },
  modeTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  modeTypePillFeatured: {
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    borderColor: 'rgba(242, 12, 143, 0.22)',
  },
  modeTypePillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  modeCardDesc: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18.5,
  },
  modeFeatureList: {
    gap: 7,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  modeFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeFeatureText: {
    fontSize: 12.5,
    color: c.textSoft,
  },

  // Summary & Review
  summary: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: c.card,
  },
  summaryKey: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.6,
  },
  summaryVal: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  nextIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeStep: {
    fontSize: fontSize.sm,
    color: c.textSoft,
    lineHeight: 19,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    ...glassTile(c),
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    ...e(1),
  },
  primaryText: {
    color: c.textOnPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
  },
  secondaryBtn: {
    width: 52,
    minHeight: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...glassTile(c),
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: spacing.lg,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  listText: {
    fontSize: fontSize.md,
    color: c.text,
  },
}));

// Kept for older imports; amount formatting now lives in @/utils/amount.
export { formatAmountWithCommas, parseAmountNumber } from '@/utils/amount';
