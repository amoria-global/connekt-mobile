import React, { useState } from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The field is under test, not the kit around it: stand-ins for the money box and the Price/Block switch.
jest.mock('@/components/ui/MoneyInput', () => {
  const { TextInput: Input } = jest.requireActual('react-native');
  return {
    MoneyInput: ({ value, onChangeText, testID }: { value: string; onChangeText: (v: string) => void; testID?: string }) => (
      <Input value={value} onChangeText={onChangeText} testID={`${testID}-amount`} />
    ),
  };
});
jest.mock('@/components/ui/Segmented', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    Segmented: ({ options, onChange }: { options: { label: string; value: string }[]; onChange: (v: string) => void }) => (
      <>
        {options.map((o) => (
          <P key={o.value} onPress={() => onChange(o.value)} accessibilityLabel={`switch-${o.value}`}>
            <T>{o.label}</T>
          </P>
        ))}
      </>
    ),
  };
});

import { LocationRulesField, type LocationsStatus } from './LocationRulesField';
import { type GeoLocation, type LocationRule, type RuleDraft } from './locationRules';

const KE: GeoLocation = { scopeType: 'COUNTRY', code: 'KE', name: 'Kenya', continentName: 'Africa' };
const FR: GeoLocation = { scopeType: 'COUNTRY', code: 'FR', name: 'France', continentName: 'Europe' };
const EU: GeoLocation = { scopeType: 'CONTINENT', code: 'EU', name: 'Europe', countryCount: 51 };
const CURRENCIES = [{ id: 'rwf', code: 'RWF', name: 'Rwandan franc' }];

const texts = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')));

let latest: { rules: LocationRule[] } = { rules: [] };

function Harness(props: {
  initialRules?: LocationRule[];
  startOpen?: boolean;
  status?: LocationsStatus;
  ruleErrors?: Record<number, string>;
  message?: string | null;
}) {
  const [open, setOpen] = useState(props.startOpen ?? true);
  const [rules, setRules] = useState<LocationRule[]>(props.initialRules ?? []);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  latest = { rules };
  return (
    <LocationRulesField
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      rules={rules}
      onRulesChange={setRules}
      draft={draft}
      onDraftChange={setDraft}
      locations={[KE, FR, EU]}
      locationsStatus={props.status ?? 'ready'}
      onRetryLocations={jest.fn()}
      currencies={CURRENCIES}
      defaultCurrencyId="rwf"
      ruleErrors={props.ruleErrors}
      message={props.message}
    />
  );
}

const render = (props: React.ComponentProps<typeof Harness> = {}) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<Harness {...props} />);
  });
  return r;
};

const press = (r: TestRenderer.ReactTestRenderer, predicate: (n: ReactTestInstance) => boolean) => {
  const hit = r.root.findAll((n) => typeof n.props?.onPress === 'function' && predicate(n))[0];
  if (!hit) throw new Error('nothing to press');
  act(() => hit.props.onPress());
};
const pressLabel = (r: TestRenderer.ReactTestRenderer, label: string) =>
  press(r, (n) => n.props.accessibilityLabel === label);
const pressText = (r: TestRenderer.ReactTestRenderer, text: string) =>
  press(r, (n) => texts(n).some((t) => t === text));

const priceRule: LocationRule = {
  key: 'COUNTRY:KE',
  scopeType: 'COUNTRY',
  scopeValue: 'KE',
  label: 'Kenya',
  action: 'PRICE',
  price: 150,
  currencyId: 'rwf',
  currencyCode: 'RWF',
};

