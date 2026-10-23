import { StyleSheet, Text, View } from 'react-native';
import { statusTone } from '@/features/payments/statusBucket';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme, type Palette } from '@/theme';

const STATUS_TRANSLATIONS: Record<string, { fr: string; es: string; rw: string; sw: string }> = {
  COMPLETED: { fr: 'Terminé', es: 'Completado', rw: 'Byakozwe', sw: 'Imekamilika' },
  PAID: { fr: 'Payé', es: 'Pagado', rw: 'Byishyuwe', sw: 'Imelipwa' },
  SUCCESS: { fr: 'Réussi', es: 'Exitoso', rw: 'Byakunze', sw: 'Mafanikio' },
  SUCCESSFUL: { fr: 'Réussi', es: 'Exitoso', rw: 'Byakunze', sw: 'Imefanikiwa' },
  APPROVED: { fr: 'Approuvé', es: 'Aprobado', rw: 'Byemejwe', sw: 'Imeidhinishwa' },
  ACCEPTED: { fr: 'Accepté', es: 'Aceptado', rw: 'Byemewe', sw: 'Imekubaliwa' },
  CONFIRMED: { fr: 'Confirmé', es: 'Confirmado', rw: 'Byemejwe', sw: 'Imethibitishwa' },
  ACTIVE: { fr: 'Actif', es: 'Activo', rw: 'Birakora', sw: 'Inafanya kazi' },
  PUBLISHED: { fr: 'Publié', es: 'Publicado', rw: 'Byatangajwe', sw: 'Imechapishwa' },
  PENDING: { fr: 'En attente', es: 'Pendiente', rw: 'Bitegereje', sw: 'Inasubiri' },
  PROCESSING: { fr: 'En cours', es: 'Procesando', rw: 'Birimo gukorwa', sw: 'Inashughulikiwa' },
  UPCOMING: { fr: 'À venir', es: 'Próximo', rw: 'Ibiri imbere', sw: 'Inayokuja' },
  ONGOING: { fr: 'En cours', es: 'En curso', rw: 'Birimo kuba', sw: 'Inaendelea' },
  DRAFT: { fr: 'Brouillon', es: 'Borrador', rw: 'Agateganyo', sw: 'Rasimu' },
  FAILED: { fr: 'Échoué', es: 'Fallido', rw: 'Byanze', sw: 'Imeshindwa' },
  REJECTED: { fr: 'Refusé', es: 'Rechazado', rw: 'Byanzwe', sw: 'Imekataliwa' },
  DECLINED: { fr: 'Refusé', es: 'Rechazado', rw: 'Byanzwe', sw: 'Imekataliwa' },
  CANCELLED: { fr: 'Annulé', es: 'Cancelado', rw: 'Byahagaritswe', sw: 'Imeghairiwa' },
  CANCELED: { fr: 'Annulé', es: 'Cancelado', rw: 'Byahagaritswe', sw: 'Imeghairiwa' },
  EXPIRED: { fr: 'Expiré', es: 'Expirado', rw: 'Byarangiye igihe', sw: 'Imeisha muda' },
  REFUNDED: { fr: 'Remboursé', es: 'Reembolsado', rw: 'Byasubijwe', sw: 'Imerudishwa' },
  PARTIALLY_PAID: { fr: 'Partiellement payé', es: 'Parcialmente pagado', rw: 'Byishyuwe igice', sw: 'Imelipwa kiasi' },
};

/**
 * Maps a free-form status string to a colour family.
 * Takes the palette as an argument rather than closing over the static import,
 * because a plain helper cannot call `useTheme()`.
 */
function tone(c: Palette, status?: string): { bg: string; fg: string } {
  switch (statusTone(status)) {
    case 'success': return { bg: c.successBg, fg: c.success };
    case 'warning': return { bg: c.warningBg, fg: c.warning };
    case 'error': return { bg: c.errorBg, fg: c.error };
    default: return { bg: c.infoBg, fg: c.info };
  }
}

export function StatusPill({ status }: { status?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { language } = useLanguage();
  if (!status) return null;
  const { bg, fg } = tone(colors, status);
  const key = status.trim().toUpperCase().replace(/\s+/g, '_');
  const translated =
    language !== 'en' && STATUS_TRANSLATIONS[key]
      ? STATUS_TRANSLATIONS[key][language]
      : status;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{translated}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  text: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'capitalize' },
}));
