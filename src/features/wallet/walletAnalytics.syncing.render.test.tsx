import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { ClientWalletAnalytics } from '@/features/client/ClientWalletAnalytics';
import { CoordinatorWalletAnalytics } from './CoordinatorWalletAnalytics';
import { WalletAnalytics } from '@/features/photographer/WalletAnalytics';
import type { WalletDTO } from './api';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: () => undefined }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const wallet = {
  currency: 'RWF',
  totalBalance: 970000,
  availableBalance: 970000,
  totalWithdrawn: 120000,
  customerType: 'Photographer',
} as unknown as WalletDTO;

function texts(node: React.ReactElement): string {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(node);
  });
  return r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(4).filter((c) => typeof c === 'string').join(''))
    .join('\n');
}

describe('wallet figures while the balance is refreshed', () => {
  it.each([
    ['photographer', (s: boolean) => <WalletAnalytics wallet={wallet} syncing={s} />],
    ['coordinator', (s: boolean) => <CoordinatorWalletAnalytics wallet={wallet} syncing={s} />],
    ['client', (s: boolean) => <ClientWalletAnalytics wallet={wallet} syncing={s} />],
  ])('the %s panel shows loading dots in place of the amounts, then the amounts again', (_role, panel) => {
    const loading = texts(panel(true));
    expect(loading).toContain('•');
    expect(loading).not.toMatch(/RWF\s*970/);
    const loaded = texts(panel(false));
    expect(loaded).not.toContain('•');
    expect(loaded).not.toBe(loading);
  });
});
