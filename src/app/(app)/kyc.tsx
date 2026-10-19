import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  getChallengeToken,
  getKyc,
  openWebKycFlow,
  submitKyc,
} from '@/features/kyc/api';
import { KycVerifyFlow } from '@/features/kyc/KycVerifyFlow';
import { ensureKycConsent } from '@/features/privacy/consent';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';

import { useLanguage } from '@/hooks/useLanguage';

/**
 * Identity verification. Opened straight from the home banner's Verify button
 * as a full, flat page; the flow itself lives in `KycVerifyFlow`.
 */
export default function KycScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { data, loading, error, refresh } = useAsync(useCallback(() => getKyc(), []));

  const exit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const openWeb = useCallback(async () => {
    if (!(await ensureKycConsent())) return;
    await openWebKycFlow();
    // The browser resolves once it is closed; read back whatever happened there.
    void refresh();
  }, [refresh]);

  return (
    <KycVerifyFlow
      kyc={data}
      loading={loading}
      error={error}
      defaultName={[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
      defaultPhone={user?.phone}
      onRefresh={refresh}
      onExit={exit}
      onOpenWeb={openWeb}
      getChallengeToken={getChallengeToken}
      submit={submitKyc}
    />
  );
}
