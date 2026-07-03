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

/**
 * Pay an existing booking declaration (web parity:
 * lib/xentripay.ts → initiateBookingPayment). Used by the Pay-Now
 * sheet on the dashboard: the user picks a method, types a phone for
 * mobile money, and the backend returns either a paymentUrl (card) or
 * just a refid to poll (mobile money).
 */
export type InitiateBookingPaymentInput = {
  declarationId: string;
  phone?: string;
  telecomProvider?: string; // 'MTN' | 'AIRTEL' | 'MPESA' | …
  paymentMethod: 'MOBILE_MONEY' | 'CARD';
  currencyId?: string;
  donationAmount?: number;
  escrowPercentage?: number;
  /** ISO-2 country code — drives backend gateway routing. */
  country?: string;
  redirectUrl?: string;
};

export async function initiateBookingPayment(
  input: InitiateBookingPaymentInput,
): Promise<InitiatedPayment> {
  const body: Record<string, unknown> = {
    declarationId: input.declarationId,
    paymentMethod: input.paymentMethod,
  };
  if (input.phone) body.phone = input.phone;
  if (input.telecomProvider) body.telecomProvider = input.telecomProvider;
  if (input.currencyId) body.currencyId = input.currencyId;
  if (input.donationAmount) body.donationAmount = input.donationAmount;
  if (input.escrowPercentage) body.escrowPercentage = input.escrowPercentage;
  if (input.country) body.country = input.country;
  if (input.redirectUrl) body.redirectUrl = input.redirectUrl;

  const res = await api.post<ApiEnvelope<Raw> & Raw>('/payments/xentripay/initiate', body);
  const d = (res?.data ?? res ?? {}) as Raw;
  const refId =
    str(d.refid) ?? str(d.refId) ?? str(d.reference) ?? str(d.transactionId) ?? '';
  const redirectUrl =
    str(d.paymentUrl) ?? str(d.redirectUrl) ?? str(d.url) ?? str(d.checkoutUrl);
  return { refId, redirectUrl };
}

/**
 * Step 2 of the authenticated donation flow: pay an existing donation
 * row (web parity: salo-run lib/xentripay → initiateDonationPayment).
 * The previous mobile donate screen stopped after creating the row,
 * which made the donate button silently inert — no money ever moved.
 */
export type InitiateDonationPaymentInput = {
  donationId: string;
  phone?: string;
  telecomProvider?: string;
  paymentMethod: 'MOBILE_MONEY' | 'CARD';
  country?: string;
  redirectUrl?: string;
};

export async function initiateAuthenticatedDonationPayment(
  input: InitiateDonationPaymentInput,
): Promise<InitiatedPayment> {
  const body: Record<string, unknown> = {
    donationId: input.donationId,
    paymentMethod: input.paymentMethod,
  };
  if (input.phone) body.phone = input.phone;
  if (input.telecomProvider) body.telecomProvider = input.telecomProvider;
  if (input.country) body.country = input.country;
  if (input.redirectUrl) body.redirectUrl = input.redirectUrl;

  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    '/payments/xentripay/initiate-donation',
    body,
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  const refId =
    str(d.refid) ?? str(d.refId) ?? str(d.reference) ?? str(d.transactionId) ?? '';
  const redirectUrl =
    str(d.paymentUrl) ?? str(d.redirectUrl) ?? str(d.url) ?? str(d.checkoutUrl);
  return { refId, redirectUrl };
}

/**
 * Poll the auth-required XentriPay status endpoint until it resolves.
 * The grace window mirrors the web's pollXentriPayStatus — card
 * sessions return FAILED for a few seconds before the user finishes
 * paying, so we suppress early FAILEDs inside `graceMs`.
 */
export async function pollBookingPaymentStatus(
  refId: string,
  options?: { intervalMs?: number; maxAttempts?: number; graceMs?: number },
): Promise<PaymentStatus> {
  const intervalMs = options?.intervalMs ?? 2500;
  const maxAttempts = options?.maxAttempts ?? 60;
  const graceMs = options?.graceMs ?? 0;
  const startedAt = Date.now();
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getPaymentStatus(refId).catch(() => 'pending' as const);
    if (status === 'success') return 'success';
    if (status === 'failed') {
      if (Date.now() - startedAt < graceMs) {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      return 'failed';
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return 'pending';
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

/** Full detail for one payment (web parity: GET /{role}/payments/{id}). */
export async function getPayment(id: string, role?: PaymentsRole): Promise<PaymentDetail> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `${paymentsBase(role)}/${encodeURIComponent(id)}`,
  );
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
