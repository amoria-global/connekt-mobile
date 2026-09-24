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
import type { PickedImage } from '@/services/imagePicker';
import type { ApiEnvelope } from '@/types';
import { appendFile } from '@/utils/upload';

export type KycState = {
  /** PENDING | APPROVED | REJECTED | NONE */
  status: string;
  submittedAt?: string;
  rejectionReason?: string;
  documentType?: string;
  fullLegalName?: string;
  dob?: string;
  phone?: string;
};

export type DocumentTypeOption = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE';

export type KycSubmissionPayload = {
  fullLegalName: string;
  gender: string;
  dob?: string;
  phone?: string;
  locationAddress?: string;
  documentType: DocumentTypeOption;
  challengeToken: string;
  challengeOrder?: string;
  challengeTimingsMs?: string;
  selfiePhoto: PickedImage;
  livenessFrames?: PickedImage[];
  governmentIdDocument: PickedImage;
  governmentIdDocumentBack?: PickedImage;
};

export type KycSubmitResult = {
  action: number;
  message: string;
  data?: {
    id: string;
    status: string;
  };
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export async function getKyc(): Promise<KycState> {
  const res = await api.get<ApiEnvelope<Raw>>('/customer/kyc/status');
  const d = (res?.data ?? {}) as Raw;
  const sub = (d.latestSubmission ?? {}) as Raw;
  const rawStatus = str(d.kycStatus) ?? str(d.status) ?? str(sub.status) ?? 'NONE';
  const status = rawStatus === 'NOT_SUBMITTED' ? 'NONE' : rawStatus.toUpperCase();
  return {
    status,
    submittedAt: str(sub.createdAt) ?? str(d.submittedAt) ?? str(d.submitted_at),
    rejectionReason: str(sub.reviewComment) ?? str(d.rejectionReason) ?? str(d.rejection_reason),
    documentType: str(sub.documentType) ?? str(d.documentType),
    fullLegalName: str(sub.fullLegalName) ?? str(d.fullLegalName),
    dob: str(sub.dob) ?? str(sub.dateOfBirth) ?? str(d.dob) ?? str(d.dateOfBirth),
    phone: str(sub.phone) ?? str(sub.phoneNumber) ?? str(d.phone) ?? str(d.phoneNumber),
  };
}

/**
 * Requests a one-time challenge token from the backend for the KYC submission.
 */
export async function getChallengeToken(): Promise<string> {
  const res = await api.post<{ action: number; challengeToken: string }>('/customer/kyc/challenge-token');
  return res.challengeToken;
}

/**
 * Submits the complete KYC multipart body directly to the backend.
 */
export async function submitKyc(payload: KycSubmissionPayload): Promise<KycSubmitResult> {
  const form = new FormData();
  form.append('fullLegalName', payload.fullLegalName.trim());
  form.append('gender', payload.gender);
  if (payload.dob?.trim()) {
    form.append('dob', payload.dob.trim());
    form.append('dateOfBirth', payload.dob.trim());
  }
  if (payload.phone?.trim()) {
    form.append('phone', payload.phone.trim());
    form.append('phoneNumber', payload.phone.trim());
  }
  if (payload.locationAddress?.trim()) {
    form.append('locationAddress', payload.locationAddress.trim());
  }
  form.append('documentType', payload.documentType);
  form.append('challengeToken', payload.challengeToken);
  if (payload.challengeOrder) {
    form.append('challengeOrder', payload.challengeOrder);
  }
  if (payload.challengeTimingsMs) {
    form.append('challengeTimingsMs', payload.challengeTimingsMs);
  }

  await appendFile(form, 'selfiePhoto', {
    uri: payload.selfiePhoto.uri,
    name: payload.selfiePhoto.name || 'selfie.jpg',
    type: payload.selfiePhoto.type || 'image/jpeg',
  });

  if (payload.livenessFrames && payload.livenessFrames.length > 0) {
    for (let i = 0; i < payload.livenessFrames.length; i++) {
      const frame = payload.livenessFrames[i];
      await appendFile(form, 'livenessFrames', {
        uri: frame.uri,
        name: frame.name || `frame_${i}.jpg`,
        type: frame.type || 'image/jpeg',
      });
    }
  }

  await appendFile(form, 'governmentIdDocument', {
    uri: payload.governmentIdDocument.uri,
    name: payload.governmentIdDocument.name || 'id_front.jpg',
    type: payload.governmentIdDocument.type || 'image/jpeg',
  });

  if (payload.governmentIdDocumentBack) {
    await appendFile(form, 'governmentIdDocumentBack', {
      uri: payload.governmentIdDocumentBack.uri,
      name: payload.governmentIdDocumentBack.name || 'id_back.jpg',
      type: payload.governmentIdDocumentBack.type || 'image/jpeg',
    });
  }

  return api.post<KycSubmitResult>('/customer/kyc/submit', form);
}

export type DocTypeValidationResult = {
  status: 'MATCH' | 'MISMATCH' | 'NOT_A_DOCUMENT' | 'UNCERTAIN' | 'SKIPPED' | 'ERROR';
  message: string;
  detectedType?: string;
  confidence?: number;
};

export type DocSideValidationResult = {
  status: 'SIDE_MATCH' | 'SIDE_WRONG' | 'SIDE_UNCERTAIN' | 'SIDE_SKIPPED' | 'ERROR';
  message: string;
  detectedSide?: string;
};

/**
 * Validates whether an uploaded document photo matches the selected document type.
 */
export async function validateDocType(
  documentType: DocumentTypeOption,
  image: PickedImage,
): Promise<DocTypeValidationResult> {
  const form = new FormData();
  form.append('documentType', documentType);
  await appendFile(form, 'image', {
    uri: image.uri,
    name: image.name || 'document.jpg',
    type: image.type || 'image/jpeg',
  });
  return api.post<DocTypeValidationResult>('/customer/kyc/validate-doc-type', form);
}

/**
 * Validates whether an uploaded document photo is the FRONT or BACK of an ID.
 */
export async function validateDocSide(
  side: 'FRONT' | 'BACK',
  image: PickedImage,
): Promise<DocSideValidationResult> {
  const form = new FormData();
  form.append('side', side);
  await appendFile(form, 'image', {
    uri: image.uri,
    name: image.name || 'document.jpg',
    type: image.type || 'image/jpeg',
  });
  return api.post<DocSideValidationResult>('/customer/kyc/validate-doc-side', form);
}

/**
 * Opens identity verification on the web dashboard (fallback).
 */
export async function openWebKycFlow(): Promise<void> {
  await WebBrowser.openBrowserAsync(`${env.dashboardBaseUrl}/user/client/profile?kyc=1`);
}

