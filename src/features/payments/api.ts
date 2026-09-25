/**
 * Payments via XentriPay (the gateway used across the Connekyt web apps).
 *
 * Flow: initiate → open the returned redirectUrl in a browser → poll status
 * by reference id. Request/response field names are mapped defensively since
 * the gateway payload can vary by environment.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError } from '@/types';

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

// NOTE: The booking/donation "initiate + poll" helpers that used to live
// here (initiateBookingPayment, initiateAuthenticatedDonationPayment,
// pollBookingPaymentStatus) were removed — those flows now hand off to
// the connekyt.com web checkout (see ./webCheckout.ts) and the app no
// longer collects payment details or polls the gateway for them.

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

export type PaymentsRole = 'Client' | 'Photographer' | 'Coordinator' | 'Viewer' | 'User';

/**
 * Payment-history endpoint by role.
 *
 * The backend keeps a SEPARATE controller per role:
 *   /api/remote/customer/payments    → ClientPaymentController
 *   /api/remote/coordinator/payments → CoordinatorController#listPayments
 *
 * Mobile used to call `/customer/payments` for every role, which meant
 * coordinators never saw any of their own payments and the screen
 * looked empty / "not working". The role-aware base path fixes that.
 */
function paymentsBase(role: PaymentsRole | undefined): string {
  if (role === 'Coordinator') return '/coordinator/payments';
  // Photographer / Viewer don't have their own payment-history endpoint
  // exposed yet; they fall through to the customer path which the
  // backend serves with role-appropriate filters.
  return '/customer/payments';
}

function mapPaymentRecord(r: Raw): PaymentRecord {
  return {
    id: String(r.id ?? r.declarationId ?? ''),
    title: str(r.eventName) ?? str(r.eventTitle) ?? str(r.title) ?? str(r.description) ?? 'Payment',
    amount:
      (typeof r.amount === 'number' ? r.amount : undefined) ??
      (typeof r.amountDue === 'number' ? r.amountDue : undefined) ??
      (typeof r.totalAmount === 'number' ? r.totalAmount : undefined) ??
      (typeof r.amountInUsd === 'number' ? r.amountInUsd : undefined),
    currency:
      str(r.currency) ?? str(r.currencyCode) ?? str(r.currencyAbbreviation),
    status: str(r.status) ?? str(r.paymentStatus),
    createdAt: str(r.createdAt) ?? str(r.date) ?? str(r.dueDate),
  };
}

export async function listPayments(role?: PaymentsRole): Promise<PaymentRecord[]> {
  const res = await api.get<ApiEnvelope<unknown>>(
    `${paymentsBase(role)}?page=0&size=20`,
  );
  return pageContent(res?.data).map(mapPaymentRecord).filter((p) => p.id);
}

export type PaymentDetail = PaymentRecord & {
  paymentType?: string;
  photographerName?: string;
  method?: string;
  reference?: string;
  description?: string;
};

export const PAYMENT_NOT_FOUND_MESSAGE =
  'This payment is no longer available. It may have been cancelled or it belongs to another account.';

/**
 * Full detail for one payment (web parity: GET /{role}/payments/{id}).
 *
 * Coordinators reach this from notifications too ("Payment Failed" on a guest's
 * gift to their event), which the backend only started serving in
 * CoordinatorController#getPaymentById. A 404 used to reach the screen as
 * Spring's raw "No static resource api/remote/..." text, so any 404 is shown as
 * a plain sentence instead.
 */
export async function getPayment(id: string, role?: PaymentsRole): Promise<PaymentDetail> {
  let res: ApiEnvelope<Raw> | undefined;
  try {
    res = await api.get<ApiEnvelope<Raw>>(`${paymentsBase(role)}/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e && typeof e === 'object' && (e as ApiError).status === 404) {
      throw { ...(e as ApiError), message: PAYMENT_NOT_FOUND_MESSAGE } satisfies ApiError;
    }
    throw e;
  }
  const r = (res?.data ?? {}) as Raw;
  const n = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    id: String(r.id ?? id),
    title: str(r.eventName) ?? str(r.eventTitle) ?? str(r.title) ?? str(r.description) ?? 'Payment',
    amount: n(r.amount) ?? n(r.amountDue) ?? n(r.totalAmount),
    currency: str(r.currency) ?? str(r.currencyCode) ?? str(r.currencyAbbreviation),
    status: str(r.status) ?? str(r.paymentStatus),
    createdAt: str(r.createdAt) ?? str(r.date),
    paymentType: str(r.paymentType) ?? str(r.type),
    photographerName: str(r.photographerName),
    method: str(r.method) ?? str(r.paymentMethod) ?? str(r.gateway),
    reference: str(r.reference) ?? str(r.transactionId) ?? str(r.refId),
    description: str(r.description),
  };
}

// ⚠ DO NOT ADD A GATEWAY STATUS POLLER HERE. See docs/PAYMENTS.md.
//
// `getPaymentStatus` used to live at this spot, polling the AUTHENTICATED
// endpoint `/payments/xentripay/status/{refId}`. It had no callers — it was a
// straggler missed when the initiate-and-poll helpers above were removed — but
// it was a live trap, because buyers of photos and stream access are ANONYMOUS.
// The identical mistake on web (`XentriPayModal` polling the authenticated
// route for `multi_album_purchase`) meant the request was refused client-side,
// no call was ever made, the modal spun for five minutes and then told a buyer
// whose money had already been taken that their payment had failed — offering
// a Retry button that charges them again.
//
// This app does not collect payment details or watch payments settle. Money
// flows through the connekyt.com web checkout (see ./webCheckout.ts), so the
// web client owns polling and delivery. If you ever need a status read here,
// use the PUBLIC endpoint `/public/payments/xentripay/status/{refid}` — a
// status read is not privileged — and give it a terminal state, never an
// unbounded spinner.
