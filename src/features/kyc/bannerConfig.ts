import type { CustomerType } from '@/features/auth/types';
import { useLanguage } from '@/store/language';
import type { Palette } from '@/theme';

export type KycBannerConfig = {
  visible: boolean;
  title: string;
  badge: string;
  detail: string;
  buttonText: string;
  accent: string;
  badgeBg: string;
  badgeColor: string;
  tint: string;
  icon: 'shield-checkmark-outline' | 'time-outline' | 'alert-circle-outline';
};

/**
 * Pure configuration derivation for the KYC banner based on verification status,
 * user role, and color palette.
 */
export function getKycBannerConfig(
  status: string | undefined,
  role: CustomerType | undefined,
  palette: Palette,
): KycBannerConfig {
  const raw = (status ?? 'NONE').toUpperCase();
  const normStatus = raw === 'NOT_SUBMITTED' ? 'NONE' : raw;
  const lang = useLanguage.getState().language;

  // Approved users don't need any prompt; Viewers do not have a KYC workflow.
  if (normStatus === 'APPROVED' || role === 'Viewer') {
    return {
      visible: false,
      title: '',
      badge: '',
      detail: '',
      buttonText: '',
      accent: '',
      badgeBg: '',
      badgeColor: '',
      tint: '',
      icon: 'shield-checkmark-outline',
    };
  }

  const isPending = normStatus === 'PENDING';
  const isRejected = normStatus === 'REJECTED';

  if (isRejected) {
    return {
      visible: true,
      title:
        lang === 'fr'
          ? 'KYC requiert votre attention'
          : lang === 'es'
            ? 'KYC requiere atención'
            : 'KYC Needs Attention',
      badge:
        lang === 'fr'
          ? 'Action requise'
          : lang === 'es'
            ? 'Acción requerida'
            : 'Action Required',
      detail:
        lang === 'fr'
          ? "Votre soumission n'a pas été acceptée. Appuyez pour vérifier et soumettre à nouveau."
          : lang === 'es'
            ? 'Tu envío no fue aceptado. Toca para revisar y volver a enviar.'
            : 'Your submission was not accepted. Tap to review & resubmit.',
      buttonText:
        lang === 'fr' ? 'Soumettre à nouveau' : lang === 'es' ? 'Reenviar' : 'Resubmit',
      accent: palette.error,
      badgeBg: 'rgba(239, 68, 68, 0.12)',
      badgeColor: palette.error,
      tint: 'rgba(239, 68, 68, 0.10)',
      icon: 'alert-circle-outline',
    };
  }

  if (isPending) {
    return {
      visible: true,
      title:
        lang === 'fr'
          ? 'KYC en cours de vérification'
          : lang === 'es'
            ? 'KYC en revisión'
            : 'KYC Under Review',
      badge: lang === 'fr' ? 'En révision' : lang === 'es' ? 'En revisión' : 'In Review',
      detail:
        lang === 'fr'
          ? 'Nous vérifions vos informations. Cela prend généralement quelques heures.'
          : lang === 'es'
            ? 'Estamos revisando tus datos. Esto suele tardar unas horas.'
            : "We're reviewing your details. This typically takes a few hours.",
      buttonText:
        lang === 'fr' ? 'Voir le statut' : lang === 'es' ? 'Ver estado' : 'Check status',
      accent: '#3B82F6',
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      badgeColor: '#2563EB',
      tint: 'rgba(59, 130, 246, 0.10)',
      icon: 'time-outline',
    };
  }

  // Not submitted (NONE / empty)
  const isOptional = role !== 'Photographer';
  return {
    visible: true,
    title:
      lang === 'fr' ? 'Compléter le KYC' : lang === 'es' ? 'Completar KYC' : 'Complete KYC',
    badge: isOptional
      ? lang === 'fr'
        ? 'Optionnel'
        : lang === 'es'
          ? 'Opcional'
          : 'Optional'
      : lang === 'fr'
        ? 'Recommandé'
        : lang === 'es'
          ? 'Recomendado'
          : 'Recommended',
    detail:
      lang === 'fr'
        ? 'Vérifiez votre identité pour débloquer toutes les fonctionnalités et le badge vérifié.'
        : lang === 'es'
          ? 'Verifica tu identidad para desbloquear todas las funciones y el estado verificado.'
          : 'Verify your identity to unlock full features & trusted status.',
    buttonText: lang === 'fr' ? 'Vérifier' : lang === 'es' ? 'Verificar' : 'Verify',
    accent: palette.primary,
    badgeBg: palette.tint,
    badgeColor: palette.primary,
    tint: palette.tint,
    icon: 'shield-checkmark-outline',
  };
}
