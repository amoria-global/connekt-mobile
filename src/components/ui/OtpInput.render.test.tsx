import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/i18n/sharedStrings', () => ({ useSharedT: () => ({ tr: (s: string) => s }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { cleanOtp, OtpInput } from './OtpInput';

/**
 * The shared code field: one real input drawn as six boxes. It never judges the code; it cleans what is
 * typed or pasted, submits once at six digits, and locks while the server checks.
 */
function mount(props: Partial<React.ComponentProps<typeof OtpInput>> = {}) {
  const onChange = jest.fn();
  const onComplete = jest.fn();
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<OtpInput value="" onChange={onChange} onComplete={onComplete} {...props} />);
  });
  return { r, onChange, onComplete, input: () => r.root.findByType(TextInput) };
}

describe('cleanOtp', () => {
  it.each([
    ['123 456', '123456'],
    ['123-456', '123456'],
    [' 12 34-56 ', '123456'],
    ['12a3b4', '1234'],
    ['1234567890', '123456'],
    ['', ''],
  ])('%j becomes %j', (raw, expected) => {
    expect(cleanOtp(raw)).toBe(expected);
  });
});

describe('OtpInput', () => {
  it('is one input that asks the OS for a one-time code', () => {
    const { r, input } = mount();
    expect(r.root.findAllByType(TextInput)).toHaveLength(1);
    const p = input().props;
    expect(p.autoComplete).toBe('one-time-code');
    expect(p.textContentType).toBe('oneTimeCode');
    expect(p.inputMode).toBe('numeric');
    expect(p.keyboardType).toBe('number-pad');
  });

  it('cleans a pasted code with spaces and dashes', () => {
    const { input, onChange } = mount();
    act(() => input().props.onChangeText('123 456'));
    expect(onChange).toHaveBeenCalledWith('123456');
  });

  it('submits once when the sixth digit lands, not again for the same code', () => {
    const { input, onComplete } = mount();
    act(() => input().props.onChangeText('123456'));
    act(() => input().props.onChangeText('123456'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('does not submit a short code', () => {
    const { input, onComplete } = mount();
    act(() => input().props.onChangeText('12345'));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('allows the next full code after the field was cleared', () => {
    const { r, input, onComplete } = mount();
    act(() => input().props.onChangeText('111111'));
    act(() => r.update(<OtpInput value="" onChange={jest.fn()} onComplete={onComplete} />));
    act(() => r.root.findByType(TextInput).props.onChangeText('222222'));
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('locks while the server checks and ignores typing', () => {
    const { input, onChange, onComplete } = mount({ busy: true });
    expect(input().props.editable).toBe(false);
    act(() => input().props.onChangeText('123456'));
    expect(onChange).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows the digits in the boxes', () => {
    const { r } = mount({ value: '12' });
    const shown = r.root.findAllByType(Text).map((t) => t.props.children).filter((c) => c === '1' || c === '2');
    expect(shown).toEqual(['1', '2']);
  });

  it('announces an error to screen readers and keeps hint for neutral text', () => {
    const { r } = mount({ error: 'That code is not right.' });
    const alert = r.root.findAll((n) => n.props.accessibilityRole === 'alert');
    expect(alert.length).toBeGreaterThan(0);
    expect(alert[0].props.accessibilityLiveRegion).toBe('assertive');
  });
});
