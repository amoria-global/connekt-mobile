import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import GalleryScreen from '@/app/(app)/gallery';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real Albums screen over a faked API
 * module. Cards used to say "0 photos" when the API sent no count, filled the line under the title with invented
 * words ("Event Collection", "Photo Vault"), and drew a count of 0 albums while the list was still loading.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockList = jest.fn();
jest.mock('@/features/gallery/api', () => ({ listAlbums: (...a: unknown[]) => mockList(...a) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: (p: { children?: React.ReactNode }) => <View>{p.children}</View> };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/store/auth', () => ({ isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object) }));
const mockRole = { role: 'Client', isPhotographer: false };
jest.mock('@/features/auth/role', () => ({ useRole: () => mockRole }));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<GalleryScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

const album = (o: Record<string, unknown>) => ({ id: 'a1', name: 'Amina Birthday', kind: 'EVENT', coverPhoto: 'c.jpg', photoCount: 240, date: '2026-09-30', photographer: 'Jean', ...o });

beforeEach(() => {
  mockList.mockReset().mockResolvedValue([]);
  mockPush.mockReset();
  mockRole.role = 'Client';
  mockRole.isPhotographer = false;
});

describe('albums as rendered', () => {
  it('a client sees the latest delivery hero and cards with the real count, date and photographer', async () => {
    mockList.mockResolvedValue([album({}), album({ id: 'a2', name: 'Corporate Launch', photoCount: 1, date: '2026-10-10', photographer: 'Grace' })]);
    const text = flat((await mount()).root);
    expect(text).toContain('LATEST DELIVERY');
    expect(text).toContain('240 photos');
    expect(text).toContain('1 photo');
    expect(text).toContain('30 Sep 2026 · Jean');
    expect(text).toContain('10 Oct 2026 · Grace');
  });

  it('a photographer gets no hero and no photographer line on their own albums', async () => {
    mockRole.role = 'Photographer';
    mockRole.isPhotographer = true;
    mockList.mockResolvedValue([album({})]);
    const text = flat((await mount()).root);
    expect(text).not.toContain('LATEST DELIVERY');
    expect(text).toContain('30 Sep 2026');
    expect(text).not.toContain('Jean');
  });

  it('an album with no count shows no count, and no invented subtitle', async () => {
    mockList.mockResolvedValue([album({ photoCount: undefined, date: undefined, photographer: undefined, coverPhoto: undefined })]);
    const text = flat((await mount()).root);
    expect(text).not.toMatch(/0 photos|Event Collection|Photo Vault|Photo collection/);
    expect(text).toContain('Amina Birthday');
  });

  it('a locked album is never the hero', async () => {
    mockList.mockResolvedValue([album({ locked: true })]);
    expect(flat((await mount()).root)).not.toContain('LATEST DELIVERY');
  });

  it('a failed read is an error with Try again, not an empty vault, and no "0" album count', async () => {
    mockList.mockRejectedValue({ message: 'Offline' });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load albums');
    expect(text).not.toContain('No galleries shared');
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Try again' && typeof n.props.onPress === 'function').length).toBeGreaterThan(0);
  });

  it('tapping a card opens that album', async () => {
    mockList.mockResolvedValue([album({ id: 'a9', name: 'Beach Portraits', coverPhoto: undefined })]);
    const r = await mount();
    const card = r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Beach Portraits') && typeof n.props.onPress === 'function')[0];
    await act(async () => card.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/album/a9');
  });
});
