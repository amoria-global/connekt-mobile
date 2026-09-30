/**
 * In-app checkout for the JWT-gated payments: a booking's outstanding balance
 * and the archive unlock fee. Mints the handoff token, then starts the charge
 * through the same public endpoint the connekyt.com receiver uses. The amount
 * shown is display only; the server derives what is charged.
 */
import { useEffect, useRef } from 'react';
import { CheckoutSheet, type StartInput } from '@/features/payments/CheckoutSheet';
import {
  initiateHandoffPayment,
  mintHandoffToken,
  type HandoffRef,
} from '@/features/payments/nativeCheckout';

export function HandoffCheckoutSheet({
  visible,
  onClose,
  onSettled,
  handoff,
  title,
  subtitle,
  amountLabel,
}: {
  visible: boolean;
  onClose: () => void;
  /** Fires once when the payment is confirmed, so the caller can refresh. */
  onSettled?: () => void;
  handoff: HandoffRef | null;
  title: string;
  subtitle?: string;
  /** Display only. The server decides what is charged. */
  amountLabel?: string;
}) {
  const tokenRef = useRef<string | null>(null);
  const resetKey = `${handoff?.type ?? ''}:${handoff?.declarationId ?? ''}:${handoff?.eventId ?? ''}`;

  // A new payment gets a new token.
  useEffect(() => {
    tokenRef.current = null;
  }, [resetKey, visible]);

  if (!handoff) return null;

  const start = async (input: StartInput) => {
    // Reuse the token across retries: it stays valid until expiry and the
    // server refuses a second charge once the declaration is settled.
    if (!tokenRef.current) tokenRef.current = await mintHandoffToken(handoff);
    return initiateHandoffPayment(tokenRef.current, input);
  };

  return (
    <CheckoutSheet
      visible={visible}
      onClose={onClose}
      onSettled={onSettled}
      resetKey={resetKey}
      start={start}
      title={title}
      subtitle={subtitle}
      amountLabel={amountLabel}
    />
  );
}
