/**
 * The QR code the app shows: navy modules on white with the Connekyt logo icon in the middle (see brandedQr.ts for why it
 * still scans). One component for the event QR sheet, the live invite card and the wish invite tab.
 */
import { useMemo } from 'react';
import Svg, { Image as SvgImage, Path, Rect } from 'react-native-svg';
import { lightPalette, onFill } from '@/theme';
import { buildBrandedQr } from './brandedQr';

const MARK = require('../../../assets/images/qr-mark.jpg');

/** Navy on white in either theme, so it scans. */
export function BrandedQr({ value, size, fg = lightPalette.primary, bg = onFill, margin = 2, accessibilityLabel = 'QR code' }: { value: string; size: number | `${number}%`; fg?: string; bg?: string; margin?: number; accessibilityLabel?: string }) {
  const q = useMemo(() => buildBrandedQr(value, margin), [value, margin]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${q.size} ${q.size}`} accessibilityLabel={accessibilityLabel}>
      <Rect width={q.size} height={q.size} fill={bg} />
      <Path d={q.path} fill={fg} />
      <Rect x={q.badge.x} y={q.badge.y} width={q.badge.side} height={q.badge.side} rx={q.badge.side * 0.22} fill={bg} />
      <SvgImage href={MARK} x={q.mark.x} y={q.mark.y} width={q.mark.side} height={q.mark.side} preserveAspectRatio="xMidYMid meet" />
    </Svg>
  );
}
