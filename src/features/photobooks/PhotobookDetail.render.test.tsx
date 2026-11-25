import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import Screen from '@/app/(app)/photobook/[id]';

/**
 * RENDERED photobook detail (react-test-renderer, not a device) over a faked transport: the ONE action for each status,
 * the wording that says what accepting does, the note box for Request changes, and that a photo the viewer has not
 * bought is drawn as a watermarked preview, never as an original.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetOk = jest.fn();
const mockPost = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    api: {
      getOk: async (...a: unknown[]) => actual.requireOk(await mockGetOk(...a)),
      post: (...a: unknown[]) => mockPost(...a),
      put: jest.fn(),
      delete: jest.fn(),
    },
  };
});
const mockParams: { id: string; received?: string } = { id: 'b1' };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View, SafeAreaProvider: View };
});
jest.mock('expo-image', () => ({ Image: () => null }));
const mockDragEnabled: boolean[] = [];
jest.mock('./DragTile', () => ({
  DragTile: ({ enabled, children }: { enabled: boolean; children: React.ReactNode }) => {
    mockDragEnabled.push(enabled);
    return children;
  },
}));
jest.mock('@/features/payments/HandoffCheckoutSheet', () => ({ HandoffCheckoutSheet: () => null }));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: { user: null }) => unknown) => sel({ user: null }), { getState: () => ({ user: null }) }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const book = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'b1', name: 'Ben and Raya', status, layout: 'grid', mediaCount: 2, photographerName: 'Joseph M.', sources: ['event'],
  mediaItems: [
    { id: 'p1', fileUrl: 'https://x/o.jpg', sourceType: 'event', original: true },
    { id: 'p2', fileUrl: 'https://x/t.jpg', sourceType: 'purchased', original: false, watermarked: true },
  ],
  ...extra,
});

const flat = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const mount = async (data: Record<string, unknown>, received = false) => {
  mockParams.received = received ? '1' : undefined;
  mockGetOk.mockResolvedValue({ action: 1, data });
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<Screen />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return r;
};
const button = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

beforeEach(() => {
  mockDragEnabled.length = 0;
  mockGetOk.mockReset();
  mockPost.mockReset();
});

describe('photobook detail as rendered', () => {
  it('a draft with photos offers Send to photographer and nothing else', async () => {
    const r = await mount(book('DRAFT'));
    expect(flat(r.root)).toContain('Draft');
    expect(button(r, 'Send to photographer')).toBeTruthy();
    expect(button(r, 'Accept book')).toBeUndefined();
  });

  it('ready to review offers Accept and Request changes, and an event book says accepting releases the final payment', async () => {
    const r = await mount(book('RESUBMITTED', { eventId: 'ev1' }));
    const text = flat(r.root);
    expect(text).toContain('Ready to review');
    expect(text).toContain("releases the event's final payment to the photographer");
    expect(button(r, 'Accept book')).toBeTruthy();
    expect(button(r, 'Request changes')).toBeTruthy();
  });

  it('a non-event book only says accepting completes it', async () => {
    const text = flat((await mount(book('RESUBMITTED'))).root);
    expect(text).toContain('Accepting completes the book.');
    expect(text).not.toContain('final payment');
  });

  it('Request changes opens a note box and sends the note to the request-changes endpoint', async () => {
    const r = await mount(book('RESUBMITTED'));
    await act(async () => button(r, 'Request changes').props.onPress());
    const box = r.root.findAll((n) => n.props?.accessibilityLabel === 'What should change?' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => box.props.onChangeText('Swap the cover'));
    mockPost.mockResolvedValue({ action: 1 });
    await act(async () => button(r, 'Send back').props.onPress());
    expect(mockPost).toHaveBeenCalledWith('/customer/events/photobook/b1/request-changes', { note: 'Swap the cover' });
  });

  it('a photo the viewer has not bought is marked Preview only, and a completed book by dismissal says closed', async () => {
    const text = flat((await mount(book('COMPLETED', { closedByPhotographer: true }))).root);
    expect(text).toContain('Preview only');
    expect(text).toContain('Closed by photographer');
    expect(text).toContain('The photographer closed this book.');
  });

  it('the photographer on a received book sees Send back for review and Close, with the sender', async () => {
    const r = await mount(book('SENT_TO_PHOTOGRAPHER', { senderName: 'Aline U.', photographerName: undefined }), true);
    const text = flat(r.root);
    expect(text).toContain('New to edit');
    expect(text).toContain('From Aline U.');
    expect(button(r, 'Send back for review')).toBeTruthy();
    expect(text).toContain('Close');
  });

  it('only the photographer editing a received book can drag photos', async () => {
    await mount(book('SENT_TO_PHOTOGRAPHER', { senderName: 'Aline U.' }), true);
    expect(mockDragEnabled.length).toBeGreaterThan(0);
    expect(mockDragEnabled.every(Boolean)).toBe(true);
    mockDragEnabled.length = 0;
    await mount(book('RESUBMITTED'));
    expect(mockDragEnabled.length).toBeGreaterThan(0);
    expect(mockDragEnabled.some(Boolean)).toBe(false);
  });

  it('an empty book says so instead of showing an empty grid', async () => {
    const text = flat((await mount(book('DRAFT', { mediaItems: [], mediaCount: 0 }))).root);
    expect(text).toContain('No photos left in this book');
  });
});
