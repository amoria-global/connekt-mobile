/**
 * GlobalOpportunityCallNotifier — App-wide incoming shoot alert listener.
 * Mounted in `(app)/_layout.tsx` so that when a photographer is using the app
 * on ANY screen or tab (Home, Events, Bookings, Wallet, Chat, etc.), an incoming
 * shoot match request rings full-screen like an incoming phone call for 47 seconds,
 * and stays available for 2 hours before permanently disappearing.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { useRouter } from 'expo-router';
import { useRole } from '@/features/auth/role';
import { env } from '@/config/env';
import { listOpportunities, approveOpportunity, rejectOpportunity, serverNowMs } from './api';
import type { OpportunityDeliveryPolicy, PhotographerOpportunity } from './types';
import {
  IncomingOpportunityAlertModal,
  OPPORTUNITY_AVAILABILITY_WINDOW_MS,
} from './IncomingOpportunityAlertModal';

function isWithinTwoHourWindow(opp: PhotographerOpportunity): boolean {
  const now = serverNowMs();
  const deadlineStr = opp.responseDeadlineAt || opp.candidateExpiresAt;
  if (deadlineStr) {
    const deadlineMs = Date.parse(deadlineStr);
    if (Number.isFinite(deadlineMs)) {
      return deadlineMs > now;
    }
  }
  if (opp.invitedAt) {
    const invitedMs = Date.parse(opp.invitedAt);
    if (Number.isFinite(invitedMs)) {
      return invitedMs + OPPORTUNITY_AVAILABILITY_WINDOW_MS > now;
    }
  }
  return true;
}

export function GlobalOpportunityCallNotifier() {
  const router = useRouter();
  const { isPhotographer, isCoordinator } = useRole();
  const isEligible = isPhotographer || isCoordinator;

  const [activeOpportunity, setActiveOpportunity] = useState<PhotographerOpportunity | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const isBusyRef = useRef(false);

  const checkOpportunities = useCallback(async () => {
    if (!env.hybridBookingEnabled || !isEligible || isBusyRef.current) return;
    try {
      const opps = await listOpportunities();
      if (!Array.isArray(opps) || opps.length === 0) {
        if (activeOpportunity && !opps.some((o) => o.candidateId === activeOpportunity.candidateId)) {
          setActiveOpportunity(null);
        }
        return;
      }

      // Find first pending opportunity not dismissed and still within its 2-hour window
      const pending = opps.find((opp) => {
        const s = (opp.status ?? '').toUpperCase();
        const isClosed =
          s === 'APPROVED' ||
          s === 'REJECTED' ||
          s === 'DECLINED' ||
          s === 'EXPIRED' ||
          s === 'WITHDRAWN' ||
          s === 'NO_LONGER_AVAILABLE';
        return !isClosed && isWithinTwoHourWindow(opp) && !dismissedIds.includes(opp.candidateId);
      });

      if (pending) {
        setActiveOpportunity((prev) => (prev?.candidateId === pending.candidateId ? prev : pending));
      } else {
        setActiveOpportunity(null);
      }
    } catch {
      // Background polling is non-blocking
    }
  }, [isEligible, dismissedIds, activeOpportunity]);

  // Polling loop every 5 seconds + on foreground resume
  useEffect(() => {
    if (!env.hybridBookingEnabled || !isEligible) return;

    void checkOpportunities();
    const interval = setInterval(checkOpportunities, 5000);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void checkOpportunities();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [checkOpportunities, isEligible]);

  const handleApprove = async (
    opp: PhotographerOpportunity,
    deliveryPolicy: OpportunityDeliveryPolicy = 'CLIENT',
  ) => {
    try {
      isBusyRef.current = true;
      await approveOpportunity(opp.candidateId, { deliveryPolicy });
      setDismissedIds((ids) => [...ids, opp.candidateId]);
      setActiveOpportunity(null);
      const policyNote =
        deliveryPolicy === 'PHOTOGRAPHER_PACKAGE'
          ? 'with your package delivery policy (digital & print delivery will update to your package schedule once the client confirms you)'
          : "with the client's requested delivery policy";
      Alert.alert(
        'Offer accepted',
        `You accepted ${opp.eventTitle} ${policyNote}. The client can now review and confirm you.`,
        [
          {
            text: 'View Opportunities',
            onPress: () => router.push('/bookings?tab=opportunities' as never),
          },
          { text: 'OK' },
        ],
      );
    } catch (e: any) {
      // 409: the invite closed, or the calendar now overlaps and it was released. Don't keep ringing for it.
      if (e?.status === 409) {
        setDismissedIds((ids) => [...ids, opp.candidateId]);
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
      setDismissedIds((ids) => [...ids, opp.candidateId]);
      setActiveOpportunity(null);
      Alert.alert(
        'Offer Rejected',
        'You passed on this offer. It remains active for other available photographers.',
      );
    } catch (e: any) {
      Alert.alert('Decline error', e?.message || 'Could not decline this opportunity.');
    } finally {
      isBusyRef.current = false;
    }
  };

  const handleDismiss = () => {
    if (activeOpportunity) {
      setDismissedIds((prev) => [...prev, activeOpportunity.candidateId]);
      setActiveOpportunity(null);
    }
  };

  const handleOpenOfferPage = (opp: PhotographerOpportunity) => {
    // Navigate photographer dashboard to incoming opportunities page while keeping Offer Details open
    router.push(`/bookings?tab=opportunities&candidate=${encodeURIComponent(opp.candidateId)}` as never);
  };

  if (!env.hybridBookingEnabled || !isEligible || !activeOpportunity) {
    return null;
  }

  return (
    <IncomingOpportunityAlertModal
      opportunity={activeOpportunity}
      visible={activeOpportunity !== null}
      initialStage="ringing"
      onApprove={handleApprove}
      onReject={handleReject}
      onDismiss={handleDismiss}
      onOpenOfferPage={handleOpenOfferPage}
    />
  );
}
