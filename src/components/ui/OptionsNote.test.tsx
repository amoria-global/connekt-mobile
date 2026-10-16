import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { OptionsNote } from './OptionsNote';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

const text = (r: TestRenderer.ReactTestRenderer) => String(r.root.findByType(Text).props.children);
const button = (r: TestRenderer.ReactTestRenderer) =>
  r.root.find((n) => typeof n.props.onPress === 'function' && typeof n.props.accessibilityLabel === 'string');

describe('OptionsNote', () => {
  it('says what is loading and is inert while it loads', () => {
    const onRetry = jest.fn();
    const r = mount(<OptionsNote what="currencies" loading onRetry={onRetry} />);
    expect(text(r)).toBe('Loading currencies...');
    expect(button(r).props.disabled).toBe(true);
  });

  it('names the missing options and retries on tap once loading has finished', () => {
    const onRetry = jest.fn();
    const r = mount(<OptionsNote what="categories" loading={false} onRetry={onRetry} />);
    expect(text(r)).toBe('Categories unavailable. Tap to retry.');
    act(() => button(r).props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
