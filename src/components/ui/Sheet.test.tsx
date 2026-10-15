import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Modal, Text } from 'react-native';

import { Sheet } from './Sheet';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const labels = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')));

function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

const closers = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Close');

describe('Sheet', () => {
  it('renders the title, body and pinned footer', () => {
    const r = mount(
      <Sheet title="New goal" subtitle="Targets for a period" onClose={() => {}} footer={<Text>Save goal</Text>}>
        <Text>Goal name</Text>
      </Sheet>,
    );
    // The close icon is a glyph rendered as text, so only check the words.
    expect(labels(r.root)).toEqual(expect.arrayContaining(['New goal', 'Targets for a period', 'Goal name', 'Save goal']));
  });

  it('closes from the close button, the backdrop and Back when idle', () => {
    const onClose = jest.fn();
    const r = mount(
      <Sheet title="T" onClose={onClose}>
        <Text>x</Text>
      </Sheet>,
    );
    closers(r).forEach((c) => act(() => c.props.onPress()));
    act(() => r.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(closers(r).length + 1);
  });

  it('ignores every way of dismissing while a request is in flight', () => {
    const onClose = jest.fn();
    const r = mount(
      <Sheet title="T" onClose={onClose} busy>
        <Text>x</Text>
      </Sheet>,
    );
    closers(r).forEach((c) => act(() => c.props.onPress?.()));
    act(() => r.root.findByType(Modal).props.onRequestClose());
    expect(onClose).not.toHaveBeenCalled();
  });
});
