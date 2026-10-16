import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { ScreenHeader } from './ScreenHeader';
import { UserHeaderBand } from './UserHeaderBand';
import { Button } from './Button';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockPhotographer = true;
jest.mock('@/features/auth/role', () => ({
  useRole: () => ({ isPhotographer: mockPhotographer }),
}));

const texts = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')));

function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

describe('photographer screens do not repeat the native header title', () => {
  beforeEach(() => {
    mockPhotographer = true;
  });

  it('ScreenHeader keeps only the subtitle when it duplicates the header', () => {
    const r = mount(<ScreenHeader duplicatesHeader title="My Packages" subtitle="Services clients can book" />);
    expect(texts(r.root)).toEqual(['Services clients can book']);
  });

  it('ScreenHeader renders nothing when it duplicates the header and has no subtitle', () => {
    const r = mount(<ScreenHeader duplicatesHeader title="Geo pricing" />);
    expect(texts(r.root)).toEqual([]);
  });

  it('ScreenHeader still shows a title that is not flagged as a duplicate', () => {
    const r = mount(<ScreenHeader title="Withdraw" subtitle="Send your earnings" />);
    expect(texts(r.root)).toEqual(['Withdraw', 'Send your earnings']);
  });

  it('UserHeaderBand drops only the title and keeps its children', () => {
    const r = mount(
      <UserHeaderBand duplicatesHeader title="Bookings" subtitle="Manage requests">
        <Text>filters</Text>
      </UserHeaderBand>,
    );
    expect(texts(r.root)).toEqual(['Manage requests', 'filters']);
  });

  it('other roles keep the title even when the flag is set', () => {
    mockPhotographer = false;
    const r = mount(<ScreenHeader duplicatesHeader title="My Packages" subtitle="Services clients can book" />);
    expect(texts(r.root)).toEqual(['My Packages', 'Services clients can book']);
  });
});

describe('Button shape', () => {
  const flatten = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(3).filter(Boolean));
  const baseStyle = (r: TestRenderer.ReactTestRenderer) => {
    const p = r.root.findByProps({ accessibilityRole: 'button' }).props;
    return flatten(typeof p.style === 'function' ? p.style({ pressed: false }) : p.style);
  };

  it('is a 48dp rounded rectangle for photographers and the 52dp pill for other roles', () => {
    mockPhotographer = true;
    const a = baseStyle(mount(<Button title="Save" onPress={() => {}} />));
    expect(a.minHeight).toBe(48);
    expect(a.height).toBeUndefined(); // a fixed height would clip a long label at large text
    expect(a.borderRadius).toBe(12);
    mockPhotographer = false;
    const b = baseStyle(mount(<Button title="Save" onPress={() => {}} />));
    expect(b.minHeight).toBe(52);
    expect(b.borderRadius).toBe(999);
  });
});
