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
  declarationId?: string;
  paymentType?: string;
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

export type PaymentsRole = 'Client' | 'Photographer' | 'Coordinator' | 'Viewer';

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
  if (role === 'Photographer') return '/photographer/payments';
  return '/customer/payments';
}

function mapPaymentRecord(r: Raw): PaymentRecord {
  const declarationId = str(r.declarationId) ?? str(r.paymentDeclarationId);
  return {
    id: String(declarationId ?? r.id ?? ''),
    declarationId,
    paymentType: str(r.paymentType) ?? str(r.type),
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
  const res = await api.getOk<ApiEnvelope<unknown>>(
    `${paymentsBase(role)}?page=0&size=20`,
  );
  return pageContent(res?.data).map(mapPaymentRecord).filter((p) => p.id);
}

export type StreamingPayment = {
  id: string;
  eventTitle: string;
  viewerName: string;
  viewerEmail?: string;
  date?: string;
  amount: number;
  currency: string;
  method?: string;
  status: string;
};

export type StreamingRevenueResult = {
  totalStreamingRevenue: number;
  payments: StreamingPayment[];
};

export type GiftPayment = {
  id: string;
  eventTitle: string;
  amount: number;
  netAmount: number;
  currency: string;
  giftMessage?: string | null;
  customerPhone?: string;
  method?: string;
  status: string;
  date?: string;
};

export async function listStreamingPayments(): Promise<StreamingRevenueResult> {
  const res = await api.getOk<ApiEnvelope<unknown> & { totalStreamingRevenue?: number }>(
    '/coordinator/payments/streaming',
  );
  const items = pageContent(res?.data);
  const payments: StreamingPayment[] = items.map((p) => ({
    id: String(p.id ?? ''),
    eventTitle: str(p.eventTitle) ?? str(p.description) ?? 'Live Stream',
    viewerName: str(p.viewerName) ?? 'Unknown Viewer',
    viewerEmail: str(p.viewerEmail),
    date: str(p.createdAt) ?? str(p.date),
    amount: typeof p.amount === 'number' ? p.amount : 0,
    currency: str(p.currencyAbbreviation) ?? str(p.currency) ?? 'RWF',
    method: str(p.paymentMethod) ?? str(p.method) ?? '-',
    status: (str(p.status) ?? 'pending').toLowerCase(),
  }));

  // The wallet's net stream share only. Summing these gross booking-currency
  // rows as a fallback overstated revenue (and mixed currencies), so a missing
  // total is 0, not a guess.
  const totalStreamingRevenue =
    typeof res?.totalStreamingRevenue === 'number' ? res.totalStreamingRevenue : 0;

  return { totalStreamingRevenue, payments };
}

export async function listGiftPayments(): Promise<GiftPayment[]> {
  const res = await api.getOk<ApiEnvelope<unknown>>(
    '/coordinator/payments?type=GIFT&page=0&size=100',
  );
  const items = pageContent(res?.data);
  return items.map((p) => {
    const rawAmt =
      typeof p.amount === 'number'
        ? p.amount
        : typeof p.amountInUsd === 'number'
          ? p.amountInUsd
          : 0;
    const rawNet =
      typeof p.withdrawableAmount === 'number'
        ? p.withdrawableAmount
        : typeof p.netAmount === 'number'
          ? p.netAmount
          : 0; // never an assumed 65% share; the backend split is configurable
    return {
      id: String(p.id ?? ''),
      eventTitle: str(p.eventTitle) ?? 'Live Stream',
      amount: rawAmt,
      netAmount: rawNet,
      currency: str(p.currencyAbbreviation) ?? str(p.currency) ?? 'RWF',
      giftMessage: str(p.giftMessage) ?? null,
      customerPhone:
        str(p.senderName) ??
        str(p.viewerName) ??
        str(p.customerPhone) ??
        str(p.viewerEmail) ??
        '',
      method: str(p.paymentMethod) ?? '-',
      status: (str(p.status) ?? 'pending').toLowerCase(),
      date: str(p.paymentCompletedAt) ?? str(p.dueDate) ?? str(p.createdAt),
    };
  });
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
    res = await api.getOk<ApiEnvelope<Raw>>(`${paymentsBase(role)}/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e && typeof e === 'object' && (e as ApiError).status === 404) {
      throw { ...(e as ApiError), message: PAYMENT_NOT_FOUND_MESSAGE } satisfies ApiError;
    }
    throw e;
  }
  const r = (res?.data ?? {}) as Raw;
  const n = (v: unknown) => (typeof v === 'number' ? v : undefined);
  const declarationId = str(r.declarationId) ?? str(r.paymentDeclarationId);
  return {
    id: String(r.id ?? id),
    declarationId,
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
