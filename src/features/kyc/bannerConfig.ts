import type { CustomerType } from '@/features/auth/types';
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
      title: 'KYC Needs Attention',
      badge: 'Action Required',
      detail: 'Your submission was not accepted. Tap to review & resubmit.',
      buttonText: 'Resubmit',
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
      title: 'KYC Under Review',
      badge: 'In Review',
      detail: "We're reviewing your details. This typically takes a few hours.",
      buttonText: 'Check status',
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
    title: 'Complete KYC',
    badge: isOptional ? 'Optional' : 'Recommended',
    detail: 'Verify your identity to unlock full features & trusted status.',
    buttonText: 'Verify',
    accent: palette.primary,
    badgeBg: palette.tint,
    badgeColor: palette.primary,
    tint: palette.tint,
    icon: 'shield-checkmark-outline',
  };
}
