/**
 * Support endpoints — contact / feedback messages and help-center FAQs.
 * Web parity: knockout/lib/APIs/public/contact-us + get-faqs.
 *
 * POST /public/contact-us  body { fullName, email, phone, subject, message }
 *   (ContactMessageRemoteController — open, no auth). Doubles as the
 *   feedback channel; there is no separate feedback endpoint.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type ContactMessageInput = {
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

export async function submitContactMessage(data: ContactMessageInput): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>(
    '/public/contact-us',
    {
      fullName: data.fullName.trim(),
      email: data.email.trim(),
      // Backend phone is required-ish; web sends '-' when blank.
      phone: data.phone?.trim() || '-',
      subject: data.subject.trim(),
      message: data.message.trim(),
    },
    { skipAuth: true },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send your message.' };
  }
}
