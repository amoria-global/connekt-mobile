import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BusinessOverview, EarningRow, PriorityCard, ShootCard } from './homeParts';
import { ProgressRing, SegmentRing, TrendChart, trendGeometry } from './charts';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-image', () => ({ Image: () => null }));

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

const tiles = [
  { key: 'a', label: 'Completed shoots', value: '15', icon: 'camera-outline' as const },
  { key: 'b', label: 'Clients served', value: 'N/A', icon: 'people-outline' as const },
];

describe('SegmentRing and ProgressRing', () => {
  const circles = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(Circle).length;

  it('draws only its track when there is nothing to show', () => {
    expect(circles(mount(<SegmentRing label="empty" segments={[]} />))).toBe(1);
  });

  it('ignores zero, negative and non-finite segments, so they cannot look like data', () => {
    const r = mount(
      <SegmentRing
        label="mixed"
        segments={[
          { value: 0, color: '#111' },
          { value: -4, color: '#222' },
          { value: Number.NaN, color: '#333' },
          { value: 5, color: '#444' },
        ]}
      />,
    );
    expect(circles(r)).toBe(2);
    expect(r.root.findAllByType(Svg)).toHaveLength(1);
  });

  it('a missing value is an empty track, not progress', () => {
    expect(circles(mount(<ProgressRing label="none" fraction={null} color="#f0f" />))).toBe(1);
    expect(circles(mount(<ProgressRing label="zero" fraction={0} color="#f0f" />))).toBe(1);
  });

  it('describes itself for a screen reader', () => {
    const r = mount(<ProgressRing label="Rating 4.5 out of 5" fraction={0.9} color="#f0f" />);
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Rating 4.5 out of 5').length).toBeGreaterThan(0);
  });
});

describe('BusinessOverview', () => {
  const base = { earnings: '$4,820.00', earningsCaption: 'Since you joined', loadingReviews: false, loading: false, tiles, reviewCount: 0 };

  it('says "No reviews yet" instead of drawing a rating', () => {
    const text = flat(mount(<BusinessOverview {...base} rating={null} />).root);
    expect(text).toContain('No reviews yet');
    expect(text).not.toContain('out of 5');
  });

  it('shows N/A, not "no reviews", while reviews are still loading', () => {
    const text = flat(mount(<BusinessOverview {...base} rating={null} loadingReviews />).root);
    expect(text).toContain('N/A');
    expect(text).not.toContain('No reviews yet');
  });

  it('shows the real rating and review count, singular and plural', () => {
    expect(flat(mount(<BusinessOverview {...base} rating={4.6} reviewCount={3} />).root)).toContain('3 reviews');
    const one = flat(mount(<BusinessOverview {...base} rating={5} reviewCount={1} />).root);
    expect(one).toContain('1 review');
    expect(one).not.toContain('1 reviews');
  });

  it('never claims "0 reviews" beside a rating whose reviews were not listed', () => {
    const text = flat(mount(<BusinessOverview {...base} rating={4.6} reviewCount={0} />).root);
    expect(text).toContain('4.6');
    expect(text).not.toContain('0 reviews');
    expect(text).toContain('Average rating');
  });

  it('keeps an unknown figure as N/A and a real one as given', () => {
    const text = flat(mount(<BusinessOverview {...base} rating={null} />).root);
    expect(text).toContain('15');
    expect(text).toContain('N/A');
    expect(text).toContain('$4,820.00');
  });

  it('shows no figures while loading', () => {
    const text = flat(mount(<BusinessOverview {...base} loading rating={null} />).root);
    expect(text).not.toContain('$4,820.00');
    expect(text).not.toContain('15');
  });
});

describe('ShootCard and PriorityCard', () => {
  const shoot = { title: 'Uwase wedding', status: { label: 'Scheduled', tone: 'info' as const }, when: 'Oct 17, 2026 · 9:00 AM' };

  it('shows only the facts it was given', () => {
    const text = flat(mount(<ShootCard shoot={shoot} actions={null} />).root);
    expect(text).toContain('Uwase wedding');
    expect(text).toContain('Scheduled');
    expect(text).not.toContain('Client:');
  });

  it('names the client and location when they exist', () => {
    const text = flat(mount(<ShootCard shoot={{ ...shoot, client: 'Amina', location: 'Kigali' }} actions={null} />).root);
    expect(text).toContain('Client: Amina');
    expect(text).toContain('Kigali');
  });

  it('the priority card carries its single action', () => {
    const onAction = jest.fn();
    const r = mount(<PriorityCard title="Uwase wedding" when="Today, 9:00 AM" status={shoot.status} actionLabel="View shoot" onAction={onAction} />);
    const btn = r.root.findAll((n) => n.props?.accessibilityLabel === 'View shoot' && typeof n.props.onPress === 'function')[0];
    act(() => btn.props.onPress());
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('EarningRow', () => {
  it('carries the amount, its real status word and an accessible summary', () => {
    const onPress = jest.fn();
    const r = mount(
      <EarningRow
        title="Booking payout"
        when="Sep 29, 2026"
        amount="+$95.50"
        positive
        status={{ label: 'COMPLETED', tone: 'success' }}
        divider={false}
        onPress={onPress}
        a11y="Booking payout, +$95.50, COMPLETED"
      />,
    );
    const text = flat(r.root);
    expect(text).toContain('+$95.50');
    expect(text).toContain('COMPLETED');
    const row = r.root.findAll((n) => n.props?.accessibilityLabel === 'Booking payout, +$95.50, COMPLETED')[0];
    act(() => row.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });
});

describe('trendGeometry and TrendChart', () => {
  it('puts each point at the centre of an equal column, so a label row lines up under it', () => {
    const g = trendGeometry([1, 2, 3, 4], 400, 150);
    expect(g.pts.map((p) => p.x)).toEqual([50, 150, 250, 350]);
  });

  it('draws the largest value at the top padding and zero on the baseline', () => {
    const g = trendGeometry([0, 10, 5], 300, 150, 26, 6);
    expect(g.pts[1].y).toBe(26);
    expect(g.pts[0].y).toBe(144);
    expect(g.pts[2].y).toBe(85);
  });

  it('a chart of zeros is flat on the baseline, never a peak', () => {
    const g = trendGeometry([0, 0, 0], 300, 150);
    expect(new Set(g.pts.map((p) => p.y))).toEqual(new Set([g.base]));
  });

  it('a negative value is clamped to the baseline', () => {
    expect(trendGeometry([-5, 10], 200, 100).pts[0].y).toBe(94);
  });

  it('the curve never leaves the band between the peak and the baseline', () => {
    const g = trendGeometry([3, 9, 1, 7], 400, 150);
    const ys = [...g.line.matchAll(/C ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) /g)].flatMap((m) => [Number(m[2]), Number(m[4])]);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(26);
    expect(Math.max(...ys)).toBeLessThanOrEqual(g.base);
  });

  it('handles no points and a single point without a curve segment', () => {
    expect(trendGeometry([], 300, 150).line).toBe('');
    expect(trendGeometry([5], 300, 150).line).not.toContain('C');
  });

  it('renders nothing until it has a width, then draws the curve and one dot per interval', () => {
    const r = mount(<TrendChart values={[1, 3, 2]} peakIndex={1} />);
    expect(r.root.findAllByType(Circle)).toHaveLength(0);
    const host = r.root.findAll((n) => typeof n.props?.onLayout === 'function')[0];
    act(() => host.props.onLayout({ nativeEvent: { layout: { width: 300, height: 150 } } }));
    expect(r.root.findAllByType(Circle)).toHaveLength(3);
    expect(flat(r.root)).toContain('Peak');
  });
});
