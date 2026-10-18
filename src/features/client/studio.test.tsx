import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { HeroActionCard, ListRow, ProgressTrack } from './studio';

/** The night-studio building blocks: behaviour and accessibility, not pixels. */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: (p: { children: React.ReactNode }) => <View>{p.children}</View> };
});

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

const mount = async (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  // The icon font resolves on a later tick; let it settle inside act.
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
};

describe('HeroActionCard', () => {
  it('is one button named by its title and help line, and presses through', async () => {
    const onPress = jest.fn();
    const r = await mount(<HeroActionCard title="Book photographer" subtitle="Direct booking" icon="camera-outline" onPress={onPress} />);
    const btn = r.root.findAll((n) => n.props?.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
    expect(btn.props.accessibilityLabel).toBe('Book photographer, Direct booking');
    act(() => btn.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flat(r.root)).toContain('Direct booking');
  });

  it('works without a help line and in the violet tone', async () => {
    const r = await mount(<HeroActionCard title="Publish offer" icon="document-text-outline" tone="violet" onPress={() => {}} />);
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Publish offer').length).toBeGreaterThan(0);
  });
});

describe('ListRow', () => {
  it('a row with onPress is a button with a chevron and a combined label', async () => {
    const onPress = jest.fn();
    const r = await mount(<ListRow title="Notifications" meta="Push and email" icon="notifications-outline" onPress={onPress} />);
    const btn = r.root.findAll((n) => n.props?.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
    expect(btn.props.accessibilityLabel).toBe('Notifications, Push and email');
    act(() => btn.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });

  it('a row without onPress is plain information, with its trailing value', async () => {
    const r = await mount(<ListRow title="Email" meta="a@b.co" trailing={<Text>Verified</Text>} />);
    expect(r.root.findAll((n) => n.props?.accessibilityRole === 'button').length).toBe(0);
    expect(flat(r.root)).toContain('Verified');
  });

  it('a destructive row says so in its label text colour only through its words', async () => {
    const r = await mount(<ListRow title="Delete account" icon="trash-outline" destructive onPress={() => {}} />);
    expect(flat(r.root)).toContain('Delete account');
  });
});

describe('ProgressTrack', () => {
  const steps = [
    { key: 'a', label: 'Details', state: 'done' as const },
    { key: 'b', label: 'Budget', state: 'current' as const },
    { key: 'c', label: 'Review', state: 'todo' as const },
  ];
  it('announces the current step and its position, so state is not colour only', async () => {
    const r = await mount(<ProgressTrack steps={steps} label="Booking" />);
    const bar = r.root.findAll((n) => n.props?.accessibilityRole === 'progressbar')[0];
    expect(bar.props.accessibilityLabel).toBe('Booking: step 2 of 3, Budget');
    expect(flat(r.root)).toContain('Review');
  });
  it('with nothing current it reports how many are done', async () => {
    const r = await mount(<ProgressTrack steps={steps.map((s) => ({ ...s, state: 'done' as const }))} />);
    expect(r.root.findAll((n) => n.props?.accessibilityRole === 'progressbar')[0].props.accessibilityLabel).toBe('Progress: 3 of 3 done');
  });
});
