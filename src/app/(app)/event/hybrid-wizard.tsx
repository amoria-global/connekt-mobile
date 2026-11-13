import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookingModeSelector } from '@/features/booking/BookingModeSelector';

import { useLanguage } from '@/hooks/useLanguage';

export default function HybridWizardScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();

  return (
    <BookingModeSelector
      visible={true}
      initialStep={params.step === 'select' ? 'select' : 'session'}
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
