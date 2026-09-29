import type { Role } from '@/features/auth/role';

/**
 * The Payments screen is the "you owe" view (total spending, pending, Pay Now).
 * Photographers only receive payments, and their view of that money is
 * Transactions and the wallet, so they must never be sent to Payments. Other
 * roles keep the access they had.
 */
export function canUsePaymentsScreen(role: Role | undefined): boolean {
  return role !== 'Photographer';
}
