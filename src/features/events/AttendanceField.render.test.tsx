import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { AttendanceField } from './AttendanceField';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const radios = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => n.props?.accessibilityRole === 'radio' && typeof n.props?.onPress === 'function');
const text = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');

const mount = async (props: React.ComponentProps<typeof AttendanceField>) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<AttendanceField {...props} />);
  });
  return r;
};

describe('AttendanceField', () => {
  it('has nothing selected on a new event and offers the two choices', async () => {
    const r = await mount({ value: null, onChange: jest.fn() });
    expect(text(r)).toContain('How can guests attend?');
    expect(text(r)).toContain('In person + live stream');
    expect(text(r)).toContain('Live stream only');
    expect(radios(r).filter((n) => n.props.accessibilityState.checked)).toHaveLength(0);
  });

  it('reports the choice made, and shows a saved mode preselected', async () => {
    const onChange = jest.fn();
    const r = await mount({ value: 'STREAM_ONLY', onChange });
    const checked = radios(r).filter((n) => n.props.accessibilityState.checked);
    expect(checked).toHaveLength(1);
    expect(checked[0].props.accessibilityLabel).toBe('Live stream only');
    act(() => {
      radios(r).find((n) => n.props.accessibilityLabel === 'In person + live stream')!.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('IN_PERSON');
  });

  it('says what is wrong in place of the helper, with the required star on the label', async () => {
    const r = await mount({ value: null, onChange: jest.fn(), error: 'Choose how guests can attend' });
    expect(text(r)).toContain('Choose how guests can attend');
    expect(text(r)).toContain(' *');
  });
});
