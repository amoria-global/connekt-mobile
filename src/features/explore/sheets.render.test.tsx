import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

/** RENDERED item sheet and "I already bought this" sheet: they mount, and a store build shows no price or Buy. */
import '@/test/autoUnmount';
import { ItemSheet } from './ItemSheet';
import { OwnedSheet } from './OwnedSheet';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockDigital = false;
jest.mock('@/features/payments/policy', () => ({ get digitalPurchasesEnabled() { return mockDigital; }, giftsEnabled: true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ addListener: () => ({ remove: () => {} }), play: () => {}, muted: true }), VideoView: () => null }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', downloadAsync: async () => ({ status: 200, uri: 'file:///cache/x.mp4' }) }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassScene: ({ children }: { children?: React.ReactNode }) => children ?? null }));
jest.mock('@/components/ui/GlassCard', () => ({ ...jest.requireActual('@/components/ui/GlassCard'), GlassScene: ({ children }: { children?: React.ReactNode }) => children ?? null }));
jest.mock('@/features/photos/PhotoCheckoutSheet', () => ({ PhotoCheckoutSheet: () => null }));
jest.mock('@/utils/gallerySaver', () => ({ savePhotoToGallery: async () => ({ success: true }) }));

const photo = {
  id: 'p1', albumId: 'a', mediaType: 'PHOTO' as const, title: 'Kigali dusk', categoryLabel: 'Nature', creatorName: 'Aline Uwase', creatorLogo: null,
  thumbnailUrl: 'https://e.test/t.jpg', previewUrl: 'https://e.test/v.jpg', previewVideoUrl: null, durationSeconds: null, aspectRatio: 1.4,
  priceAmount: 5, priceCurrency: 'USD', tags: ['sunset'],
};
const clip = { ...photo, id: 'c1', mediaType: 'VIDEO' as const, previewVideoUrl: 'https://e.test/c.m3u8', durationSeconds: 100 };

const flat = (node: ReactTestInstance): string =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? ''))).join(' | ');

async function render(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(el); });
  return r;
}

describe('Explore sheets as rendered', () => {
  it('a store build shows a photo without a price or a Buy button', async () => {
    mockDigital = false;
    const text = flat((await render(<ItemSheet item={photo} saved={false} onSave={() => {}} onClose={() => {}} />)).root);
    expect(text).toContain('Kigali dusk');
    expect(text).toContain('#sunset');
    expect(text).not.toMatch(/\$|USD|price|Buy|cart|licen/i);
  });

  it('a store build shows a clip without a price or a Buy button', async () => {
    mockDigital = false;
    const text = flat((await render(<ItemSheet item={clip} saved onSave={() => {}} onClose={() => {}} />)).root);
    expect(text).not.toMatch(/\$|USD|price|Buy|cart|licen/i);
  });

  it('a web build shows the price, the Buy bar and the licence chip', async () => {
    mockDigital = true;
    const text = flat((await render(<ItemSheet item={photo} saved={false} onSave={() => {}} onClose={() => {}} />)).root);
    expect(text).toMatch(/\$5|5\.00|USD/);
    expect(text).toMatch(/Buy · /);
    expect(text).toMatch(/Personal & social/);
  });

  it('the "already bought" sheet mounts with the code field and the email recovery', async () => {
    mockDigital = false;
    const text = flat((await render(<OwnedSheet onClose={() => {}} />)).root);
    expect(text).toMatch(/I already bought this/);
    expect(text).toMatch(/unlock code/i);
    expect(text).toMatch(/Send me a link/);
    expect(text).not.toMatch(/\$|price|Buy now|checkout|cart/i);
  });
});
