import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Onboarding splash route.
 * Automatically forwards to `/welcome` because the branded video preloader has
 * already presented during the initial app launch cycle.
 */
export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/welcome');
  }, [router]);

  return null;
}
