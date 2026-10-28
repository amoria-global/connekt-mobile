/**
 * Every QR code the app draws is made here: navy modules on white with the Connekyt logo icon in the middle. The same
 * maths runs on the web (lib/qr/brandedQr.ts) and in the backend (QrLogo), so a code looks the same everywhere.
 *
 * It still scans because of three rules, which the tests pin and decode with a real reader:
 *   1. Error correction is always H (a third of the code can be lost).
 *   2. The white badge behind the logo covers about 21% of the code's width, under 6% of its modules. Nothing outside the
 *      badge is touched, so the corner finder patterns and the timing lines stay whole.
 *   3. The code keeps a white margin (the quiet zone) around it.
 */
import QRCode from 'qrcode';

export const NAVY_RGB: [number, number, number] = [8, 58, 133];
/** The badge's share of the code's width; the mark fills most of it. */
export const BADGE_SHARE = 0.21;
export const MARK_FILL = 0.84;

export type BrandedQr = {
  /** Modules per side (no margin). */
  n: number;
  /** Side of the drawing in module units, margin included. */
  size: number;
  /** Row-major dark modules, the badge area already cleared. */
  dark: boolean[];
  /** SVG path of the dark modules. */
  path: string;
  /** The badge square and the mark inside it, in module units (margin included). */
  badge: { x: number; y: number; side: number };
  mark: { x: number; y: number; side: number };
  /** Modules covered by the badge as a share of all modules. */
  covered: number;
};

export function buildBrandedQr(value: string, margin = 2): BrandedQr {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  let side = Math.max(5, Math.round(n * BADGE_SHARE));
  if ((n - side) % 2 !== 0) side += 1; // centred on the module grid
  const start = (n - side) / 2;
  const end = start + side - 1;
  const dark: boolean[] = new Array(n * n);
  let path = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      const on = (cc: number) => qr.modules.data[r * n + cc] === 1 && !(r >= start && r <= end && cc >= start && cc <= end);
      if (on(c)) {
        const from = c;
        while (c < n && on(c)) {
          dark[r * n + c] = true;
          c++;
        }
        path += `M${from + margin} ${r + margin}h${c - from}v1h-${c - from}z`;
      } else {
        dark[r * n + c] = false;
        c++;
      }
    }
  }
  const markSide = side * MARK_FILL;
  const markOff = start + (side - markSide) / 2;
  return {
    n,
    size: n + margin * 2,
    dark,
    path,
    badge: { x: start + margin, y: start + margin, side },
    mark: { x: markOff + margin, y: markOff + margin, side: markSide },
    covered: (side * side) / (n * n),
  };
}
