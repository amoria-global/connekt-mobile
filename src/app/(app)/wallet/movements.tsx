/**
 * Wallet movements used to be a second copy of the Transactions screen (same
 * feed, same filters). Kept only so old links and deep links still resolve.
 */
import { Redirect, type Href } from 'expo-router';

import { useLanguage } from '@/hooks/useLanguage';

export default function WalletMovementsRedirect() {
  const { t } = useLanguage();
  return <Redirect href={'/transactions' as Href} />;
}
