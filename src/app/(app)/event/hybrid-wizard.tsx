import React from 'react';
import { useRouter } from 'expo-router';
import { BookingModeSelector } from '@/features/booking/BookingModeSelector';

export default function HybridWizardScreen() {
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
