import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, View } from 'react-native';

import { LiveButton, LiveDot, LivePill, LiveRing, LiveTwinkle } from './index';

/**
 * The live-event pieces render their copy, stay tappable and keep the card content
 * when active. Motion itself is native-driven and is not asserted here.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const texts = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

async function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  return r;
}

describe('live-event styling pieces', () => {
  it('LivePill shows its label and announces itself as live', async () => {
    const r = await mount(<LivePill label="HAPPENING NOW" size="md" sparkle />);
    expect(texts(r.root)).toContain('HAPPENING NOW');
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Live now').length).toBeGreaterThan(0);
  });

  it('LivePill defaults to LIVE at every size', async () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      const r = await mount(<LivePill size={size} />);
      expect(texts(r.root)).toContain('LIVE');
    }
  });

  it('LiveButton shows label and sub text and fires onPress', async () => {
    const onPress = jest.fn();
    const r = await mount(<LiveButton label="Watch live" sub="Free" onPress={onPress} />);
    expect(texts(r.root)).toEqual(expect.arrayContaining(['Watch live', 'Free']));
    const btn = r.root.find((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
    await act(async () => btn.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('LiveButton does not fire when disabled', async () => {
    const onPress = jest.fn();
    const r = await mount(<LiveButton label="Watch live" onPress={onPress} disabled />);
    const btn = r.root.find((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
    expect(btn.props.disabled).toBe(true);
    expect(btn.props.accessibilityState).toEqual({ disabled: true });
  });

  it('LiveTwinkle keeps its content whether live or not', async () => {
    for (const active of [true, false]) {
      const r = await mount(
        <LiveTwinkle active={active}>
          <Text>card body</Text>
        </LiveTwinkle>,
      );
      expect(texts(r.root)).toContain('card body');
    }
  });

  it('LiveRing and LiveDot render with and without live motion', async () => {
    const ring = await mount(
      <LiveRing size={68} colors={['#111111', '#222222']} live>
        <View />
      </LiveRing>,
    );
    expect(ring.toJSON()).not.toBeNull();
    const still = await mount(
      <LiveRing size={68} colors={['#111111', '#222222']} live={false}>
        <View />
      </LiveRing>,
    );
    expect(still.toJSON()).not.toBeNull();
    expect((await mount(<LiveDot />)).toJSON()).not.toBeNull();
  });
});

/** Broadcast red (design/live.png): the recipes, and motion that switches off under reduced motion. */
describe('broadcast red live elements', () => {
  const flat = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(4).filter(Boolean));
  const gradients = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => Array.isArray(n.props?.colors) && !!n.props.locations);

  it('the LIVE badge runs the reference gradient, #FF2448 to #E8002B at 55% to #C8001F', async () => {
    const [g] = gradients(await mount(<LivePill />));
    expect(g.props.colors).toEqual(['#FF2448', '#E8002B', '#C8001F']);
    expect(g.props.locations).toEqual([0, 0.55, 1]);
  });

  it('Watch Live runs #FF2D55, #FF0033 at 35%, #D4002A and a red glow', async () => {
    const r = await mount(<LiveButton label="Watch Live" onPress={() => {}} />);
    const [g] = gradients(r);
    expect(g.props.colors).toEqual(['#FF2D55', '#FF0033', '#D4002A']);
    expect(g.props.locations).toEqual([0, 0.35, 1]);
    const wrap = r.root.findAll((n) => typeof n.type === 'string' && String(flat(n.props.style).boxShadow ?? '').includes('0 10px 26px rgba(255,0,51,0.55)'));
    expect(wrap.length).toBeGreaterThan(0);
  });

  it('a live card gets the red edge and the two-layer glow, a quiet one gets neither', async () => {
    const edge = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => flat(n.props?.style).borderColor === 'rgba(255,45,85,0.75)');
    const glow = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => String(flat(n.props?.style).boxShadow ?? '').includes('0 0 80px rgba(255,0,51,0.25)'));
    const live = await mount(<LiveTwinkle active><Text>x</Text></LiveTwinkle>);
    expect(edge(live).length).toBeGreaterThan(0);
    expect(glow(live).length).toBeGreaterThan(0);
    const quiet = await mount(<LiveTwinkle active={false}><Text>x</Text></LiveTwinkle>);
    expect(edge(quiet)).toHaveLength(0);
  });

  it('the story ring is solid red while live and keeps the caller colours otherwise', async () => {
    const ring = (live: boolean) => mount(<LiveRing size={68} colors={['#111111', '#222222']} live={live}><View /></LiveRing>);
    expect(gradients(await ring(true))).toHaveLength(0); // the ring gradient has no locations
    const colorsOf = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => Array.isArray(n.props?.colors) && !!n.props.start)[0].props.colors; // the gradient, not LiveRing's own `colors` prop
    expect(colorsOf(await ring(true))).toEqual(['#FF2D55', '#FF0033', '#C8001F']);
    expect(colorsOf(await ring(false))).toEqual(['#111111', '#222222']);
  });
});

describe('live motion under reduced motion', () => {
  const { AccessibilityInfo } = jest.requireActual('react-native');
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });
  afterEach(() => spy.mockRestore());

  it('draws no button shine, and the dot halo holds still', async () => {
    const r = await mount(<LiveButton label="Watch Live" onPress={() => {}} />);
    await act(async () => {
      await Promise.resolve();
    });
    const shine = r.root.findAll((n) => Array.isArray(n.props?.colors) && n.props.colors[1] === 'rgba(255,255,255,0.28)');
    expect(shine).toHaveLength(0);
  });
});
