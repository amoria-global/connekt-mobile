import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';

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

function render(stage: 'ringing' | 'details') {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <IncomingOpportunityAlertModal
        opportunity={offer}
        visible
        initialStage={stage}
        onApprove={jest.fn()}
        onReject={jest.fn()}
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
    expect(all).toContain('Accept offer');
    expect(all).toContain('Accept with my delivery package policy');
    expect(all).toContain('Reject offer');
    expect(all).toContain('Diamond · RWF 89,997');
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

  it('keeps the two accept buttons together in one row and Reject offer on its own', () => {
    const { r } = render('details');
    const holds = (v: TestRenderer.ReactTestInstance, label: string) =>
      v.findAll((n) => n.props.accessibilityLabel === label).length > 0;
    // A container that holds both accept buttons but not Reject offer is the row they share.
    const sharedRow = r.root
      .findAllByType(View)
      .filter((v) => holds(v, 'Accept offer') && holds(v, 'Accept with my delivery package policy') && !holds(v, 'Reject offer'));
    expect(sharedRow.length > 0).toBe(true);
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
