import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { getAlbum, normalizeImageUrl } from './api';
import { FallbackImage } from './FallbackImage';
import { encodeImageUrl, galleryThumbUrl, isGatedOriginal } from './imageUrls';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a) },
  requireOk: (r: unknown) => r,
}));

const mockImage = jest.fn();
jest.mock('expo-image', () => ({
  Image: (p: Record<string, unknown>) => {
    mockImage(p);
    return null;
  },
}));
jest.mock('@/services/storage', () => ({
  StorageKeys: { authToken: 'authToken' },
  storage: { get: jest.fn().mockResolvedValue('tok-123') },
}));

const ROOT = 'https://backend.connekyt.com';
// Names as stored in production: a timestamp prefix, then the phone's own file name.
const ORIGINAL = `${ROOT}/uploads/gallery/images/1773971384102WhatsApp Image 2026-03-19 at 21.34.35.jpeg`;
const THUMB = `${ROOT}/uploads/gallery/thumbs/1773971384102WhatsApp%20Image%202026-03-19%20at%2021.34.35.jpg`;
const PAREN = `${ROOT}/uploads/gallery/images/1773971384375WhatsApp Image 2026-03-19 at 21.34.36 (1).jpeg`;

describe('album image urls', () => {
  it('encodes spaces once, and leaves an encoded url alone', () => {
    expect(encodeImageUrl(ORIGINAL)).toContain('WhatsApp%20Image%202026');
    expect(encodeImageUrl(encodeImageUrl(ORIGINAL))).toBe(encodeImageUrl(ORIGINAL));
    expect(encodeImageUrl(`${ROOT}/uploads/x/100%.jpg`)).toContain('100%25.jpg');
  });

  it('derives the public thumbnail the way the backend names it (extension swapped to .jpg)', () => {
    expect(galleryThumbUrl(ORIGINAL)).toBe(THUMB);
    expect(galleryThumbUrl(PAREN)).toBe(
      `${ROOT}/uploads/gallery/thumbs/1773971384375WhatsApp%20Image%202026-03-19%20at%2021.34.36%20(1).jpg`,
    );
    expect(galleryThumbUrl(`${ROOT}/uploads/gallery/images/1792317761171photo-output.jpg`)).toBe(
      `${ROOT}/uploads/gallery/thumbs/1792317761171photo-output.jpg`,
    );
  });

  it('derives nothing for a url that is not a gallery original or not a raster image', () => {
    expect(galleryThumbUrl(undefined)).toBeUndefined();
    expect(galleryThumbUrl(`${ROOT}/uploads/event/photos/a.jpg`)).toBeUndefined();
    expect(galleryThumbUrl(`${ROOT}/uploads/gallery/images/clip.mp4`)).toBeUndefined();
    expect(galleryThumbUrl(`${ROOT}/uploads/gallery/thumbs/a.jpg`)).toBeUndefined();
    expect(isGatedOriginal(ORIGINAL)).toBe(true);
    expect(isGatedOriginal(THUMB)).toBe(false);
  });

  it('normalizeImageUrl returns an encoded url', () => {
    expect(normalizeImageUrl(ORIGINAL)).toContain('%20');
    expect(normalizeImageUrl('/uploads/gallery/images/a b.jpg')).toMatch(/a%20b\.jpg$/);
  });
});

describe('getAlbum', () => {
  it('points the grid at the public thumbnail and keeps the original for the viewer (paid albums refuse an unsigned original)', async () => {
    mockGet.mockResolvedValue({
      action: 1,
      data: {
        id: 'a1',
        title: 'Cards Album',
        coverImage: ORIGINAL,
        images: [{ id: 'i1', fileUrl: ORIGINAL }, { id: 'i2', fileUrl: PAREN }],
      },
    });
    const a = await getAlbum('a1', true);
    expect(a.images[0].url).toBe(THUMB);
    expect(a.images[0].fullUrl).toContain('/uploads/gallery/images/');
    expect(a.images[0].fullUrl).toContain('%20');
    expect(a.coverPhoto).toBe(THUMB);
    expect(a.coverFull).toContain('/uploads/gallery/images/');
  });

  it('uses the API thumbnail when it sends one', async () => {
    mockGet.mockResolvedValue({
      action: 1,
      data: { id: 'a1', images: [{ id: 'i1', fileUrl: ORIGINAL, thumbnailUrl: `${ROOT}/uploads/gallery/thumbs/own.jpg` }] },
    });
    const a = await getAlbum('a1');
    expect(a.images[0].url).toBe(`${ROOT}/uploads/gallery/thumbs/own.jpg`);
  });
});

describe('FallbackImage', () => {
  beforeEach(() => mockImage.mockClear());
  const last = () => mockImage.mock.calls[mockImage.mock.calls.length - 1][0] as {
    source: { uri: string; headers?: Record<string, string> };
    onError: () => void;
  };

  it('loads the thumbnail first, unsigned, then the original signed when the thumbnail fails', async () => {
    await act(async () => {
      TestRenderer.create(<FallbackImage uri={THUMB} fallbackUri={encodeImageUrl(ORIGINAL)} />);
    });
    expect(last().source).toEqual({ uri: THUMB, headers: undefined });
    await act(async () => {
      last().onError();
    });
    expect(last().source.uri).toBe(encodeImageUrl(ORIGINAL));
    expect(last().source.headers).toEqual({ Authorization: 'Bearer tok-123' });
  });

  it('never sends the token to a host that is not the app backend', async () => {
    await act(async () => {
      TestRenderer.create(<FallbackImage signed uri="https://cdn.example.test/uploads/gallery/images/a.jpg" />);
    });
    expect(last().source.headers).toBeUndefined();
  });

  it('signs the full-size request from the first attempt', async () => {
    await act(async () => {
      TestRenderer.create(<FallbackImage signed uri={encodeImageUrl(ORIGINAL)} />);
    });
    expect(last().source.headers).toEqual({ Authorization: 'Bearer tok-123' });
  });
});