describe('LocationRulesField', () => {
  it('collapsed it is one row with the summary and nothing else', () => {
    const r = render({ startOpen: false });
    const all = texts(r.root);
    expect(all).toContain('Location pricing & access (optional)');
    expect(all).toContain('Same price everywhere');
    expect(all).not.toContain('Add a location rule');
  });

  it('opens on tap and says where the rules stand', () => {
    const r = render({ startOpen: false, initialRules: [priceRule] });
    expect(texts(r.root)).toContain('1 price');
    pressLabel(r, 'Location pricing and access, optional');
    const all = texts(r.root);
    expect(all).toContain('Kenya');
    expect(all).toContain('RWF 150');
    expect(all).toContain('Add a location rule');
  });

  it('adds a price rule inline: search, choose, price, add', () => {
    const r = render();
    pressText(r, 'Add a location rule');
    act(() => r.root.findByProps({ accessibilityLabel: 'Search a country or continent' }).props.onChangeText('ken'));
    pressLabel(r, 'Kenya, country');
    act(() => r.root.findByProps({ testID: 'geo-rules-price-amount' }).props.onChangeText('150'));
    pressText(r, 'Add price');

    expect(latest.rules).toHaveLength(1);
    expect(latest.rules[0]).toMatchObject({ scopeValue: 'KE', action: 'PRICE', price: 150, currencyId: 'rwf' });
    expect(texts(r.root)).toContain('1 price');
  });

  it('blocks a continent with no price and says what a block means', () => {
    const r = render();
    pressText(r, 'Add a location rule');
    pressLabel(r, 'Europe, continent');
    pressLabel(r, 'switch-BLOCK');
    expect(texts(r.root).join(' ')).toMatch(/will not be able to watch, buy, send gifts or donate/);
    expect(texts(r.root).join(' ')).toMatch(/paid before the block keeps their access/);
    pressText(r, 'Block place');

    expect(latest.rules[0]).toMatchObject({ scopeType: 'CONTINENT', scopeValue: 'EU', action: 'BLOCK' });
    expect(latest.rules[0].price).toBeUndefined();
    expect(texts(r.root)).toContain('Europe');
    expect(texts(r.root)).toContain('Blocked');
  });

  it('will not add with no place chosen, and says why', () => {
    const r = render();
    pressText(r, 'Add a location rule');
    pressText(r, 'Add price');
    expect(texts(r.root)).toContain('Choose a country or continent first.');
    expect(latest.rules).toHaveLength(0);
  });

  it('removes a rule, and edits one by moving it back into the new-rule row', () => {
    const r = render({ initialRules: [priceRule] });
    pressLabel(r, 'Edit Kenya, RWF 150');
    expect(latest.rules).toHaveLength(0);
    const amount = r.root.findByProps({ testID: 'geo-rules-price-amount' });
    expect(amount.props.value).toBe('150');

    pressText(r, 'Cancel');
    expect(texts(r.root)).toContain('Add a location rule');
  });

  it('removes a rule with its remove button', () => {
    const r = render({ initialRules: [priceRule] });
    pressLabel(r, 'Remove Kenya');
    expect(latest.rules).toHaveLength(0);
    expect(texts(r.root)).toContain('No location rules yet. Everyone pays the same price.');
  });

  it('shows the server error on the row it belongs to', () => {
    const r = render({ initialRules: [priceRule], ruleErrors: { 0: 'The minimum is RWF 100.' } });
    expect(texts(r.root)).toContain('The minimum is RWF 100.');
  });

  it('shows the form message, even while collapsed', () => {
    const r = render({ startOpen: false, message: 'Finish or cancel the open rule first.' });
    expect(texts(r.root)).toContain('Finish or cancel the open rule first.');
  });

  it('says so when the list of places will not load, and offers a retry', () => {
    const r = render({ status: 'error' });
    pressText(r, 'Add a location rule');
    expect(texts(r.root)).toContain('We could not load the list of places.');
    expect(texts(r.root)).toContain('Retry');
  });

  it('keeps a place from being added twice', () => {
    const r = render({ initialRules: [priceRule] });
    pressText(r, 'Add a location rule');
    act(() => r.root.findByProps({ accessibilityLabel: 'Search a country or continent' }).props.onChangeText('kenya'));
    expect(r.root.findAllByType(TextInput).length).toBeGreaterThan(0);
    // Kenya shows once, as the saved rule's row; it is not offered again in the search results.
    expect(texts(r.root).filter((t) => t === 'Kenya')).toHaveLength(1);
  });
});
