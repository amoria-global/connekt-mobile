import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { PhotobookCard, bookByline } from './PhotobookCard';

/**
 * RENDERED card (react-test-renderer under jest-expo, not a device). The shelf card used to print "0 photos" for a
 * book with no count and "Event Collection" for a book with no photographer.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: (p: { children?: React.ReactNode }) => <View>{p.children}</View> };
});

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

function mount(book: Record<string, unknown>, received = false) {
  const onOpen = jest.fn();
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<PhotobookCard book={{ id: 'b1', name: 'Wedding Story', ...book }} received={received} onOpen={onOpen} />);
  });
  return { r, onOpen };
}

describe('photobook card as rendered', () => {
  it('shows the real status, count and photographer', () => {
    const text = flat(mount({ status: 'SENT', mediaCount: 60, photographerName: 'Jean' }).r.root);
    expect(text).toContain('Delivered');
    expect(text).toContain('60 photos');
    expect(text).toContain('By Jean');
  });

  it('says nothing for a missing count and photographer, and names an unknown status as the API did', () => {
    const text = flat(mount({ status: 'ARCHIVED' }).r.root);
    expect(text).toContain('ARCHIVED');
    expect(text).not.toMatch(/0 photos|Event Collection/);
    expect(text).toContain('Wedding Story');
  });

  it('falls back to the creation date when there is no photographer, and to nothing without either', () => {
    expect(bookByline({ createdAt: '2026-09-28T10:00:00' })).toBe('28 Sep 2026');
    expect(bookByline({ photographerName: 'Jean', createdAt: '2026-09-28' })).toBe('By Jean');
    expect(bookByline({})).toBeUndefined();
  });

  it('opens the book, passing whether it is a received one', () => {
    const { r, onOpen } = mount({}, true);
    const card = r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Wedding Story') && typeof n.props.onPress === 'function')[0];
    act(() => card.props.onPress());
    expect(onOpen).toHaveBeenCalledWith('b1', true);
  });
});
