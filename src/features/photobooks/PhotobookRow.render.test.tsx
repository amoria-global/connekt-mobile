import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { PhotobookRow, bookByline } from './PhotobookRow';

/**
 * RENDERED row (react-test-renderer under jest-expo, not a device): the real status, the source chips, the count and
 * who it went to; a book with no photos shows a "No photos" tile and no count.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-image', () => ({ Image: () => null }));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

function mount(book: Record<string, unknown>, shelf: 'mine' | 'received' = 'mine') {
  const onOpen = jest.fn();
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<PhotobookRow book={{ id: 'b1', name: 'Wedding Story', ...book }} shelf={shelf} onOpen={onOpen} />);
  });
  return { r, onOpen };
}

describe('photobook row as rendered', () => {
  it('shows the real status, a chip per source, the count and who it went to', () => {
    const text = flat(
      mount({ status: 'RESUBMITTED', mediaCount: 48, toName: 'Joseph M.', sentAt: '2026-11-02T10:00:00', sources: ['event', 'content'], previews: ['https://x/1.jpg'] }).r.root,
    );
    expect(text).toContain('Ready to review');
    expect(text).toContain('Event album');
    expect(text).toContain('Content');
    expect(text).toContain('48 photos');
    expect(text).toContain('To Joseph M. · 2 Nov 2026');
  });

  it('a book completed by the photographer says so, and an empty one shows a No photos tile with no count', () => {
    const text = flat(mount({ status: 'COMPLETED', closedByPhotographer: true, mediaCount: 0 }).r.root);
    expect(text).toContain('Closed by photographer');
    expect(text).toContain('No photos');
  });

  it('the photographer shelf reads From and uses photographer wording', () => {
    const text = flat(mount({ status: 'SENT_TO_PHOTOGRAPHER', senderName: 'Aline U.' }, 'received').r.root);
    expect(text).toContain('New to edit');
    expect(text).toContain('From Aline U.');
  });

  it('opens received books through the received route', () => {
    const { r, onOpen } = mount({ status: 'SENT_TO_PHOTOGRAPHER' }, 'received');
    act(() => r.root.findAllByProps({ accessibilityRole: 'button' })[0].props.onPress());
    expect(onOpen).toHaveBeenCalledWith('b1', true);
  });

  it('bookByline is blank rather than invented', () => {
    expect(bookByline({}, 'mine')).toBeUndefined();
  });
});
