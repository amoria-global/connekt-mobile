import { inflateSync } from 'zlib';
import { bytesToBase64, qrPngBytes, wishLink } from './qrPng';
import { qrMatrix } from '@/features/events/scanIntent';
import { hideOwnWish, listHostWishes, listWishes, mapWish, moderateWish } from './api';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock('@/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) } }));
jest.mock('@/utils/deviceId', () => ({ getDeviceId: async () => 'device-1' }));

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
});

describe('wish link and QR PNG', () => {
  it('points at the public event page on its wishes tab', () => {
    expect(wishLink('ev 1')).toBe('https://connekyt.com/user/events/view-event?id=ev%201&tab=wishes');
  });

  it('writes a valid PNG whose pixels are the QR modules', () => {
    const link = wishLink('abc');
    const png = qrPngBytes(link, 4, 2);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const buf = Buffer.from(png);
    const { size, dark } = qrMatrix(link);
    const side = (size + 4) * 4;
    expect(buf.readUInt32BE(16)).toBe(side);
    expect(buf.readUInt32BE(20)).toBe(side);

    // Chunks: IHDR, IDAT, IEND. Check the lengths chain to the end and read the pixel data back.
    let pos = 8;
    const types: string[] = [];
    let idat = Buffer.alloc(0);
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString('ascii', pos + 4, pos + 8);
      types.push(type);
      if (type === 'IDAT') idat = buf.subarray(pos + 8, pos + 8 + len);
      pos += 12 + len;
    }
    expect(pos).toBe(buf.length);
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);

    const raw = inflateSync(idat);
    expect(raw.length).toBe((side + 1) * side);
    const px = (mx: number, my: number) => raw[(my * 4 + 2 + 0) * (side + 1) + 1 + mx * 4 + 2 + 8];
    // The top-left finder pattern corner module is dark, and the quiet zone is white.
    expect(dark[0]).toBe(true);
    expect(raw[1 + 0]).toBe(255);
    expect(raw[(2 * 4) * (side + 1) + 1 + 2 * 4]).toBe(0);
    expect(px(0, 0)).toBeDefined();
  });

  it('encodes base64 like Buffer does', () => {
    for (const s of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
      expect(bytesToBase64(new Uint8Array(Buffer.from(s)))).toBe(Buffer.from(s).toString('base64'));
    }
    const png = qrPngBytes(wishLink('x'), 2, 1);
    expect(bytesToBase64(png)).toBe(Buffer.from(png).toString('base64'));
  });
});

describe('wish mapping and calls', () => {
  it('maps a backend wish, defaulting to a private pending text wish', () => {
    expect(mapWish({ id: 'w1' })).toMatchObject({ id: 'w1', type: 'text', visibility: 'private', status: 'pending', mine: false, authorName: 'Guest' });
    expect(mapWish({ id: 'w2', type: 'VIDEO', duration: '41', visibility: 'PUBLIC', status: 'APPROVED', mine: true, videoUrl: 'https://v', thumbnailUrl: 'https://t' }))
      .toMatchObject({ type: 'video', durationSeconds: 41, visibility: 'public', status: 'approved', mine: true });
  });

  it('lists the public feed with the device so the caller\'s own wishes are flagged', async () => {
    mockGet.mockResolvedValue({ action: 1, data: { items: [{ id: 'w1', message: 'Hi' }, { message: 'no id' }], page: 0, totalPages: 2, total: 7 } });
    const page = await listWishes('e1', 0, 20);
    expect(page.items.map((w) => w.id)).toEqual(['w1']);
    expect(page).toMatchObject({ totalPages: 2, total: 7 });
    expect(mockGet.mock.calls[0][0]).toContain('/public/events/e1/wishes?page=0&size=20&deviceFingerprint=device-1');
    expect(mockGet.mock.calls[0][1]).toEqual({ skipAuth: true });
  });

  it('treats HTTP 200 with action 0 as an error', async () => {
    mockGet.mockResolvedValue({ action: 0, message: 'Nope' });
    await expect(listWishes('e1')).rejects.toMatchObject({ message: 'Nope' });
    mockPost.mockResolvedValue({ action: 0, message: 'Not yours' });
    await expect(hideOwnWish('e1', 'w1')).rejects.toMatchObject({ message: 'Not yours' });
  });

  it('hides a wish by device and moderates through the host routes', async () => {
    mockPost.mockResolvedValue({ action: 1 });
    await hideOwnWish('e1', 'w1');
    expect(mockPost).toHaveBeenCalledWith('/public/events/e1/wishes/w1/hide', { deviceFingerprint: 'device-1' }, { skipAuth: true });

    mockGet.mockResolvedValue({ action: 1, data: [{ id: 'w1', status: 'PENDING', visibility: 'PUBLIC' }] });
    expect((await listHostWishes('e1'))[0]).toMatchObject({ status: 'pending', visibility: 'public' });

    mockPut.mockResolvedValue({ action: 1, data: { id: 'w1', status: 'APPROVED', visibility: 'PUBLIC' } });
    expect((await moderateWish('e1', 'w1', 'approved')).status).toBe('approved');
    expect(mockPut).toHaveBeenCalledWith('/photographer/events/e1/wishes/w1/moderation', { status: 'APPROVED' });
  });
});
