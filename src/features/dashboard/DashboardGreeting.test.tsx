import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { DashboardGreeting, GREETING_ROTATE_MS } from '@/features/dashboard/DashboardGreeting';
import { GREETINGS, NAME_GRADIENT, gradientChars, mixHex, timeOfDay } from '@/features/dashboard/greetingModel';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockReduced = false;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));

/** The windows and phrases are the web dashboards', so a user reads the same welcome on both. */
describe('greeting model', () => {
  const at = (h: number) => timeOfDay(new Date(2026, 9, 21, h, 0, 0));

  it('uses the web time-of-day windows', () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21, 23, 0].map(at)).toEqual([
      'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night', 'night',
    ]);
  });

  it('has eight phrases per window, starting with the plain Good greeting', () => {
    for (const k of ['morning', 'afternoon', 'evening', 'night'] as const) {
      expect(GREETINGS[k]).toHaveLength(8);
      expect(GREETINGS[k][0]).toMatch(/^Good /);
    }
  });

  it('runs the name from the brand start colour to the end colour', () => {
    const g = gradientChars('Joseph', NAME_GRADIENT.light.from, NAME_GRADIENT.light.to);
    expect(g.map((x) => x.ch).join('')).toBe('Joseph');
    expect(g[0].color).toBe('#083A85');
    expect(g[g.length - 1].color).toBe('#F20C8F');
    expect(new Set(g.map((x) => x.color)).size).toBe(6);
  });

  it('survives a one character and an empty name', () => {
    expect(gradientChars('A', '#000000', '#FFFFFF')).toEqual([{ ch: 'A', color: '#000000' }]);
    expect(gradientChars('', '#000000', '#FFFFFF')).toEqual([]);
    expect(mixHex('#000000', '#FFFFFF', 2)).toBe('#FFFFFF');
  });
});

describe('dashboard greeting as rendered', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduced = false;
  });
  afterEach(() => jest.useRealTimers());

  const mount = (props: Partial<React.ComponentProps<typeof DashboardGreeting>> = {}) => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<DashboardGreeting name="Joseph" subtitle="Wednesday, October 21" {...props} />);
    });
    return r;
  };
  const header = (r: TestRenderer.ReactTestRenderer) =>
    r.root.findAll((n) => n.props.accessibilityRole === 'header')[0].props.accessibilityLabel as string;

  it('shows the eyebrow, a time-of-day greeting with the name, the subtitle and the trailing control', () => {
    const r = mount({ trailing: <Text>TRAIL</Text> });
    const all = r.root.findAllByType(Text).map((t) => t.props.children);
    expect(all).toContain('Your dashboard');
    expect(all).toContain('Wednesday, October 21');
    expect(all).toContain('TRAIL');
    expect(header(r)).toMatch(/, Joseph$/);
    expect(GREETINGS[timeOfDay()]).toContain(header(r).replace(', Joseph', ''));
  });

  it('draws one glyph per character of the name in gradient colours', () => {
    const r = mount();
    const glyphs = r.root.findAllByType(Text).filter((t) => typeof t.props.children === 'string' && t.props.children.length === 1);
    expect(glyphs.map((t) => t.props.children).join('')).toBe('Joseph');
    expect(glyphs[0].props.style.color).not.toBe(glyphs[5].props.style.color);
  });

  it('rotates to the next phrase every five seconds', () => {
    const r = mount();
    const first = header(r);
    act(() => {
      jest.advanceTimersByTime(GREETING_ROTATE_MS + 200);
    });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(header(r)).not.toBe(first);
    expect(header(r)).toMatch(/, Joseph$/);
  });

  it('keeps one fixed phrase and starts no timer when Reduce motion is on', () => {
    mockReduced = true;
    const r = mount();
    const first = header(r);
    act(() => {
      jest.advanceTimersByTime(GREETING_ROTATE_MS * 3);
    });
    expect(header(r)).toBe(first);
    expect(jest.getTimerCount()).toBe(0);
  });
});
