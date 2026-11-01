/**
 * GlobalOpportunityCallNotifier — Handles incoming shoot offer device notifications and tapped actions.
 *
 * Notifications appear and ring in the OS device notification tray & lock screen.
 * Opening the app UI never auto-shows popups or rings inside the app. Only when
 * the user explicitly taps the device notification (or its Accept / Reject action
 * button) does `showIncomingOpportunity` open the offer details or execute the action.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Alert } from '@/components/ui/dialog';
import { showMatchingInProgress } from './MatchingInProgress';
import { canDrawOverOtherApps, cancelIncomingCall, showIncomingCall } from './incomingCall';
import { useCallReadiness } from './useCallReadiness';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { useRole } from '@/features/auth/role';
import { env } from '@/config/env';
import {
  listOpportunities,
  getOpportunity,
  approveOpportunity,
  rejectOpportunity,
  serverNowMs,
} from './api';
import type { OpportunityDeliveryPolicy, PhotographerOpportunity } from './types';
import {
  IncomingOpportunityAlertModal,
  OPPORTUNITY_AVAILABILITY_WINDOW_MS,
} from './IncomingOpportunityAlertModal';

export type OpportunityNotificationAction = 'approve' | 'reject';

type ShowListener = (
  candidateId?: string,
  stage?: 'ringing' | 'details',
  action?: OpportunityNotificationAction,
) => void;
const showListeners = new Set<ShowListener>();
let pendingShowRequest: {
  candidateId?: string;
  action?: OpportunityNotificationAction;
} | null = null;

/**
 * Trigger the incoming opportunity details modal or action when a device push
 * notification (or its Accept/Reject action button) is explicitly tapped by the user.
 */
export function showIncomingOpportunity(
  candidateId?: string,
  _stage: 'ringing' | 'details' = 'details',
  action?: OpportunityNotificationAction,
): void {
  if (showListeners.size === 0) {
    pendingShowRequest = { candidateId, action };
    return;
  }
  showListeners.forEach((fn) => fn(candidateId, 'details', action));
}

function isWithinTwoHourWindow(opp: PhotographerOpportunity): boolean {
  const now = serverNowMs();
  if (opp.invitedAt) {
    const invitedMs = Date.parse(opp.invitedAt);
    if (Number.isFinite(invitedMs)) {
      return invitedMs + OPPORTUNITY_AVAILABILITY_WINDOW_MS > now;
    }
  }
  const deadlineStr = opp.responseDeadlineAt || opp.candidateExpiresAt;
  if (deadlineStr) {
    const deadlineMs = Date.parse(deadlineStr);
    if (Number.isFinite(deadlineMs)) {
      return deadlineMs > now;
    }
  }
  return true;
}

