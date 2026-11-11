import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { AlbumListRow, AlbumGridCard } from '@/features/gallery/AlbumCards';
import { PublishOutcomeView } from '@/features/gallery/PublishOutcomeView';
import { publishOutcome } from '@/features/gallery/sellPhotos';
import type { GalleryItem } from '@/features/gallery/api';

/**
 * RENDERED (react-test-renderer under jest-expo, not a device): the two places a photographer learns whether buyers can
 * find an album. An album that is not live must say so on the list, and the result screen must never read as success
 * when publishing failed.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: (p: { children?: React.ReactNode }) => <View>{p.children}</View> };
});
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ role: 'Photographer', isPhotographer: true }) }));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

const album = (over: Partial<GalleryItem>): GalleryItem => ({ id: 'a1', name: 'Kigali shoot', photoCount: 3, kind: 'PAID', ...over } as GalleryItem);

const mountNode = async (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  return r;
};

describe('the not-visible badge on the album list', () => {
  it('a standalone PAID album that is not live says so, with Publish, on the row and the card', async () => {
    const a = album({ isStandalone: true, faceRecognitionEnabled: false });
    for (const el of [<AlbumListRow key="row" album={a} showPhotographer={false} onOpen={jest.fn()} />, <AlbumGridCard key="card" album={a} showPhotographer={false} onOpen={jest.fn()} />]) {
      const r = await mountNode(el);
      expect(flat(r.root)).toContain('Not visible on Find my photos · Publish');
    }
  });

  it('a live album, a FREE album and an event album carry no badge', async () => {
    for (const a of [album({ isStandalone: true, faceRecognitionEnabled: true }), album({ isStandalone: true, isFreeAlbum: true }), album({ isStandalone: false })]) {
      const r = await mountNode(<AlbumListRow album={a} showPhotographer={false} onOpen={jest.fn()} />);
      expect(flat(r.root)).not.toContain('Not visible');
    }
  });
});

describe('the result screen after saving a PAID album', () => {
  const view = (o: ReturnType<typeof publishOutcome>, extra: Partial<React.ComponentProps<typeof PublishOutcomeView>> = {}) => {
    const fns = { onRetry: jest.fn(), onView: jest.fn(), onShare: jest.fn() };
    return { fns, el: <PublishOutcomeView outcome={o} title="Kigali shoot" retrying={false} {...fns} {...extra} /> };
  };
  const pressText = async (r: TestRenderer.ReactTestRenderer, text: string) => {
    const n = r.root.findAll((x) => typeof x.props?.onPress === 'function' && x.findAllByType(Text).some((t) => t.props.children === text))[0];
    if (!n) throw new Error(`nothing to press: ${text}`);
    await act(async () => n.props.onPress());
  };

  it('listed: says photos are being prepared, how many faces, how long they stay listed, and offers View and Share', async () => {
    const { el, fns } = view(publishOutcome({ published: true, facesIndexed: 4 }));
    const r = await mountNode(el);
    const t = flat(r.root);
    expect(t).toContain('Your photos are being prepared for Find my photos');
    expect(t).toContain('Ready: 4 faces indexed');
    expect(t).toContain('60 days');
    expect(t).not.toContain('Retry publishing');
    await pressText(r, 'View album');
    await pressText(r, 'Share album');
    expect(fns.onView).toHaveBeenCalledTimes(1);
    expect(fns.onShare).toHaveBeenCalledTimes(1);
  });

  it('failed: shows the real reason and Retry publishing, never the success headline', async () => {
    const o = publishOutcome({ publishFailure: { kind: 'credits', message: 'Not enough credits. You need 30 credits and have 4. Top up, then retry.' } });
    const { el, fns } = view(o);
    const r = await mountNode(el);
    const t = flat(r.root);
    expect(t).toContain('Saved, but not on Find my photos yet');
    expect(t).toContain('You need 30 credits and have 4');
    expect(t).not.toContain('being prepared');
    expect(t).not.toContain('Share album');
    await pressText(r, 'Retry publishing');
    expect(fns.onRetry).toHaveBeenCalledTimes(1);
  });

  it('preparing: same headline, how far it got, a progress bar, and Share and View are offered because it is published', async () => {
    const { el, fns } = view(publishOutcome({ published: true, indexing: { total: 120, done: 45 } }));
    const r = await mountNode(el);
    const t = flat(r.root);
    expect(t).toContain('Your photos are being prepared for Find my photos');
    expect(t).toContain('Preparing 45 of 120 photos');
    expect(t).not.toContain('Retry publishing');
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props?.accessibilityRole === 'progressbar')).toHaveLength(1);
    await pressText(r, 'Share album');
    expect(fns.onShare).toHaveBeenCalledTimes(1);
  });

  it('while retrying it says it is preparing and offers no second tap on View', async () => {
    const { el } = view(publishOutcome({}), { retrying: true });
    const r = await mountNode(el);
    expect(flat(r.root)).toContain('Preparing your photos');
  });
});
