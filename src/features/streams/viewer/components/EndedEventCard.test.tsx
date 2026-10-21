import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { EndedEventCard } from './EndedEventCard';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-image', () => ({ Image: () => null }));

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');
const button = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityLabel === label)[0];

const mount = (props: Partial<React.ComponentProps<typeof EndedEventCard>> = {}) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<EndedEventCard cover={1} cancelled={false} message="Find photos you appear in." onDetails={() => {}} onFindPhotos={() => {}} {...props} />);
  });
  return r;
};

describe('ended event card', () => {
  it('says the event has ended, explains why photos are worth a look, and offers both actions', () => {
    const text = flat(mount().root);
    expect(text).toContain('Ended');
    expect(text).toContain('This event has ended');
    expect(text).toContain('Find photos you appear in.');
    expect(text).toContain('Find my photos');
    expect(text).toContain('View event details');
  });

  it('wires each button to its own action', () => {
    const find = jest.fn();
    const details = jest.fn();
    const r = mount({ onFindPhotos: find, onDetails: details });
    act(() => button(r, 'Find my photos').props.onPress());
    act(() => button(r, 'View event details').props.onPress());
    expect(find).toHaveBeenCalledTimes(1);
    expect(details).toHaveBeenCalledTimes(1);
  });

  it('a cancelled event offers its details only, with no photo search and no photo message', () => {
    const r = mount({ cancelled: true });
    const text = flat(r.root);
    expect(text).toContain('This event was cancelled');
    expect(text).toContain('Cancelled');
    expect(text).not.toContain('Find my photos');
    expect(text).not.toContain('Find photos you appear in.');
    expect(text).toContain('View event details');
  });
});
