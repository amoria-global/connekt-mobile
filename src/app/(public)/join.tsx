import { useEffect } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { parseReferralCode } from '@/features/referral/referral';

/**
 * connekyt://join?ref=CODE (and connekyt.com/join?ref=CODE once the link opens the app). A signed-in photographer goes
 * to Preferences with the code prefilled in "Add a referral code"; everyone else lands on the photographer sign-up
 * with the code filled in.
 */
export default function JoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const { isPhotographer } = useRole();
  const code = parseReferralCode(typeof params.ref === 'string' ? params.ref : '') ?? '';

  useEffect(() => {
    if (isPhotographer) {
      router.replace({ pathname: '/preferences', params: { referral: '1', ...(code ? { ref: code } : {}) } } as unknown as Href);
    } else {
      router.replace({ pathname: '/signup', params: { role: 'Photographer', ...(code ? { ref: code } : {}) } } as unknown as Href);
    }
  }, [isPhotographer, code, router]);

  return <Screen>{null}</Screen>;
}
