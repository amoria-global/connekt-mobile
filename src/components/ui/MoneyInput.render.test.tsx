import React, { useState } from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/services/storage', () => ({
  storage: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), remove: jest.fn() },
  StorageKeys: { moneyCurrencyUsage: 'money.currencyUsage' },
}));
jest.mock('@/store/currency', () => ({ useCurrency: (sel: (s: { currency: string }) => unknown) => sel({ currency: 'RWF' }) }));

const LIMITS: Record<string, unknown> = {
  USD: { currency: 'USD', minimum: '0.07', decimals: 2, wholeNumbersOnly: false, rateStale: false },
  RWF: { currency: 'RWF', minimum: '100', decimals: 0, wholeNumbersOnly: true, rateStale: false },
  KES: { currency: 'KES', minimum: '8.79', decimals: 2, wholeNumbersOnly: false, rateStale: true },
};
jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn((url: string) => {
      if (url.includes('/payments/limits')) {
        const code = decodeURIComponent(url.split('currency=')[1]);
        return Promise.resolve({ action: 1, data: LIMITS[code] });
      }
      return Promise.resolve({ data: { RWF: { rateToUsd: 1478.5 }, KES: { rateToUsd: 130 }, USD: { rateToUsd: 1 } } });
    }),
  },
}));

import { MoneyInput } from './MoneyInput';

const CURRENCIES = [
  { id: 'rwf', code: 'RWF', name: 'Rwandan franc' },
  { id: 'usd', code: 'USD', name: 'US dollar' },
  { id: 'kes', code: 'KES', name: 'Kenyan shilling' },
];

const texts = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')));

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

function Harness({ initialAmount = '', initialCurrency = 'usd', onAmount }: { initialAmount?: string; initialCurrency?: string; onAmount?: (v: string) => void }) {
  const [amount, setAmount] = useState(initialAmount);
  const [currencyId, setCurrencyId] = useState(initialCurrency);
  return (
    <MoneyInput
      label="PRICE PER IMAGE"
      required
      value={amount}
      onChangeText={(v) => {
        setAmount(v);
        onAmount?.(v);
      }}
      currencyId={currencyId}
      onCurrencyChange={setCurrencyId}
      currencies={CURRENCIES}
      testID="money"
    />
  );
}

async function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  await flush();
  return r;
}

const press = (r: TestRenderer.ReactTestRenderer, label: string) =>
  act(() => r.root.find((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label).props.onPress());

describe('MoneyInput', () => {
  it('shows the minimum before anything is typed, and names the currency button for screen readers', async () => {
    const r = await mount(<Harness />);
    expect(texts(r.root)).toEqual(expect.arrayContaining(['Minimum USD 0.07', 'PRICE PER IMAGE *']));
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Currency, US dollar, change').length).toBeGreaterThan(0);
  });

  it('accepts USD 4.00, shows the conversion, and keeps the amount a plain number', async () => {
    const seen: string[] = [];
    const r = await mount(<Harness onAmount={(v) => seen.push(v)} />);
    await act(async () => r.root.findByType(TextInput).props.onChangeText('4.00'));
    await flush();
    expect(seen).toEqual(['4.00']);
    expect(texts(r.root)).toEqual(expect.arrayContaining(['≈ RWF 5,914']));
    expect(texts(r.root).join(' ')).not.toContain('The minimum price');
  });

  it('shows the field error below the minimum, in plain language', async () => {
    const r = await mount(<Harness initialAmount="0.05" />);
    expect(texts(r.root)).toContain("The minimum price in USD is 0.07. Mobile Money can't process smaller payments.");
  });

  it('shows thousands separators while the stored value stays clean', async () => {
    const r = await mount(<Harness initialAmount="1234567" />);
    expect(r.root.findByType(TextInput).props.value).toBe('1,234,567');
  });

  it('takes whole numbers only in a zero-decimal currency, with a number keypad', async () => {
    const seen: string[] = [];
    const r = await mount(<Harness initialCurrency="rwf" onAmount={(v) => seen.push(v)} />);
    expect(texts(r.root)).toContain('Minimum RWF 100 · whole numbers only');
    expect(r.root.findByType(TextInput).props.keyboardType).toBe('number-pad');
    await act(async () => r.root.findByType(TextInput).props.onChangeText('500.5'));
    expect(seen).toEqual(['5005']);
  });

  it('keeps the amount when the currency changes and drops digits the new currency cannot carry', async () => {
    const r = await mount(<Harness initialAmount="50.5" />);
    await press(r, 'Use Rwandan franc');
    await flush();
    expect(r.root.findByType(TextInput).props.value).toBe('505');
    expect(texts(r.root)).toContain('Minimum RWF 100 · whole numbers only');
  });

  it('opens the picker with search and suggested currencies', async () => {
    const r = await mount(<Harness />);
    await press(r, 'More currencies');
    await flush();
    const all = texts(r.root);
    expect(all).toEqual(expect.arrayContaining(['Choose currency', 'SUGGESTED']));
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Search currencies').length).toBeGreaterThan(0);
  });

  it('warns in amber when the rate is old, and still lets the user type', async () => {
    const r = await mount(<Harness initialAmount="50" initialCurrency="kes" />);
    expect(texts(r.root).join(' ')).toContain('more than 24 hours old');
    expect(r.root.findByType(TextInput).props.editable).toBe(true);
  });
});
