import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Alert as NativeAlert, Text } from 'react-native';

import { Alert, DialogHost, cancelButton } from './dialog';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockType: string | undefined = 'Photographer';
jest.mock('@/store/auth', () => ({
  useAuth: { getState: () => ({ user: mockType ? { customerType: mockType } : null }) },
}));

const labels = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')));

function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

const tap = (r: TestRenderer.ReactTestRenderer, text: string) => {
  // Several nodes carry the press handler (the wrapper and its host view), and the backdrop also wraps every label.
  // Take the smallest node whose own labels are exactly this button's text.
  const hits = r.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button' && labels(n).join('|') === text,
  );
  const btn = hits[0];
  if (!btn) throw new Error(`no button ${text}`);
  act(() => btn.props.onPress());
};

describe('themed dialog', () => {
  let native: jest.SpyInstance;
  beforeEach(() => {
    mockType = 'Photographer';
    native = jest.spyOn(NativeAlert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => native.mockRestore());

  it('falls back to the native alert when no host is mounted, so a message is never lost', () => {
    Alert.alert('Hello', 'World');
    expect(native).toHaveBeenCalledWith('Hello', 'World');
  });

  it('shows photographer alerts in the host and runs the pressed button once', () => {
    const r = mount(<DialogHost />);
    const onDelete = jest.fn();
    const onCancel = jest.fn();
    act(() => {
      Alert.alert('Delete event', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
    });
    expect(native).not.toHaveBeenCalled();
    expect(labels(r.root)).toEqual(expect.arrayContaining(['Delete event', 'This cannot be undone.', 'Cancel', 'Delete']));
    tap(r, 'Delete');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(labels(r.root)).toEqual([]);
  });

  it('queues a second dialog and shows it after the first closes', () => {
    const r = mount(<DialogHost />);
    act(() => {
      Alert.alert('First', undefined, [{ text: 'OK' }]);
      Alert.alert('Second', undefined, [{ text: 'Got it' }]);
    });
    expect(labels(r.root)).toContain('First');
    expect(labels(r.root)).not.toContain('Second');
    tap(r, 'OK');
    expect(labels(r.root)).toContain('Second');
    tap(r, 'Got it');
    expect(labels(r.root)).toEqual([]);
  });

  it('keeps the native alert for every other role', () => {
    mockType = 'Client';
    mount(<DialogHost />);
    act(() => {
      Alert.alert('Title', 'Body', [{ text: 'OK' }]);
    });
    expect(native).toHaveBeenCalledTimes(1);
  });

  it('adds an OK button when none are given', () => {
    const r = mount(<DialogHost />);
    act(() => {
      Alert.alert('Saved');
    });
    expect(labels(r.root)).toContain('OK');
  });

  it('Back and the backdrop act as Cancel when the dialog has one', () => {
    expect(cancelButton([{ text: 'Keep' }, { text: 'No', style: 'cancel' }])?.text).toBe('No');
    expect(cancelButton([{ text: 'OK' }])).toBeUndefined();
  });
});
