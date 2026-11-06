import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { SelfStreamLink } from '@/features/hosting/SelfStreamLink';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

it('offers Go live and opens Host an event', async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<SelfStreamLink />);
  });
  const text = r.root.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children))).join(' ');
  expect(text).toContain('Want to stream it yourself?');
  const link = r.root.findAll((n) => n.props?.accessibilityRole === 'link' && typeof n.props.onPress === 'function')[0];
  await act(async () => {
    link.props.onPress();
  });
  expect(mockPush).toHaveBeenCalledWith('/host/new');
});
