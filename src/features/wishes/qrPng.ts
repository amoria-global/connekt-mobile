/**
 * The wish link and a PNG of its QR code, built without any native module: the branded matrix (src/features/qr) is
 * drawn into an 8-bit RGB PNG with stored (uncompressed) deflate blocks, the logo composited in. A 45-module code at 8 px
 * is about 550 KB, which is fine for "Save QR".
 */
import { BRAND_MARK_RGB_BASE64, BRAND_MARK_SIZE } from '@/features/qr/brandMarkPixels';
import { buildBrandedQr, NAVY_RGB } from '@/features/qr/brandedQr';

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

const B64_LOOKUP = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < 64; i++) m['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[i]] = i;
  return m;
})();

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64_LOOKUP[clean[i]] << 18) | (B64_LOOKUP[clean[i + 1]] << 12) | ((B64_LOOKUP[clean[i + 2]] ?? 0) << 6) | (B64_LOOKUP[clean[i + 3]] ?? 0);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}

let markPixels: Uint8Array | null = null;
/** The logo at 96 x 96, three bytes (RGB) a pixel. */
const mark = () => (markPixels ??= base64ToBytes(BRAND_MARK_RGB_BASE64));

/** Bilinear sample of the logo at (u, v) in 0..1. */
function sampleMark(u: number, v: number): [number, number, number] {
  const px = mark();
  const N = BRAND_MARK_SIZE;
  const x = Math.min(N - 1.001, Math.max(0, u * N - 0.5));
  const y = Math.min(N - 1.001, Math.max(0, v * N - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (xx: number, yy: number, c: number) => px[(yy * N + xx) * 3 + c];
  const out: number[] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const top = at(x0, y0, c) * (1 - fx) + at(x0 + 1, y0, c) * fx;
    const bot = at(x0, y0 + 1, c) * (1 - fx) + at(x0 + 1, y0 + 1, c) * fx;
    out[c] = Math.round(top * (1 - fy) + bot * fy);
  }
  return out as [number, number, number];
}

/**
 * The QR as an RGB PNG: navy modules on white with a quiet zone (each module `scale` pixels square) and the Connekyt logo
 * icon in a white rounded badge in the middle. Built by the same rules as the on-screen code (src/features/qr).
 */
export function qrPngBytes(link: string, scale = 8, quiet = 4): Uint8Array {
  const q = buildBrandedQr(link, quiet);
  const side = q.size * scale;
  const stride = side * 3 + 1;
  const raw = new Uint8Array(stride * side); // one filter byte (0) per row
  const bx = q.badge.x * scale;
  const bs = q.badge.side * scale;
  const radius = bs * 0.22;
  const mx = q.mark.x * scale;
  const ms = q.mark.side * scale;
  const insideBadge = (x: number, y: number) => {
    if (x < bx || y < bx || x >= bx + bs || y >= bx + bs) return false;
    const dx = Math.max(bx + radius - x, 0, x - (bx + bs - radius));
    const dy = Math.max(bx + radius - y, 0, y - (bx + bs - radius));
    return dx * dx + dy * dy <= radius * radius;
  };
  for (let y = 0; y < side; y++) {
    const my = Math.floor(y / scale) - quiet;
    const row = y * stride;
    for (let x = 0; x < side; x++) {
      const mxm = Math.floor(x / scale) - quiet;
      let rgb: [number, number, number] = [255, 255, 255];
      if (mxm >= 0 && my >= 0 && mxm < q.n && my < q.n && q.dark[my * q.n + mxm]) rgb = NAVY_RGB;
      if (insideBadge(x, y)) {
        rgb = [255, 255, 255];
        if (x >= mx && y >= mx && x < mx + ms && y < mx + ms) rgb = sampleMark((x - mx) / ms, (y - mx) / ms);
      }
      const o = row + 1 + x * 3;
      raw[o] = rgb[0];
      raw[o + 1] = rgb[1];
      raw[o + 2] = rgb[2];
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

  const ihdr = new Uint8Array([...u32(side), ...u32(side), 8, 2, 0, 0, 0]); // 8-bit RGB
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
