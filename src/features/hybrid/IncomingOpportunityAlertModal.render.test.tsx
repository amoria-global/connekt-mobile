import '@/test/autoUnmount';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { IncomingOpportunityAlertModal } from './IncomingOpportunityAlertModal';
import type { PhotographerOpportunity } from './types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (x: unknown) => x,
    withTiming: (x: unknown) => x,
    withSequence: (...a: unknown[]) => a[0],
    Easing: { inOut: () => 0, ease: 0 },
  };
});
jest.mock('@/utils/safeAudio', () => ({
  createAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), remove: jest.fn(), loop: false }),
  setAudioModeAsync: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const offer = {
  candidateId: 'c1',
  eventId: 'e1',
  eventTitle: 'Wedding · kigali',
  eventType: 'Wedding',
  city: 'kigali',
  venue: 'kigali',
  eventDate: '2026-11-07',
  startTime: '12:00:00',
  endTime: '18:00:00',
  maxBudget: 970000,
  currency: 'RWF',
  status: 'INVITED',
  invitedAt: new Date().toISOString(),
  matchedPackageName: 'Diamond',
  matchedPackagePrice: 89997,
  matchedPackageCurrency: 'RWF',
  matchedPackageDeliveryDays: 7,
} as unknown as PhotographerOpportunity;

function render(stage: 'ringing' | 'details', handlers: { onApprove?: jest.Mock; onReject?: jest.Mock } = {}) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <IncomingOpportunityAlertModal
        opportunity={offer}
        visible
        initialStage={stage}
        onApprove={handlers.onApprove ?? jest.fn()}
        onReject={handlers.onReject ?? jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
  });
  const texts = r.root.findAllByType(Text).map((t) => [t.props.children].flat(3).filter((c) => typeof c === 'string').join(''));
  return { r, texts, all: texts.join('\n') };
}

describe('offer details, as the photographer sees it', () => {
  it('uses plain wording, capitalised places, and the code before the amount', () => {
    const { all } = render('details');
    expect(all).toContain('Wedding · Kigali');
    expect(all).toContain('RWF 970,000');
    expect(all).toContain('Offer details');
    expect(all).toContain('Accept offer · RWF 970,000');
    expect(all).toContain("Client's delivery schedule");
    expect(all).toContain('My package delivery policy');
    expect(all).toContain('Reject offer');
    expect(all).toContain('Diamond');
    expect(all).toContain('RWF 89,997');
  });

  it('words the price difference for the photographer: an offer above the package is good news', () => {
    const { all } = render('details');
    expect(all).toContain('Client offers RWF 880,003 more than your package');
    expect(all).not.toMatch(/below the client's offer/);
  });

  it('merges the deliverables the client did not ask for into one Not included line', () => {
    const { all } = render('details');
    expect(all).toContain('Requested deliverables'.toUpperCase());
    expect(all.match(/None/g) ?? []).toHaveLength(0);
  });

  it('no longer explains how things work or shows the old wordmark', () => {
    const { all } = render('details');
    expect(all).not.toMatch(/Client published their own budget/);
    expect(all).not.toMatch(/Both acceptance options/);
    expect(all).not.toMatch(/requires client agreement/);
    expect(all).not.toMatch(/Client selects a professional/);
    expect(all).not.toMatch(/C O N N E K Y T/);
    expect(all).not.toMatch(/Viewing as/);
    expect(all).not.toMatch(/Accept with my delivery terms/);
  });

  const pressByLabel = (r: TestRenderer.ReactTestRenderer, label: string) =>
    act(() => {
      r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress();
    });

  it('answers from one sticky Accept: the delivery option chosen decides which existing handler runs', async () => {
    const onApprove = jest.fn();
    const { r } = render('details', { onApprove });
    // The client's schedule is chosen by default.
    await act(async () => {
      r.root.findAll((n) => n.props.accessibilityLabel === 'Accept offer' && typeof n.props.onPress === 'function')[0].props.onPress();
    });
    expect(onApprove).toHaveBeenLastCalledWith(offer, 'CLIENT');
    // Choose the package policy, then the same button runs the package handler.
    pressByLabel(r, 'My package delivery policy');
    await act(async () => {
      r.root.findAll((n) => n.props.accessibilityLabel === 'Accept offer' && typeof n.props.onPress === 'function')[0].props.onPress();
    });
    expect(onApprove).toHaveBeenLastCalledWith(offer, 'PHOTOGRAPHER_PACKAGE');
    expect(onApprove).toHaveBeenCalledTimes(2);
  });

  it('offers the delivery choice as two radios, with Reject offer separate', async () => {
    const onReject = jest.fn();
    const { r } = render('details', { onReject });
    const radios = r.root.findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function');
    expect(radios.map((n) => n.props.accessibilityLabel)).toEqual(["Client's delivery schedule", 'My package delivery policy']);
    expect(radios.filter((n) => n.props.accessibilityState?.checked)).toHaveLength(1);
    await act(async () => {
      r.root.findAll((n) => n.props.accessibilityLabel === 'Reject offer' && typeof n.props.onPress === 'function')[0].props.onPress();
    });
    expect(onReject).toHaveBeenCalledWith(offer);
  });

  it('lets long values wrap instead of cutting them off', () => {
    const { r } = render('details');
    const values = r.root.findAllByType(Text).filter((t) => /^(Within|You propose)/.test(String(t.props.children)));
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(v.props.numberOfLines).toBeUndefined();
  });
});

describe('offer call screen', () => {
  it('reads as a new offer with Decline and Accept', () => {
    const { all } = render('ringing');
    expect(all).toContain('New offer');
    expect(all).toContain('RWF 970,000');
    expect(all).toContain('Decline');
    expect(all).toContain('Accept');
    expect(all).not.toMatch(/INCOMING OFFER CALL/);
  });
});
