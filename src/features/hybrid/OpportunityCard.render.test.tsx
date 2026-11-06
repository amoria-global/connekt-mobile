import '@/test/autoUnmount';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { OpportunityCard } from './OpportunityCard';
import type { PhotographerOpportunity } from './types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const scope =
  '[OFFER_SCOPE] | Mode: Photography + video | Client: Individual | Coverage: 6 hours | Photos: 100 | ShortVideos: 2 × 30 seconds | LongVideos: None | LiveStream: Not requested | InstantWishes: Not requested | PhotoBook: None | PhotoAlbum: None | WallPortraits: None | InstantUpdates: Not requested | DigitalDelivery: Within 7 days after the event | PrintDelivery: None | PackageTier: Recommended | PricingDecision: MY_OFFER_ANYWAY';

const opp = {
  candidateId: 'c1',
  eventId: 'e1',
  eventType: 'wedding',
  city: 'kigali',
  eventDate: '2026-11-07',
  maxBudget: 970000,
  status: 'INVITED',
  instructions: scope,
  responseDeadlineAt: new Date(Date.now() + 52 * 60 * 1000).toISOString(),
  matchReasons: ['Available for the full event (6 hrs)', 'Wedding specialty fits this event', 'In the event\'s city', 'Freelancer requested', 'Instagram profile enriched'],
} as unknown as PhotographerOpportunity;

function render(handlers: { onApprove?: jest.Mock; onReject?: jest.Mock; onPress?: jest.Mock } = {}) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <OpportunityCard opportunity={opp} onApprove={handlers.onApprove ?? jest.fn()} onReject={handlers.onReject ?? jest.fn()} onPress={handlers.onPress} />,
    );
  });
  const all = r.root.findAllByType(Text).map((t) => [t.props.children].flat(3).filter((c) => typeof c === 'string').join('')).join('\n');
  return { r, all };
}

const press = (r: TestRenderer.ReactTestRenderer, label: string) =>
  act(() => {
    r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress();
  });

describe('opportunity card', () => {
  it('reads as a nearby opportunity with the client\'s offer as the big number, in RWF, with places in title case', () => {
    const { all } = render({ onPress: jest.fn() });
    expect(all).toContain('NEW NEARBY OPPORTUNITY');
    expect(all).toContain('Wedding · Kigali');
    expect(all).toContain("CLIENT'S OFFER");
    expect(all).toContain('RWF 970,000');
    expect(all).not.toMatch(/\bRF\b/);
  });

  it('shows the real print products only when there are some: this offer has none, so no Book or Portraits line', () => {
    const { all } = render({ onPress: jest.fn() });
    expect(all).not.toMatch(/Book|Portraits|Album/);
    expect(all).toContain('7 days after');
  });

  it('has no Accept: it offers Decline and View offer, and both open Offer details', () => {
    const onPress = jest.fn();
    const onApprove = jest.fn();
    const { r, all } = render({ onPress, onApprove });
    expect(all).not.toMatch(/\bAccept\b(?! happens)/);
    press(r, 'View offer');
    expect(onPress).toHaveBeenCalledWith(opp);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('shows at most three match chips and counts the rest', () => {
    const { all } = render({ onPress: jest.fn() });
    expect(all).toContain('Available 6 hrs');
    expect(all).toContain('Wedding specialty');
    expect(all).toContain('In Kigali');
    expect(all).toContain('100 photos · 2 clips');
    expect(all).toContain('+2 more');
    expect(all).not.toContain('Freelancer');
  });
});
