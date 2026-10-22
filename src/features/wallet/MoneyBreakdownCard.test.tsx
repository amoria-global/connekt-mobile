import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { MoneyBreakdownCard } from './MoneyBreakdownCard';

jest.mock('react-native-svg', () => {
  const R = require('react');
  const el = (n: string) => (p: object) => R.createElement(n, p);
  return { __esModule: true, default: el('Svg'), Svg: el('Svg'), Circle: el('Circle') };
});

const flat = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');

const hues = ['#111111', '#222222', '#333333'];

describe('money breakdown ring', () => {
  it('formats every figure in the wallet currency and shrinks the centre total to fit the ring', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <MoneyBreakdownCard
          currency="EUR"
          hues={hues}
          summary="Wallet figures by source"
          emptyText="Nothing"
          segments={[
            { label: 'Stream revenue', value: 6.6272 },
            { label: 'Refunds received', value: 216.5314 },
          ]}
        />,
      );
    });
    const text = flat(r);
    expect(text).toContain('Stream revenue');
    expect(text).not.toMatch(/6\.6272|216\.5314/);
    expect(text).toMatch(/€6\.63|EUR\s?6\.63/);
    const centre = r.root.findAllByType(Text).find((t) => t.props.adjustsFontSizeToFit);
    expect(centre?.props.numberOfLines).toBe(1);
    expect(centre?.props.minimumFontScale).toBeLessThanOrEqual(0.6);
  });

  it('says so when there is nothing to split', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<MoneyBreakdownCard currency="EUR" hues={hues} summary="s" emptyText="Nothing here" segments={[{ label: 'A', value: 0 }]} />);
    });
    expect(flat(r)).toBe('Nothing here');
  });
});
