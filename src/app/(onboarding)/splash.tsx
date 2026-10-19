import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useLanguage } from '@/hooks/useLanguage';

/**
 * Onboarding splash route.
 * Automatically forwards to `/welcome` because the branded video preloader has
 * already presented during the initial app launch cycle.
 */
export default function SplashScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    router.replace('/welcome');
  }, [router]);

  return null;
}
