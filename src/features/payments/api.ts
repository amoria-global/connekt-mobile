/**
 * Payments via XentriPay (the gateway used across the Connekyt web apps).
 *
 * Flow: initiate → open the returned redirectUrl in a browser → poll status
 * by reference id. Request/response field names are mapped defensively since
 * the gateway payload can vary by environment.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type PaymentInput = {
  amount: number;
  currency?: string;
  eventId?: string;
  bookingId?: string;
  photographerId?: string;
  packageId?: string;
  countryCode?: string;
};

export type InitiatedPayment = {
  refId: string;
  redirectUrl?: string;
};

export type PaymentStatus = 'success' | 'pending' | 'failed';

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export async function initiatePayment(input: PaymentInput): Promise<InitiatedPayment> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>('/payments/xentripay/initiate', input);
  const d = (res?.data ?? res ?? {}) as Raw;

  const refId =
    str(d.refId) ?? str(d.reference) ?? str(d.transactionId) ?? str(d.refid) ?? '';
  const redirectUrl =
    str(d.redirectUrl) ?? str(d.paymentUrl) ?? str(d.url) ?? str(d.checkoutUrl);

  return { refId, redirectUrl };
}

// --- Payment history -----------------------------------------------------

export type PaymentRecord = {
  id: string;
  title: string;
  amount?: number;
  currency?: string;
  status?: string;
  createdAt?: string;
};

function pageContent(data: unknown): Raw[] {
  if (Array.isArray(data)) return data as Raw[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Raw[]) : [];
}

export async function listPayments(): Promise<PaymentRecord[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/customer/payments?page=0&size=20');
  return pageContent(res?.data)
    .map((r) => ({
      id: String(r.id ?? r.declarationId ?? ''),
      title: str(r.eventName) ?? str(r.eventTitle) ?? str(r.title) ?? str(r.description) ?? 'Payment',
      amount:
        (typeof r.amount === 'number' ? r.amount : undefined) ??
        (typeof r.amountDue === 'number' ? r.amountDue : undefined) ??
        (typeof r.totalAmount === 'number' ? r.totalAmount : undefined),
      currency: str(r.currency) ?? str(r.currencyCode),
      status: str(r.status) ?? str(r.paymentStatus),
      createdAt: str(r.createdAt) ?? str(r.date),
    }))
    .filter((p) => p.id);
}

export async function getPaymentStatus(refId: string): Promise<PaymentStatus> {
  const res = await api.get<ApiEnvelope<Raw> & Raw>(
    `/payments/xentripay/status/${encodeURIComponent(refId)}`,
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  const raw = (str(d.status) ?? str(d.paymentStatus) ?? '').toUpperCase();

  if (/SUCCESS|COMPLETED|PAID|APPROVED/.test(raw)) return 'success';
  if (/FAIL|CANCEL|DECLIN|ERROR/.test(raw)) return 'failed';
  return 'pending';
}
