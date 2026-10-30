/**
 * GlobalOpportunityCallNotifier — App-wide incoming shoot alert listener.
 * Mounted in `(app)/_layout.tsx` so that when a photographer is using the app
 * on ANY screen or tab (Home, Events, Bookings, Wallet, Chat, etc.), an incoming
 * shoot match request rings full-screen like an incoming phone call for 47 seconds,
 * and stays available for 2 hours before permanently disappearing.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Alert } from '@/components/ui/dialog';
import { showMatchingInProgress } from './MatchingInProgress';
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

type ShowListener = (candidateId?: string, stage?: 'ringing' | 'details') => void;
const showListeners = new Set<ShowListener>();

/**
 * Trigger the incoming opportunity modal immediately (e.g. when a push notification
 * or its Accept/Decline action button is tapped).
 */
export function showIncomingOpportunity(
  candidateId?: string,
  stage: 'ringing' | 'details' = 'details',
): void {
  showListeners.forEach((fn) => fn(candidateId, stage));
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

/** Takes this offer's alerts off the phone, so nothing for it keeps sounding after an answer. */
async function clearOfferNotifications(candidateId: string): Promise<void> {
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

  const ensureTrayNotification = useCallback(async (opp: PhotographerOpportunity) => {
    if (Platform.OS === 'web') return;
    // In the foreground the modal is already ringing, and the server's own push covers the tray.
    if (AppState.currentState === 'active') return;
    if (notifiedTrayIdsRef.current.has(opp.candidateId)) return;
    notifiedTrayIdsRef.current.add(opp.candidateId);
    try {
      const where = opp.city || opp.venue || 'Rwanda';
      const when = opp.eventDate || 'Upcoming date';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Incoming Shoot Offer: ${opp.eventTitle}`,
          body: `${when} · ${where} · Tap Accept or Decline to review offer details`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'OPPORTUNITY_ALERT',
          data: {
            type: 'OPPORTUNITY',
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
    async (focusCandidateId?: string, requestedStage?: 'ringing' | 'details') => {
      if (!env.hybridBookingEnabled || !isEligible || isBusyRef.current) return;
      try {
        if (focusCandidateId) {
          dismissedRef.current = dismissedRef.current.filter((id) => id !== focusCandidateId);
          try {
            const directOpp = await getOpportunity(focusCandidateId);
            if (isBusyRef.current) return;
            if (directOpp && directOpp.candidateId && isOpenStatus(directOpp.status) && isWithinTwoHourWindow(directOpp)) {
              setModalStage(requestedStage ?? 'details');
              setActiveOpportunity(directOpp);
              return;
            }
          } catch {
            // Fall back to list check
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
          setActiveOpportunity(null);
        }
      } catch {
        // Background polling is non-blocking
      }
    },
    [isEligible, activeOpportunity, ensureTrayNotification],
  );

  // The timer below must outlive re-renders, so it calls the latest check through a ref instead of restarting.
  const checkRef = useRef(checkOpportunities);
  useEffect(() => {
    checkRef.current = checkOpportunities;
  }, [checkOpportunities]);

  // Silent poll every 5 seconds while the app is in the foreground, plus on resume, on push receipt and on explicit trigger.
  useEffect(() => {
    if (!env.hybridBookingEnabled || !isEligible) return;
    const check = (cid?: string, st?: 'ringing' | 'details') => void checkRef.current(cid, st);

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
    if (AppState.currentState === 'active') start();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        check();
        start();
      } else {
        stop();
      }
    });

    const pushReceived =
      Platform.OS === 'web'
        ? null
        : Notifications.addNotificationReceivedListener((notification) => {
            const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
            const type = typeof data.type === 'string' ? data.type.toUpperCase() : '';
            const cid =
              typeof data.candidateId === 'string'
                ? data.candidateId
                : type === 'OPPORTUNITY' && typeof data.referenceId === 'string'
                  ? data.referenceId
                  : undefined;
            if (cid) {
              notifiedTrayIdsRef.current.add(cid);
            }
            check(cid, 'ringing');
          });

    const onShow: ShowListener = (cid, st) => {
      check(cid, st ?? 'details');
    };
    showListeners.add(onShow);

    return () => {
      stop();
      subscription.remove();
      pushReceived?.remove();
      showListeners.delete(onShow);
    };
  }, [isEligible]);

  const handleApprove = async (
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
      if (e?.status === 409) {
        markDismissed(opp.candidateId);
        setActiveOpportunity(null);
      }
      Alert.alert('Approval error', e?.message || 'Could not approve this opportunity.');
    } finally {
      isBusyRef.current = false;
    }
  };

  const handleReject = async (opp: PhotographerOpportunity) => {
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
      Alert.alert('Decline error', e?.message || 'Could not decline this opportunity.');
    } finally {
      isBusyRef.current = false;
    }
  };

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
