/**
 * The wish link and a PNG of its QR code, built without any native module: the matrix from scanIntent.qrMatrix is
 * drawn into an 8-bit grayscale PNG with stored (uncompressed) deflate blocks. A 41-module code at 8 px is about
 * 110 KB, which is fine for "Save QR".
 */
import { qrMatrix } from '@/features/events/scanIntent';

export { wishLink } from './wishPage';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function chunk(type: string, data: Uint8Array): number[] {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}

/** Dark modules as black on white, with a quiet zone, each module `scale` pixels square. */
export function qrPngBytes(link: string, scale = 8, quiet = 4): Uint8Array {
  const { size, dark } = qrMatrix(link);
  const side = (size + quiet * 2) * scale;
  const raw = new Uint8Array((side + 1) * side); // one filter byte (0) per row
  for (let y = 0; y < side; y++) {
    const my = Math.floor(y / scale) - quiet;
    const row = y * (side + 1);
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const isDark = mx >= 0 && my >= 0 && mx < size && my < size && dark[my * size + mx];
      raw[row + 1 + x] = isDark ? 0 : 255;
    }
  }

  // zlib stream of stored blocks.
  const z: number[] = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const len = Math.min(65535, raw.length - i);
    z.push(i + len >= raw.length ? 1 : 0, len & 0xff, len >>> 8, ~len & 0xff, (~len >>> 8) & 0xff);
    for (let j = 0; j < len; j++) z.push(raw[i + j]);
  }
  z.push(...u32(adler32(raw)));

  const ihdr = new Uint8Array([...u32(side), ...u32(side), 8, 0, 0, 0, 0]); // 8-bit grayscale
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', new Uint8Array(z)),
    ...chunk('IEND', new Uint8Array(0)),
  ]);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}
