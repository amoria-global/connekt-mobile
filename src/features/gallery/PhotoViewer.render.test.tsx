import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { PhotoViewer, type ViewerPhoto } from './PhotoViewer';

/**
 * RENDERED viewer (react-test-renderer under jest-expo, not a device): the counter, the buttons at the ends of the
 * album, and that Save and Share receive the photo that is on screen, not the one that was tapped.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const photos: ViewerPhoto[] = [
  { id: 'p1', url: 't1', fullUrl: 'f1' },
  { id: 'p2', url: 't2', fullUrl: 'f2' },
  { id: 'p3', url: 't3', fullUrl: 'f3' },
];

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');
const btn = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

function mount(props: Partial<React.ComponentProps<typeof PhotoViewer>> = {}) {
  const fns = { onIndexChange: jest.fn(), onClose: jest.fn(), onSave: jest.fn(), onShare: jest.fn() };
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<PhotoViewer photos={photos} index={1} {...fns} {...props} />);
  });
  return { r, ...fns };
}

describe('photo viewer as rendered', () => {
  it('shows which photo of how many', () => {
    expect(flat(mount().r.root)).toContain('2 of 3');
  });

  it('Save and Share act on the photo on screen', () => {
    const { r, onSave, onShare } = mount({ index: 2 });
    act(() => btn(r, 'Save to camera roll').props.onPress());
    act(() => btn(r, 'Share photo').props.onPress());
    expect(onSave).toHaveBeenCalledWith(photos[2]);
    expect(onShare).toHaveBeenCalledWith(photos[2]);
  });

  it('next and previous report their target and stop at the ends', () => {
    const mid = mount({ index: 1 });
    act(() => btn(mid.r, 'Next photo').props.onPress());
    expect(mid.onIndexChange).toHaveBeenCalledWith(2);
    act(() => btn(mid.r, 'Previous photo').props.onPress());
    expect(mid.onIndexChange).toHaveBeenCalledWith(0);

    const first = mount({ index: 0 });
    expect(btn(first.r, 'Previous photo').props.disabled).toBe(true);
    const last = mount({ index: 2 });
    expect(btn(last.r, 'Next photo').props.disabled).toBe(true);
  });

  it('Report appears only when a report handler is given, and reports the photo on screen', () => {
    expect(btn(mount().r, 'Report photo')).toBeUndefined();
    const onReport = jest.fn();
    const { r } = mount({ onReport, index: 0 });
    act(() => btn(r, 'Report photo').props.onPress());
    expect(onReport).toHaveBeenCalledWith(photos[0]);
  });

  it('closed (-1) mounts no strip and the close button closes', () => {
    const closed = mount({ index: -1 });
    expect(flat(closed.r.root)).not.toContain(' of 3');
    const { r, onClose } = mount();
    act(() => btn(r, 'Close photo viewer').props.onPress());
    expect(onClose).toHaveBeenCalled();
  });
});
