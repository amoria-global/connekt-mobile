import { StyleSheet, Text, View } from 'react-native';
import { statusTone } from '@/features/payments/statusBucket';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme, type Palette } from '@/theme';

const STATUS_TRANSLATIONS: Record<string, { fr: string; es: string }> = {
  COMPLETED: { fr: 'Terminé', es: 'Completado' },
  PAID: { fr: 'Payé', es: 'Pagado' },
  SUCCESS: { fr: 'Réussi', es: 'Exitoso' },
  SUCCESSFUL: { fr: 'Réussi', es: 'Exitoso' },
  APPROVED: { fr: 'Approuvé', es: 'Aprobado' },
  ACCEPTED: { fr: 'Accepté', es: 'Aceptado' },
  CONFIRMED: { fr: 'Confirmé', es: 'Confirmado' },
  ACTIVE: { fr: 'Actif', es: 'Activo' },
  PUBLISHED: { fr: 'Publié', es: 'Publicado' },
  PENDING: { fr: 'En attente', es: 'Pendiente' },
  PROCESSING: { fr: 'En cours', es: 'Procesando' },
  UPCOMING: { fr: 'À venir', es: 'Próximo' },
  ONGOING: { fr: 'En cours', es: 'En curso' },
  DRAFT: { fr: 'Brouillon', es: 'Borrador' },
  FAILED: { fr: 'Échoué', es: 'Fallido' },
  REJECTED: { fr: 'Refusé', es: 'Rechazado' },
  DECLINED: { fr: 'Refusé', es: 'Rechazado' },
  CANCELLED: { fr: 'Annulé', es: 'Cancelado' },
  CANCELED: { fr: 'Annulé', es: 'Cancelado' },
  EXPIRED: { fr: 'Expiré', es: 'Expirado' },
  REFUNDED: { fr: 'Remboursé', es: 'Reembolsado' },
  PARTIALLY_PAID: { fr: 'Partiellement payé', es: 'Parcialmente pagado' },
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
