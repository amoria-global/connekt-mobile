import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Role selection is unified as a native bottom sheet modal on the Login page.
 * Direct navigation to /choose-role seamlessly redirects to /login with the role sheet open.
 */
export default function ChooseRoleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    router.replace({
      pathname: '/login',
      params: { ...params, selectRole: '1' },
    });
  }, [params, router]);

  return null;
}
