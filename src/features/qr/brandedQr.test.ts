import { inflateSync } from 'zlib';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { qrPngBytes } from '@/features/wishes/qrPng';
import { BADGE_SHARE, buildBrandedQr } from './brandedQr';

/** Reads our own RGB PNG back (stored deflate, filter 0) so a real QR decoder can try it. */
function decode(png: Uint8Array) {
  const buf = Buffer.from(png);
  const width = buf.readUInt32BE(16);
  let off = 8;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * (width * 3 + 1) + 1 + x * 3;
      const o = (y * width + x) * 4;
      rgba[o] = raw[i];
      rgba[o + 1] = raw[i + 1];
      rgba[o + 2] = raw[i + 2];
      rgba[o + 3] = 255;
    }
  }
  return jsQR(rgba, width, width);
}

const payloads = [
  'https://connekyt.com/get-app',
  'https://connekyt.com/user/events/view-event?id=8bcd3a91-89da-424e-beb6-a6761c308c0a&src=qr',
  'https://connekyt.com/wish/8bcd3a91-89da-424e-beb6-a6761c308c0a?from=Grace',
  `https://connekyt.com/wish/8bcd3a91-89da-424e-beb6-a6761c308c0a?from=Jean-Luc%20Mukamana-Uwase&x=${'y'.repeat(80)}`,
];

describe('the app branded QR keeps its function', () => {
  it('covers under 6% of the modules with the logo badge, in a badge about a fifth of the width', () => {
    for (const p of payloads) {
      const q = buildBrandedQr(p);
      expect(q.covered).toBeLessThan(0.06);
      expect(q.badge.side / q.n).toBeGreaterThan(BADGE_SHARE - 0.06);
      expect(q.badge.side / q.n).toBeLessThan(0.3);
    }
  });

  it('leaves every module outside the badge exactly as the plain code has it, finder patterns and timing lines included', () => {
    const p = payloads[1];
    const plain = QRCode.create(p, { errorCorrectionLevel: 'H' }).modules;
    const q = buildBrandedQr(p, 0);
    const lo = q.badge.x;
    const hi = lo + q.badge.side - 1;
    for (let r = 0; r < plain.size; r++) {
      for (let c = 0; c < plain.size; c++) {
        const inside = r >= lo && r <= hi && c >= lo && c <= hi;
        expect(q.dark[r * q.n + c]).toBe(inside ? false : !!plain.get(r, c));
      }
    }
  });

  for (const p of payloads) {
    for (const scale of [4, 8]) {
      it(`the saved PNG is read back by a real decoder: ${p.length} characters at ${scale}px a module`, () => {
        expect(decode(qrPngBytes(p, scale, 4))?.data).toBe(p);
      });
    }
  }

  it('the saved PNG carries the logo: the middle is not plain white or navy', () => {
    const png = qrPngBytes(payloads[0], 8, 4);
    const buf = Buffer.from(png);
    const width = buf.readUInt32BE(16);
    const raw = inflateSync(Buffer.concat([buf.subarray(buf.indexOf('IDAT') + 4, buf.length - 12)]));
    const mid = Math.floor(width / 2);
    const colours = new Set<string>();
    for (let dy = -20; dy <= 20; dy += 4) for (let dx = -20; dx <= 20; dx += 4) {
      const i = (mid + dy) * (width * 3 + 1) + 1 + (mid + dx) * 3;
      colours.add(`${raw[i]},${raw[i + 1]},${raw[i + 2]}`);
    }
    expect(colours.size).toBeGreaterThan(8);
  });
});
