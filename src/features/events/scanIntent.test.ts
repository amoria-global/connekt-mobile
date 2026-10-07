const mockMem = new Map<string, string>();

jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockMem.get(k) ?? null,
    set: async (k: string, v: string) => {
      mockMem.set(k, v);
    },
    remove: async (k: string) => {
      mockMem.delete(k);
    },
  },
}));

import {
  PENDING_SCAN_TTL_MS,
  eventQrLink,
  qrMatrix,
  sanitizeEventId,
  setPendingScanEvent,
  takePendingScanEvent,
} from '@/features/events/scanIntent';

beforeEach(() => mockMem.clear());

describe('sanitizeEventId', () => {
  it('accepts uuid and short ids', () => {
    expect(sanitizeEventId('3f2a9c1e-77b0-4c1e-9d55-0a1b2c3d4e5f')).toBe('3f2a9c1e-77b0-4c1e-9d55-0a1b2c3d4e5f');
    expect(sanitizeEventId('1234')).toBe('1234');
  });

  it('takes the first value of a repeated route param', () => {
    expect(sanitizeEventId(['abc', 'def'])).toBe('abc');
  });

  it('rejects anything that could be used to steer navigation', () => {
    expect(sanitizeEventId('../login')).toBeNull();
    expect(sanitizeEventId('a/b')).toBeNull();
    expect(sanitizeEventId('x?y=1')).toBeNull();
    expect(sanitizeEventId('')).toBeNull();
    expect(sanitizeEventId(undefined)).toBeNull();
    expect(sanitizeEventId('a'.repeat(65))).toBeNull();
  });
});

describe('pending scanned event', () => {
  it('is delivered once, then cleared', async () => {
    await setPendingScanEvent('evt-1', 1_000);
    expect(await takePendingScanEvent(2_000)).toBe('evt-1');
    expect(await takePendingScanEvent(2_000)).toBeNull();
  });

  it('is dropped, and still cleared, when the scan is stale', async () => {
    await setPendingScanEvent('evt-1', 1_000);
    expect(await takePendingScanEvent(1_000 + PENDING_SCAN_TTL_MS + 1)).toBeNull();
    expect(mockMem.size).toBe(0);
  });

  it('ignores a corrupted stored value', async () => {
    mockMem.set('connekt.pendingScanEvent', '../etc|nope');
    expect(await takePendingScanEvent()).toBeNull();
  });
});

describe('eventQrLink', () => {
  it('matches the link the dashboards encode, flagged as a QR visit', () => {
    expect(eventQrLink('evt-1')).toBe('https://connekyt.com/user/events/view-event?id=evt-1&src=qr');
  });
});

describe('qrMatrix', () => {
  it('returns a square matrix with finder patterns in three corners', () => {
    const { size, dark } = qrMatrix(eventQrLink('evt-1'));
    expect(dark).toHaveLength(size * size);
    // Finder pattern: top-left, top-right and bottom-left corner modules are dark.
    expect(dark[0]).toBe(true);
    expect(dark[size - 1]).toBe(true);
    expect(dark[(size - 1) * size]).toBe(true);
    // The bottom-right corner has no finder pattern.
    expect(dark[size * size - 1]).toBe(false);
  });
});
