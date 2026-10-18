import React from 'react';
import { useRouter } from 'expo-router';
import { BookingModeSelector } from '@/features/booking/BookingModeSelector';

import { useLanguage } from '@/hooks/useLanguage';

export default function HybridWizardScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <BookingModeSelector
      visible={true}
      initialStep={1}
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/' as never);
        }
      }}
    />
  );
}
