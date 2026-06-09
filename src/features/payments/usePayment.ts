/**
 * Drives a full payment: initiate → open the gateway in a browser →
 * poll the status until it resolves. Returns a friendly outcome.
 */
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { isApiError } from '@/store/auth';
import { getPaymentStatus, initiatePayment, type PaymentInput, type PaymentStatus } from './api';

type PayState = {
  paying: boolean;
  error: string | null;
  pay: (input: PaymentInput) => Promise<PaymentStatus | null>;
};

const POLL_ATTEMPTS = 8;
const POLL_DELAY_MS = 2000;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function usePayment(): PayState {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (input: PaymentInput): Promise<PaymentStatus | null> => {
    setPaying(true);
    setError(null);
    try {
      const { refId, redirectUrl } = await initiatePayment(input);

      if (redirectUrl) {
        await WebBrowser.openBrowserAsync(redirectUrl);
      }

      if (!refId) {
        // No reference to poll — assume the gateway handled it out of band.
        return 'pending';
      }

      // Poll for a final status after the user returns from the gateway.
      let status: PaymentStatus = 'pending';
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        status = await getPaymentStatus(refId);
        if (status !== 'pending') break;
        await wait(POLL_DELAY_MS);
      }
      return status;
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Payment could not be started.');
      return null;
    } finally {
      setPaying(false);
    }
  };

  return { paying, error, pay };
}
