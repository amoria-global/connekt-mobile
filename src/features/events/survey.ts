/**
 * Client satisfaction survey.
 *
 * This is not a formality — submitting it is what releases the survey-held
 * tranche of the photographer's fee (30% by default). `confirm-completion`
 * alone does NOT release it, and the remaining-balance escrow path is blocked
 * outright until a survey exists, so a completion without one leaves the
 * photographer underpaid indefinitely.
 *
 * The backend accepts a partial body and silently substitutes defaults rather
 * than rejecting it — some scoring for, some against the release — so all six
 * answers are always sent explicitly instead of relying on them.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError } from '@/types';

export type ServiceDelivery = 'YES' | 'PARTIALLY' | 'NO';
export type SatisfactionLevel = 'VERY_SATISFIED' | 'SATISFIED' | 'NOT_SATISFIED';

export type SatisfactionSurvey = {
  attendedEvent: boolean;
  serviceDelivery: ServiceDelivery;
  satisfactionLevel: SatisfactionLevel;
  deliverablesReceived: boolean;
  /** Optional free text; only sent when the client wrote something. */
  issuesDescription?: string;
  wouldBookAgain: boolean;
};

export type SurveyResult = {
  surveyId?: string;
  /**
   * Set by the server when an answer indicates a problem (didn't attend,
   * service not delivered, not satisfied, or wouldn't book again). It decides
   * whether completion is confirmed or sent back for changes.
   */
  disputeFlagged: boolean;
};

export async function submitSatisfactionSurvey(
  eventId: string,
  answers: SatisfactionSurvey,
): Promise<SurveyResult> {
  const res = await api.post<ApiEnvelope<{ surveyId?: string; disputeFlagged?: boolean }>>(
    '/client/surveys',
    {
      eventId,
      attendedEvent: answers.attendedEvent,
      serviceDelivery: answers.serviceDelivery,
      satisfactionLevel: answers.satisfactionLevel,
      deliverablesReceived: answers.deliverablesReceived,
      issuesDescription: answers.issuesDescription?.trim() || undefined,
      wouldBookAgain: answers.wouldBookAgain,
    },
  );
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not submit your feedback.',
    } satisfies ApiError;
  }
  return { surveyId: res.data?.surveyId, disputeFlagged: res.data?.disputeFlagged === true };
}