/** Takes this offer's alerts off the phone, so nothing for it keeps sounding after an answer or expiry. */
export async function clearOfferNotifications(candidateId: string): Promise<void> {
  cancelIncomingCall(candidateId);
  if (Platform.OS === 'web') return;
  try {
    const same = (r: Notifications.NotificationRequest) => {
      const d = (r.content.data ?? {}) as Record<string, unknown>;
      return d.candidateId === candidateId || d.referenceId === candidateId;
    };
    for (const n of await Notifications.getPresentedNotificationsAsync()) {
      if (same(n.request)) await Notifications.dismissNotificationAsync(n.request.identifier);
    }
    for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
      if (same(n)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  } catch {
    // Best effort: the answer itself already went through.
  }
}

function isOpenStatus(status?: string): boolean {
  const s = (status ?? '').toUpperCase();
  return (
    s !== 'APPROVED' &&
    s !== 'REJECTED' &&
    s !== 'DECLINED' &&
    s !== 'EXPIRED' &&
    s !== 'WITHDRAWN' &&
    s !== 'NO_LONGER_AVAILABLE' &&
    s !== 'SELECTED' &&
    s !== 'NOT_SELECTED'
  );
}

export function GlobalOpportunityCallNotifier() {
  const router = useRouter();
  const isSignedIn = useAuth((s) => !!s.user);
  const { isPhotographer } = useRole();
  const isEligible = isSignedIn && isPhotographer;

  const [activeOpportunity, setActiveOpportunity] = useState<PhotographerOpportunity | null>(null);
  const isBusyRef = useRef(false);
  const dismissedRef = useRef<string[]>([]);

  const markDismissed = useCallback((id: string) => {
    if (!dismissedRef.current.includes(id)) dismissedRef.current = [...dismissedRef.current, id];
    void clearOfferNotifications(id);
  }, []);

  useCallReadiness(isEligible);

  const handleApprove = useCallback(
    async (
      opp: PhotographerOpportunity,
      deliveryPolicy: OpportunityDeliveryPolicy = 'CLIENT',
    ) => {
      try {
        isBusyRef.current = true;
        await approveOpportunity(opp.candidateId, { deliveryPolicy });
        markDismissed(opp.candidateId);
        setActiveOpportunity(null);
        showMatchingInProgress();
      } catch (e: any) {
        if (e?.status === 409 || e?.status === 404 || e?.status === 410) {
          markDismissed(opp.candidateId);
          setActiveOpportunity(null);
        }
        Alert.alert('Approval error', e?.message || 'Could not approve this opportunity.');
      } finally {
        isBusyRef.current = false;
      }
    },
    [markDismissed],
  );

  const handleReject = useCallback(
    async (opp: PhotographerOpportunity) => {
      try {
        isBusyRef.current = true;
        await rejectOpportunity(opp.candidateId);
        markDismissed(opp.candidateId);
        setActiveOpportunity(null);
        Alert.alert('Offer Rejected', 'Offer declined.');
      } catch (e: any) {
        if (e?.status === 409 || e?.status === 404 || e?.status === 410) {
          markDismissed(opp.candidateId);
          setActiveOpportunity(null);
        }
        Alert.alert('Decline error', e?.message || 'Could not decline this opportunity.');
      } finally {
        isBusyRef.current = false;
      }
    },
    [markDismissed],
  );

  const openTappedOpportunity = useCallback(
    async (
      focusCandidateId?: string,
      requestedAction?: OpportunityNotificationAction,
    ) => {
      if (!env.hybridBookingEnabled || !isEligible || isBusyRef.current) return;
      try {
        if (focusCandidateId) {
          dismissedRef.current = dismissedRef.current.filter((id) => id !== focusCandidateId);
          void clearOfferNotifications(focusCandidateId);
          try {
            const directOpp = await getOpportunity(focusCandidateId);
            if (isBusyRef.current) return;
            if (directOpp && directOpp.candidateId) {
              const open = isOpenStatus(directOpp.status) && isWithinTwoHourWindow(directOpp);
              if (!open) {
                markDismissed(directOpp.candidateId);
                setActiveOpportunity((prev) =>
                  prev?.candidateId === directOpp.candidateId ? null : prev,
                );
                if (requestedAction) {
                  Alert.alert(
                    'Offer no longer open',
                    'This offer has already expired or been answered.',
                  );
                }
                return;
              }
              if (requestedAction === 'approve') {
                await handleApprove(directOpp, 'CLIENT');
                return;
              }
              if (requestedAction === 'reject') {
                await handleReject(directOpp);
                return;
              }
              setActiveOpportunity(directOpp);
              return;
            }
          } catch (err: any) {
            const status = err?.status;
            if (status === 404 || status === 410) {
              markDismissed(focusCandidateId);
              Alert.alert(
                'Offer unavailable',
                'This offer is no longer available or has been removed.',
              );
              return;
            }
            if (status === 403 || status === 401) {
              markDismissed(focusCandidateId);
              Alert.alert(
                'Offer unavailable',
                err?.message || 'You do not have access to this offer.',
              );
              return;
            }
          }
        }

        const opps = await listOpportunities('PENDING_RESPONSE');
        if (isBusyRef.current || !Array.isArray(opps) || opps.length === 0) return;

        const pending =
          (focusCandidateId && opps.find((o) => o.candidateId === focusCandidateId)) ||
          opps.find(
            (opp) =>
              isOpenStatus(opp.status) &&
              isWithinTwoHourWindow(opp) &&
              !dismissedRef.current.includes(opp.candidateId),
          );

        if (pending) {
          void clearOfferNotifications(pending.candidateId);
          if (requestedAction === 'approve') {
            await handleApprove(pending, 'CLIENT');
            return;
          }
          if (requestedAction === 'reject') {
            await handleReject(pending);
            return;
          }
          setActiveOpportunity(pending);
        } else if (focusCandidateId && requestedAction) {
          Alert.alert('Offer no longer open', 'This offer has already expired or been answered.');
        }
      } catch {
        // Silently ignore background network errors
      }
    },
    [isEligible, markDismissed, handleApprove, handleReject],
  );

  // When a push arrives while the app is minimized on Android, wake the display
  // via IncomingCallModule (without auto-opening the app over other apps).
  useEffect(() => {
    if (!env.hybridBookingEnabled || !isEligible || Platform.OS !== 'android') return;
    if (typeof Notifications.addNotificationReceivedListener !== 'function') return;

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      if (AppState.currentState === 'active') return;
      if (canDrawOverOtherApps() === true) return;
      const content = notification?.request?.content;
      const data = (content?.data ?? {}) as Record<string, unknown>;
      const type = String(data.type ?? '').toUpperCase();
      const kind = String(data.kind ?? '').toUpperCase();
      if (type !== 'OPPORTUNITY' && type !== 'HYBRID_OPPORTUNITY' && kind !== 'INCOMING_OFFER') {
        return;
      }
      const cid = String(data.candidateId ?? data.referenceId ?? '');
      if (!cid || dismissedRef.current.includes(cid)) return;
      const title = String(content?.title ?? 'New Shoot Opportunity');
      const body = String(content?.body ?? 'A client has invited you to a shoot. Tap to review and respond.');
      showIncomingCall(cid, title, body);
    });

    return () => sub.remove();
  }, [isEligible]);

  useEffect(() => {
    if (!env.hybridBookingEnabled || !isEligible) return;

    const listener: ShowListener = (candidateId, _stage = 'details', action) => {
      void openTappedOpportunity(candidateId, action);
    };
    showListeners.add(listener);

    if (pendingShowRequest) {
      const req = pendingShowRequest;
      pendingShowRequest = null;
      void openTappedOpportunity(req.candidateId, req.action);
    }

    return () => {
      showListeners.delete(listener);
    };
  }, [isEligible, openTappedOpportunity]);

  if (!activeOpportunity) return null;

  return (
    <IncomingOpportunityAlertModal
      visible={!!activeOpportunity}
      opportunity={activeOpportunity}
      initialStage="details"
      onApprove={(opp, deliveryPolicy) => handleApprove(opp, deliveryPolicy)}
      onReject={(opp) => handleReject(opp)}
      onDismiss={() => {
        if (activeOpportunity) markDismissed(activeOpportunity.candidateId);
        setActiveOpportunity(null);
      }}
      onOpenOfferPage={(opp) => {
        setActiveOpportunity(opp);
        router.push('/bookings?tab=opportunities' as never);
      }}
    />
  );
}
