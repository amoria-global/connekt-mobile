import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { BalanceHero } from './BalanceHero';
import { applyRates, FALLBACK_CURRENCIES, KNOWN_CURRENCIES, mapSource } from './model';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const usd = FALLBACK_CURRENCIES[0];
const texts = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

function render(source: Parameters<typeof BalanceHero>[0]['source'], currency = usd) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<BalanceHero source={source} currency={currency} usd={usd} />);
  });
  return r;
}

describe('withdraw balance card', () => {
  it('shows N/A and says nothing was reported when there is no source, never $0.00', () => {
    const t = texts(render(null).root);
    expect(t).toContain('N/A');
    expect(t.join(' ')).toMatch(/No withdrawable balance was reported/);
    expect(t.join(' ')).not.toMatch(/\$\s?0/);
  });

  it('shows a reported zero as $0.00 (a real zero is still a number)', () => {
    const t = texts(render(mapSource({ source: 'BALANCE', label: 'Available balance', availableBalance: 0 })).root);
    expect(t.join(' ')).toMatch(/\$0\.00/);
    expect(t).not.toContain('N/A');
  });

  it('shows a reported balance with its own label', () => {
    const t = texts(render(mapSource({ source: 'GIFT', label: 'Gift earnings', availableBalance: 12.5 })).root);
    expect(t).toContain('Gift earnings');
    expect(t.join(' ')).toMatch(/\$12\.50/);
  });

  it('floors a balance in another currency and shows the USD value beneath it', () => {
    const rwf = applyRates(KNOWN_CURRENCIES, { RWF: { rateToUsd: 1000, symbol: 'RF' } }).find((c) => c.code === 'RWF')!;
    const t = texts(render(mapSource({ source: 'BALANCE', availableBalance: 1.2345 }), rwf).root);
    expect(t.join(' ')).toMatch(/1,?234/);
    expect(t.join(' ')).toMatch(/\$1\.23/);
  });
});
