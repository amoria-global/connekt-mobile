import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { KycBanner } from './KycBanner';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => {
  const R = require('react');
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]) };
});
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ role: 'Photographer' }) }));
jest.mock('./api', () => ({ getKyc: async () => ({ status: 'NOT_STARTED' }) }));

const texts = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

async function mount(compact: boolean) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<KycBanner compact={compact} />);
  });
  return r;
}

describe('KycBanner compact', () => {
  it('drops the long detail and footer but keeps title, the action and the dismiss control', async () => {
    const full = texts(await mount(false)).join(' | ');
    const slim = await mount(true);
    const slimText = texts(slim).join(' | ');
    expect(full).toContain('Official');
    expect(slimText).not.toContain('Official');
    expect(slimText).not.toContain('Identity Verification');
    expect(slimText).not.toContain('Recommended');
    expect(slim.root.findAll((n) => /identity verification$/.test(String(n.props?.accessibilityLabel)) && typeof n.props.onPress === 'function').length).toBeGreaterThan(0);
    expect(slim.root.findAll((n) => n.props?.accessibilityLabel === 'Dismiss verification banner').length).toBeGreaterThan(0);
  });
});
