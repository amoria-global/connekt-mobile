import { statusTone } from '@/features/payments/statusBucket';
import { useLanguage } from '@/store/language';
import { StatusChip, type ChipTone } from './StatusChip';

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

/** Statuses that mean "happening now" take the live cyan, not the generic info blue. */
const LIVE = new Set(['ONGOING', 'LIVE', 'IN_PROGRESS', 'STREAMING']);

/** Maps a free-form status string to a chip tone (blue action, amber pending, cyan live). */
export function statusChipTone(status?: string): ChipTone {
  const key = (status ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (LIVE.has(key)) return 'live';
  switch (statusTone(status)) {
    case 'success': return 'success';
    case 'warning': return 'pending';
    case 'error': return 'error';
    default: return 'primary';
  }
}

export function StatusPill({ status }: { status?: string }) {
  const { language } = useLanguage();
  if (!status) return null;
  const key = status.trim().toUpperCase().replace(/\s+/g, '_');
  const translated =
    language !== 'en' && STATUS_TRANSLATIONS[key]
      ? STATUS_TRANSLATIONS[key][language]
      : status;
  // Capitalised here rather than by textTransform, which StatusChip does not apply.
  const label = translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
  return <StatusChip label={label} tone={statusChipTone(status)} dot />;
}
