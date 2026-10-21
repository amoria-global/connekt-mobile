import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { WithdrawMethodPrompt } from './WithdrawMethodPrompt';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockList = jest.fn();
const mockPush = jest.fn();
let mockFocus: (() => void | (() => void)) | null = null;
jest.mock('./api', () => ({ listPaymentAccounts: (...a: unknown[]) => mockList(...a) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // Runs the effect on mount, like a screen that has just come into focus; `focus()` below simulates a later visit.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const R = require('react');
    mockFocus = cb;
    R.useEffect(() => cb(), [cb]);
  },
}));
jest.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ title, subtitle, onClose, footer, children }: { title: string; subtitle?: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode }) => {
    const { Text: T, View, Pressable } = require('react-native');
    return (
      <View>
        <T>{`SHEET ${title}`}</T>
        {subtitle ? <T>{subtitle}</T> : null}
        <Pressable accessibilityLabel="Close" onPress={onClose} />
        {children}
        {footer}
      </View>
    );
  },
}));

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');
const mount = async (role: 'Photographer' | 'Coordinator' = 'Photographer') => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<WithdrawMethodPrompt role={role} />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
};
const press = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  const all = r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.label === label || n.props.accessibilityLabel === label));
  const node = all.filter((n) => !(n.parent && all.includes(n.parent)))[0];
  if (!node) throw new Error(`nothing to press: ${label}`);
  await act(async () => {
    node.props.onPress();
  });
};

beforeEach(() => {
  mockList.mockReset();
  mockPush.mockReset();
  mockFocus = null;
});

describe('withdrawal method prompt on the wallet', () => {
  it('opens at once when there is no saved withdrawal method, and explains why and how', async () => {
    mockList.mockResolvedValue([]);
    const text = flat((await mount()).root);
    expect(mockList).toHaveBeenCalledWith('Photographer');
    expect(text).toContain('Add a withdrawal method');
    expect(text).toContain('You cannot withdraw your funds yet.');
    expect(text).toContain('1. Choose a type');
    expect(text).toContain('3. Save it');
    expect(text).toContain('Add withdrawal method');
    expect(text).toContain('Do it later');
  });

  it('shows nothing when a method is already saved', async () => {
    mockList.mockResolvedValue([{ id: 'a1' }]);
    expect(flat((await mount()).root)).not.toContain('Add a withdrawal method');
  });

  it('shows nothing when the methods could not be read, because that is not the same as having none', async () => {
    mockList.mockRejectedValue({ message: 'offline' });
    expect(flat((await mount()).root)).not.toContain('Add a withdrawal method');
  });

  it('Add withdrawal method opens Payment accounts and closes the prompt', async () => {
    mockList.mockResolvedValue([]);
    const r = await mount('Coordinator');
    await press(r, 'Add withdrawal method');
    expect(mockPush).toHaveBeenCalledWith('/payment-accounts');
    expect(flat(r.root)).not.toContain('Add a withdrawal method');
  });

  it('Do it later closes it without leaving the wallet, and it asks again on the next visit', async () => {
    mockList.mockResolvedValue([]);
    const r = await mount();
    await press(r, 'Do it later');
    expect(mockPush).not.toHaveBeenCalled();
    expect(flat(r.root)).not.toContain('Add a withdrawal method');
    await act(async () => {
      mockFocus?.();
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(flat(r.root)).toContain('Add a withdrawal method');
  });

  it('stops asking once a method has been added', async () => {
    mockList.mockResolvedValueOnce([]).mockResolvedValue([{ id: 'new' }]);
    const r = await mount();
    expect(flat(r.root)).toContain('Add a withdrawal method');
    await act(async () => {
      mockFocus?.();
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(flat(r.root)).not.toContain('Add a withdrawal method');
  });
});
