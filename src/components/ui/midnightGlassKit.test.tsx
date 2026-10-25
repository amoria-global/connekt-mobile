import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';

import { Button, GhostButton, PrimaryButton } from './Button';
import { WeekStrip, type WeekDay } from './WeekStrip';
import { BentoGrid, BentoTile } from './BentoGrid';
import { EmptyState, ErrorState } from './EmptyState';
import { statusChipTone } from './StatusPill';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/features/auth/role', () => ({
  useRole: () => ({ isPhotographer: true }),
}));

const texts = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')));
const flatten = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(4).filter(Boolean));
const buttons = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => n.props?.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && typeof n.type !== 'string');

const dayButtons = (r: TestRenderer.ReactTestRenderer) =>
  // Host views only: each Pressable renders exactly one, carrying its role, state and style.
  r.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button' && !!n.props.accessibilityState && typeof n.props.accessibilityState.selected === 'boolean');

function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

/** Monday 19 to Sunday 25 October 2026, the week in design/events.png. */
const WEEK: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(2026, 9, 19 + i);
  return { key: `2026-10-${19 + i}`, date, count: i === 5 ? 1 : 0, accessibilityLabel: date.toDateString() };
});

describe('WeekStrip', () => {
  const strip = (selected: string) =>
    mount(<WeekStrip title="October 19 - 25" days={WEEK} selected={selected} onSelect={() => {}} onPrev={() => {}} onNext={() => {}} />);

  it('shows all seven days, Sunday included, without a scroller to hide one', () => {
    const r = strip('2026-10-25');
    expect(r.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(texts(r.root)).toEqual(expect.arrayContaining(['19', '20', '21', '22', '23', '24', '25']));
    const days = dayButtons(r);
    expect(days).toHaveLength(7);
    expect(days.filter((d) => d.props.accessibilityState.selected).map((d) => d.props.accessibilityLabel)).toEqual([WEEK[6].accessibilityLabel]);
  });

  it('gives each day an equal column at least 44pt tall', () => {
    const r = strip('2026-10-19');
    const days = dayButtons(r);
    expect(days).toHaveLength(7);
    for (const d of days) {
      const s = flatten(d.props.style);
      expect(s.flex).toBe(1);
      expect(s.minHeight as number).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('buttons', () => {
  const style = (r: TestRenderer.ReactTestRenderer) => {
    const p = buttons(r)[0].props;
    return flatten(typeof p.style === 'function' ? p.style({ pressed: false }) : p.style);
  };

  it('raises only PrimaryButton: a glow on it, none on the flat or ghost ones', () => {
    expect(String(style(mount(<PrimaryButton title="Create event" onPress={() => {}} />)).boxShadow)).toMatch(/0 8px 24px rgba\(62,111,216,0\.45\)/);
    expect(String(style(mount(<Button title="View shoot" onPress={() => {}} />)).boxShadow)).not.toMatch(/8px 24px/);
    expect(String(style(mount(<GhostButton title="Remove" onPress={() => {}} />)).boxShadow)).not.toMatch(/8px 24px/);
  });

  it('keeps every button at least 44pt tall', () => {
    for (const el of [<PrimaryButton key="p" title="A" onPress={() => {}} />, <GhostButton key="g" title="B" onPress={() => {}} />]) {
      expect(style(mount(el)).minHeight as number).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('empty and error states are never dead ends', () => {
  it('an empty state offers its next step and a secondary one', () => {
    const r = mount(
      <EmptyState
        icon="calendar-outline"
        title="A clear day"
        message="Nothing scheduled today."
        action={{ label: 'Create event', onPress: () => {}, raised: true }}
        secondary={{ label: 'Jump to next', onPress: () => {} }}
      />,
    );
    expect(texts(r.root)).toEqual(expect.arrayContaining(['A clear day', 'Create event', 'Jump to next']));
    expect(buttons(r)).toHaveLength(2);
  });

  it('an error state offers a retry', () => {
    const onRetry = jest.fn();
    const r = mount(<ErrorState onRetry={onRetry} />);
    act(() => buttons(r)[0].props.onPress());
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('BentoGrid', () => {
  it('lets a hero tile span both columns and pairs the rest', () => {
    const r = mount(
      <BentoGrid>
        <BentoTile span={2}><Text>Hero</Text></BentoTile>
        <BentoTile><Text>A</Text></BentoTile>
        <BentoTile><Text>B</Text></BentoTile>
        <BentoTile><Text>C</Text></BentoTile>
      </BentoGrid>,
    );
    expect(texts(r.root)).toEqual(['Hero', 'A', 'B', 'C']);
  });
});

describe('status chip colour meaning', () => {
  it.each([
    ['Ongoing', 'live'],
    ['PENDING', 'pending'],
    ['Completed', 'success'],
    ['Cancelled', 'error'],
    ['Scheduled', 'primary'],
  ])('%s is %s', (status, tone) => {
    expect(statusChipTone(status)).toBe(tone);
  });
});
