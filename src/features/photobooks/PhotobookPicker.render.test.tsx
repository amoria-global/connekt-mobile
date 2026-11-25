import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import Screen from '@/app/(app)/photobook/new';

/**
 * RENDERED New photobook picker (react-test-renderer, not a device) over a faked transport: albums with their source
 * chip, only the photos the server lists, the one-photographer rule (other photographers' albums switch off once a photo
 * is chosen), numbered selection, the free limit and extras for an event book, and the request that is sent.
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
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View, SafeAreaProvider: View };
});
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: { user: null }) => unknown) => sel({ user: null }), { getState: () => ({ user: null }) }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const albums = [
  { id: 'a1', title: 'Wedding', sourceType: 'event', priced: false, photoCount: 4, usableCount: 4, ownerId: 'p1', ownerName: 'Joseph M.', eventId: 'ev1', eventTitle: 'Ben and Raya' },
  { id: 'a2', title: 'Kigali streets', sourceType: 'free', priced: false, photoCount: 2, usableCount: 2, ownerId: 'p1', ownerName: 'Joseph M.' },
  { id: 'a3', title: 'Sunset', sourceType: 'purchased', priced: true, photoCount: 12, usableCount: 2, ownerId: 'p2', ownerName: 'Aline U.' },
];
const photos: Record<string, { id: string; thumbUrl: string; sourceType: string }[]> = {
  a1: [1, 2, 3, 4].map((n) => ({ id: `e${n}`, thumbUrl: `https://x/e${n}.jpg`, sourceType: 'event' })),
  a2: [1, 2].map((n) => ({ id: `f${n}`, thumbUrl: `https://x/f${n}.jpg`, sourceType: 'free' })),
  a3: [1, 2].map((n) => ({ id: `s${n}`, thumbUrl: `https://x/s${n}.jpg`, sourceType: 'purchased' })),
};

const flat = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const press = async (n: ReactTestInstance) => act(async () => n.props.onPress());
const byText = (r: TestRenderer.ReactTestRenderer, text: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => [t.props.children].flat().join('').startsWith(text)))[0];
const albumRow = (r: TestRenderer.ReactTestRenderer, title: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityRole === 'button' && flat(n).includes(title))
    .sort((a, b) => flat(a).length - flat(b).length)[0];
const photoBoxes = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => n.props?.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function');

beforeEach(() => {
  mockGetOk.mockReset();
  mockPost.mockReset();
  mockReplace.mockReset();
  mockGetOk.mockImplementation(async (path: string) => {
    if (path.endsWith('/photobook/sources')) return { action: 1, data: albums };
    const m = /sources\/([^/]+)\/photos/.exec(path);
    if (m) return { action: 1, data: { total: photos[m[1]].length, items: photos[m[1]] } };
    if (path.includes('/photobook/pricing')) return { action: 1, data: { freePhotosLimit: 2, pricePerExtraPhoto: 1000, title: 'Ben and Raya' } };
    return { action: 1, data: {} };
  });
});

const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<Screen />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return r;
};

describe('new photobook picker as rendered', () => {
  it('lists each album with its source chip, and no media-id box', async () => {
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Wedding');
    expect(text).toContain('Event album');
    expect(text).toContain('Free album');
    expect(text).toContain('Purchased');
    expect(text).toContain('2/12'); // paid: usable of total
    expect(text).not.toMatch(/MEDIA IDS|paste/i);
  });

  it('numbers photos in the order they are ticked and shows the free limit for an event book', async () => {
    const r = await mount();
    await press(albumRow(r, 'Wedding'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(photoBoxes(r)).toHaveLength(4);
    await press(photoBoxes(r)[2]);
    await press(photoBoxes(r)[0]);
    const text = flat(r.root);
    expect(text).toContain('2 selected');
    expect(text).toContain('1'); // numbered tick
    await act(async () => {
      await Promise.resolve();
    });
    expect(flat(r.root)).toContain('Free up to 2 for this event');
  });

  it('switches off another photographer once a photo is chosen, and says why', async () => {
    const r = await mount();
    await press(albumRow(r, 'Wedding'));
    await act(async () => {
      await Promise.resolve();
    });
    await press(photoBoxes(r)[0]);
    await press(byText(r, 'Albums'));
    const sunset = albumRow(r, 'Sunset');
    expect(sunset.props.accessibilityState).toMatchObject({ disabled: true });
    expect(flat(r.root)).toContain("A book can use one photographer's photos");
  });

  it('creates the book with the chosen photos in order and the event, then opens it', async () => {
    const r = await mount();
    await press(albumRow(r, 'Wedding'));
    await act(async () => {
      await Promise.resolve();
    });
    await press(photoBoxes(r)[1]);
    await press(photoBoxes(r)[0]);
    await press(byText(r, 'Next'));
    const name = r.root.findAll((n) => n.props?.accessibilityLabel === 'Book name' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => name.props.onChangeText('Our day'));
    mockPost.mockResolvedValue({ action: 1, data: { id: 'b9', name: 'Our day' } });
    await press(byText(r, 'Create photobook'));
    const call = mockPost.mock.calls.find((c) => c[0] === '/customer/events/photobook');
    expect(call?.[1]).toMatchObject({ name: 'Our day', mediaIds: ['e2', 'e1'], eventId: 'ev1', layout: 'grid' });
    expect(mockReplace).toHaveBeenCalledWith('/photobook/b9');
  });
});
