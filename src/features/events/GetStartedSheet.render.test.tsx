import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { GetStartedSheet } from './GetStartedSheet';
import { getStartedActions } from './getStarted';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ title, subtitle, onClose, footer, children }: { title: string; subtitle?: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode }) => {
    const { Text: T, View, Pressable } = require('react-native');
    return (
      <View>
        <T>{title}</T>
        {subtitle ? <T>{subtitle}</T> : null}
        <Pressable accessibilityLabel="Close" onPress={onClose} />
        {children}
        {footer}
      </View>
    );
  },
}));

const flat = (node: ReactTestInstance): string =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? ''))).join(' | ');
const press = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  const all = r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.label === label || n.props.accessibilityLabel === label || (typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(`${label}.`))));
  const node = all.filter((n) => !(n.parent && all.includes(n.parent)))[0];
  if (!node) throw new Error(`nothing to press: ${label}`);
  await act(async () => {
    node.props.onPress();
  });
};
const mount = async (role: 'Client' | 'Photographer') => {
  const fns = { onPick: jest.fn(), onClose: jest.fn(), onDismissChange: jest.fn() };
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<GetStartedSheet actions={getStartedActions(role)} createLabel="Create event" {...fns} />);
  });
  return { r, ...fns };
};

describe('Get started sheet', () => {
  it('shows the title, subtitle, role rows, the tip and the checkbox', async () => {
    const { r } = await mount('Photographer');
    const text = flat(r.root);
    expect(text).toContain('Get started with Events');
    expect(text).toContain('What would you like to do first?');
    expect(text).toContain('Host an event');
    expect(text).toContain('New album');
    expect(text).toContain('Photobook');
    expect(text).not.toContain('Book a photographer for your event');
    expect(text).toContain('You can always create from the blue');
    expect(text).toContain('+ Create event');
    expect(text).toContain('button at the bottom of this page.');
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props?.accessibilityRole === 'checkbox')).toHaveLength(1);
  });

  it('a row picks its flow; the primary button runs the first action', async () => {
    const { r, onPick } = await mount('Photographer');
    await press(r, 'New album');
    expect(onPick).toHaveBeenLastCalledWith('new-album');
    await press(r, 'Host an event');
    expect(onPick).toHaveBeenLastCalledWith('go-live');
  });

  it('Explore on my own and the close button close for the session without saving anything', async () => {
    const { r, onClose, onDismissChange } = await mount('Client');
    await press(r, 'Explore on my own');
    await press(r, 'Close');
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onDismissChange).not.toHaveBeenCalled();
  });

  it('the checkbox reports ticking and clearing', async () => {
    const { r, onDismissChange } = await mount('Client');
    await press(r, "Don't show this again");
    expect(onDismissChange).toHaveBeenLastCalledWith(true);
    await press(r, "Don't show this again");
    expect(onDismissChange).toHaveBeenLastCalledWith(false);
  });
});
