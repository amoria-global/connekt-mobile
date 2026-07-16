/**
 * Reporting and blocking.
 *
 * Google Play's UGC policy requires an in-app way to report content and an
 * in-app way to block users, on every surface where users see each other's
 * content: stream chat, direct messages, photos and profiles.
 *
 * Two report paths exist because public streams allow chat without an account:
 *  - signed-in users  → POST /customer/moderation/reports
 *  - anonymous viewers → POST /public/events/{id}/chats/{chatId}/report
 */
import { api } from '@/api/client';

type ApiEnvelope<T> = { action?: number; message?: string; data?: T };

/** Content surfaces a report can point at. Mirrors ContentReport.TargetType. */
export type ReportTarget = 'STREAM_CHAT' | 'DIRECT_MESSAGE' | 'PHOTO' | 'USER' | 'STREAM';

/**
 * Reasons offered per surface. Play expects the categories to be meaningful
 * for the content being reported, not one generic list.
 */
export const REPORT_REASONS: Record<ReportTarget, string[]> = {
  STREAM_CHAT: [
    'Harassment or bullying',
    'Hate speech',
    'Sexual content',
    'Violence or threats',
    'Spam or scam',
    'Other',
  ],
  DIRECT_MESSAGE: [
    'Harassment or bullying',
    'Hate speech',
    'Sexual content',
    'Violence or threats',
    'Spam or scam',
    'Other',
  ],
  PHOTO: [
    'Sexual content',
    'Violence or graphic content',
    'Hate speech',
    "It's my photo and I didn't consent",
    'Copyright infringement',
    'Other',
  ],
  USER: [
    'Harassment or bullying',
    'Hate speech',
    'Impersonation',
    'Spam or scam',
    'Inappropriate profile content',
    'Other',
  ],
  STREAM: [
    'Sexual content',
    'Violence or graphic content',
    'Hate speech',
    'Copyright infringement',
    'Spam or scam',
    'Other',
  ],
};

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
  STREAM_CHAT: 'message',
  DIRECT_MESSAGE: 'message',
  PHOTO: 'photo',
  USER: 'user',
  STREAM: 'stream',
};

/** Report content as a signed-in user. */
export async function reportContent(
  targetType: ReportTarget,
  targetId: string,
  reason: string,
  description?: string,
): Promise<string> {
  const res = await api.post<ApiEnvelope<{ id: string }>>('/customer/moderation/reports', {
    targetType,
    targetId,
    reason,
    description: description?.trim() || '',
  });
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not submit report.' };
  }
  return res?.message || 'Report submitted.';
}

/**
 * Report a live-chat message as an anonymous viewer. Anonymous viewers have no
 * account, so the backend authenticates them with the same viewerId +
 * deviceFingerprint pair it uses to let them post.
 */
export async function reportPublicChatMessage(
  eventId: string,
  chatId: string,
  viewerId: string,
  deviceFingerprint: string,
  reason: string,
  description?: string,
): Promise<string> {
  const res = await api.post<ApiEnvelope<{ id: string }>>(
    `/public/events/${encodeURIComponent(eventId)}/chats/${encodeURIComponent(chatId)}/report`,
    { viewerId, deviceFingerprint, reason, description: description?.trim() || '' },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not submit report.' };
  }
  return res?.message || 'Report submitted.';
}

// ────── Blocking ──────────────────────────────────────────────────────────

export type BlockedUser = {
  id: string;
  name: string;
  profilePicture?: string;
  blockedAt?: string;
};

export async function blockUser(blockedUserId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>('/customer/moderation/blocks', {
    blockedUserId,
  });
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not block this user.' };
  }
}

export async function unblockUser(blockedUserId: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<unknown>>(
    `/customer/moderation/blocks/${encodeURIComponent(blockedUserId)}`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not unblock this user.' };
  }
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const res = await api.get<ApiEnvelope<BlockedUser[]>>('/customer/moderation/blocks');
  return Array.isArray(res?.data) ? res.data : [];
}
