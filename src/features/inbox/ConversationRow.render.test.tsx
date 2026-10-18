import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { ConversationRow, conversationLabel } from './ConversationRow';
import type { Conversation } from './api';

/** One inbox row: real unread state in the words, no invented preview, no mislabelled camera. */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

const conv = (o: Partial<Conversation>): Conversation => ({ id: 'c1', name: 'Eric Mugisha', lastMessage: 'See you at 10', unreadCount: 0, timestamp: undefined, ...o }) as Conversation;

const mount = (c: Conversation, accent = false) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<ConversationRow conversation={c} accent={accent} />);
  });
  return r;
};

describe('conversationLabel', () => {
  it('puts the unread count, the preview and the time in the spoken label', () => {
    const iso = new Date(Date.now() - 3 * 3600e3).toISOString();
    expect(conversationLabel(conv({ unreadCount: 2, timestamp: iso }))).toBe('Eric Mugisha, 2 unread, See you at 10, 3h');
  });
  it('a read conversation has no unread words', () => {
    expect(conversationLabel(conv({}))).toBe('Eric Mugisha, See you at 10');
  });
  it('no last message says so, and never invents "Sent a message"', () => {
    const label = conversationLabel(conv({ lastMessage: '' }));
    expect(label).toBe('Eric Mugisha, No messages yet');
    expect(label).not.toMatch(/Sent a message/);
  });
});

describe('ConversationRow', () => {
  it('shows the name, the real preview and, for several unread, a count', () => {
    const text = flat(mount(conv({ unreadCount: 3 })).root);
    expect(text).toContain('Eric Mugisha');
    expect(text).toContain('See you at 10');
    expect(text).toContain('3');
  });
  it('caps a huge unread count at 99+', () => {
    expect(flat(mount(conv({ unreadCount: 250 })).root)).toContain('99+');
  });
  it('a read conversation draws no unread count and no camera button', () => {
    const r = mount(conv({ unreadCount: 0 }));
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Open camera').length).toBe(0);
    expect(r.root.findAll((n) => n.props?.accessibilityRole === 'button').length).toBe(0);
  });
  it('an empty preview reads No messages yet', () => {
    expect(flat(mount(conv({ lastMessage: '' })).root)).toContain('No messages yet');
  });
  it('the whole row is one accessible element carrying the label', () => {
    const r = mount(conv({ unreadCount: 1 }));
    const el = r.root.findAll((n) => n.props?.accessible === true && typeof n.props.accessibilityLabel === 'string')[0];
    expect(el.props.accessibilityLabel).toContain('1 unread');
  });
});
