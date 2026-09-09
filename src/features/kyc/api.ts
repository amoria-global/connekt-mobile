/**
 * KYC status, and the handoff to the web verification flow.
 *
 * ## Why there is no native submit here (CONN-ONB-1)
 *
 * This file used to POST a homemade multipart body to `/customer/kyc/submit`
 * and read status from `/customer/kyc`. Neither matched the backend:
 *
 *   - the status route is `/customer/kyc/status`. The bare path has no handler,
 *     and production access logs show it returning 404 to real users - the only
 *     KYC path that ever 404'd, because it is the only one no web client calls.
 *   - submit requires fullLegalName, gender, documentType and a challengeToken,
 *     and names its file parts selfiePhoto / governmentIdDocument /
 *     governmentIdDocumentBack. This sent idType, idNumber, idFront, idBack and
 *     selfie, so Spring rejected it on the first missing @RequestParam before
 *     any of it reached the service.
 *
 * Not one of the 27 kyc_verifications rows in production carries a native
 * client user agent. Zero submissions have ever come through this screen.
 *
 * Rebuilding it natively would mean reimplementing the whole anti-fraud half of
 * the flow, not just renaming fields: randomised liveness challenges with
 * per-challenge timings, multi-frame selfie capture, OCR pre-checks and the
 * forensic metadata. KycService.applyRiskScore reads exactly those, so a native
 * submission without them would score blind (CONN-ONB-9).
 *
 * So verification opens the web flow in the in-app browser, the same handoff
 * the paid flows already use per CLAUDE.md, and the app reads the outcome back
 * from the server. The web client owns verification correctness and this app
 * inherits its fixes with no release, which is the same trade already accepted
 * for payments.
 */
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/api/client';
import { env } from '@/config/env';
import type { ApiEnvelope } from '@/types';

export type KycState = {
  /** PENDING | APPROVED | REJECTED | NONE */
  status: string;
  submittedAt?: string;
  rejectionReason?: string;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Reads the account's verification state. Matches KycController#status. */
export async function getKyc(): Promise<KycState> {
  const res = await api.get<ApiEnvelope<Raw>>('/customer/kyc/status');
  const d = (res?.data ?? {}) as Raw;
  return {
    status: (str(d.status) ?? 'NONE').toUpperCase(),
    submittedAt: str(d.submittedAt) ?? str(d.submitted_at),
    rejectionReason: str(d.rejectionReason) ?? str(d.rejection_reason),
  };
}

/**
 * Opens identity verification on the web dashboard.
 *
 * `?kyc=1` lands directly on the wizard instead of a profile page the user then
 * has to find a button on.
 *
 * The in-app browser is a separate storage jar - nothing the app holds is
 * readable there - so the user signs in once inside the browser. That is real
 * friction, and it is still strictly better than the screen this replaces,
 * which could never succeed at all. A short-lived handoff token would remove
 * it; the existing one is payment-specific (`/payments/handoff`, receiver
 * `/user/complete-payment`), so that is a backend change, not a client one.
 */
export async function openWebKycFlow(): Promise<void> {
  await WebBrowser.openBrowserAsync(`${env.dashboardBaseUrl}/user/client/profile?kyc=1`);
}
