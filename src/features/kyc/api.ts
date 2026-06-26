/**
 * KYC verification (/api/remote/customer/kyc).
 * Submission is multipart (ID images + selfie).
 */
import { api } from '@/api/client';
import type { ApiError, ApiEnvelope } from '@/types';
import { appendFile } from '@/utils/upload';

export type KycState = {
  status: string; // PENDING | APPROVED | REJECTED | NONE
  submittedAt?: string;
  rejectionReason?: string;
};

export type KycImage = { uri: string; name: string; type: string };

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export async function getKyc(): Promise<KycState> {
  const res = await api.get<ApiEnvelope<Raw>>('/customer/kyc');
  const d = (res?.data ?? {}) as Raw;
  return {
    status: (str(d.status) ?? 'NONE').toUpperCase(),
    submittedAt: str(d.submittedAt),
    rejectionReason: str(d.rejection_reason) ?? str(d.rejectionReason),
  };
}

export type SubmitKycInput = {
  idType: string;
  idNumber: string;
  idFront: KycImage;
  idBack?: KycImage;
  selfie: KycImage;
};

export async function submitKyc(input: SubmitKycInput): Promise<void> {
  const form = new FormData();
  form.append('idType', input.idType);
  form.append('idNumber', input.idNumber);
  // Cross-platform file parts (real Blob on web, RN object on native).
  await appendFile(form, 'idFront', input.idFront);
  if (input.idBack) await appendFile(form, 'idBack', input.idBack);
  await appendFile(form, 'selfie', input.selfie);

  const res = await api.post<ApiEnvelope<Raw>>('/customer/kyc/submit', form);
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not submit your documents.',
    } satisfies ApiError;
  }
}
