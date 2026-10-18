import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { PhotographerRow } from './PhotographerRow';
import type { Photographer } from './api';
import { DEFAULT_CURRENCIES, useCurrency } from '@/store/currency';

/** The compact directory row: what it shows from the API, and what it refuses to invent. */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('expo-image', () => ({ Image: () => null }));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

const base: Photographer = { id: 'p1', name: 'Eric Mugisha', location: 'Kigali', category: 'Weddings', specialties: ['Weddings', 'Portraits', 'Corporate'] };

async function mount(p: Partial<Photographer>, handlers: { open?: () => void; bookmark?: () => void; saved?: boolean } = {}) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PhotographerRow photographer={{ ...base, ...p }} isBookmarked={!!handlers.saved} onOpen={handlers.open ?? (() => {})} onToggleBookmark={handlers.bookmark ?? (() => {})} />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}
const byLabel = (r: TestRenderer.ReactTestRenderer, re: RegExp) => r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && re.test(n.props.accessibilityLabel) && typeof n.props.onPress === 'function')[0];

beforeEach(() => useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES }));

describe('photographer row', () => {
  it('shows the API facts: rating with its review count, status, two tags and a +1 overflow', async () => {
    const r = await mount({ rating: 4.9, reviewCount: 32, startingPrice: 150, startingPriceCurrency: 'USD', currentStatus: 'available' });
    const text = flat(r.root);
    expect(text).toContain('4.9 (32)');
    expect(text).toContain('Available');
    expect(text).toContain('Weddings');
    expect(text).toContain('Portraits');
    expect(text).toContain('+1');
    expect(text).toContain('From $150.00');
  });

  it('draws no rating at all without one, and never a "New" star or a zero', async () => {
    const r = await mount({ rating: undefined, reviewCount: 0 });
    const text = flat(r.root);
    expect(text).not.toMatch(/New|0\.0|\(0\)/);
    expect(r.root.findAll((n) => n.props?.name === 'star').length).toBe(0);
  });

  it('a price with no price is On request and a RWF price is not called dollars', async () => {
    expect(flat((await mount({ startingPrice: undefined })).root)).toContain('On request');
    const t = flat((await mount({ startingPrice: 150000, startingPriceCurrency: 'RWF' })).root);
    expect(t).toContain('RWF');
    expect(t).not.toContain('$');
  });

  it('a booked photographer says Booked', async () => {
    expect(flat((await mount({ currentStatus: 'booked' })).root)).toContain('Booked');
  });

  it('draws the verified seal only when verified', async () => {
    const yes = await mount({ isVerified: true });
    expect(yes.root.findAll((n) => n.props?.accessibilityLabel === 'Verified').length).toBeGreaterThan(0);
    const no = await mount({ isVerified: false });
    expect(no.root.findAll((n) => n.props?.accessibilityLabel === 'Verified').length).toBe(0);
  });

  it('opens on the row and toggles the bookmark on its own control, each labelled', async () => {
    const open = jest.fn();
    const bookmark = jest.fn();
    const r = await mount({}, { open, bookmark });
    await act(async () => byLabel(r, /^Open Eric Mugisha/).props.onPress());
    await act(async () => byLabel(r, /^Save Eric Mugisha$/).props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    expect(bookmark).toHaveBeenCalledTimes(1);
  });

  it('a saved photographer offers to remove, and says it is selected', async () => {
    const r = await mount({}, { saved: true });
    const b = byLabel(r, /^Remove Eric Mugisha from saved photographers$/);
    expect(b.props.accessibilityState).toEqual({ selected: true });
  });

  it('with no image it shows an initial, not a blank box', async () => {
    expect(flat((await mount({ avatar: undefined, coverImage: undefined, images: undefined, name: 'Grace' })).root)).toContain('G');
  });
});
