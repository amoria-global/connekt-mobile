/**
 * GlobalOpportunityCallNotifier — App-wide incoming shoot alert listener.
 * Mounted in `(app)/_layout.tsx` so that when a photographer is signed in:
 *   1. Incoming shoot match requests post a high-priority system notification on
 *      `urgent_alerts_v2` (with Accept / Reject actions) and wake up the Android
 *      lock screen & display via `showIncomingCall`.
 *   2. While the app is open (or over the lock screen), `IncomingOpportunityAlertModal`
 *      rings and displays the offer details.
 *   3. Tapping the push notification or its Accept/Reject action button fetches
 *      the latest offer state from the server and handles or displays it.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Alert } from '@/components/ui/dialog';
import { showMatchingInProgress } from './MatchingInProgress';
import {
  cancelAllIncomingCalls,
  cancelIncomingCall,
  showIncomingCall,
} from './incomingCall';
import { useCallReadiness } from './useCallReadiness';
import { RINGING_CHANNEL } from '@/features/notifications/push';
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

/**
 * Trigger the incoming opportunity modal or action immediately (e.g. when a push
 * notification or its Accept/Reject action button is tapped, or when
 * InAppNotificationWatcher detects a new OPPORTUNITY notification).
 */
export function showIncomingOpportunity(
  candidateId?: string,
  stage: 'ringing' | 'details' = 'details',
  action?: OpportunityNotificationAction,
): void {
  showListeners.forEach((fn) => fn(candidateId, stage, action));
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
  // Offers ring for photographers only. Clients and event coordinators book photographers and are never invited.
  const { isPhotographer } = useRole();
  const isEligible = isSignedIn && isPhotographer;

  const [activeOpportunity, setActiveOpportunity] = useState<PhotographerOpportunity | null>(null);
  const [modalStage, setModalStage] = useState<'ringing' | 'details'>('ringing');
  const isBusyRef = useRef(false);
  // Read after every await: a refresh that began before a reject finished must not bring the offer (and its ring) back.
  const dismissedRef = useRef<string[]>([]);
  const markDismissed = useCallback((id: string) => {
    if (!dismissedRef.current.includes(id)) dismissedRef.current = [...dismissedRef.current, id];
    void clearOfferNotifications(id);
  }, []);
  const notifiedTrayIdsRef = useRef<Set<string>>(new Set());

  // Keep Android foreground service ready so offers wake the lock screen even when backgrounded or idle.
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
        // 409: the invite closed, or the calendar now overlaps and it was released. Don't keep ringing for it.
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
        Alert.alert(
          'Offer Rejected',
          'Offer declined.',
        );
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

  /**
   * Posts the incoming offer to the Android lock screen / system tray and wakes
   * up the display via `showIncomingCall`. Runs regardless of `AppState.currentState`
   * because `.MainActivity` has `android:showWhenLocked="true"`, which keeps
   * `AppState.currentState` as `'active'` even when the phone is locked.
   */
  const ensureTrayNotification = useCallback(async (opp: PhotographerOpportunity) => {
    if (Platform.OS === 'web') return;
    if (notifiedTrayIdsRef.current.has(opp.candidateId)) return;
    notifiedTrayIdsRef.current.add(opp.candidateId);

    const where = opp.city || opp.venue || 'Rwanda';
    const when = opp.eventDate || 'Upcoming date';
    const title = `New nearby opportunity: ${opp.eventTitle}`;
    const body = `${when} · ${where} · Tap Accept or Reject to respond`;

    // Wake up the locked Android display and show the full-screen lock-screen alert
    showIncomingCall(opp.candidateId, title, body);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'connekyt_ringtone.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'OPPORTUNITY_ALERT',
          data: {
            type: 'OPPORTUNITY',
            kind: 'INCOMING_OFFER',
            candidateId: opp.candidateId,
            referenceId: opp.candidateId,
            eventId: opp.eventId,
            link: `/opportunities/${opp.candidateId}`,
          },
        },
        trigger:
          Platform.OS === 'android'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 1,
                channelId: RINGING_CHANNEL,
              }
            : null,
      });
    } catch {
      // Non-fatal if local notification scheduling is unavailable
    }
  }, []);

  const checkOpportunities = useCallback(
    async (
      focusCandidateId?: string,
      requestedStage?: 'ringing' | 'details',
      requestedAction?: OpportunityNotificationAction,
    ) => {
      if (!env.hybridBookingEnabled || !isEligible || isBusyRef.current) return;
      try {
        if (focusCandidateId) {
          dismissedRef.current = dismissedRef.current.filter((id) => id !== focusCandidateId);
          if (requestedAction || requestedStage === 'details') {
            void clearOfferNotifications(focusCandidateId);
          }
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
              if (requestedStage === 'ringing') {
                void ensureTrayNotification(directOpp);
              }
              setModalStage(requestedStage ?? 'details');
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
            // For transient errors, fall back to list check below
          }
        }

        let opps = await listOpportunities('PENDING_RESPONSE');
        if (isBusyRef.current) return;
        if (!Array.isArray(opps) || opps.length === 0) {
          try {
            const allOpps = await listOpportunities('ALL');
            if (Array.isArray(allOpps) && allOpps.length > 0) {
              opps = allOpps.filter(
                (o) => (o.status ?? '').toUpperCase() === 'INVITED' && isWithinTwoHourWindow(o),
              );
            }
          } catch {
            // ignore fallback error
          }
        }

        if (!Array.isArray(opps) || opps.length === 0) {
          if (activeOpportunity && !focusCandidateId) {
            void clearOfferNotifications(activeOpportunity.candidateId);
            setActiveOpportunity(null);
          }
          return;
        }

        // Find first pending opportunity not dismissed and still within its 2-hour window
        const pending =
          (focusCandidateId && opps.find((o) => o.candidateId === focusCandidateId)) ||
          opps.find(
            (opp) =>
              isOpenStatus(opp.status) &&
              isWithinTwoHourWindow(opp) &&
              !dismissedRef.current.includes(opp.candidateId),
          );

        if (pending) {
          if (focusCandidateId && pending.candidateId === focusCandidateId) {
            if (requestedAction === 'approve') {
              await handleApprove(pending, 'CLIENT');
              return;
            }
            if (requestedAction === 'reject') {
              await handleReject(pending);
              return;
            }
          }
          void ensureTrayNotification(pending);
          setActiveOpportunity((prev) => {
            if (prev?.candidateId === pending.candidateId) {
              if (requestedStage) setModalStage(requestedStage);
              return prev;
            }
            setModalStage(requestedStage ?? 'ringing');
            return pending;
          });
        } else if (!focusCandidateId) {
          if (activeOpportunity) {
            void clearOfferNotifications(activeOpportunity.candidateId);
          }
          setActiveOpportunity(null);
        }
      } catch {
        // Background polling is non-blocking
      }
    },
    [
      isEligible,
      activeOpportunity,
      ensureTrayNotification,
      handleApprove,
      handleReject,
      markDismissed,
    ],
  );

  // The timer below must outlive re-renders, so it calls the latest check through a ref instead of restarting.
  const checkRef = useRef(checkOpportunities);
  useEffect(() => {
    checkRef.current = checkOpportunities;
  }, [checkOpportunities]);

  // Poll every 5 seconds continuously (including while locked/backgrounded via KeepAliveService on Android),
  // plus on resume, on push receipt, and on explicit trigger.
  useEffect(() => {
    if (!env.hybridBookingEnabled || !isEligible) return;
    const check = (
      cid?: string,
      st?: 'ringing' | 'details',
      act?: OpportunityNotificationAction,
    ) => void checkRef.current(cid, st, act);

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => check(), 5000);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    check();
    start();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        cancelAllIncomingCalls();
        check();
      }
      if (!interval) start();
    });

    const pushReceived =
      Platform.OS === 'web'
        ? null
        : Notifications.addNotificationReceivedListener((notification) => {
            const content = notification.request.content;
            const data = (content.data ?? {}) as Record<string, unknown>;
            const type = typeof data.type === 'string' ? data.type.toUpperCase() : '';
            const kind = typeof data.kind === 'string' ? data.kind.toUpperCase() : '';
            const cid =
              typeof data.candidateId === 'string'
                ? data.candidateId
                : (type === 'OPPORTUNITY' ||
                      type === 'HYBRID_OPPORTUNITY' ||
                      kind === 'INCOMING_OFFER') &&
                    typeof data.referenceId === 'string'
                  ? data.referenceId
                  : undefined;
            if (cid) {
              notifiedTrayIdsRef.current.add(cid);
              showIncomingCall(
                cid,
                content.title || 'New nearby opportunity',
                content.body || 'Tap to review and respond to this shoot offer.',
              );
              check(cid, 'ringing');
            } else if (
              type === 'OPPORTUNITY' ||
              type === 'HYBRID_OPPORTUNITY' ||
              kind === 'INCOMING_OFFER'
            ) {
              check(undefined, 'ringing');
            }
          });

    const onShow: ShowListener = (cid, st, act) => {
      check(cid, st ?? 'details', act);
    };
    showListeners.add(onShow);

    return () => {
      stop();
      subscription.remove();
      pushReceived?.remove();
      showListeners.delete(onShow);
    };
  }, [isEligible]);

  const handleDismiss = () => {
    if (activeOpportunity) {
      markDismissed(activeOpportunity.candidateId);
      setActiveOpportunity(null);
    }
  };

  const handleOpenOfferPage = () => {
    // Land on the opportunities list behind this modal. No `candidate` param: that makes the Bookings
    // screen open its own copy of the offer, and two stacked offer modals fight over the same invite.
    router.push('/bookings?tab=opportunities' as never);
  };

  if (!env.hybridBookingEnabled || !isEligible || !activeOpportunity) {
    return null;
  }

  return (
    <IncomingOpportunityAlertModal
      opportunity={activeOpportunity}
      visible={activeOpportunity !== null}
      initialStage={modalStage}
      onApprove={handleApprove}
      onReject={handleReject}
      onDismiss={handleDismiss}
      onOpenOfferPage={handleOpenOfferPage}
    />
  );
}
