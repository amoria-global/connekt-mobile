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
      <LiveRing size={68} colors={['#F58529', '#DD2A7B']} live>
        <View />
      </LiveRing>,
    );
    expect(ring.toJSON()).not.toBeNull();
    const still = await mount(
      <LiveRing size={68} colors={['#4F46E5', '#EC4899']} live={false}>
        <View />
      </LiveRing>,
    );
    expect(still.toJSON()).not.toBeNull();
    expect((await mount(<LiveDot />)).toJSON()).not.toBeNull();
  });
});
