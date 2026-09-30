/**
 * Wallet movements used to be a second copy of the Transactions screen (same
 * feed, same filters). Kept only so old links and deep links still resolve.
 */
import { Redirect, type Href } from 'expo-router';

export default function WalletMovementsRedirect() {
  return <Redirect href={'/transactions' as Href} />;
}
